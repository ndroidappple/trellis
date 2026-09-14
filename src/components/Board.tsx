import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { useDetailLevel, weightedRowsFor, weekFloorFor } from '../hooks/useDetailLevel';
import { useOrientation } from '../hooks/useOrientation';
import { WeekGrid, type DayData } from './WeekGrid';
import { WidgetGrid, type Placement } from './WidgetGrid';
import { WidgetTile } from './WidgetTile';
import { MIN_CELL_SPAN } from '../hooks/useWidgetGrid';
import type { Person } from './PersonBadge';
import './Board.css';

/** Still `'full' | 'compact' | 'off'` for now — Phase 3 owns replacing the
    full/compact distinction with the new size-tier system; on/off is all
    this phase reads (see the renderTile switch below). */
export type SectionMode = 'full' | 'compact' | 'off';

export interface SectionSettings {
  chores: SectionMode;
  shopping: SectionMode;
}

export interface WidgetLayoutByOrientation {
  portrait: Placement[];
  landscape: Placement[];
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
  choresCount?: string;
  shopping: ReactNode;
  shoppingCount?: string;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onEventPress?: (id: string) => void;
  onEventLongPress?: (id: string) => void;
  onAddDay?: (date: string) => void;
  onAddMeal?: (date: string) => void;
  dragging?: boolean;
  dragOverDate?: string | null;
  onOpenDay?: (date: string) => void;
  /** Straight to the recipe book — the one room that earns its own button. */
  onOpenBook?: () => void;
  /** Straight to Home (lights and scenes) — see the header-right comment
      below for why this is an icon, not a third text door next to Recipes. */
  onOpenHome?: () => void;
  /** Everything else that is not this week. */
  onOpenMenu?: () => void;
  /** Open each dock section as a full page. */
  onOpenChores?: () => void;
  onOpenShopping?: () => void;
  /** Absent while the board is already showing the current week. */
  onToday?: () => void;
  initialsFor?: (person: Person) => string;

  /** This orientation's committed widget arrangement — see the
      widget-home-screen plan's "Sync scope" section for why household
      default vs. per-device override lives in Wall.jsx, not here; Board
      only ever reads whichever one Wall already resolved. */
  widgetLayout: WidgetLayoutByOrientation;
  /** "Rearrange widgets" mode, entered from MainMenu — see MainMenu.jsx. */
  rearranging?: boolean;
  onCommitWidgetLayout?: (orientation: 'portrait' | 'landscape', next: Placement[]) => void;
}

