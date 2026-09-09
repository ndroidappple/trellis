# Trellis — Feature Backlog

> **Trellis** is a personal/shared household operating system for Nick and Ed.  
> The long-term product vision is to connect household responsibilities, planning, meals, groceries, shopping, costs, routines, and AI assistance into one interconnected system.

---

# Feature #1 — Meal Planner Data Enrichment: Phase 1

**Priority:** High  
**Category:** Meal Planning / Data Foundation  
**Status:** Backlog / Phase 1  
**Primary Goal:** Build the structured recipe data foundation required to make meal planning a major Trellis selling point.

## 1. Feature Overview

The current meal-planning experience is functional but relatively basic. A recipe currently provides information such as:

- Recipe name
- Cook time
- Number of servings
- Existing meal-planning information
- Existing cost information

The larger vision is a significantly richer meal-planning experience containing:

1. Weekly meal planning
2. Beautiful recipe library
3. Complete digital recipe book
4. Kitchen-friendly cooking mode
5. Grocery-list integration
6. Food-cost tracking
7. AI-powered meal recommendations

Phase 1 focuses on the **underlying recipe data foundation**, not the complete UI experience.

The goal is to transform existing recipe records into structured, trustworthy, extensible recipe data that future Trellis features can build on.

---

## 2. Desired Workflow

**Existing Supabase data**  
↓  
**Schema/data audit**  
↓  
**Identify missing data**  
↓  
**Define target rich recipe model**  
↓  
**AI-assisted enrichment**  
↓  
**Validation / quality checks**  
↓  
**Structured data + provenance**  
↓  
**Review exceptions**

The enrichment process should be repeatable and safe to run again.

---

## 3. Existing Data Audit Findings

The existing Trellis Supabase structure includes relevant tables such as:

- `household`
- `profiles`
- `recipes`
- `recipe_ingredients`
- `recipe_steps`
- `products`
- `staples`
- `meal_plan`

Relevant relationships and security should be preserved.

Household-level security and existing Supabase RLS are important architectural constraints.

### Current `recipes` fields observed

- `id` UUID primary key
- `household_id`
- `title`
- `status` — active / retired / conditional
- `servings_min`
- `servings_max`
- `effort`
- `cook_minutes`
- `leftover_quality`
- `cost_confidence` — receipt / estimated / unknown
- `notes`
- `source`
- `created_at`

### Current data gaps

There are currently no dedicated recipe-level fields for:

- Description
- Source URL
- Image URL
- Prep time
- Total time
- Cuisine
- Meal type
- Tags
- Nutrition
- Explicit recipe-level cost
- Field-level provenance

The audit found:

- 18 recipes
- 3 recipes missing servings
- 3 missing effort
- 5 missing cook time
- 2 recipes with zero ingredient rows
- 56 recipe steps
- 127 recipe ingredients
- Ingredient names: 127/127 populated
- Ingredient quantities: 120/127 populated
- Ingredient units: 127/127 populated
- Ingredient notes: 48/127 populated
- Linked products: 111/127

Some recipes have no steps, including:

- Asian Beef Udon Stir-Fry
- Turkey Rosso Pesto Protein Pasta
- Protein Berry Smoothie
- Filthy cabbage
- Steak salad

Retired/conditional recipes should not automatically enter future weekly planning.

---

## 4. Target Rich Recipe Model

The existing recipe structure should be extended rather than replaced.

Potential future recipe fields:

- `description`
- `prep_minutes`
- `total_minutes`
- `cuisine`
- `meal_type`
- `tags`
- `source_url`
- `image_url`
- `search_keywords`

### Ingredient enrichment

Ingredients should eventually support:

- `normalized_name`
- `ingredient_category`
- `preparation`
- Normalization metadata

The purpose is to allow different recipe ingredients to map to the same grocery/product concept.

Example:

> "2 large yellow onions, diced"

should be structurally separable into:

- quantity: 2
- unit: each
- normalized ingredient: yellow onion
- preparation: diced

---

## 5. Provenance

AI enrichment should never make it impossible to understand where recipe data came from.

Potential future provenance structure:

### `recipe_field_provenance`

- `recipe_id`
- `field_name`
- `source_type`
- `source_reference`
- `confidence`
- timestamps

Possible source types:

- Existing data
- Verified recipe source
- AI enrichment
- User supplied
- System calculated

Trust hierarchy:

**Trusted existing data → Verified source → AI enrichment → Unknown**

AI should not overwrite trusted information simply because it believes another value is more likely.

---

## 6. AI Enrichment

AI should primarily be used for:

- Classification
- Categorization
- Summarization
- Ingredient normalization
- Search metadata
- Tag generation
- Identifying likely missing information
- Structuring existing information

AI should **not** fabricate exact recipe facts.

Where exact factual information cannot be established, Trellis should retain the uncertainty rather than silently inventing a value.

---

## 7. Images

Recipes should eventually support images with provenance.

Potential image sources:

- Recipe source
- AI-generated
- User-uploaded

Image provenance should be preserved so Trellis knows where an image came from.

Source URLs should also be preserved where available.

Any external recipe enrichment must respect source/API/licensing constraints.

---

## 8. Cost Data

Existing product cost information is sparse.

The `products` table includes fields such as:

- Product name
- Brand
- Store
- Package size
- Package unit
- Pre-tax cost
- Tax rate
- Tax category
- Price capture date
- Price source

Do not introduce a simplistic recipe cost calculation until the existing frontend/database cost logic has been inspected.

Future recipe costs should be derived from structured ingredient/product relationships where possible.

