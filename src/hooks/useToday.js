import { useEffect, useState } from 'react'
import { startOfDay } from '../lib/week'

/**
 * The current local date, re-rendered when the date actually changes.
 *
 * The wall iPad runs unattended for weeks. Without this, `isToday` is only
 * evaluated at mount and whenever some unrelated data change happens to force
 * a render — so at 00:00 the board keeps its big `flex: 2.4` row on yesterday,
 * and on Sunday it keeps showing the week that just ended.
 *
 * Two triggers, because neither is sufficient alone:
 *
 *   1. A timer to the next local midnight, recomputed from a fresh Date each
 *      time rather than a fixed 24h interval, so DST transitions land on the
 *      real midnight instead of drifting an hour.
 *   2. `visibilitychange`. When the iPad sleeps, timers are throttled or
 *      suspended — the midnight timeout may fire hours late or not until wake.
 *      Re-checking on wake covers that.
 */
export function useToday() {
  const [today, setToday] = useState(() => startOfDay(new Date()))

  useEffect(() => {
    let timer

    // Only swap the Date object when the day genuinely changed, so consumers
    // memoising on `today` don't rerun on every wake or stray tick.
    function sync() {
      setToday((current) => {
        const now = startOfDay(new Date())
        return now.getTime() === current.getTime() ? current : now
      })
    }

    function schedule() {
      const now = new Date()
      const nextMidnight = startOfDay(now)
      nextMidnight.setDate(nextMidnight.getDate() + 1)
      // A second past midnight, so a timer that fires a hair early doesn't
      // read the old date and then wait another full day to correct itself.
      timer = setTimeout(() => {
        sync()
        schedule()
      }, nextMidnight.getTime() - now.getTime() + 1000)
    }

    function onVisible() {
      if (document.visibilityState !== 'visible') return
      sync()
      clearTimeout(timer)
      schedule()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}
