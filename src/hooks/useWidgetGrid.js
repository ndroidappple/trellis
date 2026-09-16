/**
 * Pure cell/collision/placement math for the widget-based home screen.
 * No DOM, no React — this is the Phase 5 vitest target, and the one piece
 * of the whole redesign that can be verified without a browser at all.
 *
 * A widget occupies an integer cell rect { x, y, w, h } on an orientation-
 * specific grid — coarse and discrete on purpose, matching how the rest of
 * this app already prefers measured, hysteresis-banded states over
 * continuous scaling (see useDetailLevel.ts). Free-form pixel placement
 * would need its own snapping/rounding logic anyway; an integer grid gets
 * that for free and is easier to reason about on a device with very little
 * vertical slack to spare (Feature #17's landscape budget).
 *
 * Portrait and landscape are stored as two independent layouts, never
 * derived from each other — see the widget-home-screen plan for why a
 * coordinate transform between them risks violating a widget's own
 * `minCellSpan` floor the way Feature #17's ~6px case already did once.
 */

/**
 * Nominal per-row/col pixel size the whole grid is dimensioned against —
 * shared by both orientations so `weekFloorFor`'s requirement (below) means
 * the same thing in either one. First-guess in the sense that it hasn't
 * been seen on the real 11" iPad (same as Feature #17's other constants,
 * the 380px dock sidebar included) — but NOT arbitrary: it was picked by
 * solving for the one concrete number this file can check without a
 * browser (see GRID_CONFIG below), not guessed and hoped.
 */
export const ROW_MIN_PX = 56

/**
 * Grid dimensions, chosen so `rows * ROW_MIN_PX` gives Calendar's
 * `minCellSpan.h` enough room to satisfy `weekFloorFor`'s own worst case
 * (a week where nothing is past yet: TODAY_ROW_MIN_HEIGHT 150 + 6 *
 * ORDINARY_ROW_MIN_HEIGHT 84 + 6 gaps * 7 = 696px, from useDetailLevel.ts) —
 * not just "generous," an actual solved-for floor. 10 rows * 56px + 9 *
 * WIDGET_GAP_PX(16) = 704px, 8px of margin over that 696px requirement.
 * That margin is thin on purpose to flag it, not because it's comfortable —
 * Feature #17's own landscape case is on record fitting by "roughly 6px,"
 * so an 8px margin here is the SAME class of tight, not a safer one, and
 * needs the same real-hardware check before anyone trusts it. Portrait uses
 * 16 rows (finer-grained than the visual 8-ish "week + dock" split reads as)
 * specifically so Calendar's 10-row span and To-Do/Shopping's smaller ones
 * aren't forced to share one uniform row height that's oversized for the
 * smaller widgets — CSS Grid's `1fr` tracks split space by row-count, not
 * by declared minimum, so more, finer rows let one widget type ask for a
 * lot of height without inflating every other widget's floor to match.
 */
export const GRID_CONFIG = {
  portrait: { cols: 4, rows: 16 },
  landscape: { cols: 6, rows: 10 },
}

/**
 * Real hardware (the actual 11" iPad, first time this feature has had it)
 * found two things a continuous free-drag resize couldn't get right: the
 * grid always reserved height for its full nominal row count regardless of
 * what was actually placed (see occupiedExtent below, the fix), and there
 * was no way to make Calendar smaller than one mandatory size at all. Both
 * pointed the same direction — iOS Home Screen widgets' own model: a short,
 * named list of sizes per widget, not an open range. `SIZE_PRESETS`
 * replaces the old `MIN_CELL_SPAN` (any span at or above a floor) with
 * "one of exactly these spans."
 *
 * Every widget's *last* entry reproduces its old MIN_CELL_SPAN-era default
 * placement exactly (see `defaultLayout` below) — this changes what sizes
 * exist, not what a household already looking at the board sees today.
 * Ordered smallest to largest; `defaultLayout`/`firstFreeSlot` read the
 * first/last entries by that convention rather than a separate "which one
 * is smallest" lookup.
 *
 * Each `id` is deliberately the exact string the widget's own content
 * already renders on: To-Do/Shopping's `id`s are `ChoresPanel`/
 * `ShoppingPanel`'s own `mode` values (`'micro'|'compact'|'full'`, from
 * Phase 3 — a preset IS the mode now, not something mapped to one), and
 * Home's are its existing `size` prop values (`'small'|'large'`). Calendar
 * has no such string to reuse (its content reads its own measured
 * `useDetailLevel`, untouched by this), so its ids are just descriptive.
 * `label` is the separate, human-facing name shown in the size menu.
 *
 * Numbers are first-guess, same status as this file's other unmeasured
 * constants (ROW_MIN_PX, GRID_CONFIG) — now that real hardware is finally
 * reachable, these are the ones to tune against it first.
 */