---

## 9. Phase 1 Scope

### In Scope

- Audit existing schema
- Audit existing recipe data
- Identify data gaps
- Define rich recipe model
- Extend existing schema appropriately
- Normalize ingredients
- Preserve source information
- Establish image strategy
- Establish provenance
- AI-assisted enrichment
- Validation
- Safe reruns
- Enrichment status/pipeline
- Future-readiness for grocery, cooking, cost, and AI features

### Out of Scope

- Full recipe library redesign
- Full cooking mode
- Grocery aggregation UI
- Pantry management
- AI meal planner
- Complete weekly meal planner redesign
- Advanced recipe discovery UI

---

## 10. Recommended Implementation Order

### 1A — Inspect
Audit schema, relationships, security, existing frontend behavior, and data quality.

### 1B — Design
Define the target recipe/ingredient/provenance model.

### 1C — Prototype
Enrich a small subset of recipes and validate the approach.

### 1D — Enrich
Run the enrichment pipeline across the recipe library.

### 1E — Quality Check
Review exceptions, validate data, confirm provenance, and verify safe reruns.

---

## 11. Definition of Done

- [ ] Existing recipe schema is fully audited.
- [ ] Existing recipe data quality is documented.
- [ ] Rich recipe data model is defined.
- [ ] Recipe enrichment is implemented safely.
- [ ] Ingredients are normalized sufficiently for future grocery aggregation.
- [ ] Source URLs are preserved where available.
- [ ] Image strategy and provenance are defined.
- [ ] AI enrichment is structured rather than blob-based.
- [ ] Field/source provenance is available.
- [ ] Enrichment can be safely rerun.
- [ ] Existing trusted information is not destructively overwritten.
- [ ] Retired/conditional recipes are handled appropriately.
- [ ] Future grocery, cooking, cost, and AI capabilities can build on the resulting data layer.

---

# Feature #2 — Productivity & Household OS Upgrade

**Priority:** High  
**Category:** Tasks / Productivity / Household OS  
**Status:** Backlog  
**Primary Goal:** Upgrade Trellis from a collection of household utilities into a cohesive household operating system with a mature task and planning layer.

## 1. Product Principle

Do not build Trellis as **"TickTick with a different UI."**

Borrow the best interaction patterns from mature productivity products:

- Fast capture
- Natural-language input
- Reminders
- Recurring tasks
- Calendar views
- Search
- Filtering
- Mobile accessibility
- Widgets
- Integrations

But differentiate through **household intelligence**.

A traditional productivity app answers:

> "A person has a task."

Trellis should answer:

> "A household has interconnected responsibilities, plans, resources, people, routines, and events."

---

## 2. Long-Term Household Flow

Trellis should eventually support:

**PLAN → DISCOVER → SHOP → COOK → TRACK → REMEMBER**

And connect:

**People → Home → Tasks → Meals → Recipes → Groceries → Shopping → Costs → Calendar → Routines**

---

## 3. Tier 1 — Core Productivity

### A. Mature Task System

Tasks should eventually support:

- Tasks
- Subtasks
- Checklists
- Due dates
- Start dates
- Recurring tasks
- Priorities
- Assignment
- Notes
- Attachments
- Completion state
- Household ownership/context

### B. Fast Capture

Support:

- Quick-add
- Natural-language date/time recognition
- Keyboard capture
- Voice capture
- Mobile capture
- Future Claude capture

The objective is to make creating a task nearly frictionless.

### C. Calendar / Scheduling

Build toward a unified scheduling experience for:

- Tasks
- Meals
- Events
- Appointments
- Deadlines
- Reservations
- Household plans

### D. Mature Reminders

Eventually support:

- Due-date reminders
- Multiple reminders
- Recurring reminders
- Contextual reminders
- Future notification channels
- Location/context-aware reminders where appropriate

### E. Search & Filtering

Support:

- Search
- Tags
- Lists
- Categories
- Filters
- Saved/smart views
- Household-specific views

---

## 4. Tier 2 — Household Intelligence

### Household Routines

Recurring household responsibilities should become first-class concepts.

Examples:

- Weekly cleaning
- Trash/recycling
- Plant care
- Grocery shopping
- Laundry
- Home maintenance

### Household Dashboard

A useful dashboard should eventually answer:

- What needs attention?
- What's happening today?
- What's coming up?
- What's planned for meals?
- What needs to be bought?
- What household routines are due?

### Cross-Module Relationships

Tasks should be able to relate to:

- Meals
- Recipes
- Groceries
- Shopping
- Calendar
- People
- Household areas
- Costs
- Routines

---

## 5. Tier 3 — Trellis Command Layer & AI

A central architecture principle:

> **Everything in Trellis should eventually be actionable through the same underlying command system—whether the command comes from a button, keyboard, voice, Claude, or an automation.**

Build a deterministic Trellis action layer first.

Potential actions:

- `get_meal_plan`
- `search_recipes`
- `get_recipe`
- `add_meal`
- `move_meal`
- `remove_meal`
- `update_recipe`
- `get_grocery_list`
- `add_grocery_item`
- Task actions
- Calendar actions
- Household actions

Claude should interpret intent, while Trellis owns the actual data and executes the action.

### Core architecture

**User voice/text**  
↓  
**Claude**  
↓  
**Trellis action layer**  
↓  
**Supabase**  
↓  
**UI**

Claude should not directly manipulate Supabase or raw database records.

---

## 6. Voice

Voice should be layered on top of the command system rather than implemented as browser automation.

