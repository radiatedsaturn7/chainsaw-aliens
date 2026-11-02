# Published project files without the Python server

RTG Studio can read the checked-in project snapshot on an ordinary static HTTP
host, including GitHub Pages at `/repository/`. Publish the application and its
`data/server-storage/files/` directory together. The manifest and all referenced
`document.json`, metadata and asset files must be deployed. No storage API or
Python process is required for opening files and local playtests.

## Shared behavior

The project storage facade first requests the storage API. Network errors,
timeouts, absent endpoints, unavailable-server responses and HTML fallbacks
switch reads to the published snapshot. A working API's explicit “File not
found” remains a missing file; it does not resurrect an older published copy.
URLs derive from the installed module directory, so page and worker requests
retain the GitHub Pages project prefix.

Listing reads the manifest, not every document. Opening reads the selected
file, decodes compact gzip JSON and hydrates external binary assets. It also
warms named resource references from the manifest (art, fonts, actors, music,
SFX, cars, tires, models, doodads and items), including transitive references,
so older synchronous editor readers see the same resources. Resource fetches
are bounded per dependency batch. References are matched conservatively by
exact saved name across resource folders; name collisions can load extra
resources. Navigation destinations (other races, levels, menus and cutscenes)
are not recursively opened. Existing async navigation loads those on demand.

The race preparation worker and preferences use this same loader. A failed
asset load is an explicit error rather than an empty image. Requests and
failed manifest reads can be retried. Editing does not rewrite the published
snapshot.

## Saving and limitations

The Project Browser labels static mode **Read-only** and disables durable
mutation actions. Save attempts elsewhere still require a successful server
confirmation; they are not reported as persisted on a static host. In-memory
edits and preference changes can remain usable for the session. Export through
an editor where supported to retain edits. Refreshing can discard unsaved
session changes. This change does not provide browser-local durable saves.

Connecting the Python server again permits explicit saves to retry the API.
Read-only snapshots have no server-side version management. Track import,
server video rendering/export, Git synchronization and performance-report
uploads still require their corresponding server endpoints; static file
fallback cannot implement those services.

GitHub Pages only serves files actually included in its deployment. New local
files not committed/published will not appear there. A stale or incomplete
snapshot produces missing-file errors. HTTPS is recommended for browser
workers and modern decompression support.

## Validation

- `tests/unit/publishedProjectStorage.test.js`: all shared editor folders,
  compressed documents, binary assets, encoded filenames, network/HTTP/HTML
  fallback, dependency hydration, settings and write refusal.
- `tests/unit/serverStorage.test.js`: existing live API, cache freshness,
  missing-file, retries and persistence contracts.
- `tests/playwright/published-project-storage.spec.js`: a real static HTTP
  host below `/published/`, with no storage API or server-side decoding;
  shared browser opening, assets/preferences and module-worker race loading.

Run browser tests in the repository's GitHub Playwright environment on
Android/Termux; local Node tests do not prove browser rendering behavior.
