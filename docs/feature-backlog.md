# Trellis — Feature Backlog

> **Trellis** is a personal/shared household operating system for Nick and Ed.  
> The long-term product vision is to connect household responsibilities, planning, meals, groceries, shopping, costs, routines, and AI assistance into one interconnected system.

---

# Feature #1 — Meal Planner Data Enrichment: Phase 1

**Priority:** ~~High~~ — **Shipped** (migrations 008, 010, 011)  
**Category:** Meal Planning / Data Foundation  
**Status:** **Complete.** `enrichment_status` is 13 `enriched` / 5 `needs_review` /
0 `pending`. Provenance, safe reruns, and the `trellis_may_enrich` gate are all
live. Two recipes (**Filthy cabbage**, **Steak salad**) remain `needs_review` and
need a person, not another model pass — tracked in CLAUDE.md, not here.
The 46 low-confidence rows from 011 are model estimates, not measurements; the
book still renders an estimate identically to a measurement. Surfacing
confidence in the UI is the only Phase 1 thread left, and it belongs to a
future meal-planning UI slice rather than to this entry.  
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
**Status:** **Tier 1 foundation shipped** (migration 014). The task system and
fast capture are built; calendar unification, search/saved views and mature
reminders are still open, as is all of Tiers 2–4.

## Shipped in the Tier 1 foundation

- **Tasks live in `chores`, not a new table.** Decided against the separate
  `tasks` table: a task is a chore whose `recurrence` is `'once'`, which is
  what `'once'` already meant. One list, one mental model. 014 added
  `priority`, `notes`, `starts_on` and `parent_id`.
- **Fast capture with natural-language dates.** "bins out every tuesday !!"
  → a Tuesday chore at high priority. End-anchored matching only, and the
  field shows back what it understood before writing anything.
- **Subtasks**, one level deep, shown under their parent with a `2/3` count.
- **Priority**, rendered only above normal, as weight rather than a traffic
  light — colour means a *person* everywhere else in this app.
- **In-app reminders**: an Overdue group above everything else, day-counted
  lateness on the row, and a late count promoted into the panel head.
- **A motion system** in `tokens.css`, with every existing transition refitted
  to it.

**Deliberately deferred within Tier 1:** push notifications (needs a service
worker, VAPID keys and a send endpoint — a feature in its own right), unified
calendar scheduling, and search / filters / saved views.

