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
  weekLabel,
} from '../lib/week'
import { daysInYear, daysLeftInYear, dayOfYear, fiscalWeek, yearProgress } from '../lib/year'
import { groceryLines, weekCost } from '../lib/cost'
import { useToday } from '../hooks/useToday'
import { combineStatus, useRealtimeTable } from '../hooks/useRealtimeTable'
import { Board } from './Board'
import Sheet from './Sheet'
import ChoresPanel from './ChoresPanel'
import ShoppingPanel from './ShoppingPanel'
import './Sheet.css'

const DEFAULT_SETTINGS = { chores: 'full', shopping: 'full', flourish: 'week' }
const LONG_PRESS_MS = 650

/**
 * Long enough that someone can cross a kitchen to reach it. A phone's
 * five-second undo assumes the screen is already in your hand; this one
 * frequently isn't.
 */
const UNDO_MS = 9000

/**
 * Optional asides for the header's second line — the board having a bit of
 * character rather than telling you anything you need.
 *
 * Tapping the line cycles them, and the same list drives the settings
 * dialog. Deliberately not advertised: someone poking at the board finds
 * them, someone reading the week never notices they exist.
 */
const FLOURISHES = [
  { id: 'off', label: 'Off', render: () => null },
  { id: 'week', label: 'Week', render: (d) => `Week ${fiscalWeek(d)}` },
  {
    id: 'progress',
    label: 'Year %',
    render: (d) => `${yearProgress(d)}% through ${d.getFullYear()}`,
  },
  {
    id: 'daysLeft',
    label: 'Days left',
    render: (d) => {
      const n = daysLeftInYear(d)
      return n === 0 ? 'Last day of the year' : `${n} days left in ${d.getFullYear()}`
    },
  },
  {
    id: 'dayOfYear',
    label: 'Day no.',
    render: (d) => `Day ${dayOfYear(d)} of ${daysInYear(d.getFullYear())}`,
  },
]

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
      name, preferred_product, purchase_qty, manual_cost_cents,
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
  const [dayViewing, setDayViewing] = useState(null) // an on_date string, or null
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState(null)
  const [undo, setUndo] = useState(null) // { message, run } while offered
  const [loaded, setLoaded] = useState({})

  /**
   * Marked on first settle of each domain, success or failure. Failure counts
   * deliberately: a board stuck in placeholders forever is worse than one
   * showing an error, and the error banner covers that case.
   */
  const markLoaded = useCallback((key) => {
    setLoaded((l) => (l[key] ? l : { ...l, [key]: true }))
  }, [])

  const booted = loaded.events && loaded.chores && loaded.shopping && loaded.meals

  const undoTimer = useRef(null)

  const offerUndo = useCallback((message, run) => {
    clearTimeout(undoTimer.current)
    setUndo({ message, run })
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS)
  }, [])

  useEffect(() => () => clearTimeout(undoTimer.current), [])

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
    markLoaded('events')
  }, [anchor, markLoaded])

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
    markLoaded('chores')
  }, [markLoaded])

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

    const { error } = await supabase.from('chores').delete().eq('id', chore.id)
    if (error) {
      setError(error.message)
      return loadChores()
    }

    // Restored as a new row rather than the same id — nothing references a
    // chore by id, and the alternative is a soft-delete column for a
    // two-person to-do list.
    offerUndo(`Deleted “${chore.title}”`, async () => {
      const { error: undoError } = await supabase.from('chores').insert({
        household_id: chore.household_id,
        title: chore.title,
        recurrence: chore.recurrence,
        sort_order: chore.sort_order,
        assignee_id: chore.assignee_id ?? null,
        completed_at: chore.completed_at ?? null,
      })
      if (undoError) setError(undoError.message)
      loadChores()
    })
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
    markLoaded('shopping')
  }, [markLoaded])

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

    const { error } = await supabase.from('list_items').delete().eq('id', item.id)
    if (error) {
      setError(error.message)
      return loadShopping()
    }

    offerUndo(`Removed “${item.body}”`, async () => {
      const { error: undoError } = await supabase.from('list_items').insert({
        household_id: item.household_id,
        list: item.list,
        body: item.body,
        added_by: item.added_by,
        checked: item.checked,
      })
      if (undoError) setError(undoError.message)
      loadShopping()
    })
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
        .select('item, weekly_qty, included, manual_unit_cents, product:products ( pre_tax_cents, tax_rate_bps )'),
      supabase.from('household').select('weekly_budget_cents').maybeSingle(),
    ])

    const firstError = planRes.error || recipeRes.error || stapleRes.error || hhRes.error
    markLoaded('meals')
    if (firstError) return setError(firstError.message)

    setError(null)
    setMealPlan(planRes.data ?? [])
    setRecipes(recipeRes.data ?? [])
    setStaples(stapleRes.data ?? [])
    if (hhRes.data) setBudget(hhRes.data.weekly_budget_cents)
    setLastSync(new Date())
  }, [anchor, markLoaded])

  useEffect(() => {
    loadMeals()
  }, [loadMeals])

  const mealsStatus = useRealtimeTable('meal-plan-sync', 'meal_plan', loadMeals)

  const cost = useMemo(() => weekCost(mealPlan, staples), [mealPlan, staples])

  // ------------------------------------------------- meal plan → shopping
  //
  // The chain recipe → ingredient → product → cost already existed; the last
  // link to the actual list did not, so the cart footer showed a total
  // derived from the week's meals directly above a list of hand-typed items
  // that had nothing to do with it.
  //
  // Matching on body text rather than an id is deliberate. list_items has no
  // column to hang a stable key off, and adding one would mean a migration
  // for a list whose whole nature is that people type into it. Text matching
  // also does the right thing when someone has already added "Ground turkey"
  // by hand: it doesn't appear twice.

  const groceries = useMemo(() => groceryLines(mealPlan, staples), [mealPlan, staples])

  const pendingGroceries = useMemo(() => {
    const already = new Set(shoppingItems.map((i) => i.body.trim().toLowerCase()))
    return groceries.lines.filter((l) => !already.has(l.body.trim().toLowerCase()))
  }, [groceries, shoppingItems])

  async function addWeekGroceries() {
    if (pendingGroceries.length === 0) return

    const { data, error } = await supabase
      .from('list_items')
      .insert(
        pendingGroceries.map((l) => ({
          household_id: profile.household_id,
          list: 'shopping',
          body: l.body,
          added_by: profile.id,
          // 001 has carried this column since the beginning and nothing has
          // ever written anything but 'manual'. Marking these lets a later
          // "clear what the meal plan added" know what it may remove.
          source: 'meal_plan',
        }))
      )
      .select('id')

    if (error) return setError(error.message)

    setError(null)
    loadShopping()

    // Fifteen rows arriving at once is exactly the action someone wants back
    // if they tapped it on the wrong week.
    const added = data ?? []
    offerUndo(`Added ${added.length} ${added.length === 1 ? 'item' : 'items'}`, async () => {
      const { error: undoError } = await supabase
        .from('list_items')
        .delete()
        .in('id', added.map((r) => r.id))
      if (undoError) setError(undoError.message)
      loadShopping()
    })
  }

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

  /**
   * A long press still ends in a click, and the board is now tappable — so
   * without this, opening settings by holding a day row also opens that day
   * underneath the settings dialog.
   */
  const swallowNextClick = useRef(false)

  function handlePressStart(e) {
    if (editing || mealEditing || dayViewing || settingsOpen) return
    // Holding a "+" button shouldn't also summon settings behind the dialog
    // it opens.
    if (e.target.closest?.('button, input, a, label')) return

    pressOrigin.current = { x: e.clientX, y: e.clientY }
    pressTimer.current = setTimeout(() => {
      swallowNextClick.current = true
      setSettingsOpen(true)
    }, LONG_PRESS_MS)
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

  // Today, not the week on screen — the big line is a fact about the room,
  // and stays put while you page around.
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const flourishIndex = Math.max(
    0,
    FLOURISHES.findIndex((f) => f.id === (settings.flourish ?? 'week'))
  )

  const flourishText = FLOURISHES[flourishIndex].render(today)

  function cycleFlourish() {
    updateSetting('flourish', FLOURISHES[(flourishIndex + 1) % FLOURISHES.length].id)
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

  function handleOpenDay(dateIso) {
    if (swallowNextClick.current) {
      swallowNextClick.current = false
      return
    }
    setDayViewing(dateIso)
  }

  const isCurrentWeek = isSameDay(startOfWeek(anchor), startOfWeek(today))

  const dayEventsFor = (dateIso) =>
    events
      .filter((e) => isSameDay(new Date(e.starts_at), new Date(`${dateIso}T00:00`)))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))

  const choresDone = chores.filter(choreIsDone).length
  const shoppingRemaining = shoppingItems.filter((i) => !i.checked).length

  const choresPanelProps = {
    loading: !booted,
    chores,
    choreIsDone,
    personFor,
    initialsForPerson,
    onToggle: toggleChore,
    onAdd: addChore,
    onRemove: removeChore,
  }

  const shoppingPanelProps = {
    loading: !booted,
    items: shoppingItems,
    cost,
    budget,
    pendingGroceries: pendingGroceries.length,
    onToggle: toggleShopping,
    onAdd: addShopping,
    onAddGroceries: addWeekGroceries,
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
        todayLabel={todayLabel}
        rangeLabel={weekLabel(anchor)}
        flourish={flourishText}
        onCycleFlourish={cycleFlourish}
        syncLabel={syncText(syncState, lastSync)}
        syncState={syncState}
        days={days}
        loading={!booted}
        settings={settings}
        chores={<ChoresPanel mode="full" {...choresPanelProps} />}
        choresCompact={<ChoresPanel mode="compact" {...choresPanelProps} />}
        choresCount={booted ? `${choresDone} of ${chores.length} done` : undefined}
        shopping={<ShoppingPanel mode="full" {...shoppingPanelProps} />}
        shoppingCompact={<ShoppingPanel mode="compact" {...shoppingPanelProps} />}
        shoppingCount={booted ? `${shoppingRemaining} to buy` : undefined}
        onPrevWeek={() => setAnchor(addDays(anchor, -7))}
        onNextWeek={() => setAnchor(addDays(anchor, 7))}
        onToday={isCurrentWeek ? undefined : () => setAnchor(startOfWeek(today))}
        onEventPress={handleEventPress}
        onAddDay={handleAddDay}
        onAddMeal={handleAddMeal}
        onOpenDay={handleOpenDay}
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
          onDeleted={(ev) =>
            offerUndo(`Deleted “${ev.title}”`, async () => {
              const { error: undoError } = await supabase.from('events').insert({
                household_id: ev.household_id,
                title: ev.title,
                starts_at: ev.starts_at,
                all_day: ev.all_day,
                owner_id: ev.owner_id,
              })
              if (undoError) setError(undoError.message)
              loadEvents()
            })
          }
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

      {dayViewing && (
        <DayView
          date={dayViewing}
          events={dayEventsFor(dayViewing)}
          meal={mealEntryFor(dayViewing)}
          peopleById={orderedPeople}
          onEventPress={(ev) => {
            setDayViewing(null)
            setEditing(ev)
          }}
          onAddEvent={() => {
            setDayViewing(null)
            handleAddDay(dayViewing)
          }}
          onEditMeal={() => {
            setDayViewing(null)
            setMealEditing(dayViewing)
          }}
          onClose={() => setDayViewing(null)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel settings={settings} onChange={updateSetting} onClose={() => setSettingsOpen(false)} />
      )}

      {/* Deletion on a shared wall is the one action nobody can take back by
          hand — the other person's chore is simply gone, with no record it
          existed. A confirm dialog would tax every correct deletion to
          prevent the rare wrong one; this taxes none of them. */}
      {undo && (
        <div className="undo-toast" role="status">
          <span className="undo-toast__message">{undo.message}</span>
          <button
            className="undo-toast__action"
            onClick={() => {
              clearTimeout(undoTimer.current)
              const restore = undo.run
              setUndo(null)
              restore()
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Everything on one day, with nothing collapsed.
 *
 * The week grid is a summary — it has to be, seven days sharing one screen —
 * and at the tight detail level it hides events behind "+N more" with no way
 * to reach them. This is where the day is actually legible: every event in
 * time order, the meal, and the two things you'd want to do next.
 */
function DayView({
  date,
  events,
  meal,
  peopleById,
  onEventPress,
  onAddEvent,
  onEditMeal,
  onClose,
}) {
  const nameFor = (ownerId) => peopleById.find((p) => p.id === ownerId)?.display_name

  return (
    <Sheet
      title={dayLabel(date)}
      onClose={onClose}
      footer={<button onClick={onAddEvent}>Add event</button>}
    >
      <div className="sheet__section">
        <span className="sheet__heading">Dinner</span>
        <button className="sheet-row" onClick={onEditMeal}>
          <span>{meal?.recipe ? meal.recipe.title : 'Nothing planned'}</span>
          <span className="sheet-row__meta">
            {meal?.recipe ? (meal.is_leftover ? 'Leftovers' : 'Cooking') : 'Tap to plan'}
          </span>
        </button>
      </div>

      <div className="sheet__section">
        <span className="sheet__heading">
          {events.length === 1 ? '1 event' : `${events.length} events`}
        </span>

        {events.length === 0 && <p className="sheet__empty">Nothing scheduled.</p>}

        {events.map((ev) => (
          <button key={ev.id} className="sheet-row" onClick={() => onEventPress(ev)}>
            <span>{ev.title}</span>
            <span className="sheet-row__meta">
              {ev.all_day ? 'All day' : timeLabel(new Date(ev.starts_at))}
              {nameFor(ev.owner_id) ? ` · ${nameFor(ev.owner_id)}` : ''}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
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

function EventEditor({ initial, profile, people, personFor, onClose, onSaved, onDeleted }) {
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
    if (error) return setError(error.message)
    onDeleted?.(initial)
    onSaved()
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
      <Sheet
        title="Pick a meal"
        subtitle={dayLabel(date)}
        onClose={entry?.recipe ? () => setPicking(false) : onClose}
      >
        {/* No autoFocus. Picking a meal starts by *reading* the list, and an
            unrequested keyboard covers half of it on an iPad. The field is
            there when someone wants to narrow things down; until they tap
            it, the list is the interface. */}
        <input
          className="sheet__search"
          placeholder="Search recipes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="sheet__section">
          {shown.map((r) => (
            <button key={r.id} className="sheet-row" onClick={() => onPick(r.id)}>
              <span>{r.title}</span>
              <span className="sheet-row__meta">
                {r.servings_min
                  ? `${r.servings_min}${r.servings_max && r.servings_max !== r.servings_min ? `–${r.servings_max}` : ''} servings`
                  : ''}
                {r.cook_minutes ? ` · ${r.cook_minutes} min` : ''}
                {r.status === 'conditional' ? ' · conditional' : ''}
              </span>
            </button>
          ))}
          {shown.length === 0 && <p className="sheet__empty">Nothing matches.</p>}
        </div>
      </Sheet>
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

        {/* These read as a two-state choice, so they have to behave like
            one. Both used to call the same toggle, which meant tapping the
            option that was already selected silently switched to the other
            — picking "Cook" on a cook night turned it into leftovers. */}
        <div className="chips">
          <button
            className={entry.is_leftover ? 'chip' : 'chip on'}
            aria-pressed={!entry.is_leftover}
            onClick={() => entry.is_leftover && onToggleLeftover()}
          >
            Cook
          </button>
          <button
            className={entry.is_leftover ? 'chip on' : 'chip'}
            aria-pressed={entry.is_leftover}
            onClick={() => !entry.is_leftover && onToggleLeftover()}
          >
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

        {/* The header line cycles these on tap too. This is here so the set
            is discoverable once you've found the settings at all, rather
            than only by tapping the header repeatedly and guessing. */}
        <div className="settings-row">
          <span className="settings-row__label">Header aside</span>
          <div className="chips">
            {FLOURISHES.map((f) => (
              <button
                key={f.id}
                className={(settings.flourish ?? 'week') === f.id ? 'chip on' : 'chip'}
                onClick={() => onChange('flourish', f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
