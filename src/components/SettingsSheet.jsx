import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { useOrientation } from '../hooks/useOrientation'
import { supabase } from '../lib/supabase'
import { DEFAULT_TIMEOUT_MIN, TIMEOUT_OPTIONS } from '../lib/screensaver'
import { FLOURISHES, maxFlourishesFor, toFlourishIds } from '../lib/flourishes'
import { googleCalendarConfigured, startGoogleCalendarConnect } from '../lib/googleCalendar'
import './SettingsSheet.css'

/**
 * Settings, full scale (Feature #20). Used to be `SettingsPanel`, a `.card
 * .dialog` popup holding five rows total — two dock-mode pickers, a header
 * aside picker, one timeout row, and Google Calendar. It grew past that: four
 * new controls (weekly budget, a per-device timeout override, night mode
 * hours, your name) turned "a small popup" into a real settings surface, so
 * this is now a full-screen `Sheet` with a root list of categories and a
 * drill-down page per category, the way Apple's own Settings app works for a
 * page with more than a handful of rows.
 *
 * `category` is owned here, not by `Wall.jsx` — Wall only knows whether
 * Settings is open at all, plus which category to *start* on
 * (`initialCategory`, used by the menu's hold-to-configure rows to jump
 * straight to Board Layout rather than dropping someone at the root list they
 * already know they don't want).
 *
 * Each branch below mounts its own `<Sheet key=…>`. Different keys force
 * React to unmount/remount on navigation instead of patching one persistent
 * tree, which is what replays `Sheet`'s own 180ms rise-in on every drill-down
 * and back — the same "a layer arrived" cue the rest of the app already
 * gets for free on mount, not a second animation invented for this.
 */
