// Trellis — Feature #19: Google Calendar sync
//
// Runs on a schedule (pg_cron, every 15 min — see the cron migration once
// one exists; not scheduled yet, this only runs when invoked manually or
// by a future scheduled trigger). For every row in calendar_connections,
// refreshes the access token, pulls events in a window matching what the
// board actually shows, and upserts them into `events` via
// upsert_google_event() (017_google_calendar_sync_fn.sql) — never a plain
// .upsert(), because that function's ON CONFLICT has to repeat the partial
// index's WHERE clause, which supabase-js has no way to express.
//
// Secrets this needs, in the Supabase project's Edge Function settings:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Function runtime — do not set them by hand.
//
// UNTESTED against a real Google account — there is no OAuth client yet to
// test against. Written carefully, matching Google Calendar API's
// documented shapes, but treat this the way this codebase treats any
// first-guess number: verify against a real sync before trusting it.

import { createClient } from 'npm:@supabase/supabase-js@2'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const googleEventsUrl = (calendarId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

// Matches loadEvents' own window in Wall.jsx closely enough — wider on both
// ends so paging a week or two away from today still shows synced events
// rather than a gap only Trellis-native events fill.
const WINDOW_BEFORE_DAYS = 7
const WINDOW_AFTER_DAYS = 60

interface GoogleEvent {
  id: string
  status?: string
  summary?: string
  start?: { date?: string; dateTime?: string }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.access_token as string
}

async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(googleEventsUrl(calendarId))
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('maxResults', '250')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Calendar list failed: ${res.status} ${await res.text()}`)
    const json = await res.json()
    events.push(...(json.items ?? []))
    pageToken = json.nextPageToken
  } while (pageToken)

  return events
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: connections, error: connError } = await supabase
    .from('calendar_connections')
    .select('id, household_id, profile_id, calendar_id, refresh_token')

  if (connError) {
    return new Response(JSON.stringify({ error: connError.message }), { status: 500 })
  }

  const timeMin = new Date(Date.now() - WINDOW_BEFORE_DAYS * 86_400_000).toISOString()
  const timeMax = new Date(Date.now() + WINDOW_AFTER_DAYS * 86_400_000).toISOString()

  const results = []

  for (const conn of connections ?? []) {
    try {
      const accessToken = await refreshAccessToken(conn.refresh_token)
      const googleEvents = await fetchGoogleEvents(accessToken, conn.calendar_id, timeMin, timeMax)
      const live = googleEvents.filter(
        (g) => g.status !== 'cancelled' && (g.start?.date || g.start?.dateTime)
      )

      for (const g of live) {
        const allDay = !!g.start?.date
        const { error: upsertError } = await supabase.rpc('upsert_google_event', {
          p_household_id: conn.household_id,
          p_owner_id: conn.profile_id,
          p_external_id: g.id,
          p_title: g.summary ?? '(untitled)',
          p_starts_at: allDay ? `${g.start!.date}T00:00:00Z` : g.start!.dateTime,
          p_all_day: allDay,
        })
        if (upsertError) throw upsertError
      }

      // Reconcile deletions: anything previously synced for this
      // connection, in this window, that Google no longer returned —
      // removed from Google, or simply outside the window now.
      const seenIds = new Set(live.map((g) => g.id))
      const { data: existing } = await supabase
        .from('events')
        .select('id, external_id')
        .eq('source', 'google')
        .eq('owner_id', conn.profile_id)
        .gte('starts_at', timeMin)
        .lt('starts_at', timeMax)

      const toDelete = (existing ?? [])
        .filter((e) => e.external_id && !seenIds.has(e.external_id))
        .map((e) => e.id)

      if (toDelete.length > 0) {
        await supabase.from('events').delete().in('id', toDelete)
      }

      await supabase
        .from('calendar_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', conn.id)

      results.push({ profile_id: conn.profile_id, synced: live.length, deleted: toDelete.length })
    } catch (err) {
      // One connection failing (an expired refresh token, Google briefly
      // down) must not stop the others from syncing.
      results.push({ profile_id: conn.profile_id, error: String(err) })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
