import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from './Sheet'
import './RecipeBook.css'

/**
 * The recipe book: the reading surface for the recipe bank that until now
 * only existed as a one-line picker inside the meal editor.
 *
 * Three layers, deliberately separate:
 *   RecipeBook   — the shelf. Search, filter, browse.
 *   RecipeDetail — one recipe, read standing still.
 *   CookMode     — one step, read from three feet away with wet hands.
 *
 * The picker in MealEditor is untouched. Picking a meal there still lands
 * the chip on the board in one tap, which was a deliberate decision (see
 * pickMeal in Wall.jsx); the book is the surface for the other question,
 * "what do we actually cook", which the picker was never shaped for.
 */

/* --------------------------------------------------------------- artwork */

/**
 * A recipe without a photo still needs to look like something.
 *
 * No recipe in the bank has an image today and several never will, so the
 * book cannot be designed around photography — a grid of grey rectangles
 * waiting for uploads would look broken rather than empty. Instead every
 * recipe gets a deterministic tinted plate derived from its title: same
 * recipe, same colour, forever, and the book looks finished at zero photos.
 * A real `image_url` simply covers it.
 *
 * Derived from the title rather than stored so it needs no column and no
 * backfill, and so a recipe added tonight has artwork immediately.
 */
function tintFor(title) {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  return h % 5
}

function RecipeArt({ recipe, className = '' }) {
  // image_source is required by the schema whenever image_url is set, so a
  // URL with no stated origin shouldn't exist — but the board is the wrong
  // place to find out, so an image missing its provenance falls back to the
  // plate rather than rendering an unattributed photo.
  const usable = recipe.image_url && recipe.image_source

  if (usable) {
    return (
      <div className={`recipe-art ${className}`}>
        <img src={recipe.image_url} alt="" loading="lazy" decoding="async" />
      </div>
    )
  }

  return (
    <div className={`recipe-art recipe-art--plate ${className}`} data-tint={tintFor(recipe.title)}>
      <span aria-hidden="true">{recipe.title.trim().charAt(0).toUpperCase()}</span>
    </div>
  )
}

/* ----------------------------------------------------------------- text */

function minutesLabel(recipe) {
  const total = recipe.total_minutes ?? recipe.cook_minutes
  if (!total) return null
  if (recipe.prep_minutes && recipe.cook_minutes) {
    return `${recipe.prep_minutes} + ${recipe.cook_minutes} min`
  }
  return `${total} min`
}

function servingsLabel(recipe) {
  if (!recipe.servings_min) return null
  const { servings_min: min, servings_max: max } = recipe
  return max && max !== min ? `${min}–${max} servings` : `${min} servings`
}

/** The line under a title in the list: only the facts that exist. */
function summaryOf(recipe) {
  return [
    servingsLabel(recipe),
    minutesLabel(recipe),
    recipe.effort,
    recipe.cuisine,
    recipe.status === 'retired' ? 'Retired' : null,
    recipe.status === 'conditional' ? 'Conditional' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Quantities arrive from Postgres `numeric`, which the client hands over as
 * a string or a number depending on the value. Both have to print as "2"
 * and not "2.00" or "2.0000" — a recipe that asks for 2.00 onions reads as
 * a spreadsheet, not a recipe.
 */
function qtyLabel(qty) {
  if (qty == null) return null
  const n = Number(qty)
  if (!Number.isFinite(n)) return null
  return String(Number(n.toFixed(2)))
}

function ingredientLine(ing) {
  const qty = qtyLabel(ing.qty)
  const amount = [qty, ing.unit].filter(Boolean).join(' ')
  const name = [ing.name, ing.preparation].filter(Boolean).join(', ')
  return { amount, name }
}

/* ------------------------------------------------------------- the shelf */

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'quick', label: 'Under 30 min', match: (r) => (r.total_minutes ?? r.cook_minutes ?? 999) <= 30 },
  { id: 'easy', label: 'Easy', match: (r) => r.effort === 'Easy' },
  { id: 'unfinished', label: 'Needs work', match: (r) => r.step_count === 0 || r.ingredient_count === 0 },
]

