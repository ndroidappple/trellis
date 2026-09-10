import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from './Sheet'
import {
  EFFORT_FILTERS,
  PROTEINS,
  SHOW_FILTERS,
  TIME_FILTERS,
  proteinsIn,
} from '../lib/recipeFilters'
import { formatCents, recipeCost } from '../lib/cost'
import './RecipeBook.css'

/**
 * How far a finger may travel and still count as a tap rather than a scroll.
 * Matches LONG_PRESS_SLOP_PX in Wall.jsx, and for the same reason: a finger
 * resting on glass emits a constant dribble of move events, so "did not move
 * at all" is not a test any real touch passes.
 */
const TAP_SLOP_PX = 12

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

/* ---------------------------------------------------------------- price */

/**
 * Whether the shelf is showing prices, remembered across a close.
 *
 * localStorage rather than the household row, for the same reason cook
 * progress is per-device: this is a fact about how someone is reading the
 * book right now, not a decision about the household. The wall being left in
 * price mode should not put prices in front of somebody picking a recipe on
 * their phone.
 */
const PRICE_KEY = 'trellis.book-prices'

function readPriceMode() {
  try {
    return localStorage.getItem(PRICE_KEY) === 'on'
  } catch {
    // Private mode or a cleared quota. Off is the old behaviour, and the old
    // behaviour worked.
    return false
  }
}

function writePriceMode(on) {
  try {
    localStorage.setItem(PRICE_KEY, on ? 'on' : 'off')
  } catch {
    /* see above */
  }
}

/**
 * A price per serving, and how much of it to believe.
 *
 * Three states, because the bank genuinely has three. Fourteen recipes price
 * completely, between $1.80 and $3.24 a serving; the Udon stir-fry prices
 * partly, because its fresh ginger is "to taste" with no product behind it;
 * the Tortilla Soup, the smoothie and the two stubs price not at all.
 *
 * The partial state is the reason this is not just a number, and Stuffed
 * peppers is the case that shaped it. Before 015 it summed to $1.66 a serving
 * with three ingredients missing a `purchase_qty`, which would have made it
 * comfortably the cheapest thing in the book and completely wrong. The "+"
 * says the number is a floor, and `byPrice` keeps it below every recipe whose
 * price is whole. 015 filled those three, so it now prices honestly at $1.82
 * — but the guard is what made the wrong answer survivable in the meantime,
 * and the next unpriced ingredient somebody adds will need it again.
 */
function priceLabel(cost) {
  if (cost.perServingCents == null) {
    return { figure: '—', note: 'no prices yet', partial: false, known: false }
  }
  return {
    figure: formatCents(cost.perServingCents) + (cost.complete ? '' : '+'),
    note: cost.complete
      ? 'a serving'
      : `${cost.unpriced} unpriced`,
    partial: !cost.complete,
    known: true,
  }
}

/**
 * Cheapest first, with the unsure ones underneath.
 *
 * Bucket before figure: a recipe missing three prices has not earned a place
 * above one that is fully costed, however small its partial sum happens to
 * be. Within a bucket it is price then title, so the order is stable rather
 * than dependent on however Postgres returned the rows.
 */
