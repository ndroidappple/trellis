// Trellis — Feature #19: Google OAuth callback
//
// Google redirects the browser here after consent, with `code` and
// `state` query params — a real page navigation, not a fetch, so this
// can't require an Authorization header the way the rest of the app's
// requests do. This exchanges the code for tokens (needs the client
// secret, which is why this has to be server-side at all) and stores the
// refresh token, then redirects back into the app.
//
// `state` carries `profileId:householdId` in plain text, unsigned. That's
// a deliberate simplification, not an oversight: the only people who can
// ever reach this callback with a valid `code` at all are the two accounts
// in handle_new_user()'s allowlist (001_initial_schema.sql) — nobody else
// can sign in to construct the initial request in the first place, and
// this app has no finer-grained authorization anywhere else either. A
// signed/opaque state is the correct hardening if that trust model ever
// changes; not required for a two-person household app today.
//
// Secrets this needs:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   APP_URL — e.g. https://trellis-seven-sigma.vercel.app, where the
//     browser gets sent back to when this is done
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are automatic.
//
// UNTESTED — same caveat as sync-google-calendar/index.ts. No OAuth client
// exists yet to run this against.

import { createClient } from 'npm:@supabase/supabase-js@2'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const appUrl = Deno.env.get('APP_URL') ?? '/'

  if (!code || !state) {
    return Response.redirect(`${appUrl}?calendar=error`, 302)
  }

  const [profileId, householdId] = state.split(':')
  if (!profileId || !householdId) {
    return Response.redirect(`${appUrl}?calendar=error`, 302)
  }

  try {
    const redirectUri = `${url.origin}${url.pathname}`

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`)
    }

    const tokens = await tokenRes.json()
    if (!tokens.refresh_token) {
      // Google only returns a refresh token the FIRST time an account
      // consents (or when the consent screen is forced with prompt=consent,
      // which the client-side redirect always sets — see the comment where
      // that URL is built). Without one, this connection can never be
      // synced again without asking the person to reconnect.
      throw new Error('No refresh_token in response — was prompt=consent set on the auth request?')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await supabase.from('calendar_connections').upsert(
      {
        profile_id: profileId,
        household_id: householdId,
        provider: 'google',
        calendar_id: 'primary',
        refresh_token: tokens.refresh_token,
      },
      { onConflict: 'profile_id,provider,calendar_id' }
    )

    if (error) throw error

    return Response.redirect(`${appUrl}?calendar=connected`, 302)
  } catch (err) {
    console.error(err)
    return Response.redirect(`${appUrl}?calendar=error`, 302)
  }
})