**Old status:** Backlog  
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
**Status:** **Shipped** — first version 9 Sep 2026, the drifting information
layer (a centred, slowly-drifting clock) added 11 Sep 2026. Per-theme scenes
and weather-reactive Sky remain backlog, both blocked on features that don't
exist yet. See "What shipped, and what did not" below.
**Depends On:** Nothing to ship what exists today. Per-theme scenes depend on
the theme system (#3); weather-reactive Sky depends on weather (#4).
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

- [x] The board fades to an ambient scene after a configurable idle period.
      2.4s fade in, `Screensaver.jsx`.
- [x] Any touch restores the board, and that touch does not activate the
      control beneath it. Verified: the pointerdown is `preventDefault`ed and
      the following click is caught capture-phase at the window, so zero
      clicks reach the page.
- [x] The idle timer survives the iPad sleeping and waking. `useIdle` stores a
      last-activity timestamp and compares it against a fresh `Date.now()` on
      a 15s tick — never one long `setTimeout` — and a wake resets rather than
      resuming mid-countdown.
- [x] The board stays mounted; realtime and the clock hook keep running. The
      scene is a sibling overlay at `z-index: 40`, rendered last in `Wall`.
- [x] Offline and error states remain visible rather than being covered.
      `screensaverAllowed` requires `syncState === 'live'` and no error.
- [x] `prefers-reduced-motion` is honoured — see the note below, because the
      answer is not the obvious one.
- [x] Timeout is configurable, and the wall and a phone can differ. Household
      default in `board_settings.screensaverMin` (no migration — it is jsonb),
      per-device override in `localStorage`.
- [x] At least one theme has a finished scene. Classic: a wash plus four
      drifting fields of light on mutually prime periods.
- [x] A darker night variant follows real local time (22:00–06:00, and it
      slows down as well as darkening).
- [x] No burn-in-prone static elements in the ambient scene. The one text
      element — the clock — drifts ±1.7vmin over a 397s loop that measures
      0.00px of average drift, share-prime with the growth/drift cycles; every
      other layer travels most of the screen over its period.
- [ ] **Verified running on the actual wall for several days, not just in a
      browser tab.** The only item still open, and it cannot be closed from
      here. Checked in a browser: the fade, the night variant, the swallowed
      wake touch, the pause when the document is hidden, and that the drift
      layers actually move (~4.9px in 2.5s on a 137s period). What a browser
      cannot tell us is the thing the feature exists for — whether it holds up
      over weeks without heat, drain or memory growth.
      **Also still unconfirmed: iPadOS Auto-Lock must be set to Never** (§3),
      or iPadOS blanks the screen first and none of this is ever seen.

## 12. What shipped, and what did not

**Shipped.** Pure ambient scene per the §6 recommendation, plus — once the
motion system was proven out — the drifting information layer itself: a
centred clock, drifting so no glance resolves it as motion and no digit holds
a pixel, dimming rather than freezing under `prefers-reduced-motion`. Full
account, including the three placement bugs it took to get the geometry right,
is in `CLAUDE.md`'s "Ambient screen timeout" section.

**Deliberately not shipped, and still backlog:**

- **Per-theme scenes** (§7). Blocked on #3 existing at all.
- **Weather-reactive Sky** (§7). Blocked on #4.
- **A configurable night hour** (§8). Hardcoded 22:00–06:00. A fourth chip row
  on a wall dialog to settle a question with one obvious answer in a house
  where people sleep did not seem worth it. `NIGHT_FROM_HOUR` /
  `NIGHT_TO_HOUR` in `src/lib/screensaver.js` when it is.
- **Waking on a realtime data change** (§4, listed there as an open question).
  Shipped without it, as suggested.

**One decision worth recording, because it went against the brief.**

§5 asks for `prefers-reduced-motion` to be honoured "with a still or near-still
variant". Built literally, that is a contradiction: the drifting light exists
*because* it moves, and a still bright highlight parked on the same pixels for
hours is precisely the image retention this feature was written to prevent —
the burn-in bug wearing the costume of an accessibility fix.

So under reduced motion the bright shapes are removed altogether rather than
frozen, leaving a flat, very dark field: nothing moves, and nothing is bright
enough to leave a mark. The arrival keeps a short fade, since an opacity change
is not travel and a hard cut still reads as a fault.

---

# Feature #10 — One front door: main menu, cook-mode stepping, meal slots

**Priority:** —
**Category:** Navigation / Wall Experience
**Status:** **Shipped, 9 Sep 2026**
**Primary Goal:** Give the board a single labelled way out of the week, make
the method reachable from the night it is being cooked, and stop the app
insisting a day holds exactly one meal.

## 1. What was wrong

Three separate complaints, one underlying cause: the board had no navigation
model, so every new room was filed wherever there was space.

- **There was no main menu.** The header carried a lone "Recipes" button
  wedged between the sync dot and the week arrows — a doorway to another room
  filed among the controls for moving around this one.
- **Turning a dock section off removed the only route to its page.** The panel
  head *is* the door, and `SectionPanel` returns null at Off. So a household
  that switched Shopping off to free board space also lost per-row delete,
  "clear ticked", and the named list of unpriced ingredients — none of which
  exist anywhere else. **A layout preference quietly took away data.** This is
  the one that was a bug rather than a rough edge.
- **Settings were only behind an undocumented 650ms long-press**, so the way
  to undo the above was a gesture you had to already know about.
- **Cook mode sat three layers deep** — open the book, find the recipe among
  eighteen, press Cook — even on a night the board already knew what dinner
  was. A search performed for an answer the app was currently displaying.
- **Back did not mean back.** Opening a recipe from a day view and closing it
  landed you on the shelf: a screen you had never visited, showing eighteen
  recipes you had not asked for.
- **Cook mode forgot its place.** `index` lived in the component, the component
  unmounted on exit, and re-entering started at step one — on a device whose
  ErrorBoundary self-reloads after a crash.

## 2. What shipped

- **`MainMenu.jsx`** — one header button, "Menu", replacing "Recipes". A
  dialog rather than a sheet: it is six rows, and the board showing through
  behind them is the point. Recipe book, Weekly To Do, Shopping and Settings,
  each carrying its live count, and each saying so when its panel is switched
  off on the board.
- **A cook row at the top of the menu**, when today has a meal with a method
  written down: straight into cook mode in one tap. It prefers a
  *half-finished* recipe over a planned one — "Back to step 4" — because
  stepping out mid-recipe is a stronger statement of intent than planning was.
  Both are named, never described, since the whole value of the row is
  confirming it is the right one before committing a tap.
- **Cook progress in `localStorage`** (`lib/cookProgress.js`), expiring after
  6 hours so last night's dinner is never offered as resumable this morning.
  Per-device, not per-household: a cook in progress is a fact about *this
  screen right now*, and syncing it would have one surface snatch the other's
  place mid-recipe.
- **Cook mode steps both ways by tapping.** Left 30% goes back, the rest goes
  on. Going back previously had only a 52px corner button, so the one move you
  make when you have missed something was the one move that required clean
  hands. Nothing marks the boundary at rest — the press lights the zone and
  draws the edge, which is both the acknowledgement and the lesson, and a tap
  is still cancelled by travelling 12px, so seeing the wrong side light up is
  something you can slide out of.
- **Real meal slots** (`lib/meals.js`). `meal_plan.slot` has accepted
  breakfast / lunch / dinner / snack since `004_recipes.sql`, with
  `unique (household_id, on_date, slot)`; the app only ever wrote `'dinner'`.
  All four are now reachable, the day row button says "+ Meal", and the board
  shows every slot. **No migration — the schema was already right.**

## 3. Decisions worth keeping

- **Dinner keeps every advantage.** It is pre-selected by `nextFreeSlot`, it
  sorts where a day puts it, and planning one costs no more taps than before.
  `MealsCard.jsx`'s original note still holds — "breakfast and lunch are
  standing routines in this household" — so the other three had to become
  possible without becoming a tax on the common case.
- **"+ Meal" was not a rename.** Relabelling alone would have promised four
  slots and still written one, and `mealEntryFor`'s `slot === 'dinner'` filter
  would have made any other slot invisible on the board. The label could only
  tell the truth once the reads and writes did.
- **The chip meta was wrong twice.** "Cooking tonight" was wrong about the
  meal the moment there was more than one, and had *already* been wrong about
  the day — a dinner five days out said "tonight". Now `mealMeta` says the
  slot, and "· leftovers" when it is.
- **A slot already holding something stays pickable** in the editor, marked
  with a `·`. Switching to it is how you change that meal; refusing would be
  worse. But it must be visible, because the unique constraint means picking a
  recipe there replaces what is on it.

## 4. Known gaps

- `mealsFor` and the days memo both filter `mealPlan` per day, so a week's
  render is 7 passes over the plan. Fine at 7–28 rows; worth an index if meal
  planning ever grows past a week on screen.
- The menu's cook row picks dinner, or the last planned slot if there is no
  dinner. It does not consider the time of day — planning a breakfast and a
  dinner on the same day offers the dinner all morning.
- `RecipeDetail`'s "Plan a night" still means dinner specifically, which is
  right for a footer that asks "Which night?" and offers seven days. If meal
  slots turn out to be used, that footer is the next thing to revisit.

---

# Feature #11 — Get the shopping list onto a phone

**Priority:** Medium
**Category:** Shopping / Household Logistics
**Status:** Backlog. **Direction settled 9 Sep 2026: QR handoff, not a text.**
**Depends On:** Nothing. Tier 0 needs no backend, no vendor and no schema change.
**Primary Goal:** Let whoever is standing in the shop read the list on their own
phone, without anyone having to send anything.

## 1. The reframe — read this before designing anything

The obvious version of this feature is "text the list to Nick or Ed". That is
the expensive version, and it is solving a problem the app does not have.

**The list is already on both phones.** Trellis runs on them, `list_items` is
synced over realtime, and anything ticked at the shop is already reflected on
the wall within a second. There is nothing to transport.

What is actually missing is *arrival*: no phone opens straight to the shopping
list. The gap is navigation, not delivery — and a text would be strictly worse
than fixing the navigation, because a text is a **snapshot that goes stale the
moment the other person ticks something off**, while the app is live.

## 2. Tier 0 — QR handoff (the recommendation)

Three small pieces, none of which needs a server:

1. **Hash routing.** The app is a single page with no routes. `…/#shopping`
   should open the Shopping full page directly. This is the only piece that
   touches the app's structure, and it is small — `Wall` already has
   `sectionOpen` state; it needs to read and write `location.hash`.
2. **A QR code on the wall's Shopping page**, encoding that URL. Scan it with a
   phone camera and the app opens on the phone, showing the live list.
3. **Add to Home Screen on the phone**, pointed at the same URL, for people who
   want it permanently one tap away.

**Why this works with no auth work at all:** sessions are per-origin, and both
phones already have their own session on the Vercel origin. The QR carries a
URL, not data — so it needs no token, grants no access that the scanner did not
already have, and a photograph of the wall leaks nothing. Someone without a
Trellis session who scans it lands on the sign-in screen, which is correct.

**This pattern is already in the backlog.** Feature #7 uses a QR to hand a
recipe from the wall to a phone. Doing the same for the shopping list is not a
new idea in this product, and the two should share whatever QR rendering ends
up being built — probably an inline SVG generator rather than a dependency, at
this size.

Cost: a few hours, no vendor, no secret, no per-message charge, no phone
numbers stored, nothing to rate limit.

## 3. Tier 1 — share sheet (cheap, and worth it on a phone)

`navigator.share({ title, text })` — roughly ten lines plus a text formatter.
Requires HTTPS (already), a user gesture, and WebKit support (long present).

Genuinely useful **from a phone**: the recipient picker is the real Messages
one, nothing is stored, nothing is sent by us. Falls back to
`navigator.clipboard.writeText`.

Near useless **from the wall**: it opens the *iPad's* share sheet, sends from
the iPad's iMessage account, needs someone standing there to complete it, and
produces the same stale snapshot as any text. Tier 0 beats it on the wall in
every respect.

## 4. Tier 2 — actually send an SMS (probably never)

Kept for completeness, and deliberately demoted. A Supabase Edge Function plus
an SMS provider, `profiles.phone`, RLS on it, and rate limiting because a
button that costs money per press sits on a wall people tap in passing. Twilio
at roughly $0.008 a message plus ~$1.15/month for a number.

**The one trap worth repeating:** the provider credential must live in the Edge
Function's environment. `VITE_`-prefixed variables are **inlined into the
client bundle at build time and are public**.

The only thing this buys over Tier 0 is *unattended* sending — "the list, every
Saturday at 9am" — which is a different feature wearing this one's clothes. If
that is ever wanted, the existing Gmail SMTP (already configured for auth email)
would do it for free, badly suited though email is to a supermarket.

## 5. If a text is ever rendered, what it should say

Not a dump of the table. `groupByAisle` already orders the list the way the
shop is walked, and that ordering is most of the list's value.

- Group by aisle, in walking order, same as the panel.
- Quantities from `qty` — a real column since 013. Do **not** reconstruct the
  old "×2" text suffix.
- Skip ticked items, or put them under an "already got" heading.
- **Decide about unpriced ingredients.** The Shopping page deliberately lists
  them separately under "Not on the list", because an ingredient with no
  product is missing from the total *and* from the list. Omitting them silently
  sends someone shopping with an incomplete list; mixing them in loses the
  distinction. A short trailing section is the suggestion.
- Distinguish "nothing on the list" from "the week's groceries have not been
  pulled in yet" — `pendingGroceries` makes those different states.

## 6. Definition of Done (Tier 0)

- [ ] `#shopping` opens the Shopping page directly, and the hash stays in step
      when the page is opened or closed by hand.
- [ ] A QR on the Shopping page encodes that URL.
- [ ] The QR is on the *page*, not the dock panel, and not on the board's
      default surface — it is furniture, and the board is a week.
- [ ] Scanning with no session lands on sign-in rather than failing oddly.
- [ ] The QR carries a URL only. No list contents, no token, no identifiers.
- [ ] Whatever renders it is shared with Feature #7 rather than duplicated.

---

# Feature #12 — Spending Insights

**Priority:** Medium
**Category:** Household Intelligence / Money
**Status:** Backlog
**Depends On:** Tier 0 depends on nothing. Everything past it depends on a
backend that can hold a secret, which Trellis does not currently have.
**Primary Goal:** Show what the household is actually spending, how this week
is pacing against the budget, and how the last four weeks compare.

## 1. What already exists, and what is missing

Trellis already knows what a week *should* cost. `src/lib/cost.js` walks the
meal plan → ingredients → products and projects a weekly grocery figure;
`household.weekly_budget_cents` holds the budget (seeded at 12000); the
shopping cart footer already shows one against the other.

What it has never known is what was actually spent. Every number in the app is
a *projection from a plan*, and the gap between those two is the entire feature.

That matters for sequencing, because it means a genuinely useful slice exists
with no bank connection at all.

## 2. On Rocket Money — worth settling early

**Rocket Money is not a data source.** It is a consumer app with no public API
for third-party developers; there is no supported way to read a user's
transactions out of it. It cannot be the integration, and any plan that starts
there stalls at the first step.

The category it belongs to — an aggregator that normalises bank data — has real
options: **Plaid** (the default, best docs, `/transactions/sync` is exactly the
shape this needs), **Teller** (cheaper, US, developer-friendly), **MX** and
**Finicity**. Plaid is the recommendation unless cost bites.

## 3. Tiers

### Tier 0 — pacing, with no bank at all (cheap, do first)

The budget and the projection both already exist. What is missing is *time*:
right now the cart footer says "this week's plan costs £X of £Y" with no sense
of how far through the week you are.

- Pace the projection against the day of the week — four days in with 80% of
  the budget already committed is the insight, and it needs no new data.
- Trend the last four weeks of *planned* cost. `meal_plan` rows are already
  dated and already historical; nothing new is stored.
- Surface the unpriced-ingredient count as a confidence caveat on every figure,
  because an ingredient with no product is missing from the total and silently
  makes every number optimistic.

This is a day of work and answers "are we on track this week" honestly, as long
as it never claims to be actual spend.

### Tier 1 — real transactions

- **Plaid Link** to connect an account, and `/transactions/sync` on a cron.
- **A backend.** Plaid's `client_secret` and every `access_token` must live
  server-side. A Supabase Edge Function plus a table; **never** a `VITE_`
  variable, which is inlined into the public bundle at build time.
- **New tables** — `bank_items` (institution, cursor, encrypted token
  reference) and `transactions` — with RLS funnelled through
  `current_household_id()` like every other table here.
- **Cost.** Plaid production bills per connected item per month plus per
  product; budget a few dollars a month for two people. Worth checking the
  current pricing page rather than trusting this line.
- **Category mapping.** Plaid's categories are not this household's. Groceries
  is the only one that matters at first, and it has to reconcile against the
  aisles in `src/lib/shopping.js` if planned-vs-actual is ever to be per-aisle.

### Tier 2 — the actual insight

Planned versus actual, per week. "You planned £96 of groceries and spent £134"
is the sentence this whole feature exists to produce, and it is only possible
once both halves exist.

## 4. The thing that makes this different from a normal finance app

**This screen hangs on a wall in a room people walk into.**

Every other feature in Trellis is fine for a guest to read. Bank balances,
merchant names and transaction histories are not, and an always-on display
cannot be assumed to be private. This is a genuine product constraint, not a
compliance checkbox:

- Nothing financial should be on the board's default surface. A room-readable
  "£96 of £120 this week" is fine; a merchant list is not.
- Detail belongs behind the menu, on a page — the same way To-Do and Shopping
  detail already do.
- Consider whether the ambient screensaver must actively suppress it (it
  currently covers everything, which happens to be the right behaviour here).
- Never render an account number, even masked, on the wall.

## 5. Also worth knowing before starting

- **Charts are static geometry**, which is the burn-in problem the ambient
  timeout exists to mitigate. A four-week trend chart living permanently on the
  board is exactly the wrong place for it. On a page, opened when wanted, it is
  fine.
- **The type floor is 17px** (`--size-min`) and these are read at kitchen
  distance. A dense financial table does not survive that; a small number of
  large figures does.
- `formatCents` and `afterTaxCents` in `src/lib/cost.js` already exist and
  should be reused rather than re-derived.

## 6. Definition of Done

- [ ] Tier 0: weekly pacing that accounts for how far through the week it is.
- [ ] Tier 0: four-week trend of planned cost.
- [ ] Tier 0: unpriced ingredients declared as a caveat wherever a total shows.
- [ ] A projection is never labelled as actual spend.
- [ ] If Tier 1 ships: no credential or access token in the client bundle.
- [ ] If Tier 1 ships: RLS on the new tables goes through
      `current_household_id()`, verified by a test with no profile row.
- [ ] Nothing merchant-level or account-level renders on the board's default
      surface.

---

# Feature #13 — AI control: planning a week by talking to Claude

**Priority:** Medium
**Category:** Agent Surface / Meal Planning
**Status:** Partly working already, by accident of architecture rather than design.
**Depends On:** Nothing to keep using what works. The gap below needs a Postgres
function or an Edge Function.
**Primary Goal:** "Help me plan my week" on a phone, and watch the wall fill in.

## 1. What already works, verified against the live project

The household's Supabase connector on claude.ai reaches the Trellis project
directly. Checked 9 Sep 2026: it reads 2 profiles, 17 active recipes, 4 chores,
9 `meal_plan` rows, 21 list items.

So Claude can **already** read the recipe bank, propose dinners day by day,
write `meal_plan` rows, schedule chores onto weekdays, and add shopping items —
with no app changes at all. And because every table the board reads is on a
realtime channel, the wall reflects it within about a second. No reload, no
refresh. You talk on a phone and the board fills in.

This was never built. It falls out of Supabase being the whole backend, which
is also the premise Feature #7 depends on.

## 2. The gap that stops it being a complete week — most plausible to fix

**A Claude-planned week does not populate the shopping list.**

`groceryLines` and `addWeekGroceries` live in `Wall.jsx`. The chain from meal
plan → ingredients → products → `list_items` is **client-side application
logic**, not a trigger and not a view. So writing `meal_plan` rows gives you
dinners on the board and an entirely unchanged shopping list; somebody still has
to stand at the wall and press "add the week's groceries".

That is the single highest-value thing to build here, and it is not large:

- Move the derivation into a Postgres function (`trellis_week_groceries(from,
  to)`), or an Edge Function if it needs to stay in JS.
- Have `Wall.jsx` call the same function rather than reimplementing it, so the
  wall and the agent cannot drift about what a week costs or contains.
- Keep the `source = 'meal_plan'` marker on generated rows — "clear what the
  meal plan added" depends on knowing which rows it added.
- Preserve the unpriced-ingredient reporting; it is the only honest signal that
  a total is incomplete, and it must survive the move.

Doing this makes "plan my week" produce dinners *and* a shopping list, which is
the difference between a demo and the feature.

## 3. Also plausible, in rough order

- **A `household_id` default.** The connector runs as `postgres` (see §5), so
  nothing fills this in and nothing catches it if it is wrong. A column default
  resolving the singleton household would remove the most likely silent error.
- **Provenance on agent writes.** Nothing distinguishes a row Claude wrote from
  one a person tapped in. A nullable `created_by_agent` (or reusing the
  `recipe_field_provenance` idea more broadly) would make an agent-planned week
  reviewable, and undoable, rather than indistinguishable.
- **A read-only "state of the week" view.** One call returning the week's
  meals, chores, events and list, so a chat does not need six queries and a
  schema tour before it can say anything useful.
- **A Trellis MCP server** exposing intent-level operations — `plan_week`,
  `schedule_chore`, `add_to_list` — instead of raw SQL. This is the real
  version. It encodes the constraints once, in one place, so an agent cannot
  bypass RLS or invent a `household_id`, and it is a far smaller surface to
  reason about than "arbitrary SQL against production". Bigger job; the right
  destination if this turns out to be used.

## 4. Less plausible, and mostly for the right reasons

- **Claude driving the actual UI.** There is no automation surface, and adding
  one to a kiosk is a lot of machinery to accomplish what a database write
  already accomplishes better. The app is the *view*; the database is the API.
- **Claude ticking chores.** `chore_completions.completed_by` is the record
  Feature #6's scoreboard is built on, and it is supposed to mean a person did
  a thing. An agent marking chores done poisons exactly the data the scoreboard
  exists to produce. Planning: yes. Completing: no.
- **Voice on the wall.** No microphone story, and a shared living room is a bad
  place for one. The phone is already the input device and already works.
- **Autonomous planning with no confirmation.** The wall is shared. A week that
  rearranges itself without either person having agreed is a wall people stop
  trusting — which is the same failure mode recorded for the old `weekly` chore
  that discarded most of what you told it.
- **Letting an agent run migrations unattended.** `006_seed_meal_hq.sql` is
  idempotent by *wiping first*, and its deletes are not scoped to
  `source = 'meal_hq'`. One careless re-run destroys hand-added products and
  resets the budget.

## 5. Risks worth knowing before leaning on this

- **The connector runs as `postgres`, so RLS is bypassed.** 15 policies exist on
  `public` and not one of them applies. Everything else in Trellis is protected
  by `current_household_id()` resolving through the caller's `profiles` row;
  that safety net is simply absent here. This is a production database with no
  branch in front of it.
- **The constraints are the only guardrail left, and they are good ones.**
  `chores_schedule_matches_recurrence` rejects the wrong scheduling column,
  `meal_plan` is unique on `(household_id, on_date, slot)` so planning must
  upsert rather than insert, `slot` is checked against four values, and an
  active recipe cannot lose its last ingredient. They fail loudly, which is
  what you want.
- **Hand edits to recipes must claim `user_supplied` provenance** or the next
  enrichment pass overwrites them.
- **No audit trail.** Nothing records that an agent made a change, so a
  surprising week has no explanation attached to it.

## 6. Definition of Done

- [ ] Grocery derivation lives server-side and `Wall.jsx` calls it rather than
      duplicating it.
- [ ] A week planned entirely through Claude produces both meals on the board
      and a populated shopping list.
- [ ] Generated grocery rows keep `source = 'meal_plan'`.
- [ ] Unpriced ingredients are still reported after the move.
- [ ] `household_id` cannot be silently wrong on an agent write.
- [ ] Agent-written rows are distinguishable from hand-entered ones.
- [ ] Chore *completion* remains a human-only action.

---

# Feature #14 — Depth: making the UI feel touchable without making it heavy

**Priority:** Medium-Low
**Category:** Design System / Wall Experience
**Status:** **Phase 0 shipped, 9 Sep 2026.** `--raise-1` / `--raise-2` /
`--press` / `--travel-tap` live in `tokens.css` and are wired up on
`.sheet__footer button` and `.card button` (`App.css`, `Sheet.css`); the
hairline contrast fix from §7 shipped alongside it. Phases 1–3 (roll the
shared press behaviour across the other ~48 hand-written `:active` rules;
fold dialog/sheet elevation into the scale; selective richness on recipe art
and badges) are still backlog.
**Depends On:** Nothing further — Phase 0 is the proof-of-concept and it held
up; Phase 1 is mechanical from here.
**Primary Goal:** Controls that look and feel pressable, on a display that is on
for weeks in a room people relax in.

## 1. Diagnosis, with the evidence

The app reads flat, and the cause is precise: **depth is spent on containers,
and controls are recessed.**

- **Eight `box-shadow` declarations exist in the entire app.** Five are scrims,
  toasts, the drag ghost, or focus rings. Exactly one is real elevation —
  `--lift` — and it is used on the dock panels (`SectionPanel.css`) and the menu
  dialog (`MainMenu.css`). Both are things you do not press.
- **`--chip-face` and `--row-face` tint *down*.** That was a correct fix when
  panels turned to paper (a row inside a white panel has to recess), but the
  consequence is that every chip, row and checklist item reads as a hole rather
  than a key.
- **Press feedback is `transform: scale(0.99)`**, hand-written in 44 separate
  `:active` rules. On a 300px footer button that is a 3px change, at a reading
  distance of several feet.
- **`--rule` (#D9D9CB) on `--slat-face` (#FCFCF8) is about 1.4:1.** Every
  separator in the app sits near the threshold of visibility.

Nothing you can touch looks touchable, and the one thing that moves when you
touch it moves by one percent.

## 2. Why literal 3D is the wrong answer here

Bevels, gradients and gloss are the obvious response and would be a mistake on
*this* device, for four reasons that do not apply to a normal app.

- **Static high-contrast ornament is the burn-in risk Feature #5 exists to
  mitigate.** The week grid, day rows and panel edges are already fixed geometry
  displayed for weeks. Bevelling them would permanently worsen a hardware
  problem in order to fix an aesthetic one.
- **Gloss is light.** The ground is warm rather than white on purpose, because a
  bright field on a living-room wall is a lamp nobody asked for. Specular
  highlights are the same problem in miniature, repeated across every control.
- **"Filled means recorded" is load-bearing**, and has already been broken twice
  in opposite directions. If a raised, filled treatment starts to mean
  "pressable", it collides directly with a fill meaning "this happened".
- **Fine detail does not survive the reading distance.** The type floor is 17px
  because this is read from across a kitchen. A 1px inner bevel is invisible
  there — cost with no benefit.

## 3. The principle

**Spend depth on the moment of contact, not on the resting state.**

- *At rest:* quiet, matte, low static contrast. Burn-in safe, room safe.
- *Under the finger:* real travel, and a shadow that collapses as the control
  goes down.

At kitchen distance a control that genuinely *moves* reads as far more physical
than any bevel, and it costs nothing while nobody is touching it. This inverts
the current arrangement — containers raised, controls recessed — without adding
a single pixel of always-on contrast.

## 4. Sustainability: tokens, not per-component CSS

This codebase has already learned this lesson once. The motion system replaced
five hand-picked durations and a bare `ease` with tokens named for the *job*, so
that "a new control picks the token that matches what it is doing and inherits
the timing". Depth needs the same treatment:

    --raise-1     a control at rest
    --raise-2     a surface that floats: dialog, sheet, primary action
    --press       the collapsed state
    --edge-top    1px light top / darker bottom — material, not gloss
    --travel-tap  how far a control actually moves when pressed

Phase 1 should *reduce* the amount of CSS: 44 bespoke `:active` rules collapse
into one shared pressable behaviour that a new control inherits by default
rather than by remembering.

## 5. Phases

**Phase 0 — proof (about half a day). Shipped 9 Sep 2026.** The tokens,
applied to `.sheet__footer button` and `.card button` only. One primary action
per surface genuinely lifts and genuinely depresses. Verified in-browser; not
separately confirmed on the wall at reading distance, which §8's DoD still
asks for before Phase 2 starts.

**Phase 1 — the press system.** Roll the shared behaviour across every
pressable, deleting the hand-written scale rules as it goes.

**Phase 2 — surface elevation.** Dialogs and sheets read as being *above* the
board rather than replacing it. `--lift` folds into the new scale.

**Phase 3 — selective richness.** Recipe art plates, person badges and meal
chips gain material. These are the places where richness is decorative in the
good sense: they are inside sheets or small enough not to dominate.

## 6. Out of scope, deliberately

- **The week grid and day rows stay matte.** This is the always-on surface and
  the whole burn-in argument. Non-negotiable.
- **No `backdrop-filter` or glass.** Re-rasterised per frame on a device that
  must stay cool across a multi-week uptime.
- **Nothing animated at rest.** Already the rule; depth does not get an
  exception.
- **No large-area gradients.** Banding on subtle ramps is a real artifact, and
  the largest areas here are exactly the ones that must stay quiet anyway.

## 7. The cheap win that is not 3D at all

`--rule` is at roughly 1.4:1 against the paper. Nudging it up would reduce the
sense of flatness on its own, in one line, with no new system — worth trying
first if only to see how much of the problem is separation rather than
elevation.

## 8. Definition of Done

- [ ] One elevation scale lives in `tokens.css`; no component declares its own
      `box-shadow` afterwards.
- [ ] Press behaviour is shared rather than reimplemented, and the count of
      hand-written `:active` scale rules goes down.
- [ ] Nothing on the board's always-on surface gains static high-contrast
      ornament.
- [ ] `--dur-tap` and the reduced-motion block are honoured; a transform with
      no duration still snaps, so per-component suppression is still required.
- [ ] Any new edge colour is checked against the *warm* ground, not white —
      the same trap that made `--chip-face` and `--row-face` invisible once.
- [ ] "Filled means recorded" still holds: elevation may say "pressable", fill
      may not.
- [ ] Verified on the actual wall at reading distance after Phase 0, before
      Phase 2 starts.

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
**Status:** Designed, not built — and the *ungoverned* version of this (an
ad hoc chat plus the Supabase connector, no schema checklist enforced) is
already happening and already caused a real incident. See §3.

## The idea

A `+` in the recipe book opens a panel showing a QR code. Scan it with a
phone and you land in a Claude chat already primed to add a recipe to
Trellis: you talk, Claude writes it to Supabase.

This exists because the wall iPad is a terrible place to type a recipe and a
great place to *see* one, and because the household already has a Supabase
connector on claude.ai — so a phone chat can genuinely write to the database
without Trellis needing an editor, an API key, or an edge function.

**Shares its QR rendering with #11.** That feature settled on the same
wall-to-phone handoff for the shopping list, on the same reasoning: a QR
carries a URL, the phone already has its own session on that origin, and no
data, token or identifier ever leaves the screen. Whichever of the two is built
first should put the renderer somewhere the other can use it — an inline SVG
generator rather than a dependency, at this size. The difference between them
is only where the URL points: #7 at a primed Claude chat, #11 at Trellis's own
`#shopping` route.

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

**The prompt is missing a step, and it is the step that just failed in
production.** On 9 Sep 2026 this exact workflow — chat plus the Supabase
connector, no QR involved — was used to add "Chicken Tortilla Soup." The
recipe and its 8 steps came out fine. Every other part of what
`recipe_field_provenance` and the price book exist for did not happen:

- **0 of 15 ingredients were matched to a product**, and not because no match
  existed — `products` already held near-exact rows for at least 10 of them
  (Chicken broth, Black beans, Garlic, Cilantro, Corn tortillas, Limes,
  Diced tomatoes, Chopped green chiles, Yellow onions, Sweet corn) at the time
  of insert. No matching was attempted at all; `product_id` and
  `purchase_qty` are null on every row.
- **`recipe_field_provenance` got zero rows.** The prompt above says to
  "record what I tell you as `user_supplied` provenance" and nothing did.
- **`recipes.source` was written as `'meal_hq'`**, which is supposed to mean
  "came from Ed's original spreadsheet." This recipe did not; a value that
  claims otherwise breaks the one field that lets a future audit tell
  original data from agent-added data.
- Ingredient rows also carry `normalization_source = 'user_supplied'` with
  `normalized_name` still null on all 15 — a source stamped on work that was
  never done. Harmless today (010's enrichment gate keys off `normalized_name
  is null`, not the source column, so a future pass still picks these up) but
  the same shape of lie as the `source` field above, and worth not repeating.

The result: this recipe sits in the live book right now under-reporting the
week it's planned into, silently — the exact failure Feature #15 §2 describes
for the Tortilla Soup already in the bank, just produced by this workflow
instead of by seed-data gaps.

**Add this to the prompt, not just to the person's intentions:**

> For every ingredient, search `products` for a plausible match (name and
> brand, case-insensitive) before you insert anything, and show me each
> match — or its absence — rather than assuming. For a match, set
> `product_id` and derive `purchase_qty` the way the price book already does
> (one whole item is its share of the matched package: one onion is 0.17 of a
> 3 lb bag; state the arithmetic so I can check it). For no match, say so by
> name and ask whether to add a `products` row or leave it flagged — never
> leave an ingredient unpriced without saying so out loud. Write one
> `recipe_field_provenance` row per field you populated, `user_supplied` for
> what I told you and `ai_enrichment` only for what you inferred yourself.
> Never write `source = 'meal_hq'` for anything you add — use
> `'claude_chat'` — that field is the only thing that will ever let anyone
> tell the original spreadsheet import apart from what an agent added later.
> Before you finish, state in plain language everything you did *not* price
> or link, so the gap is visible the moment the recipe is added rather than
> discovered later as a silently wrong budget.

This is also the real-world confirmation of the risk Feature #13 §5 already
named in the abstract — "no audit trail," "hand edits must claim
`user_supplied` provenance or the next enrichment pass overwrites them" — this
is that risk, landing.

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

# Feature #9 — Weekly To Do: make it one thing

**Priority:** ~~Critical (9A) / High (9B, 9C)~~
**Category:** Tasks / Core Experience
**Status:** **Shipped.** 9A, 9B and 9C are all built, along with full-page
views for both dock sections and the shopping revamp that came with them
(migration 013). The critique below is kept because it is the reasoning behind
the design, not a to-do list.

**Deliberately left for later:** creating an `anytime` or `once` chore still
takes two taps — add it (arrives weekly, which keeps capture to one field),
then change its kind in the sheet. A recurrence control in the add row was
rejected as a tax on the common case. Revisit if the two-tap path annoys.

**Depends On:** Nothing. 9A was the prerequisite for #6 (Chores Scoreboard),
which is now unblocked.
**Primary Goal:** The panel is three different products sharing one scroll
container. Make it read and behave as one list.

## 1. The diagnosis

"Weekly To Do" currently holds three kinds of thing:

- a **weekly checklist** (`weekly`) — "has this been done this week"
- a **dated errand list** (`once`) — "is this done, ever"
- an **activity log** (`anytime`) — "when was this last done, and whose turn"

Each has its own interaction grammar, its own time base, and its own visual
encoding — and they are stacked in one undifferentiated scroll with no
grouping, no headers, and no legend. The clunkiness is not any single control.
It is that the panel never tells you which of the three lists you are looking
at, so every row has to be decoded from scratch.

Everything below follows from that.

---

## Phase 9A — The bugs (Critical, small, ship first)

These are why the section feels *broken* rather than merely awkward. All four
are verified in the code, and none is more than a few lines.

### A1. Both person buttons show the same initials

`ChoresPanel.jsx:142` calls `initialsForPerson(p)` with a person **object**,
but `Wall.jsx:251` expects the letter `'a' | 'b' | 'shared'`. Neither branch
matches, so it falls through to the combined return — **every episodic row
renders "NE" on both buttons**.

The one feature whose entire purpose is telling Nick and Ed apart cannot
currently be used to tell Nick and Ed apart. This alone would make the section
feel unusable, and it silently poisons the completion log every time someone
guesses which circle is theirs.

Fix: pass `personFor(p.id)`, or accept both shapes.

### A2. The "whose turn" highlight is always Nick's colour

`.whodunit--turn` and `.panel-row__turn` hardcode `var(--person-a)`
(`App.css:304, 332`). When it is Ed's turn, Ed's button fills with person A's
green and the words "Ed's turn" render in Nick's colour.

Person colour is meaningful everywhere else in this app. Here it is decoration
that actively contradicts the sentence next to it. Fix: derive the token from
`personFor(turn.id)`.

### A3. The header counter can never reach completion

`choresDone` excludes episodic chores — they are never "done" — but the
denominator is `chores.length`, which includes them (`Wall.jsx:1080, 1141`).
With one dishwasher row among four chores the panel permanently reads
**"3 of 4 done"**.

A progress indicator that structurally cannot complete teaches people to stop
reading it. Fix: count only trackable chores in both halves.

### A4. Full and compact disagree with each other

Compact correctly excludes episodic rows and will say "All done"
(`ChoresPanel.jsx:56–58`) at the same moment the header says "3 of 4 done".
Same panel, same instant, two answers. Fixed by A3.

### A5. Two of the three chore types cannot be created

`addChore` hardcodes `recurrence: 'weekly'` (`Wall.jsx:500`). **No UI anywhere
creates an `anytime` or a `once` chore.** Migration 012's headline feature —
the one built precisely because the dishwasher could not be recorded — is
reachable only by hand-written SQL, and everything anyone adds through the app
arrives as the exact type that failed them.

This is the single largest gap between what Trellis can do and what Trellis
lets you do. Minimum viable fix: a three-way recurrence control in the add
flow, or a recurrence row inside the existing `ChoreScheduler` sheet (which is
already the "when does this happen" surface and is the natural home for "it
doesn't").

---

## Phase 9B — Group the list (High)

**One change fixes most of the structural complaints: three labelled groups
inside the one panel.**

    Today          — scheduled here, or due today
    This week      — the rest of the week's checklist
    As needed      — the episodic log

Why this specific move, rather than restyling rows:

- **It gives each group one interaction grammar.** Today/This week are
  checkboxes where tapping the row completes it. As needed is a log where the
  row body is inert and you tap a person. Right now those two behaviours are
  interleaved in rows that look alike — a user learns "tap the row" on row one
  and it silently does nothing on row three. Grouping makes the difference
  structural instead of something you discover by failing.
- **It replaces the border code.** Solid shared-colour = scheduled, dashed =
  loose, solid person-A = episodic: three meanings on one visual channel with
  no legend, and the third borrows a *person* colour to mean a *category*.
  Headers say it in words instead.
- **It answers the question the wall actually gets asked.** Chores are
  currently ordered by `sort_order`/`created_at` only — done rows do not sink,
  today's chores do not rise. "What is left today" is the one thing a wall
  calendar is looked at for, and the list cannot currently answer it at a
  glance.

### Also in 9B

**Two time bases in one list.** Checkbox rows reflect the week you have paged
to; episodic rows reflect actual today (`chore_last_done` is not week-scoped).
Page forward and every tick clears while "Ed, yesterday" stays put, with
nothing in the panel to say which week it is showing. The title says "Weekly";
the week itself lives in a header far away. Either scope the panel visibly to
the anchor week, or freeze it to the current week and let the grid do the
paging.

**Four hit zones per row in a ~350px column.** Grip, checklist row, when-pill,
delete. Two of them are adjacent, low-frequency, and one is destructive. At
arm's length on a wall this is a mis-tap generator, and the `×` holds
permanent prime real estate for an action performed maybe monthly. Move delete
into the reschedule sheet or behind a swipe; keep undo either way.

**The grid is a partial mirror.** Scheduled chores render in both the panel
and the day rows, in different visual languages ("Done" text vs. a checkmark
and strikethrough). Unscheduled and episodic ones appear only in the panel. So
neither surface is complete and you learn to check both. Decide which surface
is authoritative.

---

## Phase 9C — Capture (High)

**Fast capture is currently the least reachable control in the panel.** The
add input sits inside the scrolling list, below every chore *and* below the
quick-add palette. With eight chores in a shortened panel it may never be on
screen at all.

Feature #2 names fast capture as Tier 1 core. This is the cheapest possible
down payment on it: pin the add row to the bottom of the panel, outside the
scroll container, and let the palette scroll.

---

## 4. Deliberately not in scope here

- Natural-language capture, subtasks, priorities, reminders — that is #2, and
  it should not block fixing what is already shipped.
- Reviving the separate `list='todo'` list. The panel is already carrying more
  concepts than it can label; adding a fourth before grouping exists would
  make this worse. Revisit after 9B.
- The scoreboard (#6). It reads the same log and should wait for 9A, because a
  scoreboard built on attribution nobody could aim is a scoreboard built on
  bad data.

## 5. Definition of Done

- [x] Each person's button shows that person's own initial.
- [x] The turn indicator uses the colour of the person whose turn it is.
- [x] The header count can reach "all done", and agrees with compact mode.
- [x] Every recurrence the database supports can be created in the app.
      `ChoreSheet`'s recurrence chip row.
- [x] The list is grouped, and each group has one interaction grammar.
      `groupChores` — Overdue / Today / This week / Later / As needed.
- [x] It is unambiguous which week the panel is describing. `groupChores`
      labels the week group "That week" once `anchor` isn't the current one.
- [x] Adding a chore does not require scrolling the list. `AddRow`'s
      collapsible capture sits outside the scroll container.
- [x] Delete is no longer a permanent, full-time neighbour of the primary tap.
      Closed by `SwipeAway`, shipped 11 Sep 2026 — later than the rest of this
      entry, which is why this checklist had gone stale.

---

# Current Feature Priority Summary

Ordered by what should be picked up next, not by feature number.

| # | Feature | Priority | Primary Purpose |
|---|---|---|---|
| 1 | **#7 Add a recipe by QR handoff to Claude** | High | Capture recipes from a phone without building an editor — and now the fix for a bug that's already happened once |
| 2 | **#6 Chores Scoreboard** | Medium-High | Settle who did what over a period — **unblocked by #9A** |
| 3 | **#2 Tier 1 remainder** | High | Calendar unification, search/saved views, push reminders |
| 4 | **#11 Get the shopping list onto a phone** | Medium | QR to the live list — no server, no vendor; shares #7's renderer |
| 5 | **#14 Depth, Phase 1** | Medium-Low, bumped | Phase 0 shipped and held up — rolling the proven press system across the other ~48 `:active` rules is now mechanical, not risky |
| 6 | **#13 AI control — planning a week by talking to Claude** | Medium | Mostly works already; the shopping-list derivation is the gap |
| 7 | **#16 Trellis on an iPhone, Tier 0** | Medium, new | Stop the board clipping content with no visual sign anything's missing on any phone that opens it today; overlaps and should follow #11 |
| 8 | **#12 Spending Insights** | Medium | Planned vs actual; Tier 0 needs no bank connection |
| 9 | **#15 Tier 1 — price provenance and staleness marks** | Medium | Same "estimate rendered as measurement" problem #1 already named once, now showing up in the money too |
| 10 | **#4 Weather Integration** | Medium-Low | Add weather as household context |
| 11 | **#3 Themes** | Low | Personalization and visual delight |
| 12 | **#8 In-app recipe editing + AI edit** | Low | Edit recipes on the wall; largely superseded by #7 |
| — | **#15 Tier 0 — Tortilla Soup pricing** | **Nearly done** | 11 of 15 ingredients priced by hand 11 Sep; 4 pantry/spice rows still want `manual_cost_cents` — a five-minute cleanup, not worth a ranked slot |
| — | **#5 Ambient Screen Timeout** | **Shipped** | Pure ambient + drifting clock, night variant, per-device timeout — wall soak still open |
| — | **#14 Depth, Phase 0** | **Shipped** | Elevation tokens proven on primary actions — see #14, Phase 1 above for what's left |
| — | **#10 Main menu, cook-mode tap zones, meal slots** | **Shipped** | One front door; left/right stepping; four meal slots per day |
| — | **#9 Weekly To Do + full pages + shopping aisles** | **Shipped** | 9A/9B/9C, both full-page views, migration 013, swipe-to-delete |
| — | **#1 Meal Planner Data Enrichment — Phase 1** | **Shipped** | Recipe/meal data foundation — complete in 008/010/011 |

## What changed in this review (11 Sep 2026, updated)

- **#15 Tier 0 dropped out of the ranked list.** Nick matched 11 of the 15
  ingredients directly against the price book right after the previous review
  flagged it. Four pantry/spice rows (olive oil, jalapeño, ground cumin, chili
  powder) still need `manual_cost_cents`, same as other spices in the bank —
  small enough now that it doesn't earn a numbered slot. Full account moved
  into #15 §2 and #7 §3 (the incident that caused the gap in the first place).
- **#7 moves from "next up" to clearly next.** It was already the top pick;
  the incident that just got hand-patched is a concrete demonstration of why —
  every recipe added through the ungoverned version of this workflow risks the
  same silent gap, and #7's whole design (schema-checklist prompt, QR or not)
  is the fix.

- **This table hadn't been updated since #15 and #16 were written.** Both
  existed as full entries lower in this document but never made it into the
  ranked list — the two newest features in the backlog were invisible to
  "what's next." Both are folded in now.
- **#5's second half shipped since the last review and the entry still called
  it backlog.** The drifting clock (§6 of #5) landed 11 Sep — centred, 397s
  drift loop, 0.00px average offset — but #5's status line, DoD, and §12 all
  still said "no text at all" / "still backlog." Corrected; see #5 above.
- **#14's Phase 0 shipped 9 Sep and the entry still said "nothing built."**
  `--raise-1/2`, `--press` and `--travel-tap` are live in `tokens.css` and
  wired to the primary actions in `App.css`/`Sheet.css`. Corrected, and moved
  up: Phase 0 succeeding is exactly the signal to keep going while the
  pattern is fresh, rather than letting Phase 1 go cold.
- **#9's Definition of Done was entirely unchecked despite the entry's own
  status line reading "Shipped."** Verified each item against the current
  code (grouping, recurrence control, capture placement, turn colour) and
  checked them off; the swipe-to-delete item was genuinely the last to land,
  11 Sep, which is presumably why the checklist was never closed out.
- **#15 Tier 0 is promoted above its stated "Medium."** Coverage gaps read as
  a feature-completeness problem; this one reads as a correctness bug once you
  notice it's silent — the budget and the shopping list both under-report by
  a whole dinner with no indication anything is missing, on the same feature
  (price-per-serving) that just shipped and is now visible every time the book
  opens. Small, bounded, and the kind of thing that erodes trust in every
  other number on screen until it's fixed.
- **#1, #6, #2's overall standing, #3, #4, #8, #10 are unchanged** from the
  previous review's reasoning.

---

# Feature #15 — Prices you can trust

**Priority:** Medium
**Category:** Meal Planning / Money
**Status:** Backlog. Raised by the price-per-serving toggle (shipped 10 Sep
2026), which did not create either problem — it made both visible for the
first time.
**Depends On:** Nothing. Both tiers are data and UI work against the schema
that already exists.
**Primary Goal:** Make the money numbers in Trellis trustworthy — cover the
recipes that have no prices at all, and stop rendering an estimate as though
it were a measurement.

## 1. Why this exists now

The recipe book can now put a price per serving on every card, and the week's
cart footer has projected a grocery total for some time. Both read as facts.
Neither is quite one yet, for two independent reasons — coverage and
provenance — and they want fixing in that order.

## 2. Tier 0 — Chicken Tortilla Soup has no prices at all

**Mostly fixed by hand, 11 Sep 2026 — small cleanup remains.**

**Correction to how this recipe got here.** This entry originally assumed the
soup was a legacy gap from the Meal HQ seed, like the four rows `015` closed.
It wasn't: the recipe's `created_at` is 9 Sep 2026, two days after the project
was seeded, and it was written by a chat session using the Supabase connector
directly (Feature #7's ungoverned precursor) — which is *why* it had no
products attached. That session also left `recipe_field_provenance` empty and
mislabeled `source` as `'meal_hq'`, which would have made this recipe
indistinguishable from a real seed row in any future audit. Nick has since
corrected `source` to `'chat_intake'` by hand. Feature #7 §3 has the full
incident and the prompt fix meant to stop it recurring.

**The problem was not the "—" on the card. It was the week.**
`weekPackages` in `src/lib/cost.js` needs a product *and* a `purchase_qty` to
price a row and drops anything missing either into `unmatched`, so planning
the soup for a Tuesday didn't move the week's projected grocery total. The
budget figure under-reported by the entire cost of that dinner, silently, and
the shopping list never mentioned a single one of its ingredients.

**Current state:** Nick matched 11 of the 15 ingredient rows directly against
the price book (chicken breast, onion, garlic, fire-roasted tomatoes, green
chiles, chicken broth, black beans, frozen corn → Sweet corn, corn tortillas,
lime, cilantro), with `purchase_qty` following the bank's existing convention.
Four rows remain unmatched and uncosted: **olive oil, jalapeño, ground cumin,
chili powder** — no `product_id`, no `manual_cost_cents`. That keeps the
recipe reading `unknown`/"Partial" (`recipeCost`'s `complete` requires zero
unpriced rows), which is correct given the state, not a bug — every other
recipe's pantry staples in this position (soy sauce, spices, water) carry
`manual_cost_cents = 0` rather than a real product match. Closing this out is
four rows, following that same convention, and it's the only thing left.

Also worth knowing: this fix, like the original insert, was direct SQL against
the live project rather than a migration — so, like the incident that caused
it, it isn't reproducible from git. Not urgent to redo as a migration now that
the data is right, but the next person who wants to know "what changed and
why" for this recipe won't find it in `supabase/migrations/`.

**One row deliberately left open by 015:** the Protein Berry Smoothie's frozen
berries, recorded as unit "fill cup" with no quantity. A cup of a 32 oz bag
could be a fifth of it or a third depending on whose cup. That needs a sentence
from Nick, not a guess.

## 3. Tier 1 — say how much to trust a price

Every price in Trellis renders identically, to the cent, whether it came from a
receipt or from a screenshot of a website. The price book knows the difference
and the UI does not show it:

| `price_source` | Products | What it is |
|---|---|---|
| `ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed` | 29 | Someone stood at a till and this is what it cost |
| `ALDI website/app screenshot; not receipt-confirmed` | 37 | What the app said the price was |

Most of the price book — 37 of 66 products — is the weaker kind, and no recipe
in the bank is fully receipt-priced. So `$2.34 a serving` is, for every recipe,
an estimate wearing the typography of a measurement.

**This is the same complaint Feature #1 closed with, about a different column.**
011 filled prep times and three methods with model estimates at confidence
0.60–0.75, and the note there reads: "the book still renders an estimate
identically to a measurement — if that ever matters, the UI needs to show
confidence, which it does not yet." It now matters in two places instead of
one, which is the argument for solving it once, generally, rather than adding
a second bespoke caveat next to the money.

Two sub-problems, and only the first needs design:

1. **Provenance.** `recipes.cost_confidence` already carries
   `receipt` / `estimated` / `unknown` and is re-derived from the products a
   recipe touches. Nothing reads it in the UI. The cheapest honest version is
   probably a mark on an estimated price rather than a badge on every card —
   the book already uses a "+" for a partial price and a warning colour for
   the count, so there is an established vocabulary to extend.
2. **Staleness.** `products.price_captured_on` is populated on every row
   (24–29 Aug 2026 at time of writing) and nothing reads it either. A price
   book that is six months old should say so somewhere; two weeks old is fine
   and should stay quiet. This is a threshold and a line of text, not a
   feature — but it needs the threshold decided, and "when does a grocery price
   go stale" is Nick's call, not a default.

### A trap, recorded because it has already been fallen into once

The two `price_source` values are distinguished by the word "not", and **the
negative contains the positive as a substring**. `price_source not like
'%receipt-confirmed%'` matches nothing, so every screenshot-derived price reads
as receipt-confirmed. The first draft of `015` did exactly that and promoted
Stuffed peppers to `receipt` before it was caught and reverted. Test for
`'%not receipt-confirmed%'` — the weaker claim — or give the column a real
enum and stop matching strings.

## 4. What this is not

Not a repricing pipeline, not a receipt scanner, not an integration with ALDI.
Both tiers are finishable in an afternoon each against the schema as it stands.
Feature #12 (Spending Insights) is where "what did we actually spend" lives;
this entry is only about making "what will this cost" say how much it knows.

---

# Feature #16 — Trellis on an iPhone

**Priority:** Medium
**Category:** Platform / Surfaces
**Status:** Backlog
**Depends On:** Nothing structural. Overlaps Feature #11, which should probably
ship first or alongside — #11 gets you *to* a page on a phone, this makes the
page worth arriving at.
**Primary Goal:** Make Trellis usable on the phone in your pocket, not just on
the iPad on the wall.

## 1. The app already runs on a phone. It is just not designed for one.

Worth being precise about the gap, because it is smaller than "build a mobile
app" and larger than "add a media query".

Feature #11 establishes the half that already works: sessions are per-origin,
both phones already have a Trellis session on the Vercel origin, `list_items`
syncs over realtime, and anything ticked at the shop shows on the wall within a
second. **There is no data problem and no auth problem.** Open the URL on an
iPhone today and you are signed in, looking at live household data.

What you are looking at is the problem.

## 2. What actually breaks, concretely

- **There is not a single width-based media query in the codebase.** Every
  `@media` rule in `src/` is `prefers-reduced-motion`. The layout has exactly
  one target and it is a landscape iPad on a wall.
- **The board cannot scroll.** `.board` is `height: 100dvh; overflow: hidden`
  and the week area declares `min-height: calc(6 * 84px + 190px + 6 * 7px)` —
  about 736px before the header. On an iPhone that does not fit, and because
  the overflow is hidden with no scroll, **content is clipped with no visual
  sign that anything is missing**. `Board.css` already warns about this failure
  mode against the dock; a phone triggers it against the week.
- **The type scale is calibrated for three metres, not thirty centimetres.**
  `--size-dom-today: 62px`, `--size-row: 22px`, `--tap-min: 52px`. Those are
  correct for a wall and enormous in a hand — the date numeral alone would be a
  sixth of the screen width.
- **The viewport meta is kiosk-correct and phone-hostile.**
  `maximum-scale=1.0, user-scalable=no` is right for a wall panel nobody should
  be able to pinch out of alignment, and on a phone it disables pinch-zoom,
  which is an accessibility problem rather than a preference.
- **Four filter rows and a seven-column week** both assume horizontal room the
  phone does not have. The recipe book's card grid degrades cleanly on its own
  (`repeat(auto-fill, minmax(220px, 1fr))` becomes one column); the filter rows
  above it do not.

## 3. The design question to settle first

**Is the phone the same app at a different size, or a different app on the same
data?** Everything else follows from the answer and it should not be decided
by CSS.

The case for *different*: the jobs genuinely differ. On the wall Trellis is
ambient and read-mostly — it answers "what is happening today" to someone
walking past. On a phone it is transactional and one-handed — tick the
shopping list in an aisle, check a recipe at the shop, add an event on the
train. The week grid is the wall's centrepiece and probably not the phone's
home screen at all.

The case for *same*: two layouts is two of everything to maintain, forever, by
one person. The redesign that produced the Board system was already a full
rewrite of the presentation layer; doing it twice more cheaply is not obviously
cheaper.

A likely middle: keep one component tree and one data layer, add a phone
layout for the *shell* only — what the home surface is, how you navigate — and
let the sheets, which are already full-screen scrolling surfaces with their own
footers, carry over nearly unchanged. The sheets are the part of this app that
is already closest to phone-native.

## 4. Suggested slicing

- **Tier 0 — stop it being broken.** A width breakpoint that lets the board
  scroll instead of clipping, a phone type scale, and a viewport meta that
  allows zoom below some width. Does not make it good; stops it hiding data.
- **Tier 1 — a phone home surface.** Decide what replaces the week grid.
  Today, probably: today's meals, today's chores, the shopping list. Reuses the
  existing full-page section views.
- **Tier 2 — phone-native affordances.** Safe-area insets, pull-to-refresh,
  Add to Home Screen with its own icon and splash, `navigator.share` (already
  scoped in Feature #11, Tier 1, and noted there as genuinely useful *from* a
  phone and near useless from the wall).

## 5. Open questions

- Does the wall keep `user-scalable=no` while the phone gets zoom? Two viewport
  metas means either a build-time split or a runtime rewrite of the tag.
- Is the screensaver / ambient timeout (Feature #5) simply off on a phone? It
  exists to solve image retention on an always-on panel, which a phone is not.
- Does the phone need the settings dialog and the AI control surface at all, or
  are those wall-only?

---

# Feature #17 — Move to an 11" iPad on a counter dock, both orientations

**Priority:** High — the hardware this maps to is what the household is
actually about to use.
**Category:** Platform / Surfaces
**Status:** First pass implemented, unverified on real hardware.
**Depends On:** Nothing structural. Overlaps Feature #16 (Trellis on an
iPhone) in that both had to introduce width/orientation-aware layout where
none existed before — that groundwork (the `useOrientation` hook, the habit
of qualifying rules on a data attribute rather than a bare `@media`) is now
shared infrastructure, not something #16 has to invent separately.
**Primary Goal:** Re-target the board from a wall-mounted 12.9" iPad fixed in
portrait to an 11" iPad Pro on a magnetic counter dock next to the Sonos
speaker, working correctly in whichever orientation it's actually sitting in.

## 1. What changed, physically

Nick and Ed decided against wall-mounting. The iPad instead sits on a
magnetic dock on the counter, and it's Nick's 11" iPad Pro rather than Ed's
12.9" — smaller, and read from counter distance rather than across the
kitchen. Because a countertop dock isn't fixed the way a wall mount is, the
iPad can sit in either orientation, and the household wants both to work
with the correct one detected automatically rather than picked once and
left.

11" iPad Pro logical points: 834×1194 portrait, 1194×834 landscape (2x
scale). The 12.9" this was built for: 1024×1366 portrait. Portrait on the
new device is ~19% narrower; landscape is shorter than either device has
ever been in portrait.

## 2. What was actually wrong in the code

- **Nothing detected orientation at all.** No `matchMedia`, no
  `screen.orientation`, anywhere. The entire layout assumed one fixed shape.
- **The board is a single flex column** — header, then week, then dock
  stacked underneath it (`Board.css`) — and `.board`'s `overflow: hidden` is
  deliberate and load-bearing (see "Holds the board to exactly one screen"):
  this app does not scroll, by design, so there was no fallback for a
  shape that didn't fit.
- **The week grid's own floor can exceed landscape's entire height budget.**
  `weekFloorFor` (worst case, a Sunday with nothing "past" yet): today's row
  (was 190px) plus six ordinary rows (84px each) plus gaps ≈ 736px. Landscape
  on either iPad size is 834pt of height *total* — after the header and
  padding, stacking the dock underneath that would have left it well under
  100px, nowhere near its own ~300px floor (`.section-panel--full`/`--compact`
  clamps in `SectionPanel.css`). This was the real blocker, not the 11" size
  change specifically — landscape was always going to be this tight on
  either iPad, because landscape height is short on both.
- **Type sizes and the type floor were commented as tuned for "read from
  across a kitchen" at 12.9"** (`tokens.css`). A counter dock is a closer
  read on a smaller panel, so keeping those sizes would have wasted screen
  real estate the new device doesn't have to spare.
- **`MAX_FLOURISHES = 3`** (`Wall.jsx`) was picked because three short header
  asides fit the 12.9" portrait width (1024pt) and a fourth didn't. 11"
  portrait (834pt) is narrower than that; 11" landscape (1194pt) is wider.

What was already fine, no changes needed: `Screensaver.jsx`'s scene uses
`preserveAspectRatio="xMidYMid slice"` on a fixed viewBox, which crops to
any aspect ratio rather than assuming one — it already survives both the
size and orientation change. `useDetailLevel`'s "tight / mid / open" system
measures real rendered height via `ResizeObserver` rather than trusting a
viewport constant, so a cramped landscape row degrading to "+N more" is it
doing its existing job, not new behaviour. `RecipeBook.jsx`'s cook-mode
`BACK_ZONE` is a percentage of the reading area, not a pixel value.

## 3. Decisions made (with Ed, and confirmed in this session)

- **Landscape gets a real layout, not a degraded one.** The dock moves
  beside the week instead of under it (`.board__body` becomes a row when
  `useOrientation` reports landscape) — each gets the full column height
  rather than splitting one shared column. Both dock sections stay
  reachable and equally functional in both orientations.
- **The type-size floor is allowed to shrink.** Counter distance on a
  smaller panel no longer needs three-metre legibility, so `tokens.css`'s
  sizes dropped roughly 12–23%, more on the numerals that existed solely for
  wall-distance reading (`--size-dom-today`, `--size-dom-today-open`).
  `--tap-min` (52px) deliberately did **not** shrink — it's sized to a
  fingertip, not a reading distance, and that didn't change.

## 4. What shipped in this pass

- `src/hooks/useOrientation.js` — `matchMedia('(orientation: landscape)')`
  with a change listener; `Board.tsx` stamps the result as
  `data-orientation` on `.board`, and CSS throughout qualifies on that
  attribute rather than a bare `@media (orientation:)`, so JS and CSS share
  one source of truth.
- `tokens.css` — retuned type sizes and `--size-min` (17px → 15px), per the
  decision above.
- `TODAY_ROW_MIN_HEIGHT` (`useDetailLevel.ts` / `.day-row--today` in
  `WeekGrid.css`): 190px → 150px, in step with the date numeral it exists to
  fit. `ORDINARY_ROW_MIN_HEIGHT` (84px) and `PAST_ROW_MIN_HEIGHT` (44px)
  deliberately did **not** move — both are anchored to a touch target (an
  event chip's own min-height, Apple's HIG minimum) rather than to reading
  distance, and did not get an ergonomic reason to shrink.
- `Board.tsx` / `Board.css` — new `.board__body` wrapper around the week and
  dock, so only that portion (not the header) switches to a row in
  landscape; header sizing also tightens a little in landscape, since it has
  no use for wall-distance sizing and every pixel back is a pixel the
  week's floor can afford.
- `SectionPanel.css` — a landscape-specific sizing path for the dock
  (`flex: 0 0 380px` sidebar, panels flex-filling its height) alongside the
  existing portrait one (vh-based `clamp()`, tuned for the dock sharing a
  column with the week) — they answer different layout questions and
  neither reduces to the other cleanly enough to share code.
- `Wall.jsx` — `MAX_FLOURISHES` became `maxFlourishesFor(orientation)`:
  2 in portrait, 3 in landscape (unchanged from before, since 1194pt has as
  much room as the original 1024pt design did). Threaded through
  `toFlourishIds`, `toggleFlourish`, and `SettingsPanel`'s copy.
- Stale resolution comments (`Screensaver.jsx`, `Screensaver.css`,
  `RecipeBook.jsx`) updated to the 11" numbers where they stated a specific
  figure; comments that were already aspect-ratio-generic were left alone.

## 5. What's still open

- **Nothing in this pass has been seen on the actual dock**, or in a browser
  at the real dimensions — this session had no way to sign in and render the
  authenticated board to check it visually (see Authentication: the 8-digit
  emailed code). Every number above is reasoned from the code's own declared
  constants, not measured on a screen. This is the same category of
  unfinished as the screensaver's own "not yet verified on the actual wall"
  item — treat it the same way: real, but not yet closeable from a laptop.
- **The tightest known case is close.** A landscape week where nothing has
  gone "past" yet (Sunday) is computed to fit the new layout by roughly 6px
  — closer to a rounding error in this arithmetic than a real margin. Check
  that specific day/orientation combination first once the dock exists.
- The 380px dock sidebar width and the 2-vs-3 flourish split are first-guess
  numbers, same spirit as the vh `clamp()` values already in
  `SectionPanel.css` — tune them once this is visible on the actual dock.
- Broader "wall" terminology in code comments and `CLAUDE.md` (e.g. "Wall
  survival") was left alone — the resilience concerns it describes
  (suspending timers, silent staleness, a crash that isn't a blank
  rectangle) apply identically to an always-on counter device, so renaming
  it is cosmetic, not a fix, and wasn't done here.

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
