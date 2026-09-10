/**
 * Weekly cost projection.
 *
 * Two ideas do the work here:
 *
 * 1. Leftover nights cost nothing. Only entries with is_leftover = false and a
 *    real recipe contribute.
 *
 * 2. Shared ingredients are bought once. Every ingredient across the week's cook
 *    nights is grouped by product, the fractional package quantities are summed,
 *    and only then rounded UP to whole packages. Two recipes each using half a
 *    turkey package cost one package, not two. Summing per-recipe costs instead
 *    would overstate the week badly, because these recipes are deliberately
 *    designed around ingredient overlap.
 */

/** Basis points: 150 = 1.50%. Rounds half up to the cent. */
export function afterTaxCents(preTaxCents, bps) {
  return preTaxCents + Math.round((preTaxCents * bps) / 10000)
}

export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * The week's cook nights, resolved into whole packages of real products.
 *
 * Extracted so the cost projection and the shopping list cannot disagree
 * about what the week needs. They are the same question asked twice — "what
 * will you put in the cart" — and answering it in two places is how the
 * footer total and the list underneath it drift apart.
 */
export function weekPackages(planEntries) {
  const packages = new Map() // product id -> { product, qty, categories }
  const unmatched = [] // needs buying, but we can't say which product

  for (const entry of planEntries) {
    if (entry.is_leftover || !entry.recipe) continue

    for (const ing of entry.recipe.ingredients ?? []) {
      if (!ing.product || ing.purchase_qty == null) {
        unmatched.push({
          name: ing.name ?? ing.preferred_product ?? 'Unnamed ingredient',
          recipeTitle: entry.recipe.title,
          category: ing.ingredient_category ?? null,
          // Distinguishes "no price anywhere" from "priced, but not against a
          // package we could put in a cart" — only the former is missing from
          // the cost total, but both are missing from the shopping list.
          priced: ing.manual_cost_cents != null,
        })
        continue
      }

      const current =
        packages.get(ing.product.id) ?? { product: ing.product, qty: 0, categories: [] }
      current.qty += Number(ing.purchase_qty)
      // One product can be reached from several ingredient rows, and 010
      // categorised each row independently, so they can disagree. Collected
      // rather than last-one-wins so the aisle can be the commonest answer.
      if (ing.ingredient_category) current.categories.push(ing.ingredient_category)
      packages.set(ing.product.id, current)
    }
  }

  return { packages: [...packages.values()], unmatched }
}

/** The commonest category among the ingredients that reached one product. */
function commonestCategory(categories) {
  if (!categories?.length) return null

  const counts = new Map()
  for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1)

  let best = null
  let bestCount = 0
  for (const [category, n] of counts) {
    if (n > bestCount) {
      best = category
      bestCount = n
    }
  }
  return best
}

export function weekCost(planEntries, staples) {
  const { packages, unmatched } = weekPackages(planEntries)

  // No product and no manual price means we genuinely don't know what this
  // costs. Counted, so the UI can say the projection is incomplete rather
  // than silently treating it as free.
  const unpricedIngredients = unmatched.filter((u) => !u.priced).length

  let mealsCents = 0
  for (const { product, qty } of packages) {
    mealsCents +=
      Math.ceil(qty) * afterTaxCents(product.pre_tax_cents, product.tax_rate_bps)
  }

  let staplesCents = 0
  for (const s of staples) {
    if (!s.included) continue
    const unit = s.product
      ? afterTaxCents(s.product.pre_tax_cents, s.product.tax_rate_bps)
      : s.manual_unit_cents ?? 0
    staplesCents += Math.round(unit * Number(s.weekly_qty))
  }

  return {
    mealsCents,
    staplesCents,
    totalCents: mealsCents + staplesCents,
    unpricedIngredients,
    distinctProducts: packages.length,
  }
}

/**
 * The same week, expressed as things you can tick off in a shop.
 *
 * Deliberately built from weekPackages rather than from the recipes, so the
 * shared-ingredient rounding applies here too: two recipes each wanting half
 * a turkey package produce one line saying "Ground turkey", not two lines
 * that send you back for a second packet.
 *
 * Staples are included because the cart footer's total includes them. A
 * button labelled "add this week's groceries" that quietly produced a
 * shorter list than the number printed above it would be its own small lie.
 *
 * Ingredients with no product are omitted and returned separately — the
 * caller says so rather than the list silently coming up short.
 */
