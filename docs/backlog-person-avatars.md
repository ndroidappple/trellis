## Person avatars for the badges

**Status:** deferred, v1.1
**Blocks:** nothing. `PersonBadge` renders initials today and takes an optional
`avatar` slot, so this drops in without touching callers.

### What we want
The `N` / `E` / `NE` initial discs get replaced with simplified portraits of
Nick and Ed, so ownership reads from across the kitchen without parsing a
letter.

### Genmoji — investigated, not chosen
Extraction is possible but unofficial: copy the Genmoji out of iMessage, paste
into a blank Freeform board, copy again from within Freeform (this converts it
to a standard image), then paste into Notes or Mail and save as PNG. No export
button exists; an OS update could break the trick.

Ruled out for three reasons:
1. The wall iPad (A12X, iPadOS 17.6.1) can't generate them — Apple Intelligence
   needs far newer silicon. They'd be made on Nick's phone and committed as
   static assets.
2. Glossy, saturated, drop-shadowed 3D fights the matte plaster palette.
3. Badges are 30px. Facial detail is invisible at that size; only silhouette,
   hair shape, glasses and colour survive. Legibility would need ~48px discs,
   which crowds the tight-tier rows.

Keep them out of any public repo screenshots or store listing if that ever
happens.

### Chosen direction
Hand-drawn flat SVG portraits in the Trellis palette — hair shape, skin tone,
glasses, beard. Scales 26px to 200px, no asset pipeline, no CDN request at
boot, and can inherit palette tokens if night mode ever lands.

### Next step
Nick supplies a photo of each of them; the SVGs get drawn and committed to
`src/components/avatars/`.

### Open question
Whether `--person-a` / `--person-b` remain the primary ownership signal once
portraits exist, or drop to a supporting accent on the chip's left border.
