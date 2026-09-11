import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { parseCapture, priorityLabel } from '../lib/capture'
import {
  agoLabel,
  choreOccurrenceDate,
  choreScheduleLabel,
  dueLabel,
  groupChores,
  isEpisodic,
  isScheduled,
  nextTurn,
  recurrencePatchFor,
  schedulePatchFor,
  unschedulePatch,
  WEEKDAY_NAMES,
} from '../lib/chores'
import { useChoreDrag } from '../hooks/useChoreDrag'
import { useToday } from '../hooks/useToday'
import { combineStatus, useRealtimeTable } from '../hooks/useRealtimeTable'
import { Board } from './Board'
import Sheet from './Sheet'
import AddRow from './AddRow'
import { LONG_PRESS_MS, LONG_PRESS_SLOP_PX, useLongPress } from '../hooks/useLongPress'
import ChoresPanel from './ChoresPanel'
import ShoppingPanel from './ShoppingPanel'
import RecipeBook, { CookMode, RecipeDetail } from './RecipeBook'
import { ShoppingSheet, ToDoSheet } from './PanelSheets'
import MainMenu from './MainMenu'
import Screensaver from './Screensaver'
import { useIdle } from '../hooks/useIdle'
import { clearCookProgress, readCookProgress, writeCookProgress } from '../lib/cookProgress'
import {
  DEFAULT_TIMEOUT_MIN,
  TIMEOUT_OPTIONS,
  isNightAt,
  readDeviceTimeout,
  timeoutMsFor,
  writeDeviceTimeout,
} from '../lib/screensaver'
import { DEFAULT_SLOT, MEAL_SLOTS, bySlot, mealMeta, nextFreeSlot, slotLabel } from '../lib/meals'
import './Sheet.css'

const DEFAULT_SETTINGS = {
  chores: 'full',
  shopping: 'full',
  flourish: ['week'],
  // The household's default idle timeout, in minutes. Lives in the same jsonb
  // blob as the panel modes, so it needed no migration — and any device may
  // override it locally, which is the whole argument in lib/screensaver.js.
  screensaverMin: DEFAULT_TIMEOUT_MIN,
}

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

