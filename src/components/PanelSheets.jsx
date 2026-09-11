import Sheet from './Sheet'
import AddRow from './AddRow'
import ChoresPanel from './ChoresPanel'
import { ShoppingAisles } from './ShoppingPanel'
import { formatCents } from '../lib/cost'

/**
 * Full-page versions of the two dock sections.
 *
 * The dock panels are sized for a wall: a 340px box read from across a
 * kitchen, showing what is outstanding and little else. That is the right
 * shape for glancing and the wrong shape for doing — planning a week of
 * chores or working through a shop means scrolling a list four rows at a
 * time inside a box with a declared height.
 *
 * These are not a different feature. They are the same list with the height
 * it wanted, plus the things the dock deliberately does not carry: deleting,
 * clearing, and the detail behind the caveats.
 *
 * Both reuse the panel components rather than re-implementing them, so the
 * page and the dock cannot drift into disagreeing about what is on the list.
 */

export function ToDoSheet({ weekLabel, choresPanelProps, onClose }) {
  const { pendingCount = 0, choreCount = 0 } = choresPanelProps

  const subtitle =
    choreCount === 0
      ? 'Nothing on the list yet'
      : `${pendingCount === 0 ? 'Nothing' : pendingCount} left · ${weekLabel}`

  return (
    <Sheet title="Weekly To Do" subtitle={subtitle} onClose={onClose}>
      {/* The panel renders its own groups, palette and add row. On a page it
          is the same component with room to breathe rather than a second
          implementation that would drift. */}
      <div className="sheet__panel">
        <ChoresPanel mode="full" {...choresPanelProps} />
      </div>
    </Sheet>
  )
}

export function ShoppingSheet({
  items,
  cost,
  budget,
  pendingGroceries,
  unmatched = [],
  onToggle,
  onAdd,
  onRemove,
  onAddGroceries,
  onClearChecked,
  onClose,
}) {
  const remaining = items.filter((i) => !i.checked).length
  const checked = items.length - remaining

  return (
    <Sheet
      title="Shopping"
      subtitle={
        items.length === 0
          ? 'The list is empty'
          : `${remaining} to buy · ${formatCents(cost.totalCents)} of ${formatCents(budget)}`
      }
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={onClearChecked} disabled={checked === 0}>
            {checked > 0 ? `Clear ${checked} ticked` : 'Nothing ticked'}
          </button>
          <button onClick={onAddGroceries} disabled={pendingGroceries === 0}>
            {pendingGroceries > 0
              ? `Add ${pendingGroceries} from meals`
              : 'Meals are on the list'}
          </button>
        </>
      }
    >
      <AddRow placeholder="Add to shopping list" onAdd={onAdd} />

      {items.length === 0 && <p className="sheet__empty">Nothing on the list.</p>}

      <ShoppingAisles items={items} onToggle={onToggle} onRemove={onRemove} removeButton />

      {/* The dock can only afford to say how many ingredients are unpriced.
          The page has room to say which — and an unpriced ingredient is
          missing from the total *and* from the list, so this is the only
          place the shop is told what it is not being told about. */}
      {unmatched.length > 0 && (
        <section className="sheet__section">
          <span className="sheet__heading">Not on the list</span>
          <p className="sheet__empty">
            These are in this week's recipes but have no product to buy, so they
            are in neither the list above nor the total.
          </p>
          {unmatched.map((u, i) => (
            <div key={`${u.name}:${i}`} className="sheet-row" role="note">
              <span>{u.name}</span>
              <span className="sheet-row__meta">
                {u.recipeTitle}
                {u.priced ? ' · priced, no package' : ' · no price'}
              </span>
            </div>
          ))}
        </section>
      )}
    </Sheet>
  )
}
