import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Wall from './components/Wall'
import './App.css'

/**
 * Length of the emailed sign-in code. Set by Supabase under
 * Auth → Providers → Email, currently 8 — it is a project setting, not a
 * universal 6, and assuming otherwise silently truncates the code into an
 * invalid token. Keep the two in step if it's ever changed there.
 */
const CODE_LENGTH = 8

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <Shell><p className="muted">Loading…</p></Shell>
  if (!session) return <SignIn />
  return <Household session={session} />
}

function Shell({ children }) {
  return <div className="shell">{children}</div>
}

/**
 * Sign-in is a 6-digit code typed into the app, not a link tapped in Mail.
 *
 * The link cannot work on the wall. On iOS a Home Screen web app has its own
 * storage container, and tapping a link in Mail opens the *default browser* —
 * so the session is created in Safari while the app that asked for it stays
 * signed out. You then request another email and repeat, which is a fast way
 * through Supabase's built-in email rate limit.
 *
 * A code has no such hop: whichever surface asked for it is the one that ends
 * up signed in. Same flow on the wall, a phone, or a laptop.
 *
 * Requires `{{ .Token }}` in the Supabase "Magic Link" email template.
 * `emailRedirectTo` is still passed so that a template which also includes
 * `{{ .ConfirmationURL }}` keeps working in an ordinary browser.
 */
function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('email') // 'email' | 'code'
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  async function sendCode() {
    if (!email.trim()) return
    setBusy(true)
    setStatus(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    setBusy(false)

    if (error) return setStatus({ kind: 'error', text: error.message })

    setStage('code')
    setStatus({ kind: 'ok', text: 'Check your email for a 6-digit code.' })
  }

  async function verifyCode() {
    const token = code.trim()
    if (token.length !== CODE_LENGTH) return
    setBusy(true)
    setStatus(null)

    // Which `type` a code verifies under depends on how Supabase issued it,
    // so both are tried. On success `onAuthStateChange` in App swaps the
    // screen out from under this.
    //
    // Both failures are reported, not just the last one: the two messages
    // distinguish causes that look identical from the outside. "Token has
    // expired or is invalid" from both means a stale or mistyped code, while
    // one succeeding as far as a different complaint points at the type
    // rather than the code. There are no devtools on the wall, so whatever
    // this line says is the entire diagnosis.
    const failures = []

    for (const type of ['email', 'magiclink']) {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type })
      if (!error) return setBusy(false)

      failures.push(`${type} → ${error.message}${error.status ? ` (${error.status})` : ''}`)
      console.error('[trellis] verifyOtp failed', { type, error })
    }

    setBusy(false)
    setStatus({ kind: 'error', text: failures.join('  |  ') })
  }

  return (
    <Shell>
      <div className="card">
        <h1>Trellis</h1>

        {stage === 'email' ? (
          <>
            <p className="muted">Sign in to see the week.</p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
            <button onClick={sendCode} disabled={busy}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </>
        ) : (
          <>
            <p className="muted">Enter the code sent to {email.trim()}.</p>
            {/*
              This project issues 8-digit numeric codes. OTP length is a
              Supabase project setting, not a universal 6 — an earlier
              version assumed six and silently truncated the code, which
              Supabase then rejected as an invalid token. That reads exactly
              like an expired one, so the symptom pointed away from the
              cause. If sign-in ever starts failing again, check the length
              here against Auth → Providers → Email before anything else.
            */}
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              // Lets iOS offer the code from Mail without leaving the app.
              autoComplete="one-time-code"
              placeholder="12345678"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
            />
            {/* Submitting a half-typed code is what produced the "invalid
                token" dead end, so the button simply won't do it. */}
            <button onClick={verifyCode} disabled={busy || code.length !== CODE_LENGTH}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              className="ghost"
              disabled={busy}
              onClick={() => {
                setStage('email')
                setCode('')
                setStatus(null)
              }}
            >
              Use a different email
            </button>
          </>
        )}

        {status && (
          <p className={status.kind === 'error' ? 'error' : 'ok'}>{status.text}</p>
        )}
      </div>
    </Shell>
  )
}

function Household({ session }) {
  const [profile, setProfile] = useState(null)
  const [people, setPeople] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: me, error: meErr } = await supabase
        .from('profiles')
        .select('id, display_name, color, household_id')
        .eq('id', session.user.id)
        .maybeSingle()

      if (meErr) return setError(meErr.message)
      if (!me) {
        return setError('Signed in, but this email is not a member of the household.')
      }

      setProfile(me)

      // RLS already scopes this to the household, so no filter is needed here.
      const { data: roster } = await supabase
        .from('profiles')
        .select('id, display_name, color')

      setPeople(roster ?? [])
    }

    load()
  }, [session])

  if (error) {
    return (
      <Shell>
        <div className="card">
          <h1>Trellis</h1>
          <p className="error">{error}</p>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </Shell>
    )
  }

  if (!profile) return <Shell><p className="muted">Loading…</p></Shell>

  return <Wall profile={profile} people={people} />
}