function byPrice(costOf) {
  const UNKNOWN = { perServingCents: null, complete: false }

  return (a, b) => {
    const ca = costOf(a) ?? UNKNOWN
    const cb = costOf(b) ?? UNKNOWN
    const bucket = (c) => (c.perServingCents == null ? 2 : c.complete ? 0 : 1)

    if (bucket(ca) !== bucket(cb)) return bucket(ca) - bucket(cb)
    if (ca.perServingCents != null && ca.perServingCents !== cb.perServingCents) {
      return ca.perServingCents - cb.perServingCents
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  }
}

/** The toggle itself. A price is money, so the control is the currency sign. */
function PriceButton({ on, onClick }) {
  const label = on ? 'Hide prices per serving' : 'Show prices per serving'
  return (
    <button
      type="button"
      className={on ? 'price-button is-on' : 'price-button'}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      $
    </button>
  )
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

/**
 * The shelf, used for both jobs it has.
 *
 * It is the recipe book, and it is also the picker inside `MealEditor` —
 * which until now was a separate, much poorer list: plain titles, one search
 * box matching titles only, no artwork, no filters. Not a design decision so
 * much as an accident of order. The picker was built first, against the thin
 * boot-time `recipes` query (`id, title, servings, cook_minutes, effort,
 * status`), and the book arrived later with its own lazy `RECIPE_BOOK_QUERY`
 * carrying ingredients, tags, cuisine and times. The picker could not have
 * shown a filter row if it wanted to — it had never loaded the columns the
 * filters read.
 *
 * So the two differences that remain are the two that were ever real:
 *
 *   - **Retired recipes are excluded when picking.** You should not be
 *     offered Tuesday's dinner from the retired pile; a recipe you have
 *     stopped cooking is still a recipe you wrote down, which is why the book
 *     keeps them.
 *   - **Tapping plans instead of opening**, still in one tap. That was a
 *     deliberate decision (see `pickMeal` in Wall.jsx) and it survives.
 *
 * Everything else — artwork, ingredient search, four filter rows — is now the
 * same surface, because there was never a reason for it not to be.
 */
export default function RecipeBook({
  recipes,
  loading,
  title = 'Recipe book',
  lead,
  /** Marked "on the plan now", so changing a meal isn't done blind. */
  highlightId,
  /**
   * What is left of the week's grocery budget, if the caller knows.
   *
   * Price mode exists for one moment — it is Thursday, the budget is nearly
   * gone, and dinner still has to happen — so the shelf says how much is left
   * while it is showing prices. Optional: a caller with no week in hand
   * simply gets the prices without the frame around them.
   */
  budgetLeftCents,
  /**
   * The week that figure is about, when it is not the current one — null
   * otherwise, which is the common case and reads as "left this week".
   *
   * Named rather than assumed, because the projection follows the week on the
   * board and not the calendar. Page the board forward and "left this week"
   * is describing a week that has not started yet; the caller knows which week
   * it meant, so it says so.
   */
  budgetWeekLabel = null,
  onOpen,
  onClose,
}) {
  const [q, setQ] = useState('')
  const [f, setF] = useState(NO_FILTERS)
  const [helpOpen, setHelpOpen] = useState(false)
  const [prices, setPrices] = useState(readPriceMode)

  const set = (key) => (value) => setF((prev) => ({ ...prev, [key]: value }))
  const filtered = f.protein !== 'any' || f.time !== 'any' || f.effort !== 'any' || f.show !== 'all'

  // Proteins are computed once per load, not per keystroke — the ingredient
  // scan is cheap but it runs across every recipe on every render otherwise.
  const proteinIndex = useMemo(() => {
    const map = new Map()
    for (const r of recipes) map.set(r.id, proteinsIn(r))
    return map
  }, [recipes])

  // Same bargain as the protein index: 127 ingredient rows priced once per
  // load rather than on every keystroke and every toggle.
  const costIndex = useMemo(() => {
    const map = new Map()
    for (const r of recipes) map.set(r.id, recipeCost(r))
    return map
  }, [recipes])

  const costOf = (r) => costIndex.get(r.id) ?? recipeCost(r)

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

    const matches = recipes.filter((r) => {
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

    /*
     * Price mode reorders as well as annotates, and that is the point of it.
     * The question being asked is "what is the cheapest thing I could cook
     * tonight", and answering it with nineteen prices in alphabetical order
     * leaves the reader doing the sort by eye. Alphabetical returns the
     * moment prices go away.
     */
    return prices ? [...matches].sort(byPrice((r) => costIndex.get(r.id))) : matches
  }, [recipes, q, f, proteinIndex, prices, costIndex])

  const countLabel = loading
    ? 'Loading…'
    : shown.length === recipes.length
      ? `${recipes.length} recipes`
      : `${shown.length} of ${recipes.length} recipes`

  /*
   * In price mode the subtitle carries the budget instead of the count.
   *
   * Both would be a subtitle nobody reads. The count answers "did my filter
   * do anything", which the grid underneath answers anyway; the money answers
   * the question that made someone turn prices on, and it is the only place
   * on this screen the week's budget appears at all.
   *
   * "Cheapest first" is there because the list just resorted itself under the
   * reader's hands, and a surface that rearranges without saying so reads as
   * a glitch.
   */
  const subtitle =
    prices && !loading
      ? [
          budgetLeftCents == null
            ? null
            : budgetLeftCents < 0
              ? `${formatCents(-budgetLeftCents)} over budget`
              : `${formatCents(budgetLeftCents)} left${budgetWeekLabel ? '' : ' this week'}`,
          // Its own segment rather than a clause, because "left week of
          // September 14 – 20" is not a sentence.
          budgetWeekLabel && `week of ${budgetWeekLabel}`,
          'cheapest first',
        ]
          .filter(Boolean)
          .join(' · ')
      : countLabel

  function togglePrices() {
    setPrices((was) => {
      writePriceMode(!was)
      return !was
    })
  }

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      {/* Whatever the caller needs answered before the list is useful — the
          meal editor puts its slot chips here, because which meal you are
          planning is decided before which recipe fills it. */}
      {lead}

      <div className="book__search-row">
        {/* Same reasoning as the meal picker: no autoFocus. The list is the
            interface until someone asks for the keyboard. */}
        <input
          className="sheet__search"
          placeholder="Search titles and ingredients"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <PriceButton on={prices} onClick={togglePrices} />
        <HelpButton onClick={() => setHelpOpen(true)} label="How do I add or edit a recipe?" />
      </div>

      <div className="book__filters">
        <FilterRow label="Protein" options={proteinOptions} value={f.protein} onChange={set('protein')} />
        <FilterRow label="Time" options={TIME_FILTERS} value={f.time} onChange={set('time')} />
        <FilterRow label="Effort" options={EFFORT_FILTERS} value={f.effort} onChange={set('effort')} />
        <FilterRow label="Show" options={SHOW_FILTERS} value={f.show} onChange={set('show')} />
      </div>

      <div className="book__grid">
        {shown.map((r) => {
          const price = prices ? priceLabel(costOf(r)) : null
          return (
            <button
              key={r.id}
              className={r.id === highlightId ? 'book__card is-current' : 'book__card'}
              onClick={() => onOpen(r)}
            >
              <RecipeArt recipe={r} className="book__card-art" />
              <span className="book__card-title">{r.title}</span>

              {/* Above the summary, not folded into it. The summary is a
                  sentence of facts you read; this is a figure you compare
                  against the card beside it, and comparing is a great deal
                  harder when the number is the fourth clause of a line. */}
              {price && (
                <span
                  className={
                    price.known
                      ? price.partial
                        ? 'book__card-price is-partial'
                        : 'book__card-price'
                      : 'book__card-price is-unknown'
                  }
                >
                  <span className="book__card-figure">{price.figure}</span>
                  <span className="book__card-per">{price.note}</span>
                </span>
              )}

              <span className="book__card-meta">
                {r.id === highlightId
                  ? 'On the plan now'
                  : summaryOf(r) || 'No details yet'}
              </span>
            </button>
          )
        })}
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
  onChangeMeal,
  changeMealLabel,
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
      {/* Present only when you arrived here from a meal on the board, and
          first because it is the reason you would change your mind while
          reading. It is a different question from "Plan a night" beside it:
          this one replaces the meal you came from, that one puts this recipe
          on some other night as well. The label names the slot so the two
          cannot be confused at a glance. */}
      {onChangeMeal && (
        <button className="ghost" onClick={onChangeMeal}>
          {changeMealLabel ?? 'Change meal'}
        </button>
      )}
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
 * How much of the reading area, measured from the left edge, means "back".
 *
 * Forward is the overwhelmingly common move, so it keeps the larger share and
 * the whole right-hand side of the screen — which is also the side a
 * right-handed cook's hand is already on. Back is the correction, and a
 * correction wants a target you can hit without aiming rather than the biggest
 * one on screen.
 *
 * 30% of a 12.9" iPad in portrait is about 300pt: far above anything anyone
 * misses, and comfortably clear of the middle, where a tap meant for "next"
 * would otherwise have to be placed with care. Below about a quarter the zone
 * starts to need looking at, which defeats the point of the mode; much above a
 * third and the forward tap — the one made twenty times a recipe — starts
 * feeling hemmed in.
 */
const BACK_ZONE = 0.3

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
 *
 * The ambient screen timeout is suspended for as long as this is open. The two
 * features want opposite things from the same screen and cook mode wins: it is
 * the one surface in Trellis whose entire purpose is to keep showing you
 * something while you are demonstrably not touching the iPad.
 */
export function CookMode({ recipe, detail, initialIndex = 0, onIndexChange, onExit }) {
  const steps = detail?.steps ?? []
  const ingredients = detail?.ingredients ?? []

  // Clamped, because the remembered step comes from localStorage and the
  // recipe may have been edited — or replaced entirely — since it was written.
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, steps.length - 1))
  )
  const [showIngredients, setShowIngredients] = useState(false)
  const [pressing, setPressing] = useState(null)
  const lockRef = useRef(null)

  // Reported rather than written from in here, so the one place that owns
  // "where were we" is the one place that can also decide to forget it.
  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

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
  const first = index === 0

  /*
   * Tap the step to move through the recipe: left third back, the rest onward.
   *
   * The buttons in the footer are 52px in a corner and your hands are covered
   * in raw chicken. The step text is most of the screen, so it is the target
   * you can actually hit without looking — and without wiping your hands
   * first, which is the moment people put the iPad down and stop using cook
   * mode at all. Going *back* had only the corner button until now, so the one
   * move you make when you have missed something was the one move that
   * required clean hands.
   *
   * Three things stop it misfiring. The step text scrolls when it is long, so
   * a drag that happens to end where it started is a scroll and not a tap —
   * hence the same 12px slop the board's long-press uses (LONG_PRESS_SLOP_PX
   * in Wall.jsx). Controls inside the area handle their own taps. And neither
   * zone ever runs off the end of the recipe: the last step does not advance,
   * because "Finish" exits the mode entirely and that is not something a stray
   * touch should do halfway through dinner, and the first step does not go
   * back to nothing.
   */
  const tapOrigin = useRef(null)

  /** Which half of the reading area a point falls in. */
  function zoneOf(e) {
    const box = e.currentTarget.getBoundingClientRect()
    return e.clientX - box.left < box.width * BACK_ZONE ? 'back' : 'next'
  }

  function beginTap(e) {
    // Controls handle their own taps. Same guard as the board's long press.
    if (e.target.closest?.('button, a, input, label')) return

    const zone = zoneOf(e)
    tapOrigin.current = { x: e.clientX, y: e.clientY, zone }

    // The acknowledgement is per-zone now. Lighting the whole reading area on
    // a tap that is about to go backwards would say "yes" to the wrong
    // question — from a step back with wet hands, that flash is most of the
    // feedback you get before the words change.
    setPressing(zone === 'back' ? (first ? null : 'back') : last ? null : 'next')
  }

  function clearPress() {
    tapOrigin.current = null
    setPressing(null)
  }

  function endTap(e) {
    const origin = tapOrigin.current
    clearPress()
    if (!origin) return

    const moved =
      Math.abs(e.clientX - origin.x) > TAP_SLOP_PX ||
      Math.abs(e.clientY - origin.y) > TAP_SLOP_PX
    if (moved) return

    // Judged from where the finger went down, not where it came up. A tap that
    // starts in one zone and drifts a few pixels into the other is one tap, and
    // it means whatever it meant when it landed.
    if (origin.zone === 'back') {
      if (!first) setIndex((i) => Math.max(0, i - 1))
      return
    }

    if (!last) setIndex((i) => Math.min(steps.length - 1, i + 1))
  }

  /**
   * What the zones currently do, said out loud.
   *
   * A tap target with no edges is one nobody finds, and now there are two of
   * them side by side. Each half drops out of the sentence at the end of the
   * recipe it cannot move through, so the line never offers a tap that does
   * nothing — which is how you learn the zones are real rather than
   * decorative.
   */
  const hints = [!first && 'tap left to go back', !last && 'tap to continue'].filter(Boolean)

  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label={`Cooking ${recipe.title}`}>
      <header className="cook__head">
        <div>
          <p className="cook__recipe">{recipe.title}</p>
          <p className="cook__progress">
            Step {index + 1} of {steps.length}
            {hints.length > 0 && <span className="cook__hint"> · {hints.join(' · ')}</span>}
          </p>
        </div>
        {/* Stepping out, not finishing. The distinction is the whole reason
            the menu can offer to put you back on step four: "Done" here means
            something interrupted you, and that is exactly the state worth
            remembering. */}
        <button className="sheet__close" onClick={() => onExit(false)}>
          Done
        </button>
      </header>

      <div
        className="cook__body"
        data-back={first ? 'off' : 'on'}
        data-next={last ? 'off' : 'on'}
        data-press={pressing ?? 'none'}
        onPointerDown={beginTap}
        onPointerUp={endTap}
        onPointerCancel={clearPress}
        onPointerLeave={clearPress}
      >
        {/* Nothing marks the boundary at rest, deliberately. This screen is one
            40px sentence read from across a kitchen, and a permanent divider
            down it would be furniture in the middle of the only thing here
            worth looking at. The press does the teaching instead: putting a
            finger down lights that zone and draws the edge, which is both the
            acknowledgement and the lesson — and because a tap is cancelled by
            travelling 12px, seeing the wrong side light up is something you can
            still slide out of without it firing. */}
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
        <button className="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={first}>
          Back
        </button>
        <button onClick={() => (last ? onExit(true) : setIndex((i) => i + 1))}>
          {last ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  )
}
