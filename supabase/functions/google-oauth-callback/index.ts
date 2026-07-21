// everee health -- Google OAuth callback (authorisation-code exchange)
//
// Google redirects here with ?code=... This function swaps that code for an
// access token AND a refresh token using the client secret, stores both, then
// bounces back to the app. The browser never sees either token.
//
// This replaces the implicit flow, where the access token lived in localStorage
// and died after ~1 hour with no way to renew it -- which is why Fitbit data
// almost never saved.
//
// Deploy:
//   supabase functions deploy google-oauth-callback --no-verify-jwt \
//     --project-ref jdxtlxpvimjvcfrmeeap
//   (--no-verify-jwt is required: Google calls this, and it has no Supabase JWT)
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL

import { createClient } from 'npm:@supabase/supabase-js@2'

const USER_ID = '1e133101-10e9-468a-ab81-d9b76a20e8ed'
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const APP_URL = Deno.env.get('APP_URL') || 'https://reey-meep.github.io/everee-health/'
const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const back = (status: string, detail = '') =>
  Response.redirect(`${APP_URL}?google=${status}${detail ? `&detail=${encodeURIComponent(detail)}` : ''}`, 302)

Deno.serve(async req => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) return back('error', error)
  if (!code) return back('error', 'no code returned')

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const tok = await res.json()
    if (!res.ok) return back('error', tok?.error_description || tok?.error || `HTTP ${res.status}`)

    // A refresh token is only returned when access_type=offline and consent was
    // re-prompted. Without it this whole exercise is pointless, so fail loudly
    // rather than storing a token that dies in an hour.
    if (!tok.refresh_token) {
      return back('error', 'Google did not return a refresh token. Revoke access at myaccount.google.com/permissions and connect again.')
    }

    await db.from('google_oauth').upsert({
      user_id: USER_ID,
      refresh_token: tok.refresh_token,
      access_token: tok.access_token,
      expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
      scope: tok.scope,
      last_refresh_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return back('connected')
  } catch (e) {
    return back('error', String((e as Error)?.message || e))
  }
})
