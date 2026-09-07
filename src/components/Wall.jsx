import WeekGrid from './WeekGrid'
import ChoresCard from './ChoresCard'
import ListCard from './ListCard'
import MealsCard from './MealsCard'

/**
 * The wall layout: week grid on top, a dock of collapsed cards along the
 * bottom. Section toggles come next and will decide which of these render.
 */
export default function Wall({ profile, people }) {
  return (
    <div className="wall">
      <WeekGrid profile={profile} people={people} />

      <div className="dock">
        <ChoresCard profile={profile} people={people} />
        <ListCard kind="shopping" label="Shopping" profile={profile} />
        <ListCard kind="todo" label="To-do" profile={profile} />
        <MealsCard profile={profile} />
      </div>
    </div>
  )
}
