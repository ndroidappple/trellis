import type { ReactNode } from 'react';
import { useDetailLevel } from '../hooks/useDetailLevel';
import { WeekGrid, type DayData } from './WeekGrid';
import { SectionDock, SectionPanel, type SectionMode } from './SectionPanel';
import type { Person } from './PersonBadge';
import './Board.css';

export interface SectionSettings {
  chores: SectionMode;
  shopping: SectionMode;
}

interface Props {
  rangeLabel: string;          // "Sunday, March 3 – Saturday, March 9"
  syncLabel: string;           // "Updated 2 minutes ago"
  days: DayData[];
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
  initialsFor?: (person: Person) => string;
}

export function Board(props: Props) {
  const [weekRef, level] = useDetailLevel();

  return (
    <div className="board" data-detail={level}>
      <header className="board__header">
        <p className="board__range">{props.rangeLabel}</p>
        <div className="board__header-right">
          <span className="board__sync">
            <span className="board__sync-dot" aria-hidden="true" />
            {props.syncLabel}
          </span>
          <button className="board__step" aria-label="Previous week" onClick={props.onPrevWeek}>‹</button>
          <button className="board__step" aria-label="Next week" onClick={props.onNextWeek}>›</button>
        </div>
      </header>

      {/* The ref goes on the element whose height the level is derived from. */}
      <div className="board__week" ref={weekRef}>
        <WeekGrid
          days={props.days}
          level={level}
          initialsFor={props.initialsFor}
          onEventPress={props.onEventPress}
          onAddDay={props.onAddDay}
          onAddMeal={props.onAddMeal}
        />
      </div>

      <SectionDock modes={[props.settings.chores, props.settings.shopping]}>
        <SectionPanel
          title="To-Do"
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