Recommended sequence:

1. Build deterministic Trellis actions.
2. Connect Claude.
3. Add voice.
4. Expand voice across modules.

This avoids building a brittle browser-control system.

---

## 7. Security

The action layer must:

- Derive household context server-side.
- Never trust Claude to choose arbitrary `household_id`.
- Validate IDs and inputs.
- Preserve Supabase RLS.
- Distinguish read-only actions from mutations.
- Require confirmation for higher-risk mutations where appropriate.
- Log AI-triggered mutations where practical.

---

## 8. Priority Tiers

### Tier 1 — Core
1. Mature task system
2. Fast capture
3. Calendar/scheduling
4. Reminders
5. Search/filtering

### Tier 2 — Household
6. Household routines
7. Household dashboard
8. Cross-module relationships

### Tier 3 — AI
9. Trellis command layer
10. Claude integration
11. Voice
12. AI recommendations

### Tier 4 — Ecosystem
13. Notifications
14. Mobile/PWA
15. Widgets
16. Calendar integrations
17. Apple Watch
18. External integrations

Generic productivity features such as Pomodoro, Eisenhower Matrix, and statistics should not outrank the core household experience.

---

# Feature #3 — Trellis Themes

**Priority:** Low  
**Category:** UI / Personalization / Delight  
**Status:** Backlog  
**Primary Goal:** Allow users to personalize the Trellis interface with fun, bold visual themes without changing functionality.

## 1. Product Principle

Themes are intentionally **cosmetic and low priority**.

Function comes first. Delight comes second.

Themes should never alter:

- Business logic
- Data
- Permissions
- Navigation behavior
- Core workflows

---

## 2. Initial Themes

### Classic

The current Trellis visual design.

Characteristics:

- Clean
- Refined
- Functional
- Neutral
- Familiar

Classic remains the default.

### 8-Bit / Tiny Tower-Inspired

A playful retro pixel-art aesthetic inspired by the general visual language of retro mobile games.

Potential characteristics:

- Pixel-style icons
- Chunkier controls
- Retro-inspired palette
- Pixel decorative elements
- Subtle game-like animations
- Playful typography where appropriate

The theme should be **inspired by the aesthetic**, not copy proprietary artwork or assets.

### Sky

An airy outdoor aesthetic.

Potential characteristics:

- Blue sky
- Sun
- Clouds
- Bright backgrounds
- Soft gradients
- Nature-inspired details
- Subtle atmospheric elements

---

## 3. Theme Architecture

Themes should control presentation only.

Potential theme-controlled properties:

- Colors
- Typography
- Backgrounds
- Borders
- Shadows
- Icons
- Illustrations
- Decorative elements
- Animation preferences
- Component styling

The architecture should make adding new themes inexpensive.

---

## 4. Accessibility

Every theme must preserve:

- Readability
- Adequate contrast
- Keyboard usability
- Mobile usability
- Clear interaction states
- Accessibility requirements

A theme should never make core information harder to understand.

---

## 5. Theme Selector

Eventually add a Settings-based theme selector.

Potential experience:

- Theme name
- Preview
- Short description
- Apply button
- Current-theme indicator

The selector should be designed so additional themes can be added without changing the settings architecture.

---

## 6. Future Theme Ideas

Potential future themes:

- Night
- Cabin
- Coastal
- Garden
- Autumn
- Winter
- Space
- Minimal

Potential future capabilities:

- Seasonal themes
- Limited-time themes
- Animated backgrounds
- Weather-based themes
- Automatic day/night switching
- Custom accent colors
- User-created themes
- Household-specific themes

These are an idea bank, not commitments.

---

## 7. Definition of Done

- [ ] Existing Classic theme remains intact.
- [ ] Theme system is separated from business logic.
- [ ] Themes can be switched without changing data.
- [ ] Initial themes have clearly defined visual systems.
- [ ] Accessibility is preserved.
- [ ] Mobile usability is preserved.
- [ ] Theme architecture supports adding future themes.
- [ ] Theme selection is stored appropriately for the user/household.

---

# Feature #4 — Weather Integration

**Priority:** Medium-Low  
**Category:** Household Context / Integrations  
**Status:** Backlog  
**Depends On:** Household settings/location model, future notification/automation infrastructure  
**Primary Goal:** Give Trellis awareness of local weather and eventually allow weather conditions to influence household planning, tasks, meals, and AI recommendations.

## 1. Feature Overview

Add weather integration to Trellis so the household can see relevant weather information without leaving the application.

Initial capabilities:

- Current weather
- Today's forecast
- 5–7 day forecast
- High/low temperatures
- Precipitation probability
- Basic conditions
- Wind
- Weather location

The long-term vision:

> **Weather should eventually become contextual data that Trellis can use to help the household make better decisions.**

Examples:

- "Remind me to wash the car when we have a dry weekend."
- "Should we move our outdoor dinner?"
- "Will it rain during our plans Saturday?"
- "Plan meals for next week based on the weather."
- "Remind me to water the plants if we don't get rain for several days."
- "What's my day looking like tomorrow?" → calendar + tasks + meals + weather.

Weather should therefore be designed as a **data source for Trellis**, not simply as a weather widget.

---

## 2. Why This Belongs in Trellis

Weather is useful in a household operating system because many household decisions are weather-dependent.

Traditional weather apps answer:

> "What's the weather?"

Trellis should eventually answer:

> "What does the weather mean for my household?"

This creates another layer of intelligence:

**Weather → Calendar → Tasks → Meals → Household Routines → AI**

