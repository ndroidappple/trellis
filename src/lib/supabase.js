import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check .env.local locally, ' +
      'and Project Settings -> Environment Variables on Vercel.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // The wall tablet signs in once and stays signed in. These three are
    // what keep it that way across reboots and weeks of idling.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