export default function SettingsSheet({
  settings,
  deviceTimeout,
  canSleep,
  budget,
  initialCategory,
  homeUnplaced,
  onChange,
  onBudgetChange,
  onDeviceTimeout,
  onSleep,
  onToggleFlourish,
  onRenameSelf,
  onClose,
  profile,
  people,
}) {
  const [category, setCategory] = useState(initialCategory ?? null)
  const orientation = useOrientation()
  const maxFlourishes = maxFlourishesFor(orientation)
  const chosenFlourishes = toFlourishIds(settings.flourish, maxFlourishes)
  const atMax = chosenFlourishes.length >= maxFlourishes

  const householdMin = settings.screensaverMin ?? DEFAULT_TIMEOUT_MIN
  const effectiveMin = deviceTimeout ?? householdMin

  const back = { onBack: () => setCategory(null), backLabel: 'Settings' }

  if (category === 'layout') {
    return (
      <Sheet key="layout" title="Board Layout" onClose={onClose} {...back}>
        <BoardLayoutCategory
          settings={settings}
          onChange={onChange}
          homeUnplaced={homeUnplaced}
          chosen={chosenFlourishes}
          atMax={atMax}
          maxFlourishes={maxFlourishes}
          onToggleFlourish={onToggleFlourish}
        />
      </Sheet>
    )
  }

  if (category === 'display') {
    return (
      <Sheet key="display" title="Display" onClose={onClose} {...back}>
        <DisplayCategory
          settings={settings}
          deviceTimeout={deviceTimeout}
          effectiveMin={effectiveMin}
          canSleep={canSleep}
          onChange={onChange}
          onDeviceTimeout={onDeviceTimeout}
          onSleep={onSleep}
        />
      </Sheet>
    )
  }

  if (category === 'household') {
    return (
      <Sheet key="household" title="Household" onClose={onClose} {...back}>
        <HouseholdCategory
          budget={budget}
          onBudgetChange={onBudgetChange}
          profile={profile}
          onRenameSelf={onRenameSelf}
        />
      </Sheet>
    )
  }

  if (category === 'accounts') {
    return (
      <Sheet key="accounts" title="Accounts" onClose={onClose} {...back}>
        <div className="sheet__section">
          <CalendarConnections profile={profile} people={people} />
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet key="root" title="Settings" subtitle="Menu → Settings, or hold anywhere on the board." onClose={onClose}>
      <div className="sheet__section">
        <NavRow
          label="Board Layout"
          meta={`To-Do ${SECTION_MODE_LABELS[settings.chores]} · Shopping ${SECTION_MODE_LABELS[settings.shopping]}`}
          onOpen={() => setCategory('layout')}
        />
        <NavRow
          label="Display"
          meta={`${effectiveMin === 'never' ? 'Never' : `${effectiveMin} min`} · Night ${hourLabel(settings.nightFromHour)}–${hourLabel(settings.nightToHour)}`}
          onOpen={() => setCategory('display')}
        />
        <NavRow
          label="Household"
          meta={`$${Math.round(budget / 100)}/wk · ${profile.display_name}`}
          onOpen={() => setCategory('household')}
        />
        <NavRow label="Accounts" meta="Google Calendar" onOpen={() => setCategory('accounts')} />
      </div>
    </Sheet>
  )
}

function NavRow({ label, meta, onOpen }) {
  return (
    <button className="sheet-row sheet-row--nav" onClick={onOpen}>
      <span>{label}</span>
      <span className="sheet-row__meta">{meta}</span>
      <span className="sheet-row__chevron" aria-hidden="true">
        ›
      </span>
    </button>
  )
}

function hourLabel(h) {
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12} ${h < 12 ? 'AM' : 'PM'}`
}

/* On/off only, for all three sections — Full/Compact used to be a stored
   *setting* for To-Do/Shopping here, but once a widget's size is a small
   list of presets you pick (long-press the tile) rather than a setting you
   choose here, this stops meaning anything: presetIdFor (see Board.tsx)
   reads which preset is selected directly, the same way Home's small/large
   split has always been chosen rather than a Settings option. All three
   sections are symmetric now. */
const SECTION_MODE_LABELS = { on: 'On', off: 'Off' }
const SECTION_MODE_OPTIONS = ['on', 'off']
const SECTION_LABELS = { chores: 'To-Do', shopping: 'Shopping', home: 'Home' }

function BoardLayoutCategory({ settings, onChange, homeUnplaced, chosen, atMax, maxFlourishes, onToggleFlourish }) {
  return (
    <div className="sheet__section">
      {Object.keys(SECTION_LABELS).map((key) => (
        <div key={key} className="settings-row">
          <span className="settings-row__label">{SECTION_LABELS[key]}</span>
          <div className="chips">
            {SECTION_MODE_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={(settings[key] ?? 'off') === opt ? 'chip on' : 'chip'}
                onClick={() => onChange(key, opt)}
              >
                {SECTION_MODE_LABELS[opt]}
              </button>
            ))}
          </div>
        </div>
      ))}
      {homeUnplaced && (
        <p className="settings-row__hint">
          No room for it yet — free up space in Rearrange widgets and it'll appear.
        </p>
      )}

      {/* The header line cycles these on tap too. This is here so the set is
          discoverable once you've found settings at all, rather than only by
          tapping the header repeatedly and guessing. */}
      <div className="settings-row">
        <span className="settings-row__label">Header aside</span>
        <div className="chips">
          {FLOURISHES.map((f) => {
            const on = chosen.includes(f.id)
            return (
              <button
                key={f.id}
                className={on ? 'chip on' : 'chip'}
                // Full is the reason a chip is unavailable, so it says so by
                // going quiet rather than by rejecting the tap. Nothing has
                // to be un-picked first to see what is pickable.
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
          ? `Showing ${maxFlourishes} — untick one to swap it out. Together they use their short forms.`
          : `Pick up to ${maxFlourishes}. Two or more switch to short forms so the header still fits.`}
      </p>
    </div>
  )
}

/**
 * Screen timeout used to be one row, deliberately — Feature #5 §8 wanted a
 * household default plus a per-device override, but showing both before a
 * second screen existed meant reading two rows to answer a question with one
 * obvious answer. The household now has an iPad plus two phones, so "This
 * device" is back as its own row, and — unlike the old single-row version —
 * picking a household default no longer silently clears a device's own pin.
 * That silent clear only made sense when the pin was invisible; now that both
 * controls are on screen, each should do only what it says.
 */
function DisplayCategory({ settings, deviceTimeout, effectiveMin, canSleep, onChange, onDeviceTimeout, onSleep }) {
  return (
    <div className="sheet__section">
      <div className="settings-row">
        <span className="settings-row__label">Screen timeout</span>
        <div className="chips">
          {TIMEOUT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={settings.screensaverMin === o.value ? 'chip on' : 'chip'}
              aria-pressed={settings.screensaverMin === o.value}
              onClick={() => onChange('screensaverMin', o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-row__label">This device</span>
        <div className="chips">
          <button className={deviceTimeout == null ? 'chip on' : 'chip'} onClick={() => onDeviceTimeout(null)}>
            Follow default
          </button>
          {TIMEOUT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={deviceTimeout === o.value ? 'chip on' : 'chip'}
              onClick={() => onDeviceTimeout(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <p className="settings-row__hint">
        {effectiveMin === 'never'
          ? 'This screen stays on until you send it to sleep.'
          : `This screen fades to the ambient scene after ${effectiveMin} minutes. Any touch brings it back.`}
      </p>

      <div className="settings-row">
        <span className="settings-row__label">Night mode</span>
        <div className="settings-hours">
          <HourStepper label="Starts" hour={settings.nightFromHour} onChange={(h) => onChange('nightFromHour', h)} />
          <span className="settings-hours__sep" aria-hidden="true">
            –
          </span>
          <HourStepper label="Ends" hour={settings.nightToHour} onChange={(h) => onChange('nightToHour', h)} />
        </div>
      </div>
      <p className="settings-row__hint">The ambient scene runs darker and slower between these hours.</p>

      {/*
        Sleep on demand, for when the room wants the screen off now rather
        than in ten minutes. It sits with the timeout it short-circuits, not
        beside Done up in the header — those are equal-weight controls doing
        entirely different things, and a wall reached for from arm's length
        shouldn't have them touching.

        Disabled rather than hidden when the scene cannot run, because the
        reason is worth reading: a control that silently does nothing teaches
        people the setting is broken.
      */}
      <button className="settings-sleep" onClick={onSleep} disabled={!canSleep}>
        Sleep now
      </button>
      {!canSleep && (
        <p className="settings-row__hint">
          Unavailable while the board is offline or showing an error — those have to stay on screen.
        </p>
      )}
    </div>
  )
}

/** Hour-only — night mode has no minute granularity to offer, so the control
 *  doesn't pretend to more precision than `isNightAt` actually reads. Same
 *  stepper-plus-AM/PM visual language as `DateTimePicker`'s time field, in
 *  its own classes rather than shared ones: that field also handles minutes
 *  and a day picker, which this has no use for. */
function HourStepper({ label, hour, onChange }) {
  const hour12 = ((hour + 11) % 12) + 1
  const isPM = hour >= 12

  function step(delta) {
    onChange((((hour + delta) % 24) + 24) % 24)
  }

  return (
    <div className="settings-hour">
      <span className="settings-hour__label">{label}</span>
      <div className="settings-hour__controls">
        <div className="settings-stepper">
          <button type="button" aria-label={`${label}: hour up`} onClick={() => step(1)}>
            ▲
          </button>
          <span>{hour12}</span>
          <button type="button" aria-label={`${label}: hour down`} onClick={() => step(-1)}>
            ▼
          </button>
        </div>
        <button type="button" className="settings-ampm" onClick={() => onChange((hour + 12) % 24)}>
          {isPM ? 'PM' : 'AM'}
        </button>
      </div>
    </div>
  )
}

/**
 * Weekly grocery budget and your own name — two fields that write to two
 * different tables (`household.weekly_budget_cents`, `profiles.display_name`)
 * but share the same shape: a draft held in local state, committed with an
 * explicit Save rather than on every keystroke, same as the event editor's
 * own save button rather than a field that writes to Supabase per character.
 */
function HouseholdCategory({ budget, onBudgetChange, profile, onRenameSelf }) {
  const [budgetDraft, setBudgetDraft] = useState((budget / 100).toFixed(2))
  const [nameDraft, setNameDraft] = useState(profile.display_name)

  useEffect(() => setBudgetDraft((budget / 100).toFixed(2)), [budget])
  useEffect(() => setNameDraft(profile.display_name), [profile.display_name])

  const budgetCents = Math.round(parseFloat(budgetDraft || '0') * 100)
  const budgetDirty = Number.isFinite(budgetCents) && budgetCents > 0 && budgetCents !== budget
  const trimmedName = nameDraft.trim()
  const nameDirty = trimmedName.length > 0 && trimmedName !== profile.display_name

  return (
    <div className="sheet__section">
      <div className="settings-row">
        <span className="settings-row__label">Weekly grocery budget</span>
        <div className="settings-field">
          <span className="settings-field__prefix">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(e.target.value)}
          />
          <button
            type="button"
            className="settings-save"
            disabled={!budgetDirty}
            onClick={() => onBudgetChange(budgetCents)}
          >
            Save
          </button>
        </div>
      </div>
      <p className="settings-row__hint">What the shopping list and recipe book count down from each week.</p>

      <div className="settings-row">
        <span className="settings-row__label">Your name</span>
        <div className="settings-field">
          <input type="text" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          <button
            type="button"
            className="settings-save"
            disabled={!nameDirty}
            onClick={() => onRenameSelf(trimmedName)}
          >
            Save
          </button>
        </div>
      </div>
      <p className="settings-row__hint">
        Shown on badges, chore credit and calendar events. Only you can change your own name — this changes{' '}
        {profile.display_name}, not the other person in the household.
      </p>
    </div>
  )
}

/**
 * Feature #19. One row per household member — each connects their own
 * Google Calendar independently, since the household decided both people
 * should be able to, not just whoever set this up. Reads
 * calendar_connection_status() (016_google_calendar.sql) rather than the
 * calendar_connections table directly — that RPC is the only thing
 * allowed to say "connected", never the refresh token itself.
 */
function CalendarConnections({ profile, people }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('calendar_connection_status').then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError(rpcError.message)
      else setStatus(data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const configured = googleCalendarConfigured()

  return (
    <>
      <div className="settings-row">
        <span className="settings-row__label">Google Calendar</span>
        <div className="calendar-connections">
          {people.map((p) => {
            const connection = status?.find((c) => c.profile_id === p.id)
            return (
              <div key={p.id} className="calendar-connections__row">
                <span>{p.display_name}</span>
                {connection ? (
                  <span className="settings-row__hint">Connected</span>
                ) : (
                  // .chip's styling is scoped to a `.chips` ancestor inside a
                  // sheet (see RecipeBook.css) the same way it's scoped to
                  // `.card` in a dialog — a bare `.chip` here would render
                  // unstyled.
                  <div className="chips">
                    <button
                      className="chip"
                      disabled={!configured || p.id !== profile.id}
                      onClick={() => startGoogleCalendarConnect(p.id, profile.household_id)}
                    >
                      Connect
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!configured && (
        <p className="settings-row__hint">
          Not set up yet — needs a Google Cloud OAuth client (see Feature #19 in the backlog) before this does
          anything.
        </p>
      )}
    </>
  )
}
