/**
 * Where a widget's position/size actually comes from — the household
 * default, or a per-device override. Same shape as `lib/screensaver.js`'s
 * device timeout override, and the same reasoning: most board settings
 * describe the board itself (so the wall and a phone agreeing is the
 * point), but an arrangement of tiles is a property of one physical
 * screen's size, not a household preference — a phone's ~375–430pt width
 * cannot sensibly host the same 4-column grid as the iPad regardless of
 * what anyone prefers.
 *
 * `null` means "no opinion, follow the household default" — distinct from
 * an empty override, the same way a device that pinned "never" for the
 * screensaver must not silently start following the household again.
 * Practically this mostly buys forward-compatibility for a second wall-
 * class device later; the current one-iPad household has no active use
 * for it yet, which is why it costs almost nothing to add now (jsonb on
 * the household side needs no migration, localStorage needs no backend)
 * rather than being built out further.
 */

const DEVICE_KEY = 'trellis.widgetLayout.override'

export function readDeviceLayoutOverride() {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.portrait) || !Array.isArray(parsed.landscape)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDeviceLayoutOverride(layout) {
  try {
    if (layout == null) localStorage.removeItem(DEVICE_KEY)
    else localStorage.setItem(DEVICE_KEY, JSON.stringify(layout))
  } catch {
    /* Private mode, or storage full/disabled. The household default still
       applies, which is the reasonable fallback for a device that cannot
       remember anything of its own. */
  }
}
