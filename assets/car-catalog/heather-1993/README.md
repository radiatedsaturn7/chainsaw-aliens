# Heather 1993 — local checkpoint

Playable logo-free 2994 estate based on the UK-market 1993 Volvo 240 SE 2.0 B200F five-speed, with catalyst. This is not the 2.3 SE. Original eight-view body sheet and RHD dashboard; fitted shared tires/wheel and live speed, RPM, gear and fuel display.

Base: Meadowsweet `88f6854d9c13dc8bcbf2d308d03f2563b33c6e8c`. Read-only staging fetch: `58c2ec08e9457b778a19f617fad3aded4e4fa0ee`; its tree `7e1315cdc36f12c3be7b8250e39ca4c251595722` is byte-identical to Meadowsweet's original staging base. No staging/main/remote changes. This checkpoint has **95 playable documents**, plus three excluded system templates. The separate old104 checkpoint is not integrated.

Primary source: [Volvo UK brochure](https://www.240.se/litteratur/93England.pdf), archived locally in refs. PDF page4 (printed5) independently distinguishes B200F from B230F. It specifies ECE111hp/5700rpm,158Nm/2800rpm, approximate average kerb1366kg,185/70TR14 and five-speed. The brochure's hp unit interpretation, all individual ratios/final drive and unsupported simulation values are explicitly qualified in import.json. No claim of measured acceleration calibration.

No duplicate or existing alias was found in all current car document content, including compressed documents. The unimplemented SE estate backlog candidate is not a playable duplicate.

Validation:23 scoped tests;13 drivetrain/clutch/allocation tests;3 Chromium browser checks; manifest1835documents/16assets; git whitespace check. Desktop keyboard G and real handheld touch both accelerated in production physics on a temporary in-memory route. Telemetry and screenshots are in qa. Initial→cockpit displacement46.40m desktop and33.10m handheld; RPM and gear changed; no page errors. Eight angle screenshots use the actual editor compositor after its motion check. Browser evidence is emulated handheld Chromium, not a physical device test.

Original imagegen outputs and rejected gutter/haze attempts retained. Source PNGs are unmodified copies; native importer performs its standard alpha8 cleanup. Wheel openings were measured against the live rig. Cockpit values are a fictional2994 retrofit. Existing car/race files, including Meadowsweet art and QA, are checked byte-for-byte in qa/integrity.json. qa/sha256.json records this package's file integrity.
