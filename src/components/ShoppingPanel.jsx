import { ChecklistRow } from './ChecklistRow'
import AddRow from './AddRow'
import { formatCents } from '../lib/cost'

/**
 * Assembles shopping items into panel-list (full, denser grid) and
 * panel-strip (compact). The cart footer surfaces the live weekly grocery
 * total computed from the meal plan — see cost.js.
 */
export default function ShoppingPanel({ mode, items, cost, budget, onToggle, onAdd, onRemove }) {
  const remaining = items.filter((i) => !i.checked).length

  if (mode === 'compact') {
    return (
      <div className="panel-strip">
        <span className="panel-chip">{remaining} to buy</span>
        <span className="panel-chip">{formatCents(cost.totalCents)} groceries</span>
      </div>
    )
  }

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
      <div className="panel-cart">
        <span className="panel-cart__label">Groceries this week</span>
        <span className="panel-cart__figure">
          {formatCents(cost.totalCents)}
          <span className="of"> / {formatCents(budget)}</span>
        </span>
      </div>
    </>
  )
}
