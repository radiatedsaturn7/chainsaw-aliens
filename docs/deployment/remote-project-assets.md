# Remote project files for Pages

Pages builds retain application code, shared libraries/runtime data and a generated
project manifest. `manifest.documentRoot` directs the existing lazy storage loader
to public GitHub raw files pinned to the build commit. Documents, metadata and their
relative media references use that same root. Names are URL-encoded once. All cars
and races remain in the index; project history is neither indexed nor packaged.

The Pages workflow supplies `github.repository` and `github.sha`. For a local test,
use a clean checkout whose project assets already exist at the supplied public SHA:

```
python tools/build_static_site.py --output /tmp/rtg-site \
  --remote-repository radiatedsaturn7/chainsaw-aliens \
  --remote-commit FULL_40_CHARACTER_COMMIT_SHA
node tools/check_remote_project.mjs /tmp/rtg-site/data/server-storage/files/manifest.json
python -m http.server 8001 --directory /tmp/rtg-site
```

The live smoke uses the real project loader to load RTG-001, Mount Washington and
an MP3, including their referenced assets, and checks HTTP success and CORS headers.
It is a network/data integration test, not a rendered browser or driving test.

Omit both remote arguments to produce the existing self-contained optimized build
(for offline distribution). The development storage API remains unchanged. The
remote build requires internet access for uncached files. Existing in-session caches
and HTTP caching apply; there is no new persistent/offline download cache. Raw source
documents do not receive the packaging optimizer's media deduplication, so cold
loads can transfer more bytes. Requests retain the existing timeout/error behavior;
there is no fallback to a moving branch or silently missing graphics.

Measured on staging 79bbd95ec719a3d3a5fe1b17f39fe77c2581da73: remote site
417,446,425 bytes (398 MiB), project index 62,004 bytes, 14 cars and 124 races.
Source project files total 769,529,725 bytes; that is source size, not a measurement
of the old optimized Pages package. Most remaining site bytes are vendor libraries
and soundfonts. No car roster reduction is needed for this build's 850 MiB budget.
