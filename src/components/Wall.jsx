import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  addDays,
  dayName,
  isSameDay,
  startOfWeek,
  timeLabel,
  toDateInputValue,
  toInputValue,
  weekDays,
} from '../lib/week'
import { weekCost } from '../lib/cost'
import { useToday } from '../hooks/useToday'
import { combineStatus, useRealtimeTable } from '../hooks/useRealtimeTable'
import { Board } from './Board'
import ChoresPanel from './ChoresPanel'
import ShoppingPanel from './ShoppingPanel'

const DEFAULT_SETTINGS = { chores: 'full', shopping: 'full' }
const LONG_PRESS_MS = 650

/**
 * How far a finger may drift before a long-press is treated as a drag.
 * A fingertip resting on glass emits a steady dribble of pointermove events;
 * cancelling on any movement at all made the settings dialog nearly
 * impossible to open on the actual iPad while working fine with a held-still
 * mouse.
 */
const LONG_PRESS_SLOP_PX = 12

const MEAL_PLAN_QUERY = `
  id, on_date, slot, is_leftover,
  recipe:recipes (
    id, title, cost_confidence,
    ingredients:recipe_ingredients (
      purchase_qty, manual_cost_cents,
      product:products ( id, name, pre_tax_cents, tax_rate_bps )
    )
  )
`

/**
 * The board layout. Chores and shopping get full panels; meals show up as
 * chips in the week itself (kind: 'meal') plus a grocery total in the
 * shopping panel's cart footer — this design has no dedicated meals section
 * or recipe picker, so meal planning stays read-only here for now.
 */