export const SIZE_PRESETS = {
  portrait: {
    calendar: [
      { id: 'medium', label: 'Medium', w: 4, h: 7 },
      { id: 'large', label: 'Large', w: 4, h: 11 },
    ],
    todo: [
      { id: 'micro', label: 'Small', w: 1, h: 3 },
      { id: 'compact', label: 'Medium', w: 2, h: 4 },
      { id: 'full', label: 'Large', w: 2, h: 5 },
    ],
    shopping: [
      { id: 'micro', label: 'Small', w: 1, h: 3 },
      { id: 'compact', label: 'Medium', w: 2, h: 4 },
      { id: 'full', label: 'Large', w: 2, h: 5 },
    ],
    home: [
      { id: 'small', label: 'Small', w: 1, h: 3 },
      { id: 'large', label: 'Large', w: 2, h: 5 },
    ],
  },
  landscape: {
    calendar: [
      { id: 'medium', label: 'Medium', w: 4, h: 7 },
      { id: 'large', label: 'Large', w: 4, h: 10 },
    ],
    todo: [
      { id: 'micro', label: 'Small', w: 1, h: 3 },
      { id: 'compact', label: 'Medium', w: 2, h: 4 },
      { id: 'full', label: 'Large', w: 2, h: 5 },
    ],
    shopping: [
      { id: 'micro', label: 'Small', w: 1, h: 3 },
      { id: 'compact', label: 'Medium', w: 2, h: 4 },
      { id: 'full', label: 'Large', w: 2, h: 5 },
    ],
    home: [
      { id: 'small', label: 'Small', w: 1, h: 3 },
      { id: 'large', label: 'Large', w: 2, h: 5 },
    ],
  },
}

/** This widget's presets for this orientation, or `[]` for an unknown id
    rather than throwing — a caller iterating presets should just see
    nothing to offer. */
export function presetsFor(orientation, widgetId) {
  return SIZE_PRESETS[orientation]?.[widgetId] ?? []
}

/** The smallest defined preset's {w, h} — this is what used to be
    `MIN_CELL_SPAN`: the floor `firstFreeSlot` and the min-height-floor
    discipline (`Board.tsx`) still need, now read off the presets table
    itself rather than kept as a separate, driftable number. */
export function minSpanFor(orientation, widgetId) {
  const presets = presetsFor(orientation, widgetId)
  return presets[0] ?? { w: 1, h: 1 }
}

/** The default preset's {id, w, h} for a widget's first placement —
    every widget's largest preset except Home, which has always started
    small (see firstFreeSlot's use in Board.tsx/Wall.jsx) and still does. */
export function defaultPresetFor(orientation, widgetId) {
  const presets = presetsFor(orientation, widgetId)
  if (presets.length === 0) return { id: null, w: 1, h: 1 }
  return widgetId === 'home' ? presets[0] : presets[presets.length - 1]
}

/** Which preset (if any) a placement's current {w, h} matches exactly. */
export function presetIdFor(orientation, widgetId, placement) {
  const presets = presetsFor(orientation, widgetId)
  return presets.find((p) => p.w === placement.w && p.h === placement.h)?.id ?? null
}

