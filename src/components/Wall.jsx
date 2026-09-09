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
import {
  choreOccurrenceDate,
  choreScheduleLabel,
  isScheduled,
  schedulePatchFor,
  unschedulePatch,
} from '../lib/chores'
import { useChoreDrag } from '../hooks/useChoreDrag'
import { useToday } from '../hooks/useToday'
import { combineStatus, useRealtimeTable } from '../hooks/useRealtimeTable'
import { Board } from './Board'
import Sheet from './Sheet'
import ChoresPanel from './ChoresPanel'
import ShoppingPanel from './ShoppingPanel'
import RecipeBook, { CookMode, RecipeDetail } from './RecipeBook'
import './Sheet.css'

const DEFAULT_SETTINGS = { chores: 'full', shopping: 'full', flourish: ['week'] }
const LONG_PRESS_MS = 650

/**
 * Long enough that someone can cross a kitchen to reach it. A phone's
 * five-second undo assumes the screen is already in your hand; this one
 * frequently isn't.
 */
const UNDO_MS = 9000

/**
 * Optional asides for the header's second line — the board having a bit of
 * character rather than telling you anything you need. Deliberately not
 * advertised: someone poking at the board finds them, someone reading the
 * week never notices they exist.
 *
 * Several can be on at once. Each therefore carries two renderings: alone it
 * can afford to spell itself out, but shown alongside others it shortens,
 * because the header shares a row with the sync state and the week arrows
 * and cannot grow sideways forever.
 *
 * 'off' is no longer an entry — an empty selection is off, which is what
 * unticking the last chip naturally produces.
 */
const FLOURISHES = [
  {
    id: 'week',
    label: 'Week',
    render: (d) => `Week ${fiscalWeek(d)}`,
    short: (d) => `Week ${fiscalWeek(d)}`,
  },
  {
    id: 'progress',
    label: 'Year %',
    render: (d) => `${yearProgress(d)}% through ${d.getFullYear()}`,
    short: (d) => `${yearProgress(d)}%`,
  },
  {
    id: 'daysLeft',
    label: 'Days left',
    render: (d) => {
      const n = daysLeftInYear(d)
      return n === 0 ? 'Last day of the year' : `${n} days left in ${d.getFullYear()}`
    },
    short: (d) => {
      const n = daysLeftInYear(d)
      return n === 0 ? 'Last day' : `${n} left`
    },
  },
  {
    id: 'dayOfYear',
    label: 'Day no.',
    render: (d) => `Day ${dayOfYear(d)} of ${daysInYear(d.getFullYear())}`,
    short: (d) => `Day ${dayOfYear(d)}`,
  },
]

/**
 * Three, and the number is measured rather than picked.
 *
 * The heading shares the header row with the sync state and the week
 * arrows, so it gets roughly two thirds of the board's width. The range
 * label takes about half of that on its own. Three short asides plus their
 * separators fit what is left on a 12.9" iPad in portrait; four do not.
 *
 * The header wraps rather than clips if this is ever wrong (see
 * .board__sub), so the failure mode is a slightly taller header, not the
 * silent amputation this layout is prone to.
 */
const MAX_FLOURISHES = 3

/**
 * How many chore titles the palette remembers. Eight is about what fits in
 * two wrapped rows of the panel without the buttons crowding out the list
 * they sit under.
 */
const COMMON_CHORE_LIMIT = 8

/**
 * Reads whatever is in board_settings as a list of valid ids.
 *
 * Households already have a bare string stored here from when this was a
 * single choice, so that has to keep working — a wall that dropped its
 * header aside on upgrade would be a puzzling little regression. Unknown
 * ids are dropped rather than rendered as blanks.
 */
function toFlourishIds(value) {
  const known = (id) => FLOURISHES.some((f) => f.id === id)
  const chosen = Array.isArray(value) ? value : value == null || value === 'off' ? [] : [value]
  // Canonical order, not tap order: the header should not reshuffle itself
  // because of the sequence someone happened to tick the chips in.
  return FLOURISHES.filter((f) => chosen.includes(f.id) && known(f.id))
    .map((f) => f.id)
    .slice(0, MAX_FLOURISHES)
}

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
 * Everything the recipe book reads, in one query.
 *
 * The whole bank is 18 recipes, 127 ingredient rows and 56 steps — small
 * enough that fetching it whole beats a second round trip per recipe, and
 * the detail view then opens with no loading state at all. It is fetched
 * lazily (only when the book is opened) rather than at boot, because the
 * wall spends approximately all of its time not showing a recipe.
 */
