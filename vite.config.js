import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

/**
 * Why this exists.
 *
 * `src/lib/supabase.js` throws at module scope when these are missing, and
 * Vite inlines `import.meta.env` at build time. With no env, that throw
 * becomes unconditional, so the bundler proves everything downstream of it
 * is unreachable and tree-shakes the entire application away.
 *
 * The build still exits 0. It still reports every module transformed. It
 * still emits the full stylesheet. The only symptom is the bundle dropping
 * from ~430 kB to ~199 kB of React and nothing else — and then the wall
 * shows a blank screen.
 *
 * That is a silent, deployable failure, so it is made loud here instead:
 * a build without credentials does not produce an artifact at all.
 */
function assertBuildEnv(mode) {
  // .env files for local builds, process.env for CI and Vercel.
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const missing = REQUIRED_ENV.filter((key) => !fileEnv[key] && !process.env[key])

  if (missing.length === 0) return

  throw new Error(
    [
      '',
      '  Refusing to build without Supabase credentials.',
      '',
      `  Missing: ${missing.join(', ')}`,
      '',
      '  Building anyway would silently succeed and emit a bundle with the',
      '  whole app tree-shaken out, because lib/supabase.js throws at module',
      '  scope and the bundler drops everything after it as unreachable.',
      '',
      '  Local:  put them in .env.local (a git worktree does not inherit it).',
      '  Vercel: Project Settings -> Environment Variables.',
      '',
    ].join('\n')
  )
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Only on build. `npm run dev` stays usable without credentials — it fails
  // visibly in the browser, and nothing it produces can be deployed.
  if (command === 'build') assertBuildEnv(mode)

  return {
    plugins: [react()],
  }
})
