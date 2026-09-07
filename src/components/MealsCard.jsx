import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, dayName, startOfWeek, toDateInputValue } from '../lib/week'
import { formatCents, weekCost } from '../lib/cost'

// v1 plans dinners only. Breakfast and lunch are standing routines in this
// household rather than decisions, and costing them would double-count the
// weekly staples.
const SLOT = 'dinner'

const PLAN_QUERY = `
  id, on_date, slot, dish, is_leftover,
  recipe:recipes (
    id, title, cost_confidence,
    ingredients:recipe_ingredients (
      purchase_qty, manual_cost_cents,
      product:products ( id, name, pre_tax_cents, tax_rate_bps )
    )
  )
`

export default function MealsCard({ profile }) {
  const [plan, setPlan] = useState([])
  const [recipes, setRecipes] = useState([])
  const [staples, setStaples] = useState([])
  const [budget, setBudget] = useState(12000)
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(null) // a Date
  const [error, setError] = useState(null)

  const weekStart = useMemo(() => startOfWeek(new Date()), [])
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const load = useCallback(async () => {
    const from = toDateInputValue(weekStart)
    const to = toDateInputValue(addDays(weekStart, 7))

    const [planRes, recipeRes, stapleRes, hhRes] = await Promise.all([
      supabase.from('meal_plan').select(PLAN_QUERY).gte('on_date', from).lt('on_date', to),
      supabase.from('recipes').select('id, title, servings_min, servings_max, cook_minutes, effort, status')
        .neq('status', 'retired').order('title'),
      supabase.from('staples').select('weekly_qty, included, manual_unit_cents, product:products ( pre_tax_cents, tax_rate_bps )'),
      supabase.from('household').select('weekly_budget_cents').maybeSingle(),
    ])

    const firstError = planRes.error || recipeRes.error || stapleRes.error || hhRes.error
    if (firstError) return setError(firstError.message)

    setError(null)
    setPlan(planRes.data ?? [])
    setRecipes(recipeRes.data ?? [])
    setStaples(stapleRes.data ?? [])
    if (hhRes.data) setBudget(hhRes.data.weekly_budget_cents)
  }, [weekStart])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('meal-plan-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plan' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const cost = useMemo(() => weekCost(plan, staples), [plan, staples])
  const remaining = budget - cost.totalCents
  const over = remaining < 0
  const cookNights = plan.filter((p) => !p.is_leftover && p.recipe).length

  function entryFor(day) {
    const key = toDateInputValue(day)
    return plan.find((p) => p.on_date === key && p.slot === SLOT)
  }

  async function setMeal(day, recipeId) {
    const payload = {
      household_id: profile.household_id,
      on_date: toDateInputValue(day),
      slot: SLOT,
      recipe_id: recipeId,
      is_leftover: false,
    }
    const { error } = await supabase
      .from('meal_plan')
      .upsert(payload, { onConflict: 'household_id,on_date,slot' })
    if (error) setError(error.message)
    else load()
  }

  async function toggleLeftover(entry) {
    const { error } = await supabase
      .from('meal_plan')
      .update({ is_leftover: !entry.is_leftover })
      .eq('id', entry.id)
    if (error) setError(error.message)
    else load()
  }

  async function clear(entry) {
    await supabase.from('meal_plan').delete().eq('id', entry.id)
    load()
  }

  return (
    <>
      <button className="dock-card" onClick={() => setOpen(true)}>
        <span className="dock-label">Meals</span>
        <span className="dock-value">
          {cookNights}<span className="dock-of"> cook</span>
        </span>
      </button>

      <button className="dock-card" onClick={() => setOpen(true)}>
        <span className="dock-label">Grocery</span>
        <span className={over ? 'dock-value over' : 'dock-value'}>
          {formatCents(cost.totalCents)}
          <span className="dock-of"> / {formatCents(budget)}</span>
        </span>
      </button>

      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="card panel wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2>This week</h2>
              <button className="ghost" onClick={() => setOpen(false)}>Close</button>
            </div>

            {error && <p className="error">{error}</p>}

            <Projection cost={cost} budget={budget} />

            <div className="chore-list">
              {days.map((day) => {
                const entry = entryFor(day)
                return (
                  <div key={day.toISOString()} className="meal-row">
                    <span className="meal-day">{dayName(day)}</span>

                    {entry?.recipe ? (
                      <>
                        <span className="chore-title">
                          {entry.recipe.title}
                          {entry.is_leftover && <span className="tag">leftovers</span>}
                          {entry.recipe.cost_confidence === 'unknown' && (
                            <span className="tag">unpriced</span>
                          )}
                        </span>
                        <button
                          className={entry.is_leftover ? 'chip' : 'chip on'}
                          onClick={() => toggleLeftover(entry)}
                          title="Cooking tonight, or eating leftovers?"
                        >
                          {entry.is_leftover ? 'Leftovers' : 'Cook'}
                        </button>
                        <button className="ghost small" onClick={() => clear(entry)}>x</button>
                      </>
                    ) : (
                      <button className="ghost pick" onClick={() => setPicking(day)}>
                        Pick a meal
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {picking && (
        <RecipePicker
          recipes={recipes}
          onPick={(id) => { setMeal(picking, id); setPicking(null) }}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  )
}

function Projection({ cost, budget }) {
  const remaining = budget - cost.totalCents
  const over = remaining < 0

  return (
    <div className="projection">
      <div className="proj-row">
        <span className="muted">Meals</span>
        <span>{formatCents(cost.mealsCents)}</span>
      </div>
      <div className="proj-row">
        <span className="muted">Staples</span>
        <span>{formatCents(cost.staplesCents)}</span>
      </div>
      <div className="proj-row total">
        <span>{over ? 'Over budget by' : 'Remaining'}</span>
        <span className={over ? 'error' : 'ok'}>
          {formatCents(Math.abs(remaining))}
        </span>
      </div>

      <p className="muted fine">
        Checkout estimate across {cost.distinctProducts} products, whole packages,
        after tax.
        {cost.unpricedIngredients > 0 &&
          ` ${cost.unpricedIngredients} ingredients have no price, so the real total is higher.`}
      </p>
    </div>
  )
}

function RecipePicker({ recipes, onPick, onClose }) {
  const [q, setQ] = useState('')
  const shown = recipes.filter((r) =>
    r.title.toLowerCase().includes(q.trim().toLowerCase())
  )

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Pick a meal</h2>
          <button className="ghost" onClick={onClose}>Cancel</button>
        </div>

        <input
          autoFocus
          placeholder="Search recipes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="chore-list">
          {shown.map((r) => (
            <button key={r.id} className="recipe-row" onClick={() => onPick(r.id)}>
              <span className="chore-title">{r.title}</span>
              <span className="muted meta">
                {r.servings_min
                  ? `${r.servings_min}${r.servings_max && r.servings_max !== r.servings_min ? `-${r.servings_max}` : ''} servings`
                  : ''}
                {r.cook_minutes ? ` - ${r.cook_minutes} min` : ''}
                {r.status === 'conditional' ? ' - conditional' : ''}
              </span>
            </button>
          ))}
          {shown.length === 0 && <p className="muted">Nothing matches.</p>}
        </div>
      </div>
    </div>
  )
}
