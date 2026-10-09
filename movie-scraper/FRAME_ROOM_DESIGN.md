# CineSense — Frame Room Design Language

## Product, not landing page
CineSense is an operational movie review analysis workspace. There is no marketing hero, unrelated iconography, fake usage metrics, invented testimonials or decorative AI illustrations. Film posters are the meaningful visual anchor. The desktop navigation rail and mobile bottom toolbar switch between discrete **Studio / Report / Reviews** views rather than stacking everything onto a long web page.

## Identity
- Mark: typographic **C/S** enclosed by a framed square, with a single misaligned ember corner. It references a film frame, not an AI sparkle.
- Surface: charcoal and olive-black neutrals: background `#10110f`, work surface `#181a17`, separators `#393a32`.
- **One brand accent**: warm ember `#ed6748`. Never use blue-purple gradients or glowing cards.
- Paper white: `#eae7dd`. Avoid stark pure white.
- Sentiment colors are reserved for actual classified outputs: positive sage `#b7c69f`, negative coral `#ed8c7a`, neutral muted ochre. Unclassified stays grey.
- Layout: thin structural rules, film perforations, editorial indices (01/02/03), strong right-to-left rhythm, compact functional labels.
- Persian typography: self-hosted **Estedad Variable** (open-source SIL OFL-1.1) via `@fontsource-variable/estedad/wght.css`. Arabic/Persian and Latin glyphs ship with the build, no runtime Google Fonts request.
- Latin identifiers and numbers use system/monospace for machine-room feel; body Persian uses Estedad.

## Interaction guidelines
- Studio is only for choosing film/source and starting a real request. Film search is debounced; user-provided YouTube IDs and DigiMoviez URLs are not needed.
- Access codes are private and never stored in browser storage; protected sources demand explicit input without displaying credentials.
- Report only presents real fetched values. AI metrics are shown as unavailable until the real client-side sentiment worker completes.
- The Trailer source is explicitly distinct from film-review satisfaction and excluded from film sentiment metric.
- Reviews live in their own tab, with source filters, sentiment filters (after classification), text search and progressive display.
- Desktop uses one compact film workspace and vertical app rail; mobile switches to a bottom action bar. Prevent horizontal overflow at 390px.
- Transitions are brief (150–350ms) and disable under `prefers-reduced-motion`.
- Avoid animation that pretends work has completed. Source failures must be plainly visible.

## Verification
CI builds the Next.js app and validates backend and matching tests. Browser workflow `.github/workflows/frame-room-browser.yml` mounts the real app with deterministic API fixtures and checks 390px/1440px workflows, no sideways scrolling, font declaration, successful movie-selection flow, metrics and review-tab navigation.

The design is implemented by `movie-scraper/app/multi-source/page.js` and `cinesense-frame-room.css`.
