/**
 * Meal slots.
 *
 * `meal_plan.slot` has accepted breakfast / lunch / dinner / snack since
 * 004_recipes.sql, with `unique (household_id, on_date, slot)` — so four meals
 * a day has been expressible in the database from the beginning. The app only
 * ever wrote `'dinner'`, on the reasoning recorded in MealsCard.jsx: "v1 plans
 * dinners only. Breakfast and lunch are standing routines in this household."
 *
 * That was true and is still mostly true, which is why dinner keeps every
 * advantage below — it is pre-selected, it sorts where it belongs, and nothing
 * about planning a dinner costs a tap more than it used to. What changed is
 * that the other three stopped being unreachable: a Sunday brunch or a lunch
 * worth writing down had no way onto the board at all, and the label on the
 * day row said "Dinner" because that was the only truth the code could tell.
 *
 * The order here is the order of a day, not an order of importance. It is what
 * sorts several meals on one date, and a list that put dinner first because
 * dinner matters most would be a list nobody could read down.
 */
export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
]

/**
 * What "+ Meal" means before anyone chooses. Dinner is what this household
 * plans; offering a picker with nothing selected would tax the common case to
 * make room for the rare one.
 */
export const DEFAULT_SLOT = 'dinner'

const ORDER = new Map(MEAL_SLOTS.map((s, i) => [s.id, i]))

export function slotLabel(id) {
  return MEAL_SLOTS.find((s) => s.id === id)?.label ?? id
}

/**
 * Chronological within a day. A slot the app has never heard of sorts last
 * rather than throwing — the check constraint is the guard against nonsense
 * getting in, and a row that somehow holds an unknown slot should still be
 * visible enough to be fixed.
 */
export function bySlot(a, b) {
  return (ORDER.get(a.slot) ?? ORDER.size) - (ORDER.get(b.slot) ?? ORDER.size)
}

/**
 * The slot a new meal on this day should default to: dinner if it is free,
 * otherwise the earliest free one. Null once the day is full, which is what
 * hides the add button rather than offering a tap that cannot succeed —
 * the unique constraint would turn it into an upsert over an existing meal,
 * silently replacing something.
 */
export function nextFreeSlot(entriesForDay) {
  const taken = new Set(entriesForDay.map((e) => e.slot))
  if (!taken.has(DEFAULT_SLOT)) return DEFAULT_SLOT
  return MEAL_SLOTS.find((s) => !taken.has(s.id))?.id ?? null
}

/**
 * The line under a meal chip.
 *
 * It used to read "Cooking tonight", which was wrong twice over the moment
 * there was more than one slot: wrong about the meal, and already wrong about
 * the day — a dinner five days out said "tonight" because the string was
 * written when the only question was whether a night was leftovers.
 */
export function mealMeta(entry) {
  const label = slotLabel(entry.slot)
  return entry.is_leftover ? `${label} · leftovers` : label
}