/** Canonical widget priority order — used both by `defaultLayout` below and
    by the phone-class single-column stack (`Board.tsx`), which has no grid
    coordinates to sort by and needs this instead. */
export const WIDGET_ORDER = ['calendar', 'todo', 'shopping', 'home']

/**
 * A sensible starting arrangement — reproduces today's board shape (week
 * grid on top or beside, To-Do/Shopping sharing the rest) so Phase 1 reads
 * as a continuation of the current layout, not a jarring reset. Only
 * `enabledIds` are placed; anything else is omitted (equivalent to `mode:
 * 'off'`) rather than placed off-grid, since an off widget has no
 * position worth remembering until it's turned back on.
 */
export function defaultLayout(orientation, enabledIds = ['calendar', 'todo', 'shopping']) {
  const ids = WIDGET_ORDER.filter((id) => enabledIds.includes(id))
  const gridConfig = GRID_CONFIG[orientation]

  // Reproduces today's board shape (week on top-or-beside, To-Do/Shopping
  // sharing the rest) so this reads as a continuation of the current
  // layout, not a reset — every widget's default preset (see
  // defaultPresetFor) was chosen to exactly match the rect it used to be
  // hardcoded to here. Home has no slot here on purpose: it has no default
  // placement at all until firstFreeSlot places it the first time someone
  // turns it on (see Board.tsx/Wall.jsx).
  const placements = []
  if (orientation === 'landscape') {
    // Week and dock as separate full-height columns, same shape as today's
    // landscape board (Board.tsx: "each gets its own full-height column
    // instead of negotiating a split of one shared column").
    if (ids.includes('calendar')) placements.push(presetRect('calendar', 0, 0, orientation))
    if (ids.includes('todo')) placements.push(presetRect('todo', 4, 0, orientation))
    if (ids.includes('shopping')) placements.push(presetRect('shopping', 4, 5, orientation))
  } else {
    // Week on top, dock sharing the row budget underneath — today's
    // portrait shape.
    if (ids.includes('calendar')) placements.push(presetRect('calendar', 0, 0, orientation))
    if (ids.includes('todo')) placements.push(presetRect('todo', 0, 11, orientation))
    if (ids.includes('shopping')) placements.push(presetRect('shopping', 2, 11, orientation))
  }

  // Defensive, not decorative: catches a future preset/default-origin edit
  // that drifts out of sync with GRID_CONFIG before it ships, rather than
  // silently rendering a widget partly off-grid.
  return placements.filter((p) => isWithinBounds(p, gridConfig))
}

function presetRect(id, x, y, orientation) {
  const { w, h } = defaultPresetFor(orientation, id)
  return { id, x, y, w, h }
}

/** Grid bounds check — does not check collisions with siblings. */
export function isWithinBounds(r, gridConfig) {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= gridConfig.cols && r.y + r.h <= gridConfig.rows
}

/** Axis-aligned rectangle overlap, cell-space. Touching edges don't overlap. */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** The first sibling placement `candidate` collides with, or null. */
export function findCollision(layout, movingId, candidate) {
  for (const placement of layout) {
    if (placement.id === movingId) continue
    if (rectsOverlap(placement, candidate)) return placement
  }
  return null
}

/** Clamp a rect's origin so it stays fully inside the grid, size unchanged. */
export function clampOrigin(r, gridConfig) {
  const x = Math.min(Math.max(0, r.x), gridConfig.cols - r.w)
  const y = Math.min(Math.max(0, r.y), gridConfig.rows - r.h)
  return { ...r, x: Math.max(0, x), y: Math.max(0, y) }
}

/**
 * Attempt to move `id` to a new cell origin. Reject-and-snap-back per the
 * Phase 1 plan: an out-of-bounds or colliding candidate is rejected outright
 * rather than displacing another widget — auto-reflow is explicitly deferred
 * to a later pass. Returns the unchanged layout on rejection so a caller can
 * always just re-render `layout` without a branch.
 */
