/*
 * Recipe filtering: the pure half of the recipe book's shelf.
 *
 * Lives in lib/ rather than in the component for the same reason cost.js and
 * week.js do — it is decision logic with no DOM in it, it is the part most
 * likely to be wrong in a way nobody notices, and it can be tested directly
 * from a node harness without rendering anything.
 */

/**
 * Proteins are derived, not tagged.
 *
 * A `tags` array would have to be maintained by hand on every new recipe and
 * would drift the first time someone forgot; the ingredient list already
 * knows. Matching runs over normalized_name where 010 supplied one — that is
 * exactly what normalisation was for — and falls back to the raw name.
 *
 * The exclusions matter more than the matches. "Chicken broth" is in nine
 * recipes and is not what anyone means by a chicken dinner, and "chicken
 * sausage" belongs under Sausage rather than counting as both.
 */
export const PROTEINS = [
  { id: 'chicken', label: 'Chicken', match: /chicken/, exclude: /broth|stock|sausage|bouillon/ },
  { id: 'turkey', label: 'Turkey', match: /turkey/ },
  { id: 'beef', label: 'Beef', match: /beef|steak|bulgogi/ },
  { id: 'pork', label: 'Pork', match: /pork|bacon|prosciutto|chorizo/ },
  { id: 'sausage', label: 'Sausage', match: /sausage/ },
  { id: 'seafood', label: 'Seafood', match: /fish|salmon|tuna|shrimp|prawn|cod|scallop/ },
  { id: 'lamb', label: 'Lamb', match: /lamb/ },
  { id: 'egg', label: 'Egg', match: /\begg/ },
]

export function proteinsIn(recipe) {
  // The title counts too: "Steak salad" has no ingredient rows at all, and a
  // protein filter that can't find the steak in it is not much of a filter.
  const parts = [
    recipe.title,
    ...(recipe.ingredients ?? []).map((i) => i.normalized_name || i.name || ''),
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase())

  /*
   * Match and exclude are judged per ingredient, never against everything
   * joined together, and the difference is not subtle.
   *
   * Nine recipes contain chicken broth. Testing one combined string meant
   * "broth" anywhere disqualified "chicken" everywhere — so every chicken
   * recipe in the book failed the chicken test, the filter matched nothing,
   * and the chip did not even appear. Per-part, "chicken breast" matches on
   * its own line and "chicken broth" is excluded on its own line, which is
   * what the exclusion was always meant to say.
   */
  const found = new Set()
  for (const p of PROTEINS) {
    for (const part of parts) {
      if (p.match.test(part) && !(p.exclude && p.exclude.test(part))) {
        found.add(p.id)
        break
      }
    }
  }

  // Returned in PROTEINS order so the result is stable and comparable.
  return PROTEINS.filter((p) => found.has(p.id)).map((p) => p.id)
}

export const TIME_FILTERS = [
  { id: 'any', label: 'Any' },
  { id: 'u30', label: '30 min or less', match: (r) => minutesOf(r) != null && minutesOf(r) <= 30 },
  { id: 'u60', label: 'Under an hour', match: (r) => minutesOf(r) != null && minutesOf(r) < 60 },
]

export const EFFORT_FILTERS = [
  { id: 'any', label: 'Any' },
  { id: 'Easy', label: 'Easy', match: (r) => r.effort === 'Easy' },
  { id: 'Medium', label: 'Medium', match: (r) => r.effort === 'Medium' },
]

export const SHOW_FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'active', label: 'In rotation', match: (r) => r.status === 'active' },
  { id: 'leftovers', label: 'Good leftovers', match: (r) => (r.tags ?? []).includes('leftovers') },
  { id: 'unfinished', label: 'Needs work', match: (r) => r.step_count === 0 || r.ingredient_count === 0 },
]

export function minutesOf(r) {
  return r.total_minutes ?? r.cook_minutes ?? null
}

/**
 * What the shelf does about price — one control, three states.
 *
 * Lives here with the other chip sets rather than in the component, because
 * it is the same kind of thing: a labelled row of mutually exclusive options
 * the book renders with `FilterRow`.
 *
 * Each chip names what you get rather than which switch you are flipping,
 * and the three states exist because seeing a price and sorting by one are
 * different questions. "Per serving" is for browsing normally while still
 * knowing what things cost; "Cheapest first" is for the evening the budget
 * is nearly gone.
 */
export const PRICE_OPTIONS = [
  { id: 'off', label: 'Off' },
  { id: 'serving', label: 'Per serving' },
  { id: 'cheapest', label: 'Cheapest first' },
]
