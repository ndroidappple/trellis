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
 * Minimum cell span per widget type, in the same units as a placement's
 * {w, h}. Calendar's floor is deliberately generous — see the plan's "Content
 * migration" section: getting this wrong reproduces the week grid's own
 * documented min-height bug class, now shared across every widget competing
 * for the same scarce vertical budget instead of one known sibling. Its `h`
 * here is exactly what GRID_CONFIG was solved against above — the two are
 * not independent numbers and must be changed together.
 */
export const MIN_CELL_SPAN = {
  portrait: {
    calendar: { w: 4, h: 10 },
    todo: { w: 1, h: 3 },
    shopping: { w: 1, h: 3 },
    home: { w: 1, h: 3 },
  },
  landscape: {
    calendar: { w: 4, h: 10 },
    todo: { w: 1, h: 3 },
    shopping: { w: 1, h: 3 },
    home: { w: 1, h: 3 },
  },
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
  // sharing the rest) so Phase 1 reads as a continuation of the current
  // layout, not a reset. Home has no slot here on purpose — Phase 1 never
  // enables it, and Phase 2 owns designing where a 4th widget actually fits
  // (very possibly by growing GRID_CONFIG's row count, not just reusing
  // these numbers) rather than inheriting placeholder coordinates nobody
  // has validated against real content.
  const placements = []
  if (orientation === 'landscape') {
    // Week and dock as separate full-height columns, same shape as today's
    // landscape board (Board.tsx: "each gets its own full-height column
    // instead of negotiating a split of one shared column").
    //
    // Calendar sits at exactly its own minCellSpan here (4, 10) — no slack,
    // on purpose, unlike portrait below. It's a real, known limitation: in
    // this arrangement Calendar's resize grip has nowhere legal to go
    // (already at the grid's row maximum, and every column it could grow
    // into is claimed by the dock). Giving it slack would mean either
    // growing GRID_CONFIG.landscape.rows — which raises the whole grid's
    // floor (rows * ROW_MIN_PX + gaps) and risks the exact tight-margin
    // failure Feature #17 already hit once in landscape (fits by "roughly
    // 6px" in its own known worst case) — or narrowing the dock's default
    // width toward its own minCellSpan.w (1), which would make To-Do/
    // Shopping visibly cramped by default (their content still always
    // renders "full" until Phase 3's size tiers exist). Neither is a change
    // to make on a guess; it wants the real landscape measurement Phase 5
    // owns, or a fresh look once Phase 2 adds Home and the whole
    // arrangement gets redesigned anyway.
    if (ids.includes('calendar')) placements.push(rect('calendar', 0, 0, 4, 10))
    if (ids.includes('todo')) placements.push(rect('todo', 4, 0, 2, 5))
    if (ids.includes('shopping')) placements.push(rect('shopping', 4, 5, 2, 5))
  } else {
    // Week on top, dock sharing the row budget underneath — today's
    // portrait shape. Calendar gets 1 row of slack above its own
    // minCellSpan.h (11, not 10) so its resize grip actually has somewhere
    // to go — width has none to give (already at the grid's 4-column max)
    // and won't without growing GRID_CONFIG itself. The dock gives up
    // exactly that one row (6 -> 5 each), landing well above its own
    // minCellSpan.h (3), so nothing there gets visibly cramped by it. This
    // is safe in a way the landscape case isn't: it only grows the row
    // *portrait already has plenty of* (16 total, vs. landscape's tight
    // 10), so it can't reproduce Feature #17's landscape-specific risk.
    if (ids.includes('calendar')) placements.push(rect('calendar', 0, 0, 4, 11))
    if (ids.includes('todo')) placements.push(rect('todo', 0, 11, 2, 5))
    if (ids.includes('shopping')) placements.push(rect('shopping', 2, 11, 2, 5))
  }

  // Defensive, not decorative: catches a future WIDGET_ORDER/default-rect
  // edit that drifts out of sync with GRID_CONFIG before it ships, rather
  // than silently rendering a widget partly off-grid.
  return placements.filter((p) => isWithinBounds(p, gridConfig))
}

function rect(id, x, y, w, h) {
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
 * Attempt to resize `id` to a new {w, h}, anchored at its current origin.
 * Clamped to `minCellSpan` before anything else runs — a resize can never
 * produce a widget smaller than its own content can honestly show (see
 * `useWidgetSizeTier` for the Phase 3 corollary once a tile's size varies).
 */
export function tryResize(layout, id, { w, h }, gridConfig, minSpan) {
  const current = layout.find((p) => p.id === id)
  if (!current) return { ok: false, layout, reason: 'not-found' }

  const clampedW = Math.max(minSpan?.w ?? 1, w)
  const clampedH = Math.max(minSpan?.h ?? 1, h)
  const candidate = { ...current, w: clampedW, h: clampedH }

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

/**
 * Validates a whole layout against a grid config + per-widget minimums —
 * used when loading a persisted layout (household default or a device
 * override) that may have been saved against a different grid size than the
 * one currently rendering (e.g. `GRID_CONFIG` tuned after real-hardware
 * verification). Drops anything that no longer fits rather than crashing;
 * callers should fall back to `defaultLayout` for anything dropped.
 */
export function sanitizeLayout(layout, gridConfig, minSpans) {
  const kept = []
  for (const placement of layout ?? []) {
    const minSpan = minSpans?.[placement.id]
    // Clamp size to the grid's own bounds BEFORE clamping origin — a
    // straight Math.max against minSpan alone can leave w/h bigger than the
    // grid itself (e.g. a layout saved against a larger GRID_CONFIG than
    // the one now rendering), which would make isWithinBounds reject the
    // rect below no matter where clampOrigin puts its corner, and the
    // widget would silently vanish instead of shrinking to fit.
    const w = Math.min(gridConfig.cols, Math.max(minSpan?.w ?? 1, placement.w))
    const h = Math.min(gridConfig.rows, Math.max(minSpan?.h ?? 1, placement.h))
    const candidate = clampOrigin({ ...placement, w, h }, gridConfig)
    if (!isWithinBounds(candidate, gridConfig)) continue
    if (findCollision(kept, placement.id, candidate)) continue
    kept.push(candidate)
  }
  return kept
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
