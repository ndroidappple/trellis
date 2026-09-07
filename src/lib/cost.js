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

export function weekCost(planEntries, staples) {
  const packages = new Map() // product id -> { product, qty }
  let unpricedIngredients = 0

  for (const entry of planEntries) {
    if (entry.is_leftover || !entry.recipe) continue

    for (const ing of entry.recipe.ingredients ?? []) {
      // No product and no manual price means we genuinely don't know what this
      // costs. Counted, so the UI can say the projection is incomplete rather
      // than silently treating it as free.
      if (!ing.product || ing.purchase_qty == null) {
        if (ing.manual_cost_cents == null) unpricedIngredients += 1
        continue
      }

      const current = packages.get(ing.product.id) ?? { product: ing.product, qty: 0 }
      current.qty += Number(ing.purchase_qty)
      packages.set(ing.product.id, current)
    }
  }

  let mealsCents = 0
  for (const { product, qty } of packages.values()) {
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
    distinctProducts: packages.size,
  }
}
