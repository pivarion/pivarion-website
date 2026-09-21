# Performance release — September 21, 2026

User approved production publication for phone testing. Real iPhone/Android smoothness has not yet been verified; this release does not claim to meet all earlier performance targets.

Previous production / rollback point: f914419dd1b5c1193667760e28f6030247d836ab.

Changes: minified shared JavaScript chunks, versioned asset caching, responsive service images, deferred full-detail Ferrari loading, cached prop materials, fewer repeated DOM updates and debounced resizing. Approved scene composition and services content are preserved.

Validation: production build asset checks and camera/model/asset budgets passed. Earlier mobile Lighthouse lab comparison: performance 36 to 52, initial transfer 9229 to 6270 KiB. Startup remained above target. Local cinematic preview visually verified.

Rollback: revert this performance release commit on main and let Vercel rebuild the prior static configuration.