export function tryMove(layout, id, { x, y }, gridConfig) {
  const current = layout.find((p) => p.id === id)
  if (!current) return { ok: false, layout, reason: 'not-found' }

  const candidate = { ...current, x, y }
  if (!isWithinBounds(candidate, gridConfig)) return { ok: false, layout, reason: 'out-of-bounds' }
  if (findCollision(layout, id, candidate)) return { ok: false, layout, reason: 'collision' }

  return { ok: true, layout: replace(layout, id, candidate), reason: null }
}

/**
 * Attempt to set `id` to an exact new {w, h} (one of its SIZE_PRESETS
 * entries, chosen from the size menu), anchored at its current origin. No
 * clamping — presets are already valid sizes in the abstract, so this only
 * ever answers the one question left: does that exact size fit *here*,
 * right now. A caller can call this without committing (ignore the result
 * layout, read only `.ok`) to decide whether to offer or disable a preset
 * in the size menu before anyone taps it.
 */
export function tryResize(layout, id, { w, h }, gridConfig) {
  const current = layout.find((p) => p.id === id)
  if (!current) return { ok: false, layout, reason: 'not-found' }

  const candidate = { ...current, w, h }

  if (!isWithinBounds(candidate, gridConfig)) return { ok: false, layout, reason: 'out-of-bounds' }
  if (findCollision(layout, id, candidate)) return { ok: false, layout, reason: 'collision' }

  return { ok: true, layout: replace(layout, id, candidate), reason: null }
}

function replace(layout, id, next) {
  return layout.map((p) => (p.id === id ? next : p))
}

/**
 * The first cell (reading order: row-major, top-to-bottom then
 * left-to-right) where a `minSpan`-sized rect fits — in bounds, no
 * collision with `layout`. Returns `null` if nothing fits anywhere.
 *
 * This is Phase 2's answer to "where does a widget that has no default
 * placement go the first time someone turns it on" (Home, specifically —
 * see the widget-home-screen plan's Phase 2 section). `defaultLayout`
 * above deliberately never places Home, and growing `GRID_CONFIG` or
 * narrowing To-Do/Shopping's default width to make room for it both carry
 * real, documented costs (see the plan). A scan for the first empty slot
 * that already fits `minSpan` sidesteps both: nothing about the grid's
 * size or any other widget's placement changes, so a household whose
 * three widgets already fill the grid simply finds no room until they
 * free some themselves — an honest "not yet", not a silent failure (the
 * caller is expected to surface that, not this function).
 */
export function firstFreeSlot(layout, minSpan, gridConfig) {
  const w = minSpan?.w ?? 1
  const h = minSpan?.h ?? 1
  for (let y = 0; y <= gridConfig.rows - h; y++) {
    for (let x = 0; x <= gridConfig.cols - w; x++) {
      const candidate = { x, y, w, h }
      if (findCollision(layout, null, candidate)) continue
      return candidate
    }
  }
  return null
}

/** The preset closest to an arbitrary {w, h} — by total cell-count
    difference, ties broken toward the smaller option. Used by
    sanitizeLayout to resolve a persisted span left over from the old
    continuous-resize model (or a future grid retune) to a real preset,
    rather than clamping it to a floor that may no longer correspond to
    anything selectable. */
function nearestPreset(orientation, widgetId, w, h) {
  const presets = presetsFor(orientation, widgetId)
  if (presets.length === 0) return { w: 1, h: 1 }
  return presets.reduce((best, p) => {
    const dist = Math.abs(p.w - w) + Math.abs(p.h - h)
    const bestDist = Math.abs(best.w - w) + Math.abs(best.h - h)
    return dist < bestDist ? p : best
  })
}

