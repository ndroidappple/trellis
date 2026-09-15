import { useState } from 'react'
import { SkeletonRows } from './Skeleton'
import AddRow from './AddRow'
import SwipeAway from './SwipeAway'
import { formatCents } from '../lib/cost'
import { groupByAisle, qtyLabel } from '../lib/shopping'
import './PanelContent.css'

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
 * One line of the list.
 *
 * Not a ChecklistRow, unlike the chores panel. A shopping row is read while
 * walking — the name has to survive being glanced at sideways from a metre
 * away — and it carries a count, which ChecklistRow has nowhere to put. The
 * count used to live inside the name as a "×2" suffix, which made it
 * unstyleable and made "Ground turkey" and "Ground turkey ×2" two different
 * items to the dedupe that decides what the meal plan still owes the list.
 */
export function ShoppingRow({ item, onToggle }) {
  const qty = qtyLabel(item.qty)

  return (
    <button
      type="button"
      className={`shop-row${item.checked ? ' is-checked' : ''}`}
      role="checkbox"
      aria-checked={item.checked}
      onClick={() => onToggle(item)}
    >
      <span className="shop-row__box" aria-hidden="true">
        {item.checked && (
          <svg viewBox="0 0 16 16" width="15" height="15">
            <path
              d="M3 8.5l3.2 3.2L13 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <span className="shop-row__name">{item.body}</span>

      {/* Only when there is more than one. "×1" on almost every row is noise
          that makes the genuine ×12 harder to find. */}
      {qty && <span className="shop-row__qty">{qty}</span>}
    </button>
  )
}

/**
 * The list as aisles.
 *
 * Shared by the dock panel and the full-page sheet so the two cannot drift
 * into disagreeing about what the shop looks like.
 */
export function ShoppingAisles({
  items,
  onToggle,
  onRemove,
  /**
   * Whether to also show the persistent "×".
   *
   * Separate from `onRemove` because the two questions came apart the moment
   * a swipe existed: *may* this row be deleted, and does it carry a button
   * saying so. The dock answers yes and no.
   */
  removeButton = false,
  dense = false,
}) {
  const groups = groupByAisle(items)

  return (
    <div className={dense ? 'shop-aisles shop-aisles--dense' : 'shop-aisles'}>
      {groups.map((group) => (
        <section key={group.category} className="shop-aisle">
          <h3 className="shop-aisle__head">
            <span>{group.label}</span>
            {/* A finished aisle says so, rather than going quiet. On a list
                you walk past once, "done" is the useful state to be able to
                see from the end of the row. */}
            <span className="shop-aisle__count">
              {group.remaining === 0 ? 'done' : `${group.remaining} left`}
            </span>
          </h3>

          <div className="shop-aisle__items">
            {group.items.map((item) => (
              /*
               * Swipe deletes in both places; the "×" stays only on the page.
               *
               * That asymmetry is the original reasoning intact rather than
               * reversed. A permanent 44px target beside the primary tap was
               * refused in the dock because it is a mis-tap generator on a
               * wall, for something done about once a month — and it still
               * would be. A swipe costs no pixels at rest and cannot be hit
               * by a thumb that meant to tick, so the dock can finally have
               * the action without the neighbour. The page keeps the button
               * as well, because a gesture cannot be the only route to
               * anything.
               */
              <SwipeAway key={item.id} onDelete={onRemove ? () => onRemove(item) : undefined}>
                {removeButton && onRemove ? (
                  <div className="shop-row-wrap">
                    <ShoppingRow item={item} onToggle={onToggle} />
                    <button
                      className="panel-row__remove"
                      data-no-swipe
                      onClick={() => onRemove(item)}
                      aria-label={`Remove ${item.body}`}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <ShoppingRow item={item} onToggle={onToggle} />
                )}
              </SwipeAway>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * Assembles shopping items into the dock panel. The cart footer surfaces the
 * live weekly grocery total computed from the meal plan — see cost.js.
 */
export default function ShoppingPanel({
  mode = 'full',
  loading,
  items,
  cost,
  budget,
  pendingGroceries = 0,
  onToggle,
  onAdd,
  onAddGroceries,
  /* Swipe-only here: see the note in ShoppingAisles about why the dock
     refuses a permanent delete button and can still have the action. */
  onRemove,
}) {
  const [view, setView] = useState(0)

  if (loading) {
    if (mode === 'micro') {
      return (
        <div className="panel-micro">
          <SkeletonRows count={1} />
        </div>
      )
    }
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

  if (mode === 'micro') {
    return (
      <div className="panel-micro">
        <span className="panel-micro__figure">{remaining}</span>
        <span className="panel-micro__label">to buy</span>
      </div>
    )
  }

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
        <ShoppingAisles items={items} onToggle={onToggle} onRemove={onRemove} dense />
      </div>

      <AddRow
        placeholder="Add to shopping list"
        onAdd={onAdd}
        collapsible
        openLabel="Add an item"
      />

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

      {/* One line, always, whichever of the two halves is present — the panel
          has a declared height, so a footer that sometimes wraps to two rows
          steals a row from the list above it depending on the week's data. */}
      <div className="panel-cart__footer">
        <button
          className="panel-cart__add"
          onClick={onAddGroceries}
          disabled={pendingGroceries === 0}
        >
          {pendingGroceries > 0
            ? `Add ${pendingGroceries} from meals`
            : 'Meals are on the list'}
        </button>

        {/* The projection is only as complete as the price book. Saying so is
            the difference between a number and a guess wearing a number's
            clothes — cost.js counts these precisely so this line can exist.
            It now covers the list as well as the total: an ingredient with no
            product is missing from both. */}
        {cost.unpricedIngredients > 0 && (
          <span className="panel-cart__caveat">
            {cost.unpricedIngredients} unpriced{' '}
            {cost.unpricedIngredients === 1 ? 'ingredient' : 'ingredients'} not
            counted or added
          </span>
        )}
      </div>
    </>
  )
}