export default function RecipeBook({ recipes, loading, onOpen, onClose }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const active = FILTERS.find((f) => f.id === filter)

    return recipes.filter((r) => {
      if (active?.match && !active.match(r)) return false
      if (!needle) return true
      // Searching a recipe book means searching what's in it, not just what
      // it's called — "chickpea" should find the curry even though the word
      // is only in the ingredients.
      const haystack = [r.title, r.cuisine, ...(r.tags ?? []), r.ingredient_names ?? '']
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [recipes, q, filter])

  return (
    <Sheet
      title="Recipe book"
      subtitle={loading ? 'Loading…' : `${recipes.length} recipes`}
      onClose={onClose}
    >
      {/* Same reasoning as the meal picker: no autoFocus. The list is the
          interface until someone asks for the keyboard. */}
      <input
        className="sheet__search"
        placeholder="Search titles and ingredients"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="chips book__filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={filter === f.id ? 'chip on' : 'chip'}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="book__grid">
        {shown.map((r) => (
          <button key={r.id} className="book__card" onClick={() => onOpen(r)}>
            <RecipeArt recipe={r} className="book__card-art" />
            <span className="book__card-title">{r.title}</span>
            <span className="book__card-meta">{summaryOf(r) || 'No details yet'}</span>
          </button>
        ))}
      </div>

      {!loading && shown.length === 0 && <p className="sheet__empty">Nothing matches.</p>}
    </Sheet>
  )
}

/* ------------------------------------------------------------ one recipe */

export function RecipeDetail({
  recipe,
  detail,
  loading,
  planDays,
  plannedDate,
  onPlan,
  onCook,
  onClose,
}) {
  const [planning, setPlanning] = useState(false)

  const ingredients = detail?.ingredients ?? []
  const steps = detail?.steps ?? []
  const cookable = steps.length > 0

  return (
    <Sheet
      title={recipe.title}
      subtitle={summaryOf(recipe) || undefined}
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={() => setPlanning((v) => !v)}>
            {planning ? 'Not now' : 'Plan a night'}
          </button>
          {/* Five of the eighteen recipes have no steps at all. Offering to
              cook them would open an empty screen, so the button says why
              it can't rather than disappearing without explanation. */}
          <button onClick={onCook} disabled={!cookable}>
            {cookable ? 'Cook' : 'No steps yet'}
          </button>
        </>
      }
    >
      <RecipeArt recipe={recipe} className="recipe__hero" />

      {planning && (
        <div className="sheet__section">
          <span className="sheet__heading">Plan for</span>
          <div className="chips">
            {planDays.map((d) => (
              <button
                key={d.iso}
                className={d.iso === plannedDate ? 'chip on' : 'chip'}
                onClick={() => onPlan(d.iso)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {recipe.description && <p className="recipe__description">{recipe.description}</p>}

      {recipe.notes && <p className="recipe__notes">{recipe.notes}</p>}

      <div className="sheet__section">
        <span className="sheet__heading">
          {ingredients.length === 1 ? '1 ingredient' : `${ingredients.length} ingredients`}
        </span>

        {loading && <p className="sheet__empty">Loading…</p>}

        {!loading && ingredients.length === 0 && (
          <p className="sheet__empty">No ingredients recorded for this one yet.</p>
        )}

        <ul className="recipe__ingredients">
          {ingredients.map((ing) => {
            const { amount, name } = ingredientLine(ing)
            return (
              <li key={ing.id}>
                <span className="recipe__amount">{amount || '—'}</span>
                <span className="recipe__ingredient">
                  {name}
                  {ing.notes && <span className="recipe__ingredient-note">{ing.notes}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="sheet__section">
        <span className="sheet__heading">Method</span>

        {!loading && steps.length === 0 && (
          <p className="sheet__empty">
            No steps written down yet — this recipe lives in someone's head.
          </p>
        )}

        <ol className="recipe__steps">
          {steps.map((s) => (
            <li key={s.id}>
              <span className="recipe__step-number">{s.step_number}</span>
              <span className="recipe__step-body">{s.body}</span>
            </li>
          ))}
        </ol>
      </div>

      {recipe.source_url && (
        <p className="recipe__source">
          {/* Opened away from the wall on purpose — a kiosk that can navigate
              to the open web is a kiosk you find on a news site. */}
          <a href={recipe.source_url} target="_blank" rel="noreferrer noopener">
            Original recipe
          </a>
        </p>
      )}
    </Sheet>
  )
}

/* -------------------------------------------------------------- cook mode */

/**
 * One step at a time, at a size you can read from the other side of a hob,
 * with the ingredients one tap away.
 *
 * Holds a screen wake lock while it's open. The iPad's own auto-lock is the
 * thing that turns a recipe into a black rectangle halfway through browning
 * onions, and re-tapping a screen with raw chicken on your hands is the
 * actual problem this feature exists to solve. iOS releases the lock
 * whenever the tab is hidden, so it's re-requested on visibilitychange —
 * the same reason useToday listens there.
 */
export function CookMode({ recipe, detail, onExit }) {
  const steps = detail?.steps ?? []
  const ingredients = detail?.ingredients ?? []
  const [index, setIndex] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const lockRef = useRef(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let cancelled = false

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) return lock.release()
        lockRef.current = lock
      } catch {
        // Denied, unsupported, or the tab wasn't visible. Cooking without a
        // wake lock is the status quo, not a failure worth a message.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [])

  const step = steps[index]
  const last = index === steps.length - 1

  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label={`Cooking ${recipe.title}`}>
      <header className="cook__head">
        <div>
          <p className="cook__recipe">{recipe.title}</p>
          <p className="cook__progress">
            Step {index + 1} of {steps.length}
          </p>
        </div>
        <button className="sheet__close" onClick={onExit}>
          Done
        </button>
      </header>

      <div className="cook__body">
        <p className="cook__step">{step?.body}</p>
      </div>

      {showIngredients && (
        <ul className="cook__ingredients">
          {ingredients.map((ing) => {
            const { amount, name } = ingredientLine(ing)
            return (
              <li key={ing.id}>
                <span className="recipe__amount">{amount || '—'}</span>
                <span>{name}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="cook__foot">
        <button className="ghost" onClick={() => setShowIngredients((v) => !v)}>
          {showIngredients ? 'Hide ingredients' : 'Ingredients'}
        </button>
        <button className="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          Back
        </button>
        <button onClick={() => (last ? onExit() : setIndex((i) => i + 1))}>
          {last ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  )
}
