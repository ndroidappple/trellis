/**
 * Where you had got to in a recipe, remembered across a remount.
 *
 * Cook mode used to lose its place the moment it closed: `index` lived in the
 * component, the component unmounted on exit, and re-entering started at step
 * one. On a phone that is a shrug. On this wall it is not — the ErrorBoundary
 * self-reloads after a crash, the ambient timeout now covers the board, and
 * "which step was I on" is exactly the question you cannot answer by looking
 * at the pan.
 *
 * localStorage rather than Supabase, deliberately. A cook in progress is a
 * fact about *this screen right now*, not about the household: the wall and a
 * phone can each be part-way through something, and syncing them would have
 * one snatch the other's place mid-recipe.
 */

const KEY = 'trellis.cook-progress'

/**
 * How long a half-finished recipe stays offerable.
 *
 * Long enough to cover a meal that got interrupted — a phone call, a shop run
 * for the thing you were out of — and short enough that last night's dinner is
 * never offered as resumable this morning. An expired entry is not merely
 * useless: "Resume — step 3 of 7" pointing at a meal already eaten is a lie
 * the menu tells at a glance.
 */
const MAX_AGE_MS = 6 * 60 * 60 * 1000

export function readCookProgress(now = Date.now()) {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const saved = JSON.parse(raw)
    if (!saved?.recipeId || typeof saved.index !== 'number') return null
    if (!(now - saved.at < MAX_AGE_MS)) return null

    return saved
  } catch {
    // Private mode, a cleared quota, or something else wrote the key. None of
    // it is worth an error on a wall: no remembered place is the old
    // behaviour, and the old behaviour worked.
    return null
  }
}

export function writeCookProgress(recipeId, index, now = Date.now()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ recipeId, index, at: now }))
  } catch {
    /* see above */
  }
}

export function clearCookProgress() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* see above */
  }
}