export default function Wall({ profile, people }) {
  const today = useToday()
  const [anchor, setAnchor] = useState(() => startOfWeek(today))
  const [lastSync, setLastSync] = useState(null)
  const [events, setEvents] = useState([])
  const [chores, setChores] = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [mealPlan, setMealPlan] = useState([])
  const [recipes, setRecipes] = useState([])
  const [staples, setStaples] = useState([])
  const [budget, setBudget] = useState(12000)
  const [editing, setEditing] = useState(null)
  const [mealEditing, setMealEditing] = useState(null) // an on_date string, or null
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState(null)

  // 'a' and 'b' are positional, not personal — see tokens.css. Ordering by
  // id keeps the assignment stable across reloads for a two-person household.
  const orderedPeople = useMemo(
    () => [...people].sort((x, y) => x.id.localeCompare(y.id)),
    [people]
  )

  const personFor = useCallback(
    (ownerId) => {
      if (!ownerId) return 'shared'
      const idx = orderedPeople.findIndex((p) => p.id === ownerId)
      return idx === 0 ? 'a' : idx === 1 ? 'b' : 'shared'
    },
    [orderedPeople]
  )

  const initialsForPerson = useCallback(
    (letter) => {
      const a = orderedPeople[0]?.display_name?.slice(0, 1)?.toUpperCase() ?? 'A'
      const b = orderedPeople[1]?.display_name?.slice(0, 1)?.toUpperCase() ?? 'B'
      if (letter === 'a') return a
      if (letter === 'b') return b
      return `${a}${b}`
    },
    [orderedPeople]
  )

  // When the date rolls over, follow it — but only if the board was showing
  // the week that just ended. Someone who deliberately paged forward (on a
  // phone, say) shouldn't have the view yanked out from under them; the wall
  // itself is virtually always sitting on the current week, which is the case
  // that matters.
  const lastTodayRef = useRef(today)

  useEffect(() => {
    const previous = lastTodayRef.current
    lastTodayRef.current = today
    if (previous === today) return

    setAnchor((current) =>
      isSameDay(startOfWeek(current), startOfWeek(previous)) ? startOfWeek(today) : current
    )
  }, [today])

  // ---------------------------------------------------------------- events

  const loadEvents = useCallback(async () => {
    const from = startOfWeek(anchor)
    const to = addDays(from, 7)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at', { ascending: true })

    if (error) setError(error.message)
    else {
      setEvents(data ?? [])
      setError(null)
      setLastSync(new Date())
    }
  }, [anchor])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const eventsStatus = useRealtimeTable('events-sync', 'events', loadEvents)

  // ---------------------------------------------------------------- chores

  // Derived from `today` rather than a fresh `new Date()` per render, so
  // weekly chores actually uncheck themselves when Sunday arrives instead of
  // waiting for some unrelated change to force a re-render.
  const weekStart = useMemo(() => startOfWeek(today), [today])

  const choreIsDone = useCallback(
    (chore) => {
      if (!chore.completed_at) return false
      if (chore.recurrence === 'once') return true
      return new Date(chore.completed_at) >= weekStart
    },
    [weekStart]
  )

  const loadChores = useCallback(async () => {
    const { data, error } = await supabase
      .from('chores')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else {
      setChores(data ?? [])
      setError(null)
      setLastSync(new Date())
    }
  }, [])

  useEffect(() => {
    loadChores()
  }, [loadChores])

  const choresStatus = useRealtimeTable('chores-sync', 'chores', loadChores)

  async function toggleChore(chore) {
    const next = choreIsDone(chore) ? null : new Date().toISOString()
    setChores((cs) => cs.map((c) => (c.id === chore.id ? { ...c, completed_at: next } : c)))
    const { error } = await supabase.from('chores').update({ completed_at: next }).eq('id', chore.id)
    if (error) {
      setError(error.message)
      loadChores()
    }
  }

  async function addChore(title) {
    const { error } = await supabase.from('chores').insert({
      household_id: profile.household_id,
      title,
      recurrence: 'weekly',
      sort_order: chores.length,
    })
    if (error) setError(error.message)
    else loadChores()
  }

  async function removeChore(chore) {
    setChores((cs) => cs.filter((c) => c.id !== chore.id))
    await supabase.from('chores').delete().eq('id', chore.id)
  }

  // -------------------------------------------------------------- shopping

  const loadShopping = useCallback(async () => {
    const { data, error } = await supabase
      .from('list_items')
      .select('*')
      .eq('list', 'shopping')
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else {
      setShoppingItems(data ?? [])
      setError(null)
      setLastSync(new Date())
    }
  }, [])

  useEffect(() => {
    loadShopping()
  }, [loadShopping])

  const shoppingStatus = useRealtimeTable('list-shopping-sync', 'list_items', loadShopping)

  async function toggleShopping(item) {
    const next = !item.checked
    setShoppingItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, checked: next } : x)))
    const { error } = await supabase.from('list_items').update({ checked: next }).eq('id', item.id)
    if (error) {
      setError(error.message)
      loadShopping()
    }
  }

  async function addShopping(body) {
    const { error } = await supabase.from('list_items').insert({
      household_id: profile.household_id,
      list: 'shopping',
      body,
      added_by: profile.id,
    })
    if (error) setError(error.message)
    else loadShopping()
  }

  async function removeShopping(item) {
    setShoppingItems((xs) => xs.filter((x) => x.id !== item.id))
    await supabase.from('list_items').delete().eq('id', item.id)
  }

  // ------------------------------------------------------------------ meals

  const loadMeals = useCallback(async () => {
    const from = toDateInputValue(startOfWeek(anchor))
    const to = toDateInputValue(addDays(startOfWeek(anchor), 7))

    const [planRes, recipeRes, stapleRes, hhRes] = await Promise.all([
      supabase.from('meal_plan').select(MEAL_PLAN_QUERY).gte('on_date', from).lt('on_date', to),
      supabase
        .from('recipes')
        .select('id, title, servings_min, servings_max, cook_minutes, effort, status')
        .neq('status', 'retired')
        .order('title'),
      supabase
        .from('staples')
        .select('weekly_qty, included, manual_unit_cents, product:products ( pre_tax_cents, tax_rate_bps )'),
      supabase.from('household').select('weekly_budget_cents').maybeSingle(),
    ])

    const firstError = planRes.error || recipeRes.error || stapleRes.error || hhRes.error
    if (firstError) return setError(firstError.message)

    setError(null)
    setMealPlan(planRes.data ?? [])
    setRecipes(recipeRes.data ?? [])
    setStaples(stapleRes.data ?? [])
    if (hhRes.data) setBudget(hhRes.data.weekly_budget_cents)
    setLastSync(new Date())
  }, [anchor])

  useEffect(() => {
    loadMeals()
  }, [loadMeals])

  const mealsStatus = useRealtimeTable('meal-plan-sync', 'meal_plan', loadMeals)

  const cost = useMemo(() => weekCost(mealPlan, staples), [mealPlan, staples])

  const mealEntryFor = useCallback(
    (date) => mealPlan.find((p) => p.on_date === date && p.slot === 'dinner'),
    [mealPlan]
  )

  async function pickMeal(date, recipeId) {
    const payload = {
      household_id: profile.household_id,
      on_date: date,
      slot: 'dinner',
      recipe_id: recipeId,
      is_leftover: false,
    }
    const { error } = await supabase.from('meal_plan').upsert(payload, { onConflict: 'household_id,on_date,slot' })
    if (error) setError(error.message)
    else loadMeals()
  }

  async function toggleMealLeftover(entry) {
    const { error } = await supabase.from('meal_plan').update({ is_leftover: !entry.is_leftover }).eq('id', entry.id)
    if (error) setError(error.message)
    else loadMeals()
  }

  async function clearMeal(entry) {
    await supabase.from('meal_plan').delete().eq('id', entry.id)
    loadMeals()
    setMealEditing(null)
  }

  // -------------------------------------------------------------- settings
  //
  // board_settings lives on the household row, so the wall and everyone's
  // phone read the same layout. Opened with a long-press on the board
  // rather than a header button — this is a kiosk, not a settings-heavy app.

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase.from('household').select('board_settings').maybeSingle()
    if (error) return setError(error.message)
    if (data?.board_settings) setSettings({ ...DEFAULT_SETTINGS, ...data.board_settings })
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const settingsStatus = useRealtimeTable('household-settings-sync', 'household', loadSettings)

  // ------------------------------------------------------------------ sync
  //
  // Realtime is the only thing keeping the wall current, and it is not
  // reliable on a device that sleeps: the socket can be gone long before the
  // channel notices. So the board reports the real channel state rather than
  // a hardcoded "Live", and refetches outright whenever the iPad wakes or the
  // network comes back — cheaper than reasoning about whether the socket
  // survived, and correct either way.

  const syncState = combineStatus([
    eventsStatus,
    choresStatus,
    shoppingStatus,
    mealsStatus,
    settingsStatus,
  ])

  const refetchAll = useCallback(() => {
    loadEvents()
    loadChores()
    loadShopping()
    loadMeals()
    loadSettings()
  }, [loadEvents, loadChores, loadShopping, loadMeals, loadSettings])

  useEffect(() => {
    function onWake() {
      if (document.visibilityState !== 'visible') return
      refetchAll()
    }

    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', refetchAll)

    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', refetchAll)
    }
  }, [refetchAll])

  async function updateSetting(key, mode) {
    const next = { ...settings, [key]: mode }
    setSettings(next)
    const { error } = await supabase
      .from('household')
      .update({ board_settings: next })
      .eq('id', profile.household_id)
    if (error) {
      setError(error.message)
      loadSettings()
    }
  }

  const pressTimer = useRef(null)
  const pressOrigin = useRef(null)

  function handlePressStart(e) {
    if (editing || mealEditing || settingsOpen) return
    // Holding a "+" button shouldn't also summon settings behind the dialog
    // it opens.
    if (e.target.closest?.('button, input, a, label')) return

    pressOrigin.current = { x: e.clientX, y: e.clientY }
    pressTimer.current = setTimeout(() => setSettingsOpen(true), LONG_PRESS_MS)
  }

  function handlePressMove(e) {
    const origin = pressOrigin.current
    if (!origin) return
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > LONG_PRESS_SLOP_PX) {
      handlePressEnd()
    }
  }

  function handlePressEnd() {
    clearTimeout(pressTimer.current)
    pressTimer.current = null
    pressOrigin.current = null
  }

  useEffect(() => () => clearTimeout(pressTimer.current), [])

  // ------------------------------------------------------------ board data

  const days = useMemo(
    () =>
      weekDays(anchor).map((d) => {
        const iso = toDateInputValue(d)

        const dayEvents = events
          .filter((e) => isSameDay(new Date(e.starts_at), d))
          .map((e) => ({
            id: e.id,
            title: e.title,
            meta: e.all_day ? undefined : timeLabel(new Date(e.starts_at)),
            person: personFor(e.owner_id),
            kind: 'event',
          }))

        const meal = mealPlan.find((p) => p.on_date === iso && p.slot === 'dinner')
        if (meal?.recipe) {
          dayEvents.push({
            id: `meal:${meal.id}`,
            title: meal.recipe.title,
            meta: meal.is_leftover ? 'Leftovers' : 'Cooking tonight',
            kind: 'meal',
          })
        }

        return {
          date: iso,
          dayOfMonth: d.getDate(),
          dayOfWeek: d.toLocaleDateString(undefined, { weekday: 'long' }),
          shortDayOfWeek: dayName(d),
          // Against `today` from the clock hook, not a fresh `new Date()` —
          // that's what makes the highlight move at midnight.
          isToday: isSameDay(d, today),
          events: dayEvents,
        }
      }),
    [anchor, events, mealPlan, personFor, today]
  )

  function rangeLabel() {
    const sunday = startOfWeek(anchor)
    const saturday = addDays(sunday, 6)
    const month = (d) => d.toLocaleDateString(undefined, { month: 'long' })
    const start = `Sunday, ${month(sunday)} ${sunday.getDate()}`
    const end =
      month(sunday) === month(saturday)
        ? `Saturday, ${saturday.getDate()}`
        : `Saturday, ${month(saturday)} ${saturday.getDate()}`
    return `${start} – ${end}`
  }

  function handleEventPress(id) {
    if (id.startsWith('meal:')) {
      const planId = id.slice('meal:'.length)
      const entry = mealPlan.find((p) => p.id === planId)
      if (entry) setMealEditing(entry.on_date)
      return
    }
    const ev = events.find((e) => e.id === id)
    if (ev) setEditing(ev)
  }

  function handleAddDay(dateIso) {
    setEditing({ _day: new Date(`${dateIso}T00:00`), owner_id: profile.id })
  }

  function handleAddMeal(dateIso) {
    setMealEditing(dateIso)
  }

  const choresDone = chores.filter(choreIsDone).length
  const shoppingRemaining = shoppingItems.filter((i) => !i.checked).length

  const choresPanelProps = {
    chores,
    choreIsDone,
    personFor,
    initialsForPerson,
    onToggle: toggleChore,
    onAdd: addChore,
    onRemove: removeChore,
  }

  const shoppingPanelProps = {
    items: shoppingItems,
    cost,
    budget,
    onToggle: toggleShopping,
    onAdd: addShopping,
    onRemove: removeShopping,
  }

  return (
    <div
      className="board-wrapper"
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerMove={handlePressMove}
      onPointerCancel={handlePressEnd}
    >
      {error && <p className="error banner">{error}</p>}

      <Board
        rangeLabel={rangeLabel()}
        syncLabel={syncText(syncState, lastSync)}
        syncState={syncState}
        days={days}
        settings={settings}
        chores={<ChoresPanel mode="full" {...choresPanelProps} />}
        choresCompact={<ChoresPanel mode="compact" {...choresPanelProps} />}
        choresCount={`${choresDone} of ${chores.length} done`}
        shopping={<ShoppingPanel mode="full" {...shoppingPanelProps} />}
        shoppingCompact={<ShoppingPanel mode="compact" {...shoppingPanelProps} />}
        shoppingCount={`${shoppingRemaining} to buy`}
        onPrevWeek={() => setAnchor(addDays(anchor, -7))}
        onNextWeek={() => setAnchor(addDays(anchor, 7))}
        onEventPress={handleEventPress}
        onAddDay={handleAddDay}
        onAddMeal={handleAddMeal}
        initialsFor={initialsForPerson}
      />

      {editing && (
        <EventEditor
          initial={editing}
          profile={profile}
          people={orderedPeople}
          personFor={personFor}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            loadEvents()
          }}
        />
      )}

      {mealEditing && (
        <MealEditor
          date={mealEditing}
          entry={mealEntryFor(mealEditing)}
          recipes={recipes}
          onPick={(recipeId) => pickMeal(mealEditing, recipeId)}
          onToggleLeftover={() => toggleMealLeftover(mealEntryFor(mealEditing))}
          onClear={() => clearMeal(mealEntryFor(mealEditing))}
          onClose={() => setMealEditing(null)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel settings={settings} onChange={updateSetting} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}

/**
 * What the header says about itself. "Live" appears only when every channel is
 * actually subscribed; once anything drops, the board says so and offers the
 * last time it managed to read from Supabase — which is the number you want
 * when deciding whether to trust what's on the wall.
 */
function syncText(state, lastSync) {
  if (state === 'live') return 'Live'
  if (state === 'connecting') return 'Connecting…'
  return lastSync ? `Offline · ${timeLabel(lastSync)}` : 'Offline'
}

function EventEditor({ initial, profile, people, personFor, onClose, onSaved }) {
  const isNew = !initial.id
  const base = initial._day ?? new Date(initial.starts_at)

  const [title, setTitle] = useState(initial.title ?? '')
  const [allDay, setAllDay] = useState(initial.all_day ?? false)
  const [when, setWhen] = useState(() => {
    if (initial.all_day) return toDateInputValue(base)
    if (isNew) {
      const d = new Date(base)
      d.setHours(18, 0, 0, 0)
      return toInputValue(d)
    }
    return toInputValue(new Date(initial.starts_at))
  })
  const [ownerId, setOwnerId] = useState(initial.owner_id ?? profile.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function toggleAllDay(next) {
    setAllDay(next)
    const current = when.includes('T') ? new Date(when) : new Date(`${when}T18:00`)
    setWhen(next ? toDateInputValue(current) : toInputValue(current))
  }

  async function save() {
    if (!title.trim()) return setError('Give it a title.')
    setBusy(true)
    setError(null)

    const startsAt = allDay ? new Date(`${when}T00:00`) : new Date(when)

    const payload = {
      household_id: profile.household_id,
      title: title.trim(),
      starts_at: startsAt.toISOString(),
      all_day: allDay,
      owner_id: ownerId,
    }

    const { error } = isNew
      ? await supabase.from('events').insert(payload)
      : await supabase.from('events').update(payload).eq('id', initial.id)

    setBusy(false)
    if (error) setError(error.message)
    else onSaved()
  }

  async function remove() {
    setBusy(true)
    const { error } = await supabase.from('events').delete().eq('id', initial.id)
    setBusy(false)
    if (error) setError(error.message)
    else onSaved()
  }

  function colorFor(personId) {
    const letter = personFor(personId)
    if (letter === 'a') return 'var(--person-a)'
    if (letter === 'b') return 'var(--person-b)'
    return 'var(--person-shared)'
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'New event' : 'Edit event'}</h2>

        <input
          autoFocus
          placeholder="What is it?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />

        <input type={allDay ? 'date' : 'datetime-local'} value={when} onChange={(e) => setWhen(e.target.value)} />

        <label className="row">
          <input type="checkbox" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
          <span>All day</span>
        </label>

        <div className="chips">
          {people.map((p) => (
            <button
              key={p.id}
              className={p.id === ownerId ? 'chip on' : 'chip'}
              style={{ borderColor: colorFor(p.id) }}
              onClick={() => setOwnerId(p.id)}
            >
              {p.display_name}
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {!isNew && (
            <button className="ghost danger" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function dayLabel(dateIso) {
  const d = new Date(`${dateIso}T00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

/**
 * Scoped to one day's dinner, matching how EventEditor is scoped to one
 * event — rather than the old whole-week "This week" panel. Opens straight
 * into the recipe search when there's no meal yet; drops into a summary
 * view (leftovers toggle, change, clear) once one is picked.
 */
function MealEditor({ date, entry, recipes, onPick, onToggleLeftover, onClear, onClose }) {
  const [picking, setPicking] = useState(!entry?.recipe)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (entry?.recipe) setPicking(false)
  }, [entry])

  if (picking) {
    const shown = recipes.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()))

    return (
      <div className="scrim" onClick={onClose}>
        <div className="card dialog" onClick={(e) => e.stopPropagation()}>
          <h2>Pick a meal</h2>
          <p className="muted">{dayLabel(date)}</p>

          <input
            autoFocus
            placeholder="Search recipes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="list-scroll">
            {shown.map((r) => (
              <button key={r.id} className="list-button" onClick={() => onPick(r.id)}>
                <span>{r.title}</span>
                <span className="muted meta">
                  {r.servings_min
                    ? `${r.servings_min}${r.servings_max && r.servings_max !== r.servings_min ? `-${r.servings_max}` : ''} servings`
                    : ''}
                  {r.cook_minutes ? ` · ${r.cook_minutes} min` : ''}
                  {r.status === 'conditional' ? ' · conditional' : ''}
                </span>
              </button>
            ))}
            {shown.length === 0 && <p className="muted">Nothing matches.</p>}
          </div>

          <div className="actions">
            {entry?.recipe && (
              <button className="ghost" onClick={() => setPicking(false)}>
                Back
              </button>
            )}
            <button className="ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{dayLabel(date)}</h2>
        <p>
          {entry.recipe.title}
          {entry.recipe.cost_confidence === 'unknown' && <span className="tag"> unpriced</span>}
        </p>

        <div className="chips">
          <button className={entry.is_leftover ? 'chip' : 'chip on'} onClick={onToggleLeftover}>
            Cook
          </button>
          <button className={entry.is_leftover ? 'chip on' : 'chip'} onClick={onToggleLeftover}>
            Leftovers
          </button>
        </div>

        <div className="actions">
          <button onClick={() => setPicking(true)}>Change meal</button>
          <button className="ghost danger" onClick={onClear}>
            Clear
          </button>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const MODE_LABELS = { full: 'Full', compact: 'Compact', off: 'Off' }
const MODE_OPTIONS = ['full', 'compact', 'off']
const SECTION_LABELS = { chores: 'To-Do', shopping: 'Shopping' }

function SettingsPanel({ settings, onChange, onClose }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Board settings</h2>
        <p className="muted">Hold anywhere on the board to reopen this.</p>

        {Object.keys(SECTION_LABELS).map((key) => (
          <div key={key} className="settings-row">
            <span className="settings-row__label">{SECTION_LABELS[key]}</span>
            <div className="chips">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  className={settings[key] === opt ? 'chip on' : 'chip'}
                  onClick={() => onChange(key, opt)}
                >
                  {MODE_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="actions">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
