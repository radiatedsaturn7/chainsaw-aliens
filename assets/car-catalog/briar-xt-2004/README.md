# Briar XT 2004 source artwork

Original fictional salvage AWD compact wagon for the game's 2994 world, broadly inspired by the 2004 US Forester XT five-speed manual. Not a factory-exact visual replica. Muted forest-green paint, sand replacement front fenders, hood scoop and roof rails distinguish it from other catalog cars. No snow or badges.

- `body.png`: original transparent eight-view body shell sheet, existing four-column/two-row layout. Wheels are intentionally absent; transparent openings require measured hub calibration.
- `dashboard.png`: original transparent windshield overlay with blank left instrument binnacle. Reuse the existing steering wheel and game gauges/wipers; none are baked in.
- `provenance.json`: exact generation prompts, style references, source research links, and pending QA.

Imported through the production Car Editor serializer with fixed-rear camera, surface FX, shared wheel and individually positioned gauges. Browser eight-angle and desktop/portrait cockpit review is required before release. No maps/worlds changed. `research.json` records OEM anchors and unresolved brochure/service height/clearance discrepancies; runtime provisionally uses the service convention. `import.json` labels handling and performance assumptions. `calibration.json` records source-pixel wheel-well and cluster measurements.