export function groceryLines(planEntries, staples) {
  const { packages, unmatched } = weekPackages(planEntries)

  // `body` is the bare name and `qty` is a number, since 013. They used to be
  // one string with a "×2" suffix, which made the label the source of truth
  // for a count — so "Ground turkey" and "Ground turkey ×2" were different
  // items to the dedupe in pendingGroceries, and a heavier week added a
  // second row instead of a bigger number.
  const lines = packages.map(({ product, qty, categories }) => ({
    key: `product:${product.id}`,
    body: product.name,
    qty: Math.ceil(qty),
    category: commonestCategory(categories),
  }))

  for (const s of staples) {
    if (!s.included) continue
    lines.push({
      key: `staple:${s.item}`,
      body: s.item,
      qty: Math.ceil(Number(s.weekly_qty)),
      // Staples never pass through an ingredient row, so they carry their own
      // aisle (013) rather than inheriting one.
      category: s.category ?? null,
    })
  }

  // Alphabetical within the returned list. The UI groups by aisle for
  // shopping order (see lib/shopping.js); this order is what makes a
  // duplicate obvious when the lines are read as a flat set.
  lines.sort((a, b) => a.body.localeCompare(b.body, undefined, { sensitivity: 'base' }))

  return { lines, unmatched }
}

/**
 * What one recipe costs, and what one serving of it costs.
 *
 * The basis is *consumed* cost, not checkout cost — `purchase_qty` x unit
 * price, summed, with no rounding up to whole packages. 005 names both, and
 * the choice matters here:
 *
 *   Rounding a single recipe up to whole packages would price the half-pack
 *   of turkey it uses as a full one, and every recipe in the book would read
 *   dearer than the week that contains it. The week rounds because the week
 *   is a trip to the shop; one recipe is a portion of that trip, and the
 *   question this figure answers — "is this a cheaper dinner than that one"
 *   — is about the food, not the packaging.
 *
 * So these numbers are deliberately not additive with the cart total, and
 * summing seven of them will not reproduce it. That is the same
 * shared-ingredient effect `weekPackages` exists for, pointing the other way.
 *
 * Unpriced ingredients are counted rather than treated as free. A recipe
 * with three ingredients nobody has priced is not a cheap recipe, and the
 * shelf marks it as a floor ("$1.66+") rather than a price.
 *
 * `manual_cost_cents` is counted here. Every manual price in the bank today
 * is 0 — soy sauce, spices, water: pantry rows Ed marked as costing nothing
 * — so this changes no number now, but it means a real one typed later lands
 * somewhere. Worth knowing that `weekCost` above does *not* count them, so
 * the day someone types a non-zero manual price the two figures will
 * disagree until that is reconciled.
 */
export function recipeCost(recipe) {
  const ingredients = recipe?.ingredients ?? []

  let cents = 0
  let unpriced = 0

  for (const ing of ingredients) {
    // Both halves are needed to price a row: a product says what it costs,
    // purchase_qty says how much of it this recipe takes. Three of Stuffed
    // peppers' rows have the first and not the second, which is why "has a
    // product" is not the test.
    if (ing.product && ing.purchase_qty != null) {
      cents +=
        Number(ing.purchase_qty) *
        afterTaxCents(ing.product.pre_tax_cents, ing.product.tax_rate_bps)
    } else if (ing.manual_cost_cents != null) {
      cents += ing.manual_cost_cents
    } else {
      unpriced += 1
    }
  }

  /*
   * servings_min, not max, and not the midpoint.
   *
   * Five of the recipes carry a range. Dividing by the larger end would
   * quietly produce the flattering number, and this figure exists to be
   * trusted at the moment somebody is deciding whether they can afford to
   * cook something — the direction to err is dearer.
   */
  const servings = recipe?.servings_min ?? null

  /*
   * `cents > 0` is what keeps the Protein Berry Smoothie honest. Four of its
   * five rows are unpriced and the fifth is water at 0, so it would otherwise
   * announce itself as $0.00 a serving and sort to the top of a list whose
   * whole job is finding the cheapest dinner. Nothing priced above zero means
   * nothing known, and it says so instead.
   */
  const known = cents > 0 && servings > 0

  return {
    cents: Math.round(cents),
    servings,
    perServingCents: known ? Math.round(cents / servings) : null,
    unpriced,
    /** Priced, and nothing missing — the only kind that sorts as a real price. */
    complete: known && unpriced === 0,
  }
}
