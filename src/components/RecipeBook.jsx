import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from './Sheet'
import {
  EFFORT_FILTERS,
  PROTEINS,
  SHOW_FILTERS,
  TIME_FILTERS,
  proteinsIn,
} from '../lib/recipeFilters'
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

/** One labelled row of mutually exclusive chips. */
function FilterRow({ label, options, value, onChange }) {
  return (
    <div className="book__filter-row">
      <span className="book__filter-label">{label}</span>
      <div className="book__filter-chips">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={value === o.id ? 'chip on' : 'chip'}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const NO_FILTERS = { protein: 'any', time: 'any', effort: 'any', show: 'all' }

export default function RecipeBook({ recipes, loading, onOpen, onClose }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState(NO_FILTERS)
  const [helpOpen, setHelpOpen] = useState(false)

  const set = (key) => (value) => setF((prev) => ({ ...prev, [key]: value }))
  const filtered = f.protein !== 'any' || f.time !== 'any' || f.effort !== 'any' || f.show !== 'all'

  // Proteins are computed once per load, not per keystroke — the ingredient
  // scan is cheap but it runs across every recipe on every render otherwise.
  const proteinIndex = useMemo(() => {
    const map = new Map()
    for (const r of recipes) map.set(r.id, proteinsIn(r))
    return map
  }, [recipes])

  /**
   * Only offer a protein the book actually contains, plus Meatless.
   * A Lamb chip that always returns nothing is a dead control that teaches
   * people the filters are broken; the list grows by itself the day someone
   * adds a pork recipe.
   */
  const proteinOptions = useMemo(() => {
    const present = new Set()
    for (const ids of proteinIndex.values()) for (const id of ids) present.add(id)
    return [
      { id: 'any', label: 'Any' },
      ...PROTEINS.filter((p) => present.has(p.id)).map((p) => ({ id: p.id, label: p.label })),
      { id: 'none', label: 'Meatless' },
    ]
  }, [proteinIndex])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const time = TIME_FILTERS.find((o) => o.id === f.time)
    const effort = EFFORT_FILTERS.find((o) => o.id === f.effort)
    const show = SHOW_FILTERS.find((o) => o.id === f.show)

    return recipes.filter((r) => {
      const proteins = proteinIndex.get(r.id) ?? []
      if (f.protein === 'none' && proteins.length > 0) return false
      if (f.protein !== 'any' && f.protein !== 'none' && !proteins.includes(f.protein)) return false
      if (time?.match && !time.match(r)) return false
      if (effort?.match && !effort.match(r)) return false
      if (show?.match && !show.match(r)) return false
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
  }, [recipes, q, f, proteinIndex])

  const countLabel = loading
    ? 'Loading…'
    : shown.length === recipes.length
      ? `${recipes.length} recipes`
      : `${shown.length} of ${recipes.length} recipes`

  return (
    <Sheet title="Recipe book" subtitle={countLabel} onClose={onClose}>
      <div className="book__search-row">
        {/* Same reasoning as the meal picker: no autoFocus. The list is the
            interface until someone asks for the keyboard. */}
        <input
          className="sheet__search"
          placeholder="Search titles and ingredients"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <HelpButton onClick={() => setHelpOpen(true)} label="How do I add or edit a recipe?" />
      </div>

      <div className="book__filters">
        <FilterRow label="Protein" options={proteinOptions} value={f.protein} onChange={set('protein')} />
        <FilterRow label="Time" options={TIME_FILTERS} value={f.time} onChange={set('time')} />
        <FilterRow label="Effort" options={EFFORT_FILTERS} value={f.effort} onChange={set('effort')} />
        <FilterRow label="Show" options={SHOW_FILTERS} value={f.show} onChange={set('show')} />
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

      {!loading && shown.length === 0 && (
        <div className="sheet__section">
          <p className="sheet__empty">Nothing matches.</p>
          {/* An empty grid under four filter rows is a puzzle. The way out
              should be one tap, not a hunt for which row did it. */}
          {filtered && (
            <button className="chip" onClick={() => setF(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {helpOpen && <EditHelp onClose={() => setHelpOpen(false)} />}
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
  const [helpOpen, setHelpOpen] = useState(false)

  const ingredients = detail?.ingredients ?? []
  const steps = detail?.steps ?? []
  const cookable = steps.length > 0

  /*
   * Planning happens entirely in the footer.
   *
   * It used to put the day chips at the top of the sheet body: you pressed
   * "Plan a night" at the bottom of the screen, and the thing to press next
   * appeared at the top — a full diagonal of a 13" iPad away, and on a long
   * recipe it could be scrolled off-screen entirely, so the button appeared
   * to do nothing at all. Now the footer itself becomes the day picker, so
   * the second tap lands within a few centimetres of the first.
   */
  const footer = planning ? (
    <>
      {planDays.map((d) => (
        <button
          key={d.iso}
          className={d.iso === plannedDate ? 'plan-day on' : 'plan-day'}
          onClick={() => onPlan(d.iso)}
        >
          <span className="plan-day__name">{d.label}</span>
          <span className="plan-day__dom">{d.dom}</span>
        </button>
      ))}
      <button className="ghost plan-day__cancel" onClick={() => setPlanning(false)} aria-label="Cancel">
        ✕
      </button>
    </>
  ) : (
    <>
      <button className="ghost" onClick={() => setPlanning(true)}>
        Plan a night
      </button>
      {/* Two of the eighteen recipes still have no steps. Offering to cook
          them would open an empty screen, so the button says why it can't
          rather than disappearing without explanation. */}
      <button onClick={onCook} disabled={!cookable}>
        {cookable ? 'Cook' : 'No steps yet'}
      </button>
    </>
  )

  return (
    <Sheet
      title={recipe.title}
      subtitle={planning ? 'Which night?' : summaryOf(recipe) || undefined}
      onClose={onClose}
      footer={footer}
    >
      <RecipeArt recipe={recipe} className="recipe__hero" />

      {recipe.description && <p className="recipe__description">{recipe.description}</p>}

      {/* Read-only, and not chips — a chip in this codebase is something you
          tap. These are labels the enrichment pass attached, and tapping one
          would promise a filtered view the book doesn't have yet. */}
      {recipe.tags?.length > 0 && (
        <ul className="recipe__tags">
          {recipe.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

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

      {/* Where a pencil would go if there were an editor behind it. Until
          there is, the honest thing is to say so and point at what does
          work, rather than leave people tapping a title that never
          becomes a text field. */}
      <div className="recipe__edit-hint">
        <HelpButton onClick={() => setHelpOpen(true)} label="How do I change this recipe?" />
        <span>Recipes cannot be edited on the wall yet.</span>
      </div>

      {helpOpen && <EditHelp onClose={() => setHelpOpen(false)} />}
    </Sheet>
  )
}

/* --------------------------------------------------------------- editing */

function HelpButton({ onClick, label }) {
  return (
    <button type="button" className="help-button" onClick={onClick} aria-label={label} title={label}>
      i
    </button>
  )
}

/**
 * What to do when you want to change a recipe, given that you currently
 * cannot do it here.
 *
 * This exists because the alternative — a pencil icon that opens a form —
 * is a genuinely larger piece of work than it looks: a recipe is four
 * tables, `recipes` plus ingredients plus steps plus provenance, and 008
 * put real constraints between them (an active recipe may not lose its last
 * ingredient; step numbers are unique and gapless; a hand edit must claim
 * `user_supplied` provenance or the next enrichment pass will overwrite it).
 * A form that ignores any of that corrupts the data quietly.
 */
function EditHelp({ onClose }) {
  return (
    <div className="help" role="dialog" aria-modal="true" aria-label="How to edit recipes">
      <div className="help__panel">
        <h2 className="help__title">Changing the recipe book</h2>

        <p className="help__lead">
          Trellis can read the recipe book but not write to it yet. Everything below
          works today; an editor in the app is the next slice.
        </p>

        <div className="help__section">
          <h3>To fix a time, a title or a step</h3>
          <p>
            Supabase dashboard → Table Editor → <code>recipes</code> (or{' '}
            <code>recipe_steps</code> / <code>recipe_ingredients</code>). Edit the cell
            and save. It appears on the wall within a second or two.
          </p>
          <p className="help__warn">
            One extra step, and it matters: also set that field&rsquo;s row in{' '}
            <code>recipe_field_provenance</code> to <code>user_supplied</code>. Most
            times and all three of the newest methods are model estimates, and the next
            enrichment pass will overwrite anything still marked{' '}
            <code>ai_enrichment</code>. Marking it yours makes it permanent.
          </p>
        </div>

        <div className="help__section">
          <h3>To add a whole recipe</h3>
          <p>
            Write a migration in <code>supabase/migrations/</code> rather than typing it
            into the dashboard, so a rebuilt project still has it. Insert the{' '}
            <code>recipes</code> row, then its <code>recipe_ingredients</code> and{' '}
            <code>recipe_steps</code>.
          </p>
          <p>
            A recipe with <code>status = &lsquo;active&rsquo;</code> must have at least one
            ingredient — a deferred trigger rejects the transaction at commit
            otherwise. Use <code>&lsquo;conditional&rsquo;</code> while it is still a
            stub.
          </p>
        </div>

        <div className="help__section">
          <h3>Or just ask Claude</h3>
          <p>
            &ldquo;Add my mum&rsquo;s lasagne to Trellis&rdquo; or &ldquo;the curry
            actually takes 30 minutes, not 45&rdquo; is enough. It has the schema, knows
            the constraints, and will write and apply the migration — which is what the
            AI edit button would do from in here once there is one.
          </p>
        </div>

        <button className="help__close" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
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
