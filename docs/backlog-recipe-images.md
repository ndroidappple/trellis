## Images for recipes

**Status:** decision needed. Not blocking — the recipe book ships without a
single photograph and doesn't look like it's missing any.
**Blocks:** nothing. `RecipeArt` in `RecipeBook.jsx` already picks a photo over
its fallback the moment one exists.

### The schema is already done

Slice 10 (`008_recipe_enrichment.sql`) added everything the data side needs:

- `recipes.image_url`
- `recipes.image_source`, constrained to `recipe_source` | `ai_generated` |
  `user_uploaded`
- a check that `image_url is null or image_source is not null` — an image
  without a stated origin is exactly the thing that migration set out to
  prevent
- `recipe_field_provenance`, which can carry an `image_url` row like any other
  field

So there is no migration to write. What's missing is bytes and a way to get
them in. As of this writing: 0 of 18 recipes have an image, and 0 of 18 have a
`source_url` either.

### Four ways to get a picture, and what each actually costs

**1. From the recipe's source.** A dead end today. Every `source_url` is null —
these recipes came out of Ed's Meal HQ spreadsheet, not from publishers, so
there is nothing to pull from. Even with URLs it's a licensing question, and
hot-linking someone else's CDN on a device that sits unattended for weeks means
a broken image nobody is there to notice.

**2. Photograph the food.** Highest fidelity and no licensing question at all:
it's a picture of the thing they actually cook, in their actual kitchen, which
is the only version of this that a *household* recipe book wants. Cost is 18
dinners rather than 18 dollars, and it needs an upload path in the app (below).

**3. AI-generated.** Instant, and trivially cheap at this volume. Against it:
it's a photograph of a dish nobody in the house has ever made, and
"Avoid AI-Generated Blobs" is one of the backlog's own cross-feature
principles. Defensible as a labelled placeholder tier — `image_source` makes
the origin queryable, so a later "which of these are real" is one `where`
clause — but not as the answer.

**4. No photograph.** What ships today: a tinted plate with the recipe's
initial, derived deterministically from the title, so a recipe has the same
artwork forever and the book looks finished at zero photos. This is a floor,
not a placeholder — recipes that never get photographed still look intentional.

### What route 2 actually requires

- **A Supabase Storage bucket** (`recipe-images`). Free tier is 1 GB stored and
  5 GB egress a month; 18 photos at ~150 kB each does not register.
- **A public-read bucket with unguessable paths — not signed URLs.** Signed
  URLs expire, and the wall parks on one screen for days with nobody there to
  reload it, so an expiring URL is a broken image by design. Keep writes behind
  a household-scoped RLS policy (RLS is still the real boundary) and let reads
  be public. A photo of chili is not one of the household's secrets.
- **Client-side downscaling before upload, mandatory.** An iPhone photo is
  3–5 MB at 4032px; the hero renders at 220px tall on the device with the least
  memory in the house. Canvas-resize to ~1200px on the longest edge, encode
  JPEG/WebP around q0.8, aim under 200 kB. This can't be pushed to the server:
  Supabase's on-the-fly image transformation is a Pro-tier feature, and this
  project is on free. The canvas step also converts iOS's HEIC on the way
  through, which is a second reason it isn't optional.
- **A capture control in `RecipeDetail`** — an `<input type="file"
  accept="image/*">` gets Camera / Photo Library on iOS for free. It must write
  `image_url` and `image_source: 'user_uploaded'` in the same update or the
  check constraint rejects the row.
- **A provenance row** in `recipe_field_provenance` for `image_url`, so the
  book can eventually say where a picture came from rather than just showing
  it.
- **Test the upload on the wall iPad, not the Mac.** It's an A12X on iPadOS
  17.6.1; canvas encoding of a 12 MP HEIC is the step most likely to be slow or
  to fail there, and it's the one device where it has to work.

### Where images may and may not appear

Not on the board. The wall shows the same pixels for hours at a time, and a
full-bleed photograph parked on the week grid is precisely the image-retention
risk that the ambient-timeout feature exists to address. Recipe artwork lives
inside sheets that somebody opened and will close. The book is already built
this way; keep it that way.

### Route 3 in detail — Nick has approved AI generation

**Claude cannot generate images at all**, so there was never a Claude-token
path to spend or save here. Every option below is an external service.

**The binding constraint is style iteration, not generation cost.** Eighteen
images is nothing; finding a look that sits on a plaster-and-muted-green wall
without screaming "stock food photography" takes 50–150 throwaway generations.
Price the iteration, not the output.

**Generate illustrations, not photographs.** This is the important call. A
photorealistic AI plate is glossy, uncanny at close range, and claims to be a
photograph of a dinner nobody cooked — the exact honesty problem that made
route 3 uncomfortable in the first place. A flat illustration claims nothing.
It also holds a consistent style across 18 images far more reliably than
photoreal does, matches the palette by construction, and lines up with the
hand-drawn flat SVG direction already chosen for the person avatars in
`backlog-person-avatars.md`. One house style, two features.

| | Cost for 18 | Iteration cost | Setup |
| --- | --- | --- | --- |
| **Local** — Draw Things (free Mac app) or ComfyUI, running FLUX.1 [schnell] or SDXL | $0 | **$0, unlimited** | ~30 min, 6–12 GB model download |
| **Hosted API** — Gemini image gen, OpenAI `gpt-image-1`, or FLUX via fal.ai / Replicate | ~$0.05–$1.00 | ~$0.003–$0.04 each | API key, ~50-line script |
| **A subscription already paid for** — ChatGPT, Gemini, Midjourney, Copilot | $0 marginal | included | none; ~45 min of manual work |
| **Canva** — already connected as an MCP connector | free tier limits | limited | none |

(Hosted pricing moves constantly and these figures are from mid-2026 — check
before committing to one.)

FLUX.1 [schnell] is Apache-2.0, so locally generated output carries no
licensing question at all.

**Recommended:** Draw Things locally if a 30-minute setup is acceptable —
free iteration is the thing actually worth buying here, and the wall iPad
never needs to be involved. Otherwise a hosted API script, which has the
advantage of being *repeatable*: it can read the recipes still missing an
image, generate, downscale, upload, and write `image_url`,
`image_source = 'ai_generated'` and a `recipe_field_provenance` row in one
pass — the same shape as `010_recipe_enrichment_run.sql`.

Whichever route, `image_source = 'ai_generated'` means a later "which of these
are real" is one `where` clause, and photographed dishes can replace generated
ones one at a time without a migration.

### Recommendation

Both, in order. Generate illustrations now so the book has artwork this week,
and photograph dishes opportunistically as they get cooked — a real photo of
their own dinner outranks a generated illustration and can quietly replace it,
recipe by recipe, with `image_source` recording which is which. The tinted
plate stays as the permanent fallback beneath both.

### Open question

Whether a photographed recipe should keep its plate tint as an accent
somewhere — the tints are currently the only colour the book has, and a book
that's half photos and half plates may want them to agree.