const RECIPE_BOOK_QUERY = `
  id, title, status, description, notes,
  servings_min, servings_max, effort,
  prep_minutes, cook_minutes, total_minutes,
  cuisine, tags, meal_types, source_url, image_url, image_source,
  est_cost_cents, cost_confidence,
  ingredients:recipe_ingredients ( id, name, qty, unit, preparation, notes, sort_order ),
  steps:recipe_steps ( id, step_number, body )
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
  const [completions, setCompletions] = useState([])
  const [lastDone, setLastDone] = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [mealPlan, setMealPlan] = useState([])
  const [recipes, setRecipes] = useState([])
  const [staples, setStaples] = useState([])
  const [budget, setBudget] = useState(12000)
  const [editing, setEditing] = useState(null)
  const [mealEditing, setMealEditing] = useState(null) // an on_date string, or null
  const [bookOpen, setBookOpen] = useState(false)
  const [bookRecipes, setBookRecipes] = useState([])
  const [bookLoading, setBookLoading] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState(null) // a recipe id, or null
  const [cooking, setCooking] = useState(false)
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

  /**
   * Done-ness is a lookup in the completion log rather than a timestamp on
   * the chore, which is what makes "who did it, and when" answerable at all.
   *
   * Keyed against the week being *viewed*, not today, so paging back shows
   * what actually happened that week instead of re-reading last week through
   * this week's state.
   */
  const anchorWeekStart = useMemo(() => startOfWeek(anchor), [anchor])

  const completedKeys = useMemo(
    () => new Set(completions.map((c) => `${c.chore_id}:${c.on_date}`)),
    [completions]
  )

  const occurrenceFor = useCallback(
    (chore) => choreOccurrenceDate(chore, anchorWeekStart),
    [anchorWeekStart]
  )

  const choreIsDone = useCallback(
    (chore) => {
      const on = occurrenceFor(chore)
      // A one-off with no date has no occurrence: any completion at all
      // means it is done, forever, which is what 'once' has always meant.
      if (on == null) return completions.some((c) => c.chore_id === chore.id)
      return completedKeys.has(`${chore.id}:${on}`)
    },
    [completedKeys, completions, occurrenceFor]
  )

  const lastDoneFor = useCallback(
    (choreId) => lastDone.find((l) => l.chore_id === choreId) ?? null,
    [lastDone]
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

  /**
   * Two reads, because they answer two different questions: which
   * occurrences in the viewed week are ticked, and who did each chore most
   * recently regardless of when. The second is the dishwasher question, and
   * chore_last_done is a view because DISTINCT ON has no PostgREST spelling.
   */
  const loadChoreLog = useCallback(async () => {
    const from = toDateInputValue(startOfWeek(anchor))
    const to = toDateInputValue(addDays(startOfWeek(anchor), 7))

    const [weekRes, lastRes] = await Promise.all([
      supabase.from('chore_completions').select('*').gte('on_date', from).lt('on_date', to),
      supabase.from('chore_last_done').select('*'),
    ])

    const firstError = weekRes.error || lastRes.error
    if (firstError) return setError(firstError.message)

    setError(null)
    setCompletions(weekRes.data ?? [])
    setLastDone(lastRes.data ?? [])
    setLastSync(new Date())
  }, [anchor])

  useEffect(() => {
    loadChoreLog()
  }, [loadChoreLog])

  const choreLogStatus = useRealtimeTable('chore-log-sync', 'chore_completions', loadChoreLog)

  /**
   * Ticking inserts an occurrence; unticking deletes it. completed_by is
   * whoever tapped, deliberately not the chore's assignee — credit belongs
   * to whoever actually did the thing, which is the entire reason the log
   * exists.
   */
  async function toggleChore(chore) {
    const on = occurrenceFor(chore) ?? toDateInputValue(today)

    if (choreIsDone(chore)) {
      const { error } = await supabase
        .from('chore_completions')
        .delete()
        .eq('chore_id', chore.id)
        .eq('on_date', on)
      if (error) setError(error.message)
      return loadChoreLog()
    }

    const { error } = await supabase.from('chore_completions').insert({
      household_id: profile.household_id,
      chore_id: chore.id,
      on_date: on,
      completed_by: profile.id,
    })
    if (error) setError(error.message)
    loadChoreLog()
  }

  /**
   * Dropping a chore on a day. A weekly chore lands on that weekday every
   * week; a one-off lands on that date. Dropping it back on the panel
   * unschedules it without otherwise touching it.
   */
  const scheduleChore = useCallback(
    async (chore, target) => {
      const patch =
        target.kind === 'backlog' ? unschedulePatch(chore) : schedulePatchFor(chore, target.date)

      setChores((cs) => cs.map((c) => (c.id === chore.id ? { ...c, ...patch } : c)))

      const { error } = await supabase.from('chores').update(patch).eq('id', chore.id)
      if (error) {
        setError(error.message)
        loadChores()
      }
    },
    [loadChores]
  )

  const { drag, startDrag } = useChoreDrag(scheduleChore)

  async function addChore(title) {
    const clean = title.trim()
    if (!clean) return

    const { error } = await supabase.from('chores').insert({
      household_id: profile.household_id,
      title: clean,
      recurrence: 'weekly',
      sort_order: chores.length,
    })
    if (error) return setError(error.message)

    loadChores()
    rememberCommonChore(clean)
  }

  /**
   * The quick-add palette is learned rather than configured.
   *
   * Anything typed into the chore field joins it, most recent first, so the
   * buttons arrive by using the app instead of by filling in a settings
   * screen nobody wants to fill in. It rides along in board_settings, which
   * already exists, already syncs over realtime, and needs no migration.
   */
  function rememberCommonChore(title) {
    const prior = Array.isArray(settings.commonChores) ? settings.commonChores : []
    const next = [title, ...prior.filter((t) => t.toLowerCase() !== title.toLowerCase())]
    updateSetting('commonChores', next.slice(0, COMMON_CHORE_LIMIT))
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
    if (error) return setError(error.message)

    setError(null)
    loadMeals()

    // Choosing the meal *is* the task. Routing back into an editor
    // afterwards made the common case — put a recipe on a night — end in a
    // dialog whose loudest button offered to undo it. The chip landing on
    // the day is the confirmation; anyone who wants Cook/Leftovers taps it.
    setMealEditing(null)
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

  // ------------------------------------------------------------ recipe book

  const loadBook = useCallback(async () => {
    setBookLoading(true)

    // Retired recipes are included here and excluded from the meal picker,
    // which is the difference between a planner and a book: you shouldn't be
    // offered Tuesday's dinner from the retired pile, but a recipe you've
    // stopped cooking is still a recipe you wrote down.
    const { data, error: bookError } = await supabase
      .from('recipes')
      .select(RECIPE_BOOK_QUERY)
      .order('title')

    setBookLoading(false)
    if (bookError) return setError(bookError.message)

    setError(null)
    setBookRecipes(
      (data ?? []).map((r) => {
        const ingredients = [...(r.ingredients ?? [])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )
        const steps = [...(r.steps ?? [])].sort((a, b) => a.step_number - b.step_number)
        return {
          ...r,
          ingredients,
          steps,
          ingredient_count: ingredients.length,
          step_count: steps.length,
          // Flattened once here so search doesn't re-join 127 rows on
          // every keystroke.
          ingredient_names: ingredients.map((i) => i.name).join(' '),
        }
      })
    )
  }, [])

  const openBook = useCallback(
    (recipeId = null) => {
      setRecipeOpen(recipeId)
      setBookOpen(true)
      loadBook()
    },
    [loadBook]
  )

  const openRecipe = bookRecipes.find((r) => r.id === recipeOpen) ?? null

  function closeBook() {
    setBookOpen(false)
    setRecipeOpen(null)
    setCooking(false)
  }

  // The seven days currently on the board, so planning from the book obeys
  // the week you're looking at rather than silently meaning "this week".
  const planDays = useMemo(
    () =>
      weekDays(anchor).map((d) => ({
        iso: toDateInputValue(d),
        label: dayName(d),
      })),
    [anchor]
  )

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
    choreLogStatus,
  ])

  const refetchAll = useCallback(() => {
    loadEvents()
    loadChores()
    loadChoreLog()
    loadShopping()
    loadMeals()
    loadSettings()
  }, [loadEvents, loadChores, loadChoreLog, loadShopping, loadMeals, loadSettings])

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
    if (editing || mealEditing || dayViewing || settingsOpen || bookOpen) return
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

        // Nick asked for scheduled chores in both places: the panel keeps
        // the whole list, the grid shows where each one landed.
        for (const chore of chores) {
          if (!isScheduled(chore)) continue
          if (occurrenceFor(chore) !== iso) continue
          dayEvents.push({
            id: `chore:${chore.id}`,
            title: chore.title,
            meta: choreIsDone(chore) ? 'Done' : undefined,
            kind: 'chore',
            done: choreIsDone(chore),
          })
        }

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
    [anchor, chores, choreIsDone, events, mealPlan, occurrenceFor, personFor, today]
  )

  // Today, not the week on screen — the big line is a fact about the room,
  // and stays put while you page around.
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const flourishIds = useMemo(() => toFlourishIds(settings.flourish), [settings.flourish])

  // One aside can spell itself out; several have to share the row, so they
  // switch to their short forms. Derived from `today` so these re-render at
  // midnight along with everything else date-shaped.
  const flourishTexts = useMemo(() => {
    const many = flourishIds.length > 1
    return flourishIds
      .map((id) => FLOURISHES.find((f) => f.id === id))
      .filter(Boolean)
      .map((f) => (many ? f.short(today) : f.render(today)))
  }, [flourishIds, today])

  /**
   * Tapping the header still walks through the asides one at a time, which
   * is how this was always found. It is only offered while at most one is
   * showing: once someone has deliberately combined several, a stray tap
   * that collapsed the set back to one would undo a choice they made in
   * settings. Board renders plain text rather than a button in that case.
   */
  function cycleFlourish() {
    const order = [null, ...FLOURISHES.map((f) => f.id)]
    const current = flourishIds.length === 1 ? flourishIds[0] : null
    const next = order[(order.indexOf(current) + 1) % order.length]
    updateSetting('flourish', next ? [next] : [])
  }

  function toggleFlourish(id) {
    const on = flourishIds.includes(id)
    if (!on && flourishIds.length >= MAX_FLOURISHES) return
    const next = on ? flourishIds.filter((x) => x !== id) : [...flourishIds, id]
    updateSetting('flourish', toFlourishIds(next))
  }

  function handleEventPress(id) {
    if (id.startsWith('chore:')) {
      const chore = chores.find((c) => c.id === id.slice('chore:'.length))
      if (chore) toggleChore(chore)
      return
    }
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

  /**
   * Offer only what isn't already there. A button that adds a second
   * "Dishes" row underneath the "Dishes" you can already see would be a
   * duplicate generator rather than a shortcut, so anything currently in
   * the list — ticked or not — drops out of the palette until it's gone.
   */
  const commonChores = useMemo(() => {
    const remembered = Array.isArray(settings.commonChores) ? settings.commonChores : []
    const present = new Set(chores.map((c) => c.title.trim().toLowerCase()))
    return remembered.filter((t) => !present.has(t.trim().toLowerCase()))
  }, [settings.commonChores, chores])

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
    commonChores,
    onDragStart: startDrag,
    draggingId: drag?.chore?.id ?? null,
    scheduleLabelFor: choreScheduleLabel,
    isScheduled,
    lastDoneFor,
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
        flourishes={flourishTexts}
        flourishCycleable={flourishIds.length <= 1}
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
        dragging={drag != null}
        dragOverDate={drag?.over?.kind === 'day' ? drag.over.date : null}
        onOpenDay={handleOpenDay}
        onOpenBook={() => openBook()}
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
          onViewRecipe={() => {
            const entry = mealEntryFor(dayViewing)
            setDayViewing(null)
            openBook(entry?.recipe?.id ?? null)
          }}
          onClose={() => setDayViewing(null)}
        />
      )}

      {/* Three layers, one at a time: the shelf, a recipe, cooking it. Each
          later one covers the one before, so closing cook mode lands back on
          the recipe rather than dumping you at the board mid-dinner. */}
      {bookOpen && !openRecipe && (
        <RecipeBook
          recipes={bookRecipes}
          loading={bookLoading}
          onOpen={(r) => setRecipeOpen(r.id)}
          onClose={closeBook}
        />
      )}

      {bookOpen && openRecipe && !cooking && (
        <RecipeDetail
          recipe={openRecipe}
          detail={openRecipe}
          loading={bookLoading}
          planDays={planDays}
          plannedDate={mealPlan.find((p) => p.recipe?.id === openRecipe.id)?.on_date}
          onPlan={(date) => {
            pickMeal(date, openRecipe.id)
            closeBook()
          }}
          onCook={() => setCooking(true)}
          onClose={() => setRecipeOpen(null)}
        />
      )}

      {cooking && openRecipe && (
        <CookMode recipe={openRecipe} detail={openRecipe} onExit={() => setCooking(false)} />
      )}

      {drag && (
        <div
          className="chore-ghost"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          {drag.chore.title}
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={updateSetting}
          onToggleFlourish={toggleFlourish}
          onClose={() => setSettingsOpen(false)}
        />
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
  onViewRecipe,
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

        {/* The night you're actually cooking is the likeliest reason to want
            the recipe, so the shortest path to it starts here rather than
            back at the board header. Leftovers get it too — reheating
            instructions live in the same steps. */}
        {meal?.recipe && (
          <button className="sheet-row" onClick={onViewRecipe}>
            <span>Open the recipe</span>
            <span className="sheet-row__meta">Ingredients, method, cook mode</span>
          </button>
        )}
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
              // .card .chip.on fills with --person-a for everyone, but the
              // inline borderColor is per-person and wins over the
              // stylesheet — so selecting the second person drew their
              // colour around the first person's fill. Selected now takes
              // its fill from the same source as its border, which also
              // makes the dialog teach which colour means whom.
              style={
                p.id === ownerId
                  ? { borderColor: colorFor(p.id), background: colorFor(p.id) }
                  : { borderColor: colorFor(p.id) }
              }
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

  if (picking) {
    const shown = recipes.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()))

    return (
      <Sheet
        title={entry?.recipe ? 'Change meal' : 'Pick a meal'}
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
                {/* Changing a meal without being shown which one is
                    currently on the plan means picking blind. */}
                {r.id === entry?.recipe?.id ? ' · on the plan now' : ''}
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

        {/* .card button is filled green by default, so whichever action
            carries no class reads as the one to press. That was "Change
            meal", which meant the strongest signal on screen, immediately
            after successfully planning a night, was an offer to undo it.
            Done is the affirmative exit and takes the emphasis; the other
            two are things you occasionally want, not things to be nudged
            towards. */}
        <div className="actions">
          <button className="ghost" onClick={() => setPicking(true)}>
            Change meal
          </button>
          <button className="ghost danger" onClick={onClear}>
            Clear
          </button>
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

const MODE_LABELS = { full: 'Full', compact: 'Compact', off: 'Off' }
const MODE_OPTIONS = ['full', 'compact', 'off']
const SECTION_LABELS = { chores: 'To-Do', shopping: 'Shopping' }

function SettingsPanel({ settings, onChange, onToggleFlourish, onClose }) {
  const chosen = toFlourishIds(settings.flourish)
  const atMax = chosen.length >= MAX_FLOURISHES

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
            {FLOURISHES.map((f) => {
              const on = chosen.includes(f.id)
              return (
                <button
                  key={f.id}
                  className={on ? 'chip on' : 'chip'}
                  // Full is the reason a chip is unavailable, so it says so
                  // by going quiet rather than by rejecting the tap. Nothing
                  // has to be un-picked first to see what is pickable.
                  disabled={!on && atMax}
                  onClick={() => onToggleFlourish(f.id)}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        <p className="settings-row__hint">
          {atMax
            ? `Showing ${MAX_FLOURISHES} — untick one to swap it out. Together they use their short forms.`
            : `Pick up to ${MAX_FLOURISHES}. Two or more switch to short forms so the header still fits.`}
        </p>

        <div className="actions">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