Examples:

### Tasks
- Wash car
- Mow lawn
- Water plants
- Take outdoor furniture inside
- Clean windows

### Calendar
- Outdoor events
- Trips
- Reservations
- Weekend plans

### Meal Planning
- Grilling on warm days
- Soup/stew on cold days
- Outdoor dinner when conditions are favorable

### AI
Claude can eventually use weather as one of several sources when answering household questions or making recommendations.

---

## 3. Phase W1 — Basic Weather Integration

### Goal

Establish weather as a reliable Trellis data source.

### Initial capabilities

Display:

- Current temperature
- Current conditions
- Today's high/low
- Precipitation probability
- Wind
- Weather icon
- 5–7 day forecast
- Forecast location

### UI

Add a weather component/card to an appropriate existing Trellis surface, likely the household/dashboard experience.

The initial design should remain consistent with the existing Trellis visual system.

Do **not** make weather the dominant feature of the application.

### Location

Trellis should have a household-level weather location.

Prefer a location model that can eventually support:

- City/region
- Latitude/longitude
- Time zone
- Display name

Avoid tying weather permanently to a hardcoded city.

---

## 4. Weather Provider Architecture

Weather data should flow through Trellis rather than having the React client communicate directly with a weather provider.

Recommended architecture:

**Weather Provider API**  
↓  
**Trellis server-side weather service**  
↓  
**Cached weather data**  
↓  
**React UI**

This provides:

- API-key protection
- Centralized provider logic
- Consistent data formatting
- Caching
- Easier provider replacement
- Better control over API usage/cost

API credentials should remain server-side.

---

## 5. Caching

Weather does not need to be fetched on every page load.

Implement caching so Trellis can reuse recently retrieved forecast data.

The exact cache duration should be determined during implementation based on the chosen weather provider's limits and pricing.

Potential approach:

- Current conditions: short cache
- Daily forecast: longer cache
- Refresh manually when appropriate
- Automatically refresh when cached data becomes stale

The goal is to minimize unnecessary API calls while keeping weather reasonably current.

---

## 6. Phase W2 — Weather as Planning Context

Once basic weather works, integrate weather into existing Trellis workflows.

Weather should begin appearing where it is useful rather than simply existing as a standalone card.

### Calendar

Show weather alongside upcoming outdoor events.

Example:

> Saturday — Picnic  
> ☀️ 78°F / 62°F  
> 10% chance of rain

### Tasks

Potentially indicate weather relevance:

> Wash car  
> **Best scheduled:** Saturday  
> ☀️ Dry / 75°F

### Meal Planning

Weather can become an input into meal recommendations.

Example:

> Friday: 82°F  
> → Consider grilling or a lighter dinner.

> Tuesday: 42°F / rain  
> → Consider soup, pasta, or another warm meal.

This phase should primarily provide **context**, not automatically change plans.

---

## 7. Phase W3 — Weather-Aware Automation

Once Trellis has a mature task/reminder/automation system, weather can become a trigger or condition.

Examples:

### Weather-triggered tasks

> "Remind me to wash the car the next dry Saturday."

Trellis determines:

**Saturday → Weather forecast → Suitable conditions → Reminder**

### Conditional reminders

> "Remind me to water the plants if we haven't gotten rain in five days."

### Household preparation

> "Remind me to bring the patio cushions inside if there's a storm coming."

### Outdoor plans

> "If Saturday's weather looks bad, remind me Friday afternoon to make a backup plan."

This requires broader Trellis automation/notification infrastructure, so it should **not** be built as part of W1.

---

## 8. Phase W4 — AI Weather Reasoning

Weather should eventually become available through the Trellis command/action layer.

Claude should be able to retrieve weather through a controlled Trellis action rather than directly accessing the weather provider.

Potential action:

`get_weather`

Possible inputs:

- Location
- Date range
- Forecast type

Possible output:

- Current conditions
- Daily forecast
- Precipitation
- Temperature
- Wind
- Relevant weather metadata

Claude could then combine weather with other Trellis data.

### Example

User:

> "What's my day looking like tomorrow?"

Claude could combine:

- Calendar
- Tasks
- Meal plan
- Weather
- Reminders

Result:

> "You have a meeting at 9, no scheduled tasks in the afternoon, and it's expected to be sunny and 76°. You have salmon planned for dinner, so it might be a good day to grill."

The important architectural principle:

> **Claude reasons about Trellis data. Trellis remains responsible for retrieving and modifying that data.**

---

## 9. Data Model Considerations

Weather should not be tightly coupled to the dashboard UI.

At minimum, Trellis should eventually have a household location concept that can be reused by multiple features.

Potential conceptual structure:

### Household Location

- `household_id`
- `latitude`
- `longitude`
- `city`
- `region`
- `country`
- `timezone`
- `display_name`

Weather data itself does not necessarily need to be permanently stored in the database.

A cached weather layer may be sufficient.

The implementation should determine whether caching belongs in:

- Supabase
- Server-side memory/cache
- Vercel-compatible caching
- Another lightweight caching mechanism

based on the existing Trellis architecture.

---

## 10. Security

Weather itself is low-risk, but the location model should follow Trellis's existing household security architecture.

Requirements:

- Household location belongs to the authenticated household.
- Users cannot retrieve another household's location.
- Server-side requests must derive household identity from the authenticated session.
- Do not allow the client or Claude to arbitrarily provide a `household_id`.
- Preserve existing Supabase RLS patterns.

---

## 11. Cost & Performance

Weather should be inexpensive to operate.

The initial feature should require:

