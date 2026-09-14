import { useState } from 'react'
import { Board } from '../components/Board'
import { defaultLayout } from '../hooks/useWidgetGrid'
import '../components/Board.css'

/**
 * Phase 1 verification harness — NOT shipped UI. Mounts <Board> directly
 * with fake data, bypassing Wall.jsx/App.jsx/Supabase entirely (the real
 * app needs an emailed 8-digit sign-in code, which isn't something this
 * can drive). Reachable only via ?board-spike, same pattern as
 * ./gooey-spike.jsx. Exists to verify the widget-grid MECHANISM (layout,
 * drag, resize, orientation switching) in isolation from real data —
 * ChoresPanel/ShoppingPanel/WeekGrid content itself is unchanged code, not
 * what Phase 1 touched.
 */

function fakeDays() {
  const today = new Date()
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay())
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const shortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const isToday = d.toDateString() === today.toDateString()
    const isPast = d < today && !isToday
    return {
      date: iso,
      dayOfMonth: d.getDate(),
      dayOfWeek: isToday ? dayNames[i] : shortNames[i],
      shortDayOfWeek: shortNames[i],
      isToday,
      isPast,
      events:
        i === 2
          ? [{ id: 'e1', title: 'Dentist', meta: '10:00 AM', kind: 'event', person: 'a' }]
          : i === 4
            ? [{ id: 'e2', title: 'Chicken Katsu Curry', meta: 'Dinner', kind: 'meal' }]
            : [],
      canAddMeal: true,
    }
  })
}

function FakePanel({ label, rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
      {rows.map((r) => (
        <div
          key={r}
          style={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            background: 'var(--row-face)',
            borderRadius: 10,
            fontSize: 16,
          }}
        >
          {label} — {r}
        </div>
      ))}
    </div>
  )
}

export default function BoardSpike() {
  const [layout, setLayout] = useState({
    portrait: defaultLayout('portrait'),
    landscape: defaultLayout('landscape'),
  })
  const [rearranging, setRearranging] = useState(false)
  const days = useState(fakeDays)[0]

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'fixed',
          top: 4,
          right: 4,
          zIndex: 999,
          display: 'flex',
          gap: 6,
          background: 'white',
          padding: 6,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
          fontSize: 12,
        }}
      >
        {/* Real orientation switching comes from useOrientation's matchMedia
            — resize the browser window (or use devtools' device toolbar) to
            exercise portrait vs. landscape, same as the real app. */}
        <button onClick={() => setRearranging((v) => !v)}>{rearranging ? 'Stop rearrange' : 'Rearrange'}</button>
        <button onClick={() => console.log('layout', JSON.stringify(layout, null, 2))}>log layout</button>
      </div>
      <div className="board-wrapper">
        <Board
          todayLabel="Test Day, January 1"
          rangeLabel="January 1 – 7"
          syncLabel="Live"
          syncState="live"
          days={days}
          settings={{ chores: 'full', shopping: 'full' }}
          chores={<FakePanel label="Chore" rows={['Dishes', 'Trash', 'Laundry', 'Vacuum']} />}
          choresCount="2 of 4 done"
          shopping={<FakePanel label="Item" rows={['Milk', 'Eggs', 'Bread']} />}
          shoppingCount="3 to buy"
          widgetLayout={layout}
          rearranging={rearranging}
          onCommitWidgetLayout={(orientation, next) =>
            setLayout((prev) => ({ ...prev, [orientation]: next }))
          }
          onOpenBook={() => console.log('open book')}
          onOpenHome={() => console.log('open home')}
          onOpenMenu={() => console.log('open menu')}
          onOpenChores={() => console.log('open chores')}
          onOpenShopping={() => console.log('open shopping')}
        />
      </div>
    </div>
  )
}
