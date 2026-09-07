import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Wall from './components/Wall'
import './App.css'

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
    <Shell>
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
