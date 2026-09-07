import WeekGrid from './WeekGrid'
import ChoresCard from './ChoresCard'

/**
 * The wall layout: week grid on top, a dock of collapsed cards along the
 * bottom. Lists and meals join the dock in later slices, and the section
 * toggles will decide which of them render here.
 */
export default function Wall({ profile, people }) {
  return (
    <div className="wall">
      <WeekGrid profile={profile} people={people} />

      <div className="dock">
        <ChoresCard profile={profile} people={people} />
      </div>
    </div>
  )
}
