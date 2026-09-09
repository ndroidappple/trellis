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
  const packages = new Map() // product id -> { product, qty }
  const unmatched = [] // needs buying, but we can't say which product

  for (const entry of planEntries) {
    if (entry.is_leftover || !entry.recipe) continue

    for (const ing of entry.recipe.ingredients ?? []) {
      if (!ing.product || ing.purchase_qty == null) {
        unmatched.push({
          name: ing.name ?? ing.preferred_product ?? 'Unnamed ingredient',
          recipeTitle: entry.recipe.title,
          // Distinguishes "no price anywhere" from "priced, but not against a
          // package we could put in a cart" — only the former is missing from
          // the cost total, but both are missing from the shopping list.
          priced: ing.manual_cost_cents != null,
        })
        continue
      }

      const current = packages.get(ing.product.id) ?? { product: ing.product, qty: 0 }
      current.qty += Number(ing.purchase_qty)
      packages.set(ing.product.id, current)
    }
  }

  return { packages: [...packages.values()], unmatched }
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

  const label = (name, count) => (count > 1 ? `${name} ×${count}` : name)

  const lines = packages.map(({ product, qty }) => ({
    key: `product:${product.id}`,
    body: label(product.name, Math.ceil(qty)),
  }))

  for (const s of staples) {
    if (!s.included) continue
    lines.push({
      key: `staple:${s.item}`,
      body: label(s.item, Math.ceil(Number(s.weekly_qty))),
    })
  }

  // Alphabetical is not aisle order, but it is the order that makes a
  // duplicate obvious at a glance. Grouping by aisle wants
  // ingredient_category, which 008 adds and nothing populates yet.
  lines.sort((a, b) => a.body.localeCompare(b.body, undefined, { sensitivity: 'base' }))

  return { lines, unmatched }
}
