import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="shell"><p className="muted">Loading…</p></div>
  if (!session) return <SignIn />
  return <Connected session={session} />
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)

  async function sendLink() {
    if (!email.trim()) return
    setSending(true)
    setStatus(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    setSending(false)
    setStatus(
      error
        ? { kind: 'error', text: error.message }
        : { kind: 'ok', text: 'Check your email for the sign-in link.' }
    )
  }

  return (
    <div className="shell">
      <div className="card">
        <h1>Trellis</h1>
        <p className="muted">Sign in to see the week.</p>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendLink()}
        />

        <button onClick={sendLink} disabled={sending}>
          {sending ? 'Sending…' : 'Email me a link'}
        </button>

        {status && (
          <p className={status.kind === 'error' ? 'error' : 'ok'}>{status.text}</p>
        )}
      </div>
    </div>
  )
}

function Connected({ session }) {
  const [household, setHousehold] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('display_name, household_id')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profErr) return setError(profErr.message)

      if (!prof) {
        return setError(
          'Signed in, but this email is not a member of the household.'
        )
      }

      setProfile(prof)

      const { data: hh, error: hhErr } = await supabase
        .from('household')
        .select('name')
        .maybeSingle()

      if (hhErr) return setError(hhErr.message)
      setHousehold(hh)
    }

    load()
  }, [session])

  return (
    <div className="shell">
      <div className="card">
        <h1>{household?.name ?? 'Trellis'}</h1>

        {error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            <p className="ok">Connected to the database.</p>
            <p className="muted">
              Signed in as {profile?.display_name ?? session.user.email}
            </p>
          </>
        )}

        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
