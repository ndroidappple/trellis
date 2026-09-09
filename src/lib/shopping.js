/**
 * Aisles.
 *
 * The list used to be sorted alphabetically, which was chosen so a duplicate
 * would be obvious at a glance. It does that, and nothing else: alphabetical
 * order puts the yoghurt between the yeast and the ziti, so a shop reads the
 * whole list once per aisle. Grouping is the same information in walking
 * order.
 *
 * The vocabulary is `recipe_ingredients.ingredient_category` from 008/010,
 * unchanged — a grocery line inherits its aisle from the ingredient it came
 * from, and a second spelling of "produce" would split an aisle in two.
 */

/**
 * Store order, not alphabetical order. Perimeter first (produce, meat,
 * seafood, dairy, bakery), then the middle, then the freezers last so nothing
 * frozen sits in a trolley longer than it has to. `other` is deliberately
 * last: it holds the hand-typed rows nobody categorised.
 */
export const AISLES = [
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'pantry',
  'spice',
  'beverage',
  'supplement',
  'frozen',
  'other',
]

const AISLE_LABELS = {
  produce: 'Produce',
  meat: 'Meat',
  seafood: 'Seafood',
  dairy: 'Dairy & eggs',
  bakery: 'Bakery',
  pantry: 'Pantry',
  spice: 'Spices',
  beverage: 'Drinks',
  supplement: 'Supplements',
  frozen: 'Frozen',
  other: 'Anything else',
}

/**
 * An uncategorised row is not an error and should not be labelled like one.
 * It is something a person typed, which is the most human thing on the list.
 */
export function aisleLabel(category) {
  return AISLE_LABELS[category] ?? AISLE_LABELS.other
}

const AISLE_INDEX = new Map(AISLES.map((a, i) => [a, i]))

function aisleRank(category) {
  return AISLE_INDEX.get(category) ?? AISLE_INDEX.get('other')
}

/**
 * The list, in walking order, as groups.
 *
 * Ticked items stay in their aisle rather than sinking to a "done" pile at
 * the bottom. Two reasons: the list is read while walking past the shelf the
 * item is on, so moving it is moving it away from where you are standing —
 * and a group that empties as you go is the clearest possible signal that the
 * aisle is finished. They sort last *within* the aisle, which gets them out
 * of the way without getting them out of context.
 *
 * Empty groups are dropped, so the headings describe the shop you are
 * actually doing rather than every aisle that exists.
 */
export function groupByAisle(items) {
  const groups = new Map()

  for (const item of items) {
    const key = AISLE_INDEX.has(item.category) ? item.category : 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }

  return [...groups.entries()]
    .sort((a, b) => aisleRank(a[0]) - aisleRank(b[0]))
    .map(([category, groupItems]) => ({
      category,
      label: aisleLabel(category),
      items: [...groupItems].sort(
        (a, b) =>
          Number(a.checked) - Number(b.checked) ||
          a.body.localeCompare(b.body, undefined, { sensitivity: 'base' })
      ),
      remaining: groupItems.filter((i) => !i.checked).length,
    }))
}

/**
 * "×2", or nothing at all.
 *
 * A quantity of one is the overwhelming majority of rows and saying "×1" on
 * every one of them is noise that makes the genuine ×12 harder to spot.
 */
export function qtyLabel(qty) {
  const n = Number(qty ?? 1)
  return Number.isFinite(n) && n > 1 ? `×${n % 1 === 0 ? n : n.toFixed(1)}` : null
}
