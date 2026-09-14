// Trellis — Feature #19: the client's half of connecting a Google Calendar.
//
// Starting the OAuth flow needs no secret — only the client ID (public by
// design for a web OAuth client) and where to send the browser. The token
// exchange, which does need the client secret, happens entirely in
// google-oauth-callback (supabase/functions/), never here.

/** functions/v1/<name> — Supabase's standard Edge Function URL shape. */
function functionsUrl(name) {
  const base = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')
  return `${base}/functions/v1/${name}`
}

/**
 * True once VITE_GOOGLE_CLIENT_ID is actually set. Settings uses this to
 * show "Connect" as a real button or as an explanation of what's still
 * missing — the button should never silently redirect to a broken URL.
 */
export function googleCalendarConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
}

/**
 * Sends the browser to Google's consent screen. `state` carries who's
 * connecting — see the "unsigned state" comment in
 * google-oauth-callback/index.ts for why that's an acceptable
 * simplification here rather than a real gap.
 *
 * access_type=offline + prompt=consent together are what make Google
 * actually hand back a refresh_token — without prompt=consent, a second
 * authorization from the same account returns none at all, silently.
 */
export function startGoogleCalendarConnect(profileId, householdId) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', import.meta.env.VITE_GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', functionsUrl('google-oauth-callback'))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', `${profileId}:${householdId}`)
  window.location.href = url.toString()
}
