import { Fragment, type ReactNode } from 'react';
import { useDetailLevel } from '../hooks/useDetailLevel';
import { WeekGrid, type DayData } from './WeekGrid';
import { SectionDock, SectionPanel, type SectionMode } from './SectionPanel';
import type { Person } from './PersonBadge';
import './Board.css';

export interface SectionSettings {
  chores: SectionMode;
  shopping: SectionMode;
}

/** Whether the board can currently be trusted to be current. */
export type SyncState = 'live' | 'connecting' | 'offline';

interface Props {
  /** Today, always — not the week being viewed. "Sunday, March 3". */
  todayLabel: string;
  rangeLabel: string;          // "March 3 – 9"
  /** Optional aside: "Week 10", "19% through 2026". Null when switched off. */
  /** Already rendered to text by Wall, in canonical order. */
  flourishes?: string[];
  /**
   * False once several asides are showing. Tapping then would collapse a
   * deliberate combination back to a single item, so the line stops being a
   * button rather than doing something destructive.
   */
  flourishCycleable?: boolean;
  /** Advances the flourish. Deliberately undiscoverable until tapped. */
  onCycleFlourish?: () => void;
  syncLabel: string;           // "Live", "Offline · 7:41 PM"
  syncState?: SyncState;
  days: DayData[];
  /** First load hasn't landed yet — show placeholders, not empty states. */
  loading?: boolean;
  settings: SectionSettings;
  chores: ReactNode;
  choresCompact: ReactNode;
  choresCount?: string;
  shopping: ReactNode;
  shoppingCompact: ReactNode;
  shoppingCount?: string;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onEventPress?: (id: string) => void;
  onAddDay?: (date: string) => void;
  onAddMeal?: (date: string) => void;
  dragging?: boolean;
  dragOverDate?: string | null;
  onOpenDay?: (date: string) => void;
  /** Absent while the board is already showing the current week. */
  onToday?: () => void;
  initialsFor?: (person: Person) => string;
}

export function Board(props: Props) {
  const [weekRef, level] = useDetailLevel();

  const flourishes = props.flourishes ?? [];
  const cycleable = (props.flourishCycleable ?? true) && !!props.onCycleFlourish;

  // Built once so the button and the plain-text variants cannot drift apart.
  const subLine = (
    <>
      <span>{props.rangeLabel}</span>
      {flourishes.map((text, i) => (
        <Fragment key={i}>
          <span className="board__sub-dot" aria-hidden="true">·</span>
          <span className="board__flourish">{text}</span>
        </Fragment>
      ))}
    </>
  );

  return (
    <div className="board" data-detail={level}>
      <header className="board__header">
        {/* Today is the thing you read from across the room, so it gets the
            size. The week being viewed is context and sits underneath. */}
        <div className="board__heading">
          <p className="board__today-label">{props.todayLabel}</p>
          {cycleable ? (
            <button
              type="button"
              className="board__sub"
              onClick={props.onCycleFlourish}
              aria-label="Change what this line shows"
            >
              {subLine}
            </button>
          ) : (
            <p className="board__sub">{subLine}</p>
          )}
        </div>
        <div className="board__header-right">
          <span className="board__sync" data-sync={props.syncState ?? 'live'}>
            <span className="board__sync-dot" aria-hidden="true" />
            {props.syncLabel}
          </span>
          {/* Only ever shown when it would do something. Paging away from
              the current week on a phone otherwise leaves no way back
              except counting arrow taps. */}
          {props.onToday && (
            <button className="board__today" onClick={props.onToday}>
              Today
            </button>
          )}
          <button className="board__step" aria-label="Previous week" onClick={props.onPrevWeek}>‹</button>
          <button className="board__step" aria-label="Next week" onClick={props.onNextWeek}>›</button>
        </div>
      </header>

      {/* The ref goes on the element whose height the level is derived from. */}
      <div className="board__week" ref={weekRef}>
        <WeekGrid
          days={props.days}
          level={level}
          loading={props.loading}
          initialsFor={props.initialsFor}
          onEventPress={props.onEventPress}
          onAddDay={props.onAddDay}
          onAddMeal={props.onAddMeal}
          dragging={props.dragging}
          dragOverDate={props.dragOverDate}
          onOpenDay={props.onOpenDay}
        />
      </div>

      <SectionDock modes={[props.settings.chores, props.settings.shopping]}>
        <SectionPanel
          title="Weekly To Do"
          count={props.choresCount}
          mode={props.settings.chores}
          compact={props.choresCompact}
        >
          {props.chores}
        </SectionPanel>

        <SectionPanel
          title="Shopping"
          count={props.shoppingCount}
          mode={props.settings.shopping}
          compact={props.shoppingCompact}
        >
          {props.shopping}
        </SectionPanel>
      </SectionDock>
    </div>
  );
}