- One weather provider
- Server-side API access
- Reasonable caching
- A small React component

No AI is required to retrieve or display weather.

AI costs should only occur when Claude is asked to reason about weather alongside other Trellis information.

The system should avoid unnecessary weather API calls, especially from frequently refreshed dashboards.

---

## 12. What Is Explicitly Out of Scope Initially

Do **not** build all of the following in the first weather release:

- Weather-triggered automations
- Complex notification rules
- AI weather recommendations
- Historical weather analytics
- Weather maps/radar
- Severe-weather alert system
- Multiple household locations
- Weather-based meal automation
- Weather-based task rescheduling
- External calendar weather synchronization
- Advanced weather visualizations

These can be added later if the feature proves useful.

---

## 13. Future Possibilities

Weather could eventually support:

- Severe weather alerts
- Hourly forecast
- Sunrise/sunset
- UV index
- Air quality
- Pollen
- Outdoor activity recommendations
- Weather-aware travel planning
- Seasonal household routines
- Gardening reminders
- Snow/ice preparation
- Weather-aware grocery/meal recommendations
- Automatic outdoor-event backup plans
- Weather-triggered notifications
- AI-generated household recommendations

These are **future possibilities, not commitments**.

---

## 14. Recommended Implementation Order

### W1 — Basic Weather
1. Add household weather location
2. Select weather provider
3. Build server-side weather service
4. Add caching
5. Retrieve current conditions
6. Retrieve 5–7 day forecast
7. Build Trellis weather component
8. Add loading/error/empty states
9. Verify household security

### W2 — Planning Context
10. Surface weather alongside relevant calendar information
11. Surface weather alongside relevant meal-planning information
12. Explore weather relevance for tasks

### W3 — Automation
13. Connect weather to reminder/automation infrastructure
14. Add conditional weather triggers
15. Add weather-dependent household suggestions

### W4 — AI
16. Add `get_weather` to Trellis's command/action layer
17. Allow Claude to retrieve weather
18. Combine weather with calendar/tasks/meals
19. Explore proactive recommendations

---

## 15. Definition of Done — Initial Release

- [ ] A household weather location can be configured.
- [ ] Trellis can retrieve current weather.
- [ ] Trellis can retrieve a multi-day forecast.
- [ ] Weather data is accessed server-side.
- [ ] API credentials are not exposed to the client.
- [ ] Weather requests are appropriately cached.
- [ ] Weather is displayed in the Trellis UI.
- [ ] Loading and error states exist.
- [ ] Household-level authorization is preserved.
- [ ] The implementation does not modify unrelated Trellis functionality.
- [ ] Weather data is structured so future Trellis services/AI can consume it.
- [ ] No AI dependency is required for basic weather functionality.

---

# Feature #5 — Ambient Screen Timeout