export function Board(props: Props) {
  const [weekRef, level] = useDetailLevel(weightedRowsFor(props.days));
  const orientation = useOrientation();

  const flourishes = props.flourishes ?? [];
  const cycleable = (props.flourishCycleable ?? true) && !!props.onCycleFlourish;

  // Replaces Board.css's static worst-case min-height on .board__week: once
  // several days actually collapse (see .day-row--past in WeekGrid.css) the
  // grid's true floor is lower, and the container's own min-height has to
  // follow that down or the freed space never leaves .board__week at all.
  const weekFloor = weekFloorFor(props.days);

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
    <div className="board" data-detail={level} data-orientation={orientation}>
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
          {/* Two doors, and the split is by how often each is walked through.

              This was one "Recipes" button; then it became one "Menu" button,
              on the reasoning that a header growing a button per room would
              bury the week under its own index. That reasoning holds for
              To-Do, Shopping and Settings — and was wrong about the recipe
              book, which is not one room among four. It is the room this
              household opens daily, and putting it a tap further away to tidy
              the header traded a real cost for a tidiness nobody asked for.

              So the book keeps its own button and everything else lives behind
              Menu. Spelled out rather than glyphs, for the same reason as
              always: a recipe book nobody can find is just a database.

              Home is the newest room and does not yet have Recipes' years of
              being reached for daily — but it was asked for by name as
              wanting one-tap access, not a trip through Menu, so it gets a
              door too. An icon rather than a third spelled-out word: the
              header has already been measured tight enough to wrap at this
              iPad's own portrait width, and a glyph costs a fraction of a
              text pill's space. It still keeps its Menu row (same reasoning
              as Recipes, which keeps both) — losing "hidden on the board"-
              style completeness for the sake of a shortcut would be the
              wrong trade.

              Both come first and are fenced off by the rule, because they are
              the only controls here that leave the week. Sitting either
              between "Today" and the arrows would file a doorway to another
              room among the controls for moving around this one. */}
          {(props.onOpenBook || props.onOpenHome || props.onOpenMenu) && (
            <>
              {props.onOpenBook && (
                <button className="board__menu" onClick={props.onOpenBook}>
                  Recipes
                </button>
              )}
              {props.onOpenHome && (
                <button className="board__step" onClick={props.onOpenHome} aria-label="Home: lights and scenes">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12l9-9 9 9" />
                    <path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
                  </svg>
                </button>
              )}
              {props.onOpenMenu && (
                <button className="board__menu" onClick={props.onOpenMenu} aria-haspopup="dialog">
                  Menu
                </button>
              )}
              <span className="board__header-rule" aria-hidden="true" />
            </>
          )}
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

      {/*
        Each widget occupies a cell rect on one integer grid (see
        useWidgetGrid.js) instead of the old two-region week/dock split —
        that automatic space handoff (`--past-share`) is a deliberate
        casualty of moving to user-placed widgets, not an oversight: see the
        widget-home-screen plan's "What must not regress" section. Portrait
        and landscape each carry their own independently-stored arrangement
        (`props.widgetLayout`), which Wall.jsx already resolved from the
        household default plus any per-device override before this ever
        renders.
      */}
      <div className="board__body">
        <WidgetGrid
          orientation={orientation}
          layout={props.widgetLayout[orientation]}
          rearranging={!!props.rearranging}
          onCommitLayout={(next) => props.onCommitWidgetLayout?.(orientation, next)}
          minSpans={MIN_CELL_SPAN[orientation]}
          renderTile={(placement, gesture) => {
            const tileProps = {
              rearranging: props.rearranging,
              onDragHandlePointerDown: gesture.onDragHandlePointerDown,
              onResizeHandlePointerDown: gesture.onResizeHandlePointerDown,
            };

            if (placement.id === 'calendar') {
              return (
                <WidgetTile id="calendar" title="This Week" mode="on" {...tileProps}>
                  {/* The ref goes on the element whose height the level is
                      derived from — same rule as before, just re-pointed
                      from .board__week to this tile's own content area. */}
                  <div
                    className="board__week"
                    ref={weekRef}
                    style={{ '--week-floor': `${weekFloor}px` } as CSSProperties}
                  >
                    <WeekGrid
                      days={props.days}
                      level={level}
                      loading={props.loading}
                      initialsFor={props.initialsFor}
                      onEventPress={props.onEventPress}
                      onEventLongPress={props.onEventLongPress}
                      onAddDay={props.onAddDay}
                      onAddMeal={props.onAddMeal}
                      dragging={props.dragging}
                      dragOverDate={props.dragOverDate}
                      onOpenDay={props.onOpenDay}
                      onPrevWeek={props.onPrevWeek}
                      onNextWeek={props.onNextWeek}
                    />
                  </div>
                </WidgetTile>
              );
            }

            if (placement.id === 'todo') {
              return (
                <WidgetTile
                  id="todo"
                  title="Weekly To Do"
                  count={props.choresCount}
                  mode={props.settings.chores === 'off' ? 'off' : 'on'}
                  onOpen={props.onOpenChores}
                  {...tileProps}
                >
                  {props.chores}
                </WidgetTile>
              );
            }

            if (placement.id === 'shopping') {
              return (
                <WidgetTile
                  id="shopping"
                  title="Shopping"
                  count={props.shoppingCount}
                  mode={props.settings.shopping === 'off' ? 'off' : 'on'}
                  onOpen={props.onOpenShopping}
                  {...tileProps}
                >
                  {props.shopping}
                </WidgetTile>
              );
            }

            // 'home' arrives in Phase 2 — until HomeWidget exists, an
            // unrecognized placement id renders nothing rather than
            // guessing at content.
            return null;
          }}
        />
      </div>
    </div>
  );
}