/**
 * Validates a whole layout against a grid config — used when loading a
 * persisted layout (household default or a device override) that may have
 * been saved against a different GRID_CONFIG than the one currently
 * rendering, or predate this file's move to discrete presets. Drops
 * anything that doesn't fit; callers should fall back to `defaultLayout`
 * for anything dropped.
 *
 * Deliberately does NOT snap a placement to its nearest preset just because
 * it isn't an exact match — confirmed on real hardware to be actively
 * harmful: a household's live layout predated even the numbers currently in
 * SIZE_PRESETS (Calendar had shipped at portrait h:10 before a later tweak
 * grew its "large" preset to h:11), and snapping every placement to its
 * nearest preset on every read grew Calendar by a row, which now collided
 * with To-Do/Shopping sitting exactly where the *old* Calendar height had
 * left room for them — silently dropping both from the board. A stored
 * size only gets touched if it's actually invalid (non-positive, or bigger
 * than the grid itself); anything that already fits, colliding with nothing,
 * is left exactly as it was, preset match or not — the same "only correct
 * what's actually broken" contract this function had before presets existed
 * (it used to clamp to a floor, never re-snap something already valid).
 */
export function sanitizeLayout(layout, gridConfig, orientation) {
  const kept = []
  for (const placement of layout ?? []) {
    const sizeIsSane =
      placement.w > 0 && placement.h > 0 && placement.w <= gridConfig.cols && placement.h <= gridConfig.rows
    const { w, h } = sizeIsSane
      ? placement
      : nearestPreset(orientation, placement.id, placement.w, placement.h)
    const candidate = clampOrigin({ ...placement, w, h }, gridConfig)
    if (!isWithinBounds(candidate, gridConfig)) continue
    if (findCollision(kept, placement.id, candidate)) continue
    kept.push(candidate)
  }
  return kept
}

/**
 * How many rows/cols the CURRENT layout actually occupies — the fix for
 * the real-hardware clipping bug: the grid used to reserve GRID_CONFIG's
 * full nominal row count unconditionally (rows * ROW_MIN_PX, regardless of
 * what was placed), which on the real 11" iPad exceeded the space actually
 * left after the header and safe-area insets in BOTH orientations, and
 * .board's overflow:hidden silently clipped the excess. Bounded above by
 * GRID_CONFIG itself (every placement is already bounds-checked against it,
 * so this can never exceed it) and below by 1, so an empty board still
 * renders a sane minimum rather than collapsing to nothing.
 */
export function occupiedExtent(layout, gridConfig) {
  if (!layout || layout.length === 0) return { cols: 1, rows: 1 }
  const rows = Math.min(gridConfig.rows, Math.max(...layout.map((p) => p.y + p.h)))
  const cols = Math.min(gridConfig.cols, Math.max(...layout.map((p) => p.x + p.w)))
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) }
}

/** Pointer-pixel delta -> cell delta, given a measured cell size (+ gap). */
export function pixelDeltaToCellDelta(dxPx, dyPx, cellSizePx) {
  const stepX = cellSizePx.w + cellSizePx.gap
  const stepY = cellSizePx.h + cellSizePx.gap
  return { dx: Math.round(dxPx / stepX), dy: Math.round(dyPx / stepY) }
}

/**
 * The inverse of pixelDeltaToCellDelta — a placement's cell rect -> real
 * pixel box within the grid container, given the same measured cell size.
 * Phase 4's job, not Phase 1's: this is what lets the one actively
 * dragged/resized tile render at a continuous pixel position/size instead
 * of the grid's own discrete column/row placement, which is what
 * liquid-gooey's Move/Bend effects need to have something to animate.
 */
export function cellToPixel(placement, cellSizePx) {
  const stepX = cellSizePx.w + cellSizePx.gap
  const stepY = cellSizePx.h + cellSizePx.gap
  return {
    left: placement.x * stepX,
    top: placement.y * stepY,
    width: placement.w * cellSizePx.w + (placement.w - 1) * cellSizePx.gap,
    height: placement.h * cellSizePx.h + (placement.h - 1) * cellSizePx.gap,
  }
}