**Priority:** Medium
**Category:** Wall Experience / Hardware Care / Delight
**Status:** Backlog
**Depends On:** Nothing to ship a first version. Deeper versions depend on the theme system (#3) and weather (#4).
**Primary Goal:** After a period of no interaction, replace the board with a slow, quiet animation — protecting the display, calming the room, and giving each Trellis theme a face it wears most of the day.

## 1. Feature Overview

After a configurable number of minutes with no touches, the wall fades from
the board into a slow-moving ambient scene. Any touch returns it to the board
immediately.

This is the state the iPad is actually in for the overwhelming majority of its
life. The board gets looked at a few dozen times a day; the screensaver is
what the room sees the rest of the time. That inverts the usual priority — an
"idle" screen is really the primary visual surface of the product.

## 2. Why This Is Not Purely Cosmetic

Themes (#3) are correctly ranked Low because they are delight. This is ranked
higher because it does two things delight does not:

### Image persistence

A wall-mounted iPad displays the same grid, in the same pixels, for weeks
without interruption. The week grid's rules, the dock panel edges, and the
header are static geometry in fixed positions. That is the exact condition
that produces image retention. **A slow-moving animation is the mitigation**,
which is why "slow moving" is a functional requirement and not a mood.

### Light pollution

An always-lit screen on the wall of a home is a lamp nobody asked for. A
screensaver that darkens after a certain hour makes the device liveable in a
room people relax in.

Neither of these is served by a static dimmed board.

## 3. Prerequisite: iPadOS Auto-Lock

This feature only ever runs if the iPad never sleeps on its own. Confirm
**Settings → Display & Brightness → Auto-Lock → Never** on the wall device.

If auto-lock is on, iPadOS blanks the screen before Trellis ever gets to show
anything, and this feature is invisible. Whether a web page can hold the
screen awake by itself (the Screen Wake Lock API) needs checking against the
iPadOS version on the wall rather than assumed — treat the device setting as
the supported path and any API support as a bonus.

## 4. Behaviour

### Entering

- Idle timer starts from the last interaction.
- Fade in, slowly. An abrupt cut reads as a fault.
- Default timeout: 10 minutes. Configurable.

### Exiting

- Any touch, anywhere, returns to the board.
- **The waking touch must be swallowed.** Tapping to dismiss the screensaver
  must not also toggle the chore that happened to be under the finger. This is
  the same class of bug the long-press settings gesture already hit — a touch
  that means one thing to the wall and another to the widget beneath it.
- Returning should be instant and land on the current week, not wherever the
  board was left paged to hours ago.

### What counts as activity

- Touch, pointer, and key events: yes.
- Waking the iPad (`visibilitychange`): yes — reset the timer, do not resume
  mid-countdown.
- **Open question:** should a realtime data change wake the wall? If Ed adds
  something to the shopping list from his phone, having the board light up is
  either a lovely piece of ambient awareness or an annoyance at 11pm. Suggest
  shipping without it, then trying it.

## 5. Wall Survival Constraints

This feature touches the parts of the app most likely to break quietly on a
device that runs for weeks. It must not undo what the wall-survival work
established.

- **The idle timer cannot be a long `setTimeout`.** Timers do not survive an
  iPad suspending. Store a last-activity timestamp and compare it against a
  fresh `Date` on wake, the same way the midnight rollover is handled.
- **The board must stay mounted.** Unmounting it to show the screensaver would
  tear down the realtime subscriptions and the clock hook, so the wall would
  return showing a stale week. Overlay it; do not replace it.
- **The screensaver must not mask a crash or an offline state.** If the app is
  disconnected, that has to remain visible — a beautiful animation over a
  board that stopped updating four hours ago is precisely the "green dot over
  a stale week" failure in a prettier costume.
- **Honour `prefers-reduced-motion`** with a still or near-still variant.

## 6. Should It Show Information?

Two directions, and this is worth deciding deliberately.

**Pure ambient.** Animation only. Best burn-in protection, most restful, most
obviously a screensaver.

**Ambient plus a glance.** The animation carries a small amount of drifting
information: the time, the next event, tonight's dinner, tomorrow's weather.

The second is what makes this Trellis rather than a generic screensaver — the
wall stays useful from across the room without anyone touching it. The
constraint is that any text must **drift slowly and never occupy fixed
pixels**, or it reintroduces exactly the burn-in problem the feature exists to
solve.

Recommendation: build pure ambient first, then add a single drifting
information layer once the motion system works.

## 7. Per-Theme Animations

Each theme from Feature #3 should bring its own scene. Sketches, not
commitments:

### Classic

Quiet and warm, in the existing Fraunces/olive palette. Ideas:

- A very slow gradient wash, like ink diffusing through paper.
- A single thin line that traces the shape of the week over several minutes
  and dissolves.
- Soft drifting points of light, occasionally connecting.

The test for Classic is that a guest should not be able to tell whether it is
a screensaver or a piece of wall art.

### 8-Bit / Tiny Tower

The theme that most wants to be animated, because the aesthetic it draws on is
already about watching small things happen.

- A pixel building where floors correspond to household areas, with tiny
  sprites moving between them.
- A slow side-scrolling landscape that loops over several minutes.
- A pixel day/night cycle running on the real clock.
- **Data-reactive idea:** completed chores light windows; the tower gets
  livelier as the household gets through its week. This is the theme where
  tying the animation to real Trellis data would land best.

### Sky

- Clouds drifting across an open sky.
- The sun arcing in step with the actual time of day; stars and moon at night.
- Seasonal shifts in palette.

**Strong cross-feature link:** Sky is the natural home for weather (#4). If
the screensaver reflects *actual current conditions*, the household learns the
weather by glancing at the wall, and weather never has to take up board real
estate. Given that the screensaver is on screen most of the day, this is
plausibly the highest-value place weather could appear anywhere in Trellis.

### Night behaviour (all themes)

Below some hour, every theme should shift to a much darker, slower variant.
Reuse the existing clock hook so this follows real local time and survives
DST, rather than being a second, drifting notion of "night".

## 8. Settings

Settings should cover:

- On / off
- Timeout in minutes (suggest 2 / 5 / 10 / 30 / never)
- Animation style, once more than one exists
- Optionally, the hour night mode begins

### Where the setting lives — a real decision

`household.board_settings` is the obvious home and syncs across devices via
realtime. **But it is the wrong scope for this one.** The wall wants to time
out after ten minutes; a phone should almost certainly never do this at all.
A household-level setting forces both to agree.

Suggested model: a household-level *default*, overridable per device in
`localStorage`. This is also the first feature that would benefit from Trellis
having any notion of "which device am I" — worth noting as a small piece of
groundwork several later features (notifications, per-surface layout) would
also use.

## 9. Out of Scope Initially

- Animations for every theme (build one, prove the system)
- Weather-reactive and data-reactive scenes
- Photo slideshow / person avatars as screensaver content
- Video or heavyweight WebGL scenes
- Per-person screensavers
- Interactive screensavers

## 10. Performance

This runs for hours at a time on a device that must not get hot, drain, or
leak memory over a multi-week uptime.

- Prefer CSS animation and lightweight canvas over continuous heavy JS.
- Target a low, stable frame rate. This is ambient motion; 60fps is neither
  needed nor desirable.
- Pause the animation entirely when the document is hidden.
- Watch for memory growth across long runs — a leak that is invisible in a
  browser tab is a weekly crash on a wall.

## 11. Definition of Done

- [ ] The board fades to an ambient scene after a configurable idle period.
- [ ] Any touch restores the board, and that touch does not activate the
      control beneath it.
- [ ] The idle timer survives the iPad sleeping and waking.
- [ ] The board stays mounted; realtime and the clock hook keep running.
- [ ] Offline and error states remain visible rather than being covered.
- [ ] `prefers-reduced-motion` is honoured.
- [ ] Timeout is configurable, and the wall and a phone can differ.
- [ ] At least one theme has a finished scene.
- [ ] A darker night variant follows real local time.
- [ ] No burn-in-prone static elements in the ambient scene.
- [ ] Verified running on the actual wall for several days, not just in a
      browser tab.

---

# Feature #6 — Chores Scoreboard

**Priority:** Medium
**Category:** Household Intelligence / Motivation
**Status:** Backlog
**Depends On:** Chore completion history (`chore_completions`, migration 009). Nothing here is possible while a chore stores only a single "last completed" timestamp.
**Primary Goal:** Show who actually did what over a chosen period, so the household has a shared record instead of two competing memories.

## 1. The Actual Problem

This feature exists because of a specific, real argument: **who ran the dishwasher last.**

That is worth stating plainly, because it sets the bar. The scoreboard is not
successful because it produces a chart. It is successful if it ends that
argument — which means the underlying record has to be trusted by both
people, and trusted records come from logging being effortless rather than
from the chart being pretty.

Two distinct things solve two different halves:

- **Per-chore last-done** — "Dishwasher · Ed, Tuesday" on the row itself.
  Answers the argument directly, at the moment it happens. Built alongside
  migration 009.
- **The scoreboard** — the aggregate over a period. Answers the *other*
  argument, the one about who does more in general.

This entry is the second. The first is the prerequisite and the more
important of the two.

## 2. Concept

Over a selected period, each completed chore earns points for whoever
completed it. The board can show the totals.

Period options should include at least:

- This week
- This month
- All time
- Custom range

## 3. Scoring — Decide This Deliberately

The obvious scheme is **one point per completed chore**. It is also the one
that most reliably generates a new argument, because chores are not equal: a
week of taking the bins out should not outscore one deep clean of the
kitchen.

Options, roughly in order of how much trouble they invite:

### Flat — one point per completion
Simple, transparent, impossible to dispute the arithmetic. Biased toward
whoever does many small frequent things.

### Weighted — a per-chore point value
Fairer in principle. In practice, *setting* the weights becomes the argument,
which is worse than the one it replaced.

### Time-based — points proportional to how long a chore takes
Fairest in principle, requires someone to record durations, which nobody will
do.

**Recommendation:** ship flat, and make the per-chore weight an optional
field defaulting to 1. That way weights exist for the handful of chores where
the disparity is genuinely obvious, without requiring the household to price
every chore before the feature works at all.

## 4. A Real Risk Worth Designing Around

Scoreboards between two people who live together can go wrong. A number that
says one person does less is a fact with feelings attached, and a wall in a
shared home is a public place to display it.

Mitigations worth considering:

- Offer a **household framing** as well as a head-to-head one: "37 chores
  done this week" alongside, or instead of, "Nick 21 / Ed 16".
- Make the period default to something short. A weekly reset lets a bad week
  disappear; an all-time tally never forgives.
- Do not put streaks, trophies, or losing states in the first version.
- Consider making the scoreboard opt-in per household, and easy to turn off
  without deleting the underlying history.

The history is worth keeping regardless of whether the scoreboard is
displayed — it answers the dishwasher question either way.

## 5. Fairness Caveats

The data will be honest about what was logged, which is not the same as what
was done. Worth surfacing rather than hiding:

- A chore assigned to one person but completed by the other is credited to
  whoever ticked it. That is correct, and it needs the completion to record
  `completed_by` rather than the chore's `assignee_id`.
- Work nobody logs scores nothing. If one person logs diligently and the
  other doesn't, the scoreboard measures logging, not effort.
- Legacy completions from before migration 009 have no known person. They
  should be excluded from scoring rather than silently attributed.

## 6. Where It Lives

The board has no spare room, so the scoreboard needs a surface:

- A sheet opened from the Weekly To Do panel header — cheapest, consistent
  with the day sheet that already exists.
- A settings-style dialog.
- **A screensaver scene (Feature #5).** The ambient display is on screen most
  of the day and has room to spare. A slowly-drifting scoreboard is a
  genuinely good fit, and it means the feature costs the board no space at
  all.

## 7. Out of Scope Initially

- Weights, streaks, badges, achievements
- Notifications about standings
- Per-chore-category breakdowns
- Charts beyond a simple total per person
- Exporting or sharing standings

## 8. Definition of Done

- [ ] Points are computed from `chore_completions`, not from chore state.
- [ ] A period can be selected, with at least week / month / all time.
- [ ] Totals are shown per person for the selected period.
- [ ] Completions with no known person are excluded, not misattributed.
- [ ] The scoreboard can be turned off without losing history.
- [ ] A household-total framing is available alongside head-to-head.
- [ ] The underlying history remains useful even with the scoreboard off.

---

# Cross-Feature Architecture Principles

These principles should apply across the backlog.

## 1. Trellis Owns the Data

External services and AI should not become the source of truth for Trellis.

**AI interprets intent. Trellis executes actions.**

## 2. Build Foundations Before Polish

Prioritize:

1. Data quality
2. Core workflows
3. Shared infrastructure
4. Integrations
5. AI
6. Cosmetic polish

## 3. Favor Interconnected Features

A feature becomes more valuable when it can interact with existing Trellis modules.

Examples:

**Recipe → Ingredient → Product → Grocery → Cost**

**Task → Calendar → Routine → Household**

**Weather → Calendar → Task → Meal**

**Claude → Trellis actions → Every module**

## 4. Preserve Household Security

Existing Supabase RLS and household-level authorization should remain foundational.

## 5. Avoid AI-Generated Blobs

AI should enrich structured fields and invoke explicit actions rather than writing opaque blocks of unstructured data.

## 6. Design for Safe Repetition

Enrichment, automation, integrations, and AI actions should be safe to retry and should avoid destructive updates.

## 7. Keep Low-Priority Features Low-Priority

Themes and other delight-oriented work should not displace improvements that make Trellis substantially more useful as a household operating system.

---

# Feature #7 — Add a recipe by QR handoff to Claude

**Priority:** High (next up)
**Category:** Meal Planning / Capture
**Status:** Designed, not built

## The idea

A `+` in the recipe book opens a panel showing a QR code. Scan it with a
phone and you land in a Claude chat already primed to add a recipe to
Trellis: you talk, Claude writes it to Supabase.

This exists because the wall iPad is a terrible place to type a recipe and a
great place to *see* one, and because the household already has a Supabase
connector on claude.ai — so a phone chat can genuinely write to the database
without Trellis needing an editor, an API key, or an edge function.

## Design decisions already made

**Keep the encoded prompt short — this is a hard constraint, not taste.** A QR
code tops out around 2,953 bytes, and anything near that renders as a 177x177
grid that a phone camera will not reliably pick off a glossy screen at arm's
length. Target a prompt of roughly 400 characters so the code stays sparse and
scans first time.

**The prompt must tell Claude to read the schema, not carry it.** Embedding the
table definitions would blow the size budget *and* go stale — `est_cost_cents`
is declared in `004_recipes.sql` and does not exist on the live table, which is
exactly the kind of drift that would make a baked-in schema produce broken SQL.
Something close to:

> I want to add a recipe to my Trellis household app. Use the Supabase
> connector, project `useanivealpkicohodeo`. First read the schema and
> constraints of `recipes`, `recipe_ingredients`, `recipe_steps` and
> `recipe_field_provenance`. Then ask me for the recipe, show me the SQL
> before running it, and record what I tell you as `user_supplied`
> provenance.

That last clause matters: anything a person states outranks
`ai_enrichment` and must survive the next enrichment pass.

**Render the prompt as copyable text and a tappable link beside the QR.** Two
reasons. A QR is useless when you are already holding the phone that is showing
it. And the claude.ai `?q=` prefill deep link is **unverified** — a HEAD request
returns 403, which is bot filtering rather than evidence either way, and
whether a named Skill can be switched on by URL is unknown. If the prefill
silently does nothing, a visible prompt with a copy button still makes the
feature work. Design so the QR is the convenience and the text is the contract.

**Rendering:** needs a QR encoder — hand-rolling Reed-Solomon and mask
selection is ~600 lines of the wrong kind of code. `qrcode-generator` is ~15 kB
with no dependencies. Emit **SVG, not canvas**, so it stays crisp on the iPad
and can take its colours from the palette tokens.

## Open questions

- Does `https://claude.ai/new?q=...` actually prefill on iOS, and does it open
  the app or Safari? Test on the real phone before trusting it.
- Can a specific Skill or Project be selected from the URL? If yes, the prompt
  shrinks to almost nothing and the QR gets sparser still.
- Should the panel offer a second QR for *editing* the recipe currently open,
  not just adding a new one?

---

# Feature #8 — In-app recipe editing, with an AI edit button

**Priority:** Low
**Category:** Meal Planning
**Status:** Backlog, deliberately deferred

A pencil on each recipe opening a real editor, plus an "AI edit" button that
takes an instruction in plain language.

Deferred because it is a bigger piece of work than the icon suggests. A recipe
spans four tables, and `008_recipe_enrichment.sql` put real constraints between
them: an active recipe may not lose its last ingredient (a deferred trigger
rejects the whole transaction at commit), step numbers are unique and positive,
cuisine and tags must be lowercase, meal types are a closed set, and a hand edit
has to claim `user_supplied` provenance or the next enrichment pass overwrites
it. A form that ignores any of that corrupts the data quietly.

The AI half additionally cannot run in the browser: Vite inlines
`import.meta.env` at build time, so any `VITE_`-prefixed API key is baked into
the public bundle Vercel serves. It needs a server-side function — Vercel
Functions rather than Supabase Edge Functions, since the project already
deploys to Vercel and that keeps it to one deployment surface. Hosting is free
at this volume; tokens are roughly $0.05 an edit on Claude Opus 5.

Feature #7 covers most of the same ground with none of the build, which is why
this one is low priority rather than next.


---

# Current Feature Priority Summary

| Feature | Priority | Primary Purpose |
|---|---|---|
| **#1 Meal Planner Data Enrichment — Phase 1** | High | Build the recipe/meal data foundation |
| **#2 Productivity & Household OS Upgrade** | High | Build the core household task/planning system |
| **#3 Themes** | Low | Personalization and visual delight |
| **#4 Weather Integration** | Medium-Low | Add weather as household context |
| **#5 Ambient Screen Timeout** | Medium | Protect the display and give the wall a resting face |
| **#6 Chores Scoreboard** | Medium | Settle who actually did what, over a chosen period |
| **#7 Add a recipe by QR handoff to Claude** | High | Capture recipes from a phone without building an editor |
| **#8 In-app recipe editing + AI edit** | Low | Edit recipes on the wall; largely superseded by #7 |

---

# Long-Term Trellis Direction

The ultimate goal is not simply to have more modules.

The goal is to make those modules **understand one another**.

A mature Trellis experience should eventually connect:

**People**  
↓  
**Household**  
↓  
**Plans & Calendar**  
↓  
**Tasks & Routines**  
↓  
**Meals & Recipes**  
↓  
**Groceries & Shopping**  
↓  
**Products & Costs**  
↓  
**Weather & Other Context**  
↓  
**AI / Voice / Automation**

The resulting system should help answer not just:

> "What do I need to do?"

but:

> **"What does my household need, and what should we do next?"**