const MEAL_PLAN_QUERY = `
  id, on_date, slot, is_leftover,
  recipe:recipes (
    id, title, cost_confidence,
    steps:recipe_steps ( id ),
    ingredients:recipe_ingredients (
      name, preferred_product, purchase_qty, manual_cost_cents, ingredient_category,
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
 *
 * This is a PostgREST select string, not SQL: it takes no comments, and one
 * bad column name 400s the whole request rather than degrading. It shipped
 * once asking for `est_cost_cents`, which 004_recipes.sql declares and the
 * live table does not have — the repo and the database drifted at some point
 * before 008 — and the book opened to an empty shelf instead of a missing
 * price. Check a column exists in the live schema before adding it here;
 * finding it in a migration file is not the same thing.
 */
const RECIPE_BOOK_QUERY = `
  id, title, status, description, notes,
  servings_min, servings_max, effort,
  prep_minutes, cook_minutes, total_minutes,
  cuisine, tags, meal_types, source_url, image_url, image_source,
  cost_confidence,
  ingredients:recipe_ingredients (
    id, name, normalized_name, qty, unit, preparation, notes, sort_order,
    purchase_qty, manual_cost_cents,
    product:products ( id, name, pre_tax_cents, tax_rate_bps )
  ),
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
  // { date, slot } — a slot is now part of *which* meal is being edited, not
  // an assumption made when it is saved.
  const [mealEditing, setMealEditing] = useState(null)
  const [reschedulingChore, setReschedulingChore] = useState(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [bookRecipes, setBookRecipes] = useState([])
  const [bookLoading, setBookLoading] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState(null) // a recipe id, or null
  const [cooking, setCooking] = useState(false)
  /**
   * Which layer the book was entered at, so closing a recipe goes back where
   * you came from.
   *
   * Opening a recipe straight from a day, or from the menu's cook row, used
   * to leave you on the shelf when you closed it — a screen you had never
   * visited, showing eighteen recipes you had not asked for. "Back" has to
   * mean back.
   */
  const [bookEntry, setBookEntry] = useState('shelf')
  /**
   * The planned meal the book was opened from, if any — `{ date, slot }`.
   *
   * Tapping the chip opens the recipe rather than the editor, which is right,
   * but it also means arriving at a recipe you are looking at *because it is
   * on Tuesday*. Changing your mind about Tuesday is the second most likely
   * thing you want there, and without this the way back to it is close the
   * recipe, tap the day, find the meal, tap change.
   */
  const [bookFromMeal, setBookFromMeal] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cookProgress, setCookProgress] = useState(null)
  const [deviceTimeout, setDeviceTimeout] = useState(readDeviceTimeout)
  const [dayViewing, setDayViewing] = useState(null) // an on_date string, or null
  const [sectionOpen, setSectionOpen] = useState(null) // 'chores' | 'shopping' | null
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
    (chore) => choreOccurrenceDate(chore, anchorWeekStart, today),
    [anchorWeekStart, today]
  )

  const choreIsDone = useCallback(
    (chore) => {
      // An episodic chore has no done-ness to report. It is a log, and the
      // panel renders it as one; answering "is the dishwasher done" with a
      // boolean is the category error this whole slice removes.
      if (isEpisodic(chore)) return false

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
   * credit for having done the thing, deliberately not the chore's assignee —
   * which is the entire reason the log exists.
   *
   * **The wall cannot tell who tapped, so this is a guess.** It used to guess
   * `profile.id`, the session owner, which is right on a phone and wrong on
   * the wall roughly half the time by construction: one signed-in account
   * shared by two people standing in front of it. Episodic chores solved that
   * in 012 by asking outright — a button per person — but a checkbox has no
   * room to ask, and weekly and one-off chores were left crediting the same
   * name forever, quietly poisoning the log and the scoreboard (#6) built on
   * it.
   *
   * Two changes, and neither is "ask on every tick", because the tick is the
   * fast path and a wall people touch in passing should not interrogate them:
   *
   *   1. **A rotating chore credits whoever is up**, via the same `nextTurn`
   *      the row already displays. It is still an inference, but it is the
   *      household's own alternation rather than an accident of which account
   *      is signed in — right most of the time in a house that takes turns,
   *      instead of wrong half the time by design.
   *   2. **Any guess is one tap from correct**, by tapping the badge. See
   *      `cycleChoreCredit`.
   *
   * The guess is never hidden: the badge showing who was credited appears on
   * every completed row, which is what makes it correctable at all.
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

    const turn = nextTurn(chore, lastDoneFor(chore.id), orderedPeople)

    const { error } = await supabase.from('chore_completions').insert({
      household_id: profile.household_id,
      chore_id: chore.id,
      on_date: on,
      completed_by: turn?.id ?? profile.id,
    })
    if (error) setError(error.message)
    loadChoreLog()
  }

  /**
   * Hand the credit to the next person. The correction half of the above.
   *
   * A cycle rather than a swap, even though this household is two people by
   * construction (see `handle_new_user`'s allowlist) — two is the case where
   * a cycle and a toggle are the same thing, so writing the general form
   * costs nothing and does not quietly become wrong if that ever changes.
   *
   * Upsert on `(chore_id, on_date)` for the same reason `logChore` does:
   * correcting a credit is an update to an existing completion, not a second
   * one, and the unique key would reject the insert anyway.
   *
   * `completed_at` is deliberately left alone. It records when the chore was
   * done, and somebody fixing the name an hour later did not do it an hour
   * later.
   */
  async function cycleChoreCredit(chore) {
    if (orderedPeople.length < 2) return

    const on = occurrenceFor(chore) ?? toDateInputValue(today)
    const current = lastDoneFor(chore.id)?.completed_by
    const at = orderedPeople.findIndex((p) => p.id === current)
    // An unrecognised or missing credit lands on the first person rather than
    // erroring — -1 + 1 is 0, which is the behaviour we want anyway.
    const next = orderedPeople[(at + 1) % orderedPeople.length]

    const { error } = await supabase
      .from('chore_completions')
      .upsert(
        {
          household_id: profile.household_id,
          chore_id: chore.id,
          on_date: on,
          completed_by: next.id,
        },
        { onConflict: 'chore_id,on_date' }
      )

    if (error) setError(error.message)
    loadChoreLog()
  }

  /**
   * Logging an episodic chore: someone did it, today, and we know which
   * someone because they said so by tapping their own initials.
   *
   * This is the fix for the quiet correctness bug in toggleChore. That writes
   * completed_by: profile.id — whoever the session belongs to — which is
   * right on a phone and wrong on the wall, where one signed-in account is
   * shared by two people standing in front of it. A log built to answer "who
   * ran the dishwasher last" would have answered with the same name forever.
   *
   * Upsert rather than insert: the unique key is (chore_id, on_date), so
   * tapping the other person's initials corrects the credit instead of
   * failing on a duplicate. Tapping the same one twice is a no-op.
   */
  async function logChore(chore, personId) {
    const on = toDateInputValue(today)

    const { error } = await supabase
      .from('chore_completions')
      .upsert(
        {
          household_id: profile.household_id,
          chore_id: chore.id,
          on_date: on,
          completed_by: personId,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'chore_id,on_date' }
      )

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

      // schedulePatchFor returns null for an episodic chore: it has no day to
      // land on, and 012's constraint would reject the write anyway. Dropping
      // one on the grid does nothing, visibly, rather than appearing to work
      // until the next refetch undoes it.
      if (!patch) return

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

  /**
   * Any change to a chore's own row — its kind, its day — applied optimistically.
   *
   * Optimistic because these are all one-tap changes made while looking at the
   * row, and a round trip before the label updates reads as the tap not having
   * landed. A rejected write refetches, so the row snaps back to the truth
   * rather than staying wrong.
   */
  const patchChore = useCallback(
    async (chore, patch) => {
      setChores((cs) => cs.map((c) => (c.id === chore.id ? { ...c, ...patch } : c)))

      const { error: patchError } = await supabase
        .from('chores')
        .update(patch)
        .eq('id', chore.id)

      if (patchError) {
        setError(patchError.message)
        loadChores()
      }
    },
    [loadChores]
  )

  /**
   * Adding a task, from one line of typing.
   *
   * `parseCapture` reads scheduling and priority off the end of the text, so
   * "bins out every tuesday !!" lands as a Tuesday chore at high priority
   * rather than as an untimed weekly one that then needs a sheet opened to
   * finish it. Anything it does not understand stays in the title, and the
   * defaults below are exactly what the field produced before.
   */
  /**
   * `whenUnspecified` is the schedule to use when the typed text names none.
   *
   * The To Do panel passes nothing, so capture there behaves as it always has:
   * a weekly chore with no day unless you said otherwise. The day sheet passes
   * that day, because the sheet is already the answer to "when" — you opened
   * Thursday to write down a Thursday thing.
   *
   * It loses to the text rather than overriding it. Typing "bins out every
   * tuesday" into Thursday's sheet gives you a Tuesday chore, and the capture
   * field's own readback says "Tuesdays" before it is written, so the sheet
   * never silently reinterprets what someone typed.
   */
  async function addChore(text, parentId = null, whenUnspecified = null) {
    const parsed = parseCapture(text, today)
    const clean = parsed.title.trim()
    if (!clean) return

    const fallback =
      whenUnspecified && !('recurrence' in parsed.patch) ? whenUnspecified : {}

    const { error } = await supabase.from('chores').insert({
      household_id: profile.household_id,
      title: clean,
      recurrence: 'weekly',
      sort_order: chores.length,
      parent_id: parentId,
      ...parsed.patch,
      ...fallback,
    })
    if (error) return setError(error.message)

    loadChores()
    // The palette learns titles, not schedules — re-adding "Bins out" from a
    // chip should not silently re-apply a priority typed once last month.
    if (!parentId) rememberCommonChore(clean)
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

  /**
   * Everything ticked, gone at once — the end of a shop, in one tap.
   *
   * Offered only on the full page. Clearing the list is the one action here
   * that destroys several rows at a time, and the dock panel is a surface
   * people tap while walking past it.
   */
  async function clearCheckedShopping() {
    const done = shoppingItems.filter((i) => i.checked)
    if (done.length === 0) return

    setShoppingItems((xs) => xs.filter((x) => !x.checked))

    const { error: clearError } = await supabase
      .from('list_items')
      .delete()
      .in('id', done.map((i) => i.id))

    if (clearError) {
      setError(clearError.message)
      return loadShopping()
    }

    offerUndo(`Cleared ${done.length} ${done.length === 1 ? 'item' : 'items'}`, async () => {
      const { error: undoError } = await supabase.from('list_items').insert(
        done.map((i) => ({
          household_id: i.household_id,
          list: i.list,
          body: i.body,
          qty: i.qty,
          category: i.category,
          added_by: i.added_by,
          checked: i.checked,
          source: i.source,
        }))
      )
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
        .select('item, weekly_qty, included, manual_unit_cents, category, product:products ( pre_tax_cents, tax_rate_bps )'),
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

  /*
   * Which week the budget figure is about.
   *
   * `mealPlan` is fetched for `anchor`'s week, so `cost` — and everything
   * derived from it — follows whatever week is on the board, not the calendar
   * week. Left unsaid that becomes a small lie: page forward one week, open
   * the recipe book, and a subtitle reading "left this week" is describing a
   * week that has not started. Naming the week costs four words and is never
   * wrong.
   */
  const isCurrentWeek = isSameDay(startOfWeek(anchor), startOfWeek(today))
  const budgetWeekLabel = isCurrentWeek ? null : weekLabel(anchor)

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
          qty: l.qty ?? 1,
          // Carried across from the ingredient (013) so the list can be walked
          // in aisle order. Null for anything we cannot place, which lands it
          // under "Anything else" rather than guessing an aisle.
          category: l.category,
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

  /** Every meal on a day, in the order the day happens. */
  const mealsFor = useCallback(
    (date) => mealPlan.filter((p) => p.on_date === date).sort(bySlot),
    [mealPlan]
  )

  const mealEntryAt = useCallback(
    (date, slot) => mealPlan.find((p) => p.on_date === date && p.slot === slot),
    [mealPlan]
  )

  async function pickMeal(date, slot, recipeId) {
    const payload = {
      household_id: profile.household_id,
      on_date: date,
      slot,
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
    // Still true with four slots: the slot was chosen before the recipe, so
    // by the time a recipe is picked there is nothing left to decide.
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

  /**
   * The meal picker reads the recipe book now, so opening the editor has to
   * bring the book with it.
   *
   * Guarded on the bank being empty rather than firing every time `mealEditing`
   * changes: picking a different slot re-sets that state, and a round trip per
   * chip tap would be a tax on the one interaction this whole screen exists
   * for. The bank is 18 recipes and it does not go stale within a sitting.
   */
  useEffect(() => {
    if (mealEditing && bookRecipes.length === 0) loadBook()
  }, [mealEditing, bookRecipes.length, loadBook])

  const openBook = useCallback(
    (recipeId = null, fromMeal = null) => {
      setRecipeOpen(recipeId)
      setBookEntry(recipeId ? 'recipe' : 'shelf')
      setBookFromMeal(fromMeal)
      setBookOpen(true)
      loadBook()
    },
    [loadBook]
  )

  /**
   * Straight into cook mode, without stopping at the shelf or the recipe.
   *
   * The book is still fetched lazily, so for one round trip there is a recipe
   * id and no recipe. That gap renders as a cook-mode-shaped loading screen
   * rather than as the shelf, which is what `cooking` guarding the shelf below
   * is for: asking for a method and being shown eighteen other recipes for
   * half a second reads as the tap having missed.
   */
  const startCook = useCallback(
    (recipeId) => {
      setRecipeOpen(recipeId)
      setBookEntry('recipe')
      setBookOpen(true)
      setCooking(true)
      loadBook()
    },
    [loadBook]
  )

  const openRecipe = bookRecipes.find((r) => r.id === recipeOpen) ?? null

  function closeBook() {
    setBookOpen(false)
    setRecipeOpen(null)
    setBookFromMeal(null)
    setCooking(false)
  }

  /** Back out of one recipe — to the shelf if that is where you came in. */
  function closeRecipe() {
    if (bookEntry === 'recipe') return closeBook()
    setRecipeOpen(null)
  }

  /**
   * Cook mode reporting where it has got to.
   *
   * Written straight to localStorage rather than held in React state: this
   * fires on every step, and putting it in state would re-render the whole
   * board — week grid, both dock panels — twenty times a recipe to update
   * something nothing on screen is showing. The menu reads it back when it
   * opens, which is the only moment it is ever looked at.
   */
  const handleCookIndex = useCallback(
    (index) => {
      if (recipeOpen) writeCookProgress(recipeOpen, index)
    },
    [recipeOpen]
  )

  /**
   * `finished` is the Finish button on the last step; anything else is
   * stepping out mid-recipe, which is exactly the case worth remembering.
   */
  function exitCook(finished) {
    if (finished) clearCookProgress()
    setCooking(false)
  }

  // The seven days currently on the board, so planning from the book obeys
  // the week you're looking at rather than silently meaning "this week".
  // The date number rides along because "Tue" alone is ambiguous the moment
  // you have paged the board to another week — which is exactly when someone
  // is most likely to be planning ahead.
  const planDays = useMemo(
    () =>
      weekDays(anchor).map((d) => ({
        iso: toDateInputValue(d),
        label: dayName(d),
        dom: d.getDate(),
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

  function setDeviceScreensaver(value) {
    writeDeviceTimeout(value)
    setDeviceTimeout(value)
  }

  // ------------------------------------------------------ ambient timeout
  //
  // The state the wall is actually in for most of its life. See
  // Screensaver.jsx for what the scene is doing and why it has to move;
  // this is only the decision about when it is allowed to.

  /**
   * Three things suspend the fade, and each is a case where covering the
   * screen would be actively wrong rather than merely unwelcome.
   *
   * **Cook mode.** It holds a wake lock and exists to keep showing you a step
   * while your hands are full — it is the one surface whose whole point is to
   * stay lit while nobody is touching the iPad. An ambient scene over it would
   * defeat the feature it was layered on top of.
   *
   * **A disconnected board.** A beautiful animation over a board that stopped
   * updating four hours ago is precisely the "green dot over a stale week"
   * failure in a prettier costume. Offline has to stay visible.
   *
   * **An error on screen.** Same argument, louder: the board is the only
   * debugger this device has.
   *
   * Note the test is `!== 'offline'`, not `=== 'live'`. It was `=== 'live'`,
   * and that was a bug rather than caution: `combineStatus` only says "live"
   * when **all six** realtime channels are up, and returns "connecting" if a
   * single one is mid-handshake — a routine, transient state on a device that
   * sleeps. So one flaky channel meant the wall would never fade at all, and
   * the failure was silent, because nothing on screen connects "the dot is
   * grey" to "the screensaver is disabled". Connecting is not disconnected;
   * only offline is, and only offline has to stay on screen.
   */
  const screensaverAllowed = !cooking && syncState !== 'offline' && !error
  const idleTimeoutMs = timeoutMsFor(settings.screensaverMin, deviceTimeout)
  const { idle, wake, sleep } = useIdle({ timeoutMs: idleTimeoutMs, enabled: screensaverAllowed })

  /**
   * Night is a property of the hour, and `today` only moves at midnight — so
   * it needs its own tick. It runs only while the scene is up, because the
   * question "is it night" has no consumer while the board is showing, and a
   * minute timer running for weeks to answer nobody is exactly the kind of
   * thing that makes a wall device warm.
   */
  const [night, setNight] = useState(() => isNightAt(new Date()))

  useEffect(() => {
    if (!idle) return
    setNight(isNightAt(new Date()))
    const tick = setInterval(() => setNight(isNightAt(new Date())), 60_000)
    return () => clearInterval(tick)
  }, [idle])

  function handleWake() {
    wake()
    // Land on the current week, not wherever the board was left paged to
    // hours ago. Someone walking up to a sleeping wall is asking what is
    // happening now; being shown March because that is where the last person
    // left it is the board lying by omission.
    if (!isCurrentWeek) setAnchor(startOfWeek(today))
  }

  // ------------------------------------------------------------- the menu

  const todayIso = toDateInputValue(today)

  /**
   * The one row in the menu that isn't a room: the shortest path to a method.
   *
   * Resuming wins over starting, because a half-finished recipe is a stronger
   * statement of intent than a planned one — and because the recipe you
   * stepped out of is usually the recipe you are coming back to. Both are
   * named rather than described ("Resume Chicken Katsu", not "Resume
   * cooking"), since the whole value of the row is confirming it is the right
   * one before you commit a tap to it.
   */
  const cookRow = useMemo(() => {
    if (cookProgress) {
      const known =
        bookRecipes.find((r) => r.id === cookProgress.recipeId) ??
        recipes.find((r) => r.id === cookProgress.recipeId)

      // No title means no honest row. A "Resume" button that cannot say what
      // it would resume is asking for blind trust in a guess.
      if (known) {
        return {
          heading: 'Carry on',
          label: known.title,
          meta: `Back to step ${cookProgress.index + 1}`,
          recipeId: cookProgress.recipeId,
          index: cookProgress.index,
        }
      }
    }

    const todays = mealsFor(todayIso)
    // Dinner is what this household cooks; anything else planned today only
    // gets the row when dinner isn't there to take it.
    const pick = todays.find((m) => m.slot === DEFAULT_SLOT) ?? todays[todays.length - 1]
    if (!pick?.recipe) return null

    // Two of the eighteen recipes still have no method. Offering to cook one
    // would open an empty screen, so the row simply isn't there — the recipe
    // detail already explains why, and is one tap further on.
    if ((pick.recipe.steps?.length ?? 0) === 0) return null

    return {
      heading: 'Today',
      label: `Cook ${pick.recipe.title}`,
      meta: pick.is_leftover
        ? `${slotLabel(pick.slot)} · leftovers, same method`
        : `${slotLabel(pick.slot)} · straight to the steps`,
      recipeId: pick.recipe.id,
      index: 0,
    }
  }, [bookRecipes, cookProgress, mealsFor, recipes, todayIso])

  function openMenu() {
    // Read at open rather than held in state: cook mode writes it on every
    // step, and this is the only moment anything looks at it.
    setCookProgress(readCookProgress())
    setMenuOpen(true)
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
    if (editing || mealEditing || dayViewing || settingsOpen || bookOpen || reschedulingChore) return
    if (menuOpen) return
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

        // Every slot the day holds, in the order the day happens. This used
        // to reach past three of them to find the dinner, which is why a
        // lunch written straight into the table was invisible on the board.
        const meals = mealPlan.filter((p) => p.on_date === iso).sort(bySlot)
        for (const meal of meals) {
          if (!meal.recipe) continue
          dayEvents.push({
            id: `meal:${meal.id}`,
            title: meal.recipe.title,
            meta: mealMeta(meal),
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
          // Off the same clock hook as isToday, so the week re-shades itself
          // at midnight along with everything else date-shaped.
          isPast: d.getTime() < today.getTime(),
          events: dayEvents,
          // The grid can no longer work this out from "is there a meal chip",
          // now that four of them can sit on one day.
          canAddMeal: nextFreeSlot(meals) != null,
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
      if (!entry) return

      /*
       * Tapping the food opens the food.
       *
       * This chip used to open the meal *editor* — so tapping the words
       * "Chicken Katsu Curry" produced a dialog whose options were change it,
       * mark it leftovers, or clear it. Every one of those is a thing you do
       * to the plan, and none of them is the thing the chip is showing you.
       * The overwhelmingly common reason to touch a recipe title on a wall in
       * a kitchen is to read the recipe.
       *
       * Managing the plan moves one tap out, to the day view — tap the row
       * rather than the chip. That is the right way round: changing what is
       * for dinner is a planning act and belongs with the day, while the chip
       * is the dish itself.
       */
      if (entry.recipe?.id) {
        return openBook(entry.recipe.id, { date: entry.on_date, slot: entry.slot })
      }

      // A plan row with no recipe attached has nothing to read, so it falls
      // back to the only thing it can usefully offer.
      setMealEditing({ date: entry.on_date, slot: entry.slot })
      return
    }
    const ev = events.find((e) => e.id === id)
    if (ev) setEditing(ev)
  }

  /**
   * Hold a chip to manage what it stands for.
   *
   * The board's chips are all primary-action-first, which is right: tapping a
   * meal opens the recipe, tapping a chore ticks it. The cost was that the
   * *other* thing you might want — change tonight's dinner, reschedule the
   * bins — had no route from the board at all. Changing a meal meant opening
   * the day and finding "Change or clear this meal"; editing a scheduled chore
   * meant leaving the week for the To Do panel entirely.
   *
   * So: one gesture, one meaning, on every chip. Hold it and you get the
   * management view of that object. It is deliberately uniform even where the
   * tap already edits — holding an event opens the same editor a tap does —
   * because a gesture that works on two kinds of chip and silently does
   * nothing on the third is a gesture nobody learns.
   *
   * Discoverable rather than secret: the day view's meal row and the To Do
   * panel both name it, which is where you end up if you don't know it yet.
   */
  function handleEventLongPress(id) {
    if (id.startsWith('chore:')) {
      const chore = chores.find((c) => c.id === id.slice('chore:'.length))
      // Everything a tick is not: which day, what kind, priority, subtasks,
      // delete. Ticking stays on the tap because that is what the chip is for.
      if (chore) setReschedulingChore(chore)
      return
    }

    if (id.startsWith('meal:')) {
      const entry = mealPlan.find((p) => p.id === id.slice('meal:'.length))
      // Change it, mark it leftovers, clear it — the dialog the chip used to
      // open on a tap, before "tapping the food opens the food". It was never
      // the wrong dialog, only the wrong gesture.
      if (entry) setMealEditing({ date: entry.on_date, slot: entry.slot })
      return
    }

    const ev = events.find((e) => e.id === id)
    if (ev) setEditing(ev)
  }

  /**
   * The tasks that land on one day: the same test the week grid's chips use,
   * so the day sheet and the board cannot disagree about what Thursday holds.
   */
  const tasksFor = (dateIso) =>
    chores.filter((c) => isScheduled(c) && occurrenceFor(c) === dateIso)

  function handleAddDay(dateIso) {
    setEditing({ _day: new Date(`${dateIso}T00:00`), owner_id: profile.id })
  }

  function handleAddMeal(dateIso) {
    // Dinner unless dinner is taken, then the earliest slot still free. The
    // button is hidden once a day is full, so this is never null here — but
    // it falls back rather than trusting that, because an upsert on a taken
    // slot would quietly replace a meal instead of adding one.
    const slot = nextFreeSlot(mealsFor(dateIso)) ?? DEFAULT_SLOT
    setMealEditing({ date: dateIso, slot })
  }

  function handleOpenDay(dateIso) {
    if (swallowNextClick.current) {
      swallowNextClick.current = false
      return
    }
    setDayViewing(dateIso)
  }

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

  // Episodic chores are never "done" — they have no done-ness to report — so
  // counting them in the denominator made the panel permanently read "3 of 4"
  // with no fourth tick in existence. A progress figure that cannot reach its
  // own total teaches people to stop reading it. Compact mode already
  // excluded them, so the two halves of the same panel disagreed.
  const trackableChores = chores.filter((c) => !isEpisodic(c))
  const choresDone = trackableChores.filter(choreIsDone).length
  const shoppingRemaining = shoppingItems.filter((i) => !i.checked).length

  const choreGroups = useMemo(
    () =>
      groupChores(chores, {
        todayIso: toDateInputValue(today),
        weekEndIso: toDateInputValue(addDays(startOfWeek(anchor), 6)),
        isCurrentWeek,
        occurrenceFor,
        choreIsDone,
      }),
    [anchor, chores, choreIsDone, isCurrentWeek, occurrenceFor, today]
  )

  // What is actually late, for the panel head. Overdue is the only count
  // worth promoting past "N of M done" — it is the one number that means
  // something has gone wrong rather than something is outstanding.
  const overdueCount = useMemo(
    () => choreGroups.find((g) => g.key === 'overdue')?.chores.length ?? 0,
    [choreGroups]
  )

  const choresPanelProps = {
    loading: !booted,
    groups: choreGroups,
    choreCount: chores.length,
    pendingCount: trackableChores.filter((c) => !choreIsDone(c)).length,
    allDone: trackableChores.length > 0 && choresDone === trackableChores.length,
    choreIsDone,
    personFor,
    initialsForPerson,
    // The panel gets people as rows and needs their positional colour slot;
    // personFor answers that from an id. Passing a whole profile straight to
    // initialsForPerson is what made both buttons read "NE".
    slotFor: (person) => personFor(person.id),
    people: orderedPeople,
    onToggle: toggleChore,
    onLog: logChore,
    onCycleCredit: cycleChoreCredit,
    peopleById: orderedPeople,
    onAdd: addChore,
    onOpenSettings: setReschedulingChore,
    commonChores,
    onDragStart: startDrag,
    draggingId: drag?.chore?.id ?? null,
    scheduleLabelFor: choreScheduleLabel,
    dueLabelFor: (chore) => dueLabel(chore, today),
    lastDoneFor,
    turnFor: (chore, last) => nextTurn(chore, last, orderedPeople),
    agoFor: (iso) => agoLabel(iso, today),
    today,
    todayIso: toDateInputValue(today),
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
        choresCount={
          booted
            ? overdueCount > 0
              ? `${overdueCount} late · ${choresDone} of ${trackableChores.length} done`
              : `${choresDone} of ${trackableChores.length} done`
            : undefined
        }
        shopping={<ShoppingPanel mode="full" {...shoppingPanelProps} />}
        shoppingCompact={<ShoppingPanel mode="compact" {...shoppingPanelProps} />}
        shoppingCount={booted ? `${shoppingRemaining} to buy` : undefined}
        onPrevWeek={() => setAnchor(addDays(anchor, -7))}
        onNextWeek={() => setAnchor(addDays(anchor, 7))}
        onToday={isCurrentWeek ? undefined : () => setAnchor(startOfWeek(today))}
        onEventPress={handleEventPress}
        onEventLongPress={handleEventLongPress}
        onAddDay={handleAddDay}
        onAddMeal={handleAddMeal}
        dragging={drag != null}
        dragOverDate={drag?.over?.kind === 'day' ? drag.over.date : null}
        onOpenDay={handleOpenDay}
        onOpenBook={() => openBook()}
        onOpenMenu={openMenu}
        onOpenChores={() => setSectionOpen('chores')}
        onOpenShopping={() => setSectionOpen('shopping')}
        initialsFor={initialsForPerson}
      />

      {sectionOpen === 'chores' && (
        <ToDoSheet
          weekLabel={weekLabel(anchor)}
          choresPanelProps={choresPanelProps}
          onClose={() => setSectionOpen(null)}
        />
      )}

      {sectionOpen === 'shopping' && (
        <ShoppingSheet
          items={shoppingItems}
          cost={cost}
          budget={budget}
          pendingGroceries={pendingGroceries.length}
          unmatched={groceries.unmatched}
          onToggle={toggleShopping}
          onAdd={addShopping}
          onRemove={removeShopping}
          onAddGroceries={addWeekGroceries}
          onClearChecked={clearCheckedShopping}
          onClose={() => setSectionOpen(null)}
        />
      )}

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
          date={mealEditing.date}
          slot={mealEditing.slot}
          entry={mealEntryAt(mealEditing.date, mealEditing.slot)}
          takenSlots={mealsFor(mealEditing.date).map((m) => m.slot)}
          bookRecipes={bookRecipes}
          bookLoading={bookLoading}
          budgetLeftCents={budget - cost.totalCents}
          budgetWeekLabel={budgetWeekLabel}
          onSlot={(slot) => setMealEditing({ date: mealEditing.date, slot })}
          onPick={(recipeId) => pickMeal(mealEditing.date, mealEditing.slot, recipeId)}
          onToggleLeftover={() => toggleMealLeftover(mealEntryAt(mealEditing.date, mealEditing.slot))}
          onClear={() => clearMeal(mealEntryAt(mealEditing.date, mealEditing.slot))}
          onClose={() => setMealEditing(null)}
        />
      )}

      {dayViewing && (
        <DayView
          date={dayViewing}
          events={dayEventsFor(dayViewing)}
          meals={mealsFor(dayViewing)}
          tasks={tasksFor(dayViewing)}
          taskIsDone={choreIsDone}
          canAddMeal={nextFreeSlot(mealsFor(dayViewing)) != null}
          peopleById={orderedPeople}
          today={today}
          onEventPress={(ev) => {
            setDayViewing(null)
            setEditing(ev)
          }}
          onAddEvent={() => {
            setDayViewing(null)
            handleAddDay(dayViewing)
          }}
          /* Ticking keeps the sheet open — the reason to be here is often to
             clear two or three, and closing after each would mean reopening
             the day to reach the next one. */
          onToggleTask={toggleChore}
          onEditTask={(task) => {
            setDayViewing(null)
            setReschedulingChore(task)
          }}
          onAddTask={(text) =>
            addChore(text, null, { recurrence: 'once', due_on: dayViewing, scheduled_day: null })
          }
          onEditMeal={(slot) => {
            setDayViewing(null)
            setMealEditing({ date: dayViewing, slot })
          }}
          onAddMeal={() => {
            setDayViewing(null)
            handleAddMeal(dayViewing)
          }}
          onViewRecipe={(entry) => {
            setDayViewing(null)
            openBook(
              entry?.recipe?.id ?? null,
              entry ? { date: entry.on_date, slot: entry.slot } : null
            )
          }}
          onCook={(entry) => {
            setDayViewing(null)
            startCook(entry.recipe.id)
          }}
          onClose={() => setDayViewing(null)}
        />
      )}

      {menuOpen && (
        <MainMenu
          cook={cookRow}
          sections={settings}
          choresCount={
            booted ? `${choresDone} of ${trackableChores.length} done this week` : undefined
          }
          shoppingCount={booted ? `${shoppingRemaining} to buy` : undefined}
          onCook={() => {
            setMenuOpen(false)
            startCook(cookRow.recipeId)
          }}
          onRecipes={() => {
            setMenuOpen(false)
            openBook()
          }}
          onChores={() => {
            setMenuOpen(false)
            setSectionOpen('chores')
          }}
          onShopping={() => {
            setMenuOpen(false)
            setSectionOpen('shopping')
          }}
          onSettings={() => {
            setMenuOpen(false)
            setSettingsOpen(true)
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* Three layers, one at a time: the shelf, a recipe, cooking it. Each
          later one covers the one before, so closing cook mode lands back on
          the recipe rather than dumping you at the board mid-dinner.

          `!cooking` on the shelf is what makes the menu's cook row safe: it
          opens the book and cook mode in the same breath, and for one round
          trip there is a recipe id and no recipe yet. Without the guard that
          gap renders as eighteen recipes you did not ask for. */}
      {bookOpen && !openRecipe && !cooking && (
        <RecipeBook
          recipes={bookRecipes}
          loading={bookLoading}
          budgetLeftCents={budget - cost.totalCents}
          budgetWeekLabel={budgetWeekLabel}
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
            // "Plan a night" means dinner — the footer asks "Which night?" and
            // offers seven days, not twenty-eight slots. Upserting over an
            // existing dinner is the behaviour this has always had: choosing a
            // recipe for a night replaces that night's.
            pickMeal(date, DEFAULT_SLOT, openRecipe.id)
            closeBook()
          }}
          onCook={() => setCooking(true)}
          // Only when you got here from a meal on the board. Opening the same
          // recipe from the shelf has no night attached to change.
          changeMealLabel={
            bookFromMeal ? `Change ${slotLabel(bookFromMeal.slot).toLowerCase()}` : null
          }
          onChangeMeal={
            bookFromMeal
              ? () => {
                  const meal = bookFromMeal
                  closeBook()
                  setMealEditing(meal)
                }
              : undefined
          }
          onClose={closeRecipe}
        />
      )}

      {cooking && openRecipe && (
        <CookMode
          recipe={openRecipe}
          detail={openRecipe}
          initialIndex={cookProgress?.recipeId === openRecipe.id ? cookProgress.index : 0}
          onIndexChange={handleCookIndex}
          onExit={exitCook}
        />
      )}

      {/* The book is fetched lazily and cook mode can be asked for before it
          lands. One round trip, but on a screen someone crossed a kitchen to
          reach — so it says what it is doing rather than showing nothing. */}
      {cooking && !openRecipe && (
        <div className="cook cook--loading" role="status" aria-live="polite">
          <p className="cook__step">Getting the method…</p>
        </div>
      )}

      {reschedulingChore && (
        <ChoreSheet
          // Read back out of `chores` rather than held in state, so an edit
          // made in the sheet is reflected by the sheet itself.
          chore={chores.find((c) => c.id === reschedulingChore.id) ?? reschedulingChore}
          subtasks={chores.filter((c) => c.parent_id === reschedulingChore.id)}
          subtaskIsDone={choreIsDone}
          onPatch={(patch) => patchChore(reschedulingChore, patch)}
          onAddChild={(text) => addChore(text, reschedulingChore.id)}
          onDeleteChild={removeChore}
          onDelete={() => {
            const chore = reschedulingChore
            setReschedulingChore(null)
            removeChore(chore)
          }}
          onClose={() => setReschedulingChore(null)}
        />
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
          deviceTimeout={deviceTimeout}
          canSleep={screensaverAllowed}
          onChange={updateSetting}
          onDeviceTimeout={setDeviceScreensaver}
          onSleep={() => {
            // Close first, so the scene is not laid over a dialog the person
            // would find still open behind it when they woke the board.
            setSettingsOpen(false)
            sleep()
          }}
          onToggleFlourish={toggleFlourish}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Last in the tree and highest in the stack, because it covers
          everything — an open sheet or a half-finished dialog is just as easy
          to walk away from as the board. The board underneath stays mounted
          throughout: unmounting it would tear down five realtime channels and
          the clock hook, and the wall would come back showing a stale week. */}
      {idle && <Screensaver night={night} onWake={handleWake} />}

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
  meals,
  tasks,
  taskIsDone,
  canAddMeal,
  peopleById,
  today,
  onEventPress,
  onAddEvent,
  onToggleTask,
  onEditTask,
  onAddTask,
  onEditMeal,
  onAddMeal,
  onViewRecipe,
  onCook,
  onClose,
}) {
  const nameFor = (ownerId) => peopleById.find((p) => p.id === ownerId)?.display_name
  const planned = meals.filter((m) => m.recipe)

  return (
    <Sheet
      title={dayLabel(date)}
      onClose={onClose}
      footer={<button onClick={onAddEvent}>Add event</button>}
    >
      {/* "Dinner" until a day could hold four meals. The heading now counts
          what is actually there, and each meal is its own row carrying its own
          slot — so tapping the lunch edits the lunch, rather than every tap in
          this section meaning "the dinner" as it used to. */}
      <div className="sheet__section">
        <span className="sheet__heading">
          {planned.length === 0
            ? 'Meals'
            : planned.length === 1
              ? '1 meal'
              : `${planned.length} meals`}
        </span>

        {planned.length === 0 && (
          <button className="sheet-row" onClick={onAddMeal}>
            <span>Nothing planned</span>
            <span className="sheet-row__meta">Tap to plan</span>
          </button>
        )}

        {/* Three rows a meal, each doing exactly one thing, in the order you
            are likely to want them.

            The title opens the recipe — the same as tapping the chip on the
            board, and that consistency is the point. It used to open the meal
            editor here while the chip opened the editor there too, so the
            dish's own name was the one thing in the app that never showed you
            the dish. Changing the plan is a real action and keeps a real row;
            it just stops being what happens when you touch the food. */}
        {planned.map((meal) => (
          <Fragment key={meal.id}>
            <button className="sheet-row" onClick={() => onViewRecipe(meal)}>
              <span>{meal.recipe.title}</span>
              <span className="sheet-row__meta">
                {mealMeta(meal)}
                {meal.recipe.steps?.length > 0
                  ? ` · ${meal.recipe.steps.length} steps`
                  : ' · no method written down yet'}
              </span>
            </button>

            {/* Straight to the hob, and only when there is a method to show.
                Without this the shortest path to step one was the recipe page
                plus a Cook button that sits below the fold on a long one —
                a screen and two taps while holding a pan. */}
            {meal.recipe.steps?.length > 0 && (
              <button className="sheet-row" onClick={() => onCook(meal)}>
                <span>Cook it</span>
                <span className="sheet-row__meta">Step by step, screen stays awake</span>
              </button>
            )}

            <button className="sheet-row" onClick={() => onEditMeal(meal.slot)}>
              <span>Change or clear this meal</span>
              {/* Where the hold gesture gets taught. This is the row you find
                  when you don't know about it, so it is the row that should
                  say there is a faster way. */}
              <span className="sheet-row__meta">
                {meal.is_leftover ? 'Currently leftovers' : 'Currently a cook night'}
                {' · or hold its chip on the board'}
              </span>
            </button>
          </Fragment>
        ))}

        {planned.length > 0 && canAddMeal && (
          <button className="sheet-row" onClick={onAddMeal}>
            <span>Add another meal</span>
            <span className="sheet-row__meta">Breakfast, lunch or a snack</span>
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

      {/*
        Tasks, which the day view could show but never add.
        
        "Add event" has been the only thing in this footer since the sheet
        existed, so a day was a place where things happen *to* you and not a
        place where you decide to do something. The board has always been able
        to land a task on a day — 009 gave chores a `due_on`, 012 the drag —
        but only by dragging a row that already existed out of the To Do panel.
        There was no way to have the thought "I should do that on Thursday"
        and write it down on Thursday.
        
        It gets a capture field rather than a footer button, and that asymmetry
        with events is deliberate: an event needs a time and an owner, which is
        a form. A task is one line of text — and this field parses the rest off
        the end of it, so "call the plumber !!" arrives with its priority
        already set.
      */}
      <div className="sheet__section">
        <span className="sheet__heading">
          {tasks.length === 1 ? '1 task' : `${tasks.length} tasks`}
        </span>

        {tasks.length === 0 && <p className="sheet__empty">Nothing due.</p>}

        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            done={taskIsDone(task)}
            onToggle={() => onToggleTask(task)}
            onEdit={() => onEditTask(task)}
          />
        ))}

        <AddRow
          placeholder={`Add a task for ${dayLabel(date)}`}
          onAdd={onAddTask}
          parse
          today={today}
          collapsible
          openLabel="Add a task"
        />
      </div>
    </Sheet>
  )
}

/**
 * One task in the day sheet: tick it, or hold it to open everything else.
 *
 * Its own component because the hold needs a hook and this is inside a map.
 * The gesture is the same `useLongPress` the board's chips use rather than a
 * `contextmenu` handler — a right-click is not a thing that happens on a
 * wall-mounted iPad, and having the sheet answer to a different gesture than
 * the chip for the same object would undo the point of having one.
 */
function TaskRow({ task, done, onToggle, onEdit }) {
  const press = useLongPress(onEdit)

  return (
    <button
      className={done ? 'sheet-row is-done' : 'sheet-row'}
      {...press.handlers}
      onClick={() => {
        if (press.consumeClick()) return
        onToggle()
      }}
    >
      <span>{task.title}</span>
      <span className="sheet-row__meta">
        {done ? 'Done' : 'Tap to tick off · hold to reschedule'}
        {priorityLabel(task.priority) ? ` · ${priorityLabel(task.priority)}` : ''}
      </span>
    </button>
  )
}

/**
 * Picking the day a chore lands on, by tapping.
 *
 * Dragging remains the fast path and is untouched. This exists because drag
 * was the *only* path: on a wall-mounted iPad that means hauling a row out of
 * a scrolling dock panel, up across a 13" screen, onto a day row that may be
 * scrolled out of view — and it is unavailable entirely to anyone who cannot
 * make that gesture. Seven buttons are slower for the person who can drag and
 * possible for the person who cannot.
 *
 * One-offs are not offered a weekday. They carry a date, which wants a
 * calendar rather than seven buttons; dragging one onto a day in the grid
 * still works and remains the way to move it.
 */
/** 0 is "no priority", and the row shows nothing at all for it. */
const PRIORITY_OPTIONS = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Low !' },
  { value: 2, label: 'Medium !!' },
  { value: 3, label: 'High !!!' },
]

const RECURRENCE_OPTIONS = [
  { id: 'weekly', label: 'Every week', hint: 'A rhythm. One tick per week, cleared each Sunday.' },
  { id: 'once', label: 'Just once', hint: 'An errand on a date. Drag it onto a day to move it.' },
  { id: 'anytime', label: 'As needed', hint: 'No schedule. Logs every time it is done, and whose turn is next.' },
]

/**
 * Everything a chore row is not for.
 *
 * The row carries one primary action — tick it, or say who did it. This holds
 * the rest: what kind of chore it is, which day, whether it alternates, and
 * deleting it. Those were previously spread across a schedule pill, a drag
 * handle and a permanently-resident delete × sitting next to the primary tap
 * in a ~350px column, which at arm's length on a wall is a mis-tap generator.
 *
 * The recurrence control is also the only way to create anything but a weekly
 * chore. `addChore` writes `recurrence: 'weekly'` and always has, so until
 * this existed the 'anytime' kind that 012 was built for — the dishwasher,
 * the reason any of this exists — could only be made by hand in SQL, and
 * everything added through the app arrived as the exact kind that failed.
 */
function ChoreSheet({
  chore,
  subtasks = [],
  subtaskIsDone,
  onPatch,
  onAddChild,
  onDeleteChild,
  onDelete,
  onClose,
}) {
  const weekly = chore.recurrence === 'weekly'
  const oneOff = chore.recurrence === 'once'
  const episodic = chore.recurrence === 'anytime'
  const isChild = chore.parent_id != null
  const active = RECURRENCE_OPTIONS.find((o) => o.id === chore.recurrence)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{chore.title}</h2>

        <p className="muted">How does this happen?</p>
        <div className="chips">
          {RECURRENCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={chore.recurrence === opt.id ? 'chip on' : 'chip'}
              aria-pressed={chore.recurrence === opt.id}
              onClick={() => onPatch(recurrencePatchFor(chore, opt.id))}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {active && <p className="settings-row__hint">{active.hint}</p>}

        {/* Only weekly chores get weekdays. A one-off carries a date, which
            wants a calendar rather than seven buttons, and an 'anytime' chore
            has no day at all — 012's constraint would reject one. */}
        {weekly && (
          <>
            <p className="muted">Which day?</p>
            <div className="chips">
              {WEEKDAY_NAMES.map((name, day) => (
                <button
                  key={name}
                  className={chore.scheduled_day === day ? 'chip on' : 'chip'}
                  aria-pressed={chore.scheduled_day === day}
                  onClick={() => onPatch({ scheduled_day: day, due_on: null })}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
              <button
                className={chore.scheduled_day == null ? 'chip on' : 'chip'}
                aria-pressed={chore.scheduled_day == null}
                onClick={() => onPatch(unschedulePatch(chore))}
              >
                Any day
              </button>
            </div>
          </>
        )}

        {/* A one-off carries a date, so it gets a date field rather than the
            seven weekday buttons. This is the half of scheduling that drag
            was previously the only way to reach. */}
        {oneOff && (
          <>
            <p className="muted">Due</p>
            <div className="field-row">
              <input
                type="date"
                value={chore.due_on ?? ''}
                onChange={(e) => onPatch({ due_on: e.target.value || null })}
              />
              {chore.due_on && (
                <button className="ghost" onClick={() => onPatch({ due_on: null })}>
                  Clear
                </button>
              )}
            </div>
          </>
        )}

        {/* Rotation is only meaningful where there is a log to derive a turn
            from, which is what an episodic chore is. nextTurn() answers from
            the completion history rather than a stored next_person_id, so
            this switch changes what the row says, not who owns anything. */}
        {episodic && (
          <label className="row">
            <input
              type="checkbox"
              checked={!!chore.rotates}
              onChange={(e) => onPatch({ rotates: e.target.checked })}
            />
            Take turns
          </label>
        )}

        <p className="muted">How urgent?</p>
        <div className="chips">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={Number(chore.priority ?? 0) === opt.value ? 'chip on' : 'chip'}
              aria-pressed={Number(chore.priority ?? 0) === opt.value}
              onClick={() => onPatch({ priority: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Subtasks are one level deep and stay that way. A household to-do
            list that grows a tree needs an outliner, and an outliner on a
            wall-mounted iPad is a worse version of a list. */}
        {!isChild && (
          <>
            <p className="muted">Steps</p>
            {subtasks.length > 0 && (
              <div className="substeps">
                {subtasks.map((child) => (
                  <div key={child.id} className="substeps__row">
                    <span className={subtaskIsDone(child) ? 'is-done' : undefined}>
                      {child.title}
                    </span>
                    <button
                      className="panel-row__remove"
                      onClick={() => onDeleteChild(child)}
                      aria-label={`Remove ${child.title}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <AddRow placeholder="Add a step" onAdd={onAddChild} />
          </>
        )}

        <p className="muted">Notes</p>
        <textarea
          className="sheet__notes"
          rows={3}
          placeholder="Anything worth remembering next time"
          defaultValue={chore.notes ?? ''}
          onBlur={(e) => {
            const next = e.target.value.trim() || null
            if (next !== (chore.notes ?? null)) onPatch({ notes: next })
          }}
        />

        <div className="actions">
          <button className="ghost danger" onClick={onDelete}>
            Delete
          </button>
          <button onClick={onClose}>Done</button>
        </div>
      </div>
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
function MealEditor({
  date,
  slot,
  entry,
  takenSlots,
  bookRecipes,
  bookLoading,
  budgetLeftCents,
  budgetWeekLabel,
  onSlot,
  onPick,
  onToggleLeftover,
  onClear,
  onClose,
}) {
  const [picking, setPicking] = useState(!entry?.recipe)

  /**
   * Which meal of the day this is.
   *
   * Above the list rather than below it, because it is the question that comes
   * first: you decide you are planning a lunch and then go looking for one.
   * Underneath it would be a correction you make after noticing the recipe you
   * just picked landed on the wrong meal.
   *
   * A slot already holding something stays pickable — switching to it is how
   * you change that meal — but it says so with a dot, because `meal_plan` is
   * unique on (household, date, slot) and picking a recipe there replaces what
   * is on it. A control that silently overwrites is worse than one that warns.
   */
  const slotRow = (
    <div className="settings-row">
      <span className="settings-row__label">Meal</span>
      <div className="chips">
        {MEAL_SLOTS.map((s) => {
          const taken = takenSlots.includes(s.id) && s.id !== slot
          return (
            <button
              key={s.id}
              className={s.id === slot ? 'chip on' : 'chip'}
              aria-pressed={s.id === slot}
              onClick={() => onSlot(s.id)}
            >
              {s.label}
              {taken && ' ·'}
            </button>
          )
        })}
      </div>
    </div>
  )

  if (picking) {
    /*
     * The book's own shelf, not a stripped-down copy of it.
     *
     * Retired recipes are the one thing held back: a recipe you have stopped
     * cooking is still a recipe you wrote down, so the book keeps it, but you
     * should not be offered it for Tuesday.
     */
    const pickable = bookRecipes.filter((r) => r.status !== 'retired')

    return (
      <RecipeBook
        recipes={pickable}
        loading={bookLoading}
        title={entry?.recipe ? 'Change meal' : `Pick a ${slotLabel(slot).toLowerCase()}`}
        lead={slotRow}
        highlightId={entry?.recipe?.id}
        /* The picker is where the budget question actually bites: this is the
           tap that spends the money, not the one that browses. */
        budgetLeftCents={budgetLeftCents}
        budgetWeekLabel={budgetWeekLabel}
        onOpen={(r) => onPick(r.id)}
        onClose={entry?.recipe ? () => setPicking(false) : onClose}
      />
    )
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{dayLabel(date)}</h2>
        <p className="muted">{slotLabel(slot)}</p>
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

function SettingsPanel({
  settings,
  deviceTimeout,
  canSleep,
  onChange,
  onDeviceTimeout,
  onSleep,
  onToggleFlourish,
  onClose,
}) {
  const chosen = toFlourishIds(settings.flourish)
  const atMax = chosen.length >= MAX_FLOURISHES

  const householdMin = settings.screensaverMin ?? DEFAULT_TIMEOUT_MIN
  const effectiveMin = deviceTimeout ?? householdMin

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Board settings</h2>
        <p className="muted">Menu → Settings, or hold anywhere on the board.</p>

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

        {/*
          One row, not two.
          
          There were two: a household default and a per-device override, which
          is what Feature #5 §8 asks for and is genuinely the right shape
          *eventually* — the wall hangs in a room and wants to fade out, while
          a phone already has an idle behaviour and it is called locking.
          
          But "Screen timeout" above "This device" made you read both rows and
          work out which one was winning before you could answer a question
          with one obvious answer, and it did that to serve a household that
          currently has one screen in it. A setting whose whole purpose is to
          describe a difference should not appear before the difference does.
          
          `timeoutMsFor` still prefers a device override if one exists, and
          `readDeviceTimeout` still reads it — the model is intact and tested,
          it simply has no control until there is a second device to disagree
          with. When there is, this row splits back into two.
        */}
        <div className="settings-row">
          <span className="settings-row__label">Screen timeout</span>
          <div className="chips">
            {TIMEOUT_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={effectiveMin === o.value ? 'chip on' : 'chip'}
                aria-pressed={effectiveMin === o.value}
                onClick={() => {
                  // Clear any device pin at the same time, so this one control
                  // is always the one telling the truth. Without it a value
                  // left over from the two-row version would silently outrank
                  // whatever you picked here.
                  onDeviceTimeout(null)
                  onChange('screensaverMin', o.value)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <p className="settings-row__hint">
          {effectiveMin === 'never'
            ? 'The board stays on until you send it to sleep.'
            : `The board fades to the ambient scene after ${effectiveMin} minutes, and darkens after 10pm. Any touch brings it back.`}
        </p>

        {/*
          Sleep on demand, for when the room wants the screen off now rather
          than in ten minutes.

          It sits with the timeout it short-circuits, not in the footer beside
          Close. Those were two equal-weight ghost buttons in a `.actions` row,
          where each one is `flex: 1` — so the control that blanks the board
          and the control that dismisses the dialog were the same size, the
          same colour and touching. On a wall you reach for from arm's length
          that is a mis-tap waiting to happen, and the two do entirely
          different things.

          Disabled rather than hidden when the scene cannot run, because the
          reason is worth reading: a control that silently does nothing teaches
          people the setting is broken.
        */}
        <button className="settings-sleep" onClick={onSleep} disabled={!canSleep}>
          Sleep now
        </button>

        {!canSleep && (
          <p className="settings-row__hint">
            Unavailable while the board is offline or showing an error — those
            have to stay on screen.
          </p>
        )}

        <div className="actions">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
