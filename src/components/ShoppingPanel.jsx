import { useState } from 'react'
import { ChecklistRow } from './ChecklistRow'
import { SkeletonRows } from './Skeleton'
import AddRow from './AddRow'
import { formatCents } from '../lib/cost'

/**
 * The cart footer answers three different questions depending on who's
 * asking: what will this week cost, what's left of the budget, and how much
 * of it is gone. Tapping the figure cycles between them.
 *
 * Kept as local state rather than a household setting — this is a glance,
 * not a preference, and it shouldn't change what the wall shows for the
 * other person mid-shop.
 */
const CART_VIEWS = ['total', 'remaining', 'percent']

function cartFigure(view, cost, budget) {
  const spent = cost.totalCents

  if (view === 'remaining') {
    const left = budget - spent
    return {
      label: left < 0 ? 'Over budget by' : 'Left this week',
      value: formatCents(Math.abs(left)),
      over: left < 0,
    }
  }

  if (view === 'percent') {
    return {
      label: 'Of the weekly budget',
      value: budget > 0 ? `${Math.round((spent / budget) * 100)}%` : '—',
      over: spent > budget,
    }
  }

  return { label: 'Groceries this week', value: formatCents(spent), over: spent > budget }
}

/**
 * Assembles shopping items into panel-list (full, denser grid) and
 * panel-strip (compact). The cart footer surfaces the live weekly grocery
 * total computed from the meal plan — see cost.js.
 */
export default function ShoppingPanel({
  mode,
  loading,
  items,
  cost,
  budget,
  onToggle,
  onAdd,
  onRemove,
}) {
  const [view, setView] = useState(0)

  if (loading) {
    return mode === 'compact' ? (
      <div className="panel-strip">
        <SkeletonRows count={1} />
      </div>
    ) : (
      <div className="panel-list">
        <SkeletonRows count={4} />
      </div>
    )
  }

  const remaining = items.filter((i) => !i.checked).length

  if (mode === 'compact') {
    return (
      <div className="panel-strip">
        <span className="panel-chip">{remaining} to buy</span>
        <span className="panel-chip">{formatCents(cost.totalCents)} groceries</span>
      </div>
    )
  }

  const figure = cartFigure(CART_VIEWS[view % CART_VIEWS.length], cost, budget)

  return (
    <>
      <div className="panel-list">
        {items.length === 0 && <p className="muted">Empty.</p>}
        {items.map((i) => (
          <div key={i.id} className="panel-row">
            <ChecklistRow id={i.id} label={i.body} done={i.checked} density="item" onToggle={() => onToggle(i)} />
            <button className="panel-row__remove" onClick={() => onRemove(i)} aria-label={`Remove ${i.body}`}>
              ×
            </button>
          </div>
        ))}
      </div>
      <AddRow placeholder="Add to shopping list" onAdd={onAdd} />

      <button
        className="panel-cart"
        onClick={() => setView((v) => v + 1)}
        aria-label="Change what the grocery total shows"
      >
        <span className="panel-cart__label">{figure.label}</span>
        <span className={`panel-cart__figure${figure.over ? ' is-over' : ''}`}>
          {figure.value}
          {view % CART_VIEWS.length === 0 && (
            <span className="of"> / {formatCents(budget)}</span>
          )}
        </span>
      </button>

      {/* The projection is only as complete as the price book. Saying so is
          the difference between a number and a guess wearing a number's
          clothes — cost.js counts these precisely so this line can exist. */}
      {cost.unpricedIngredients > 0 && (
        <p className="panel-cart__caveat">
          {cost.unpricedIngredients} unpriced{' '}
          {cost.unpricedIngredients === 1 ? 'ingredient' : 'ingredients'} not counted
        </p>
      )}
    </>
  )
}
