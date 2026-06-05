# Design QA

final result: passed

## Source

- Selected Product Design concept: `F:\soft\gitgreen\design\poster-studio-concept.png`
- Implemented prototype: `http://localhost:4173`
- Final rendered screenshot: `F:\soft\gitgreen\gitgreen-i18n-qr-final.png`
- Final rendered poster: `F:\soft\gitgreen\dist\studio\octocat-2026-06-04T17-31-48-723Z-9501fc.png`

## Verification

- Browser plugin attempt: blocked by transport closure.
- Fallback used: Playwright local browser verification.
- Viewport checked: 1440 x 1024 physical, which resolves to 1152 x 819 CSS pixels on this Windows scaling setup.
- Console errors after clean reload and generation: none.
- Functional path verified: paste `https://github.com/octocat`, generate public contribution poster, preview SVG in the canvas, generate active PNG/SVG download links.
- Language path verified: default Chinese UI, switch to English, then switch back to Chinese before generation.
- Ordering verified: poster renders contribution years newest-first, with 2026 at the top and 2011 at the bottom for `octocat`.

## Comparison Notes

- Layout: preserved the selected Poster Studio model with top command bar, left workflow rail, central poster canvas with rulers, and right settings panel.
- Information hierarchy: primary input and Generate action stay in the top bar; poster preview is the dominant center surface; export settings remain secondary.
- Public-data constraint: no token field, no private data controls, and repeated “Public only” messaging in the top pill and left note.
- Visual system: GitHub green accents, white base, soft gray divisions, compact 8px-radius controls, and restrained product-tool typography.
- Interactions: Generate, error/success states, language switching, zoom controls, palette selection, month/totals options, PNG/SVG links, and server-side public-data generation are functional.
- QR badge: poster upper-right includes a `www.gitgreen.me` QR badge styled as a theme-colored dot matrix instead of a plain square QR code.

## Fixes Made During QA

- Fixed hidden poster image showing under the empty state.
- Adjusted Windows-scaled desktop breakpoint so 1440 physical width keeps the three-column Studio layout.
- Removed left-rail step/check overlap and note overlap.
- Replaced unclear zoom icons with lucide-static SVG image references.
- Removed sticky download overlap in the settings panel.
- Added public-fetch retries and a short server-side contribution cache for more reliable repeated generation.
- Added Chinese / English copy handling, defaulting to Chinese.
- Added Windows-safe public contribution HTML fetching through PowerShell environment variables, with Node fetch fallback.
