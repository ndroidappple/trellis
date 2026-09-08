import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Supabase channel state -> what the board says about itself. */
const STATUS = {
  SUBSCRIBED: 'live',
  CHANNEL_ERROR: 'offline',
  TIMED_OUT: 'offline',
  CLOSED: 'offline',
}

/**
 * Subscribes to one table's realtime changes and reports whether that
 * subscription is actually up.
 *
 * The board tells the room it's live, so it has to be telling the truth: a
 * kitchen wall showing a confidently-green stale week is worse than one that
 * admits it lost the connection.
 *
 * `onChange` is held in a ref so a loader that changes identity — `loadEvents`
 * is rebuilt whenever the viewed week changes — re-points the callback instead
 * of tearing down and rejoining the channel.
 */
export function useRealtimeTable(channelName, table, onChange) {
  const [status, setStatus] = useState('connecting')
  const handler = useRef(onChange)

  useEffect(() => {
    handler.current = onChange
  }, [onChange])

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => handler.current())
      .subscribe((s) => setStatus(STATUS[s] ?? 'connecting'))

    return () => supabase.removeChannel(channel)
  }, [channelName, table])

  return status
}

/**
 * One verdict from several channels. Any channel down means the board can be
 * stale, so the whole board says so — claiming "Live" while one table is
 * silently disconnected is the exact lie this is here to prevent.
 */
export function combineStatus(statuses) {
  if (statuses.some((s) => s === 'offline')) return 'offline'
  if (statuses.every((s) => s === 'live')) return 'live'
  return 'connecting'
}
