# Speedwell 1968 — local checkpoint

Playable original logo-free 2994 hatchback based on French model-year1968 Renault4 Export with the standard747cc engine and four-speed manual. The optional845cc Super engine is deliberately excluded. Eight exterior views and a vehicle-specific metal/shelf dashboard with dash gear lever, fitted shared wheel/tires and live speed, RPM, gear and fuel display.

Base: Heather `ad9f0453b4bffeb6b334771d94eb56e033779280`, tree `1bed32f8391f75de8df7f8db3da5defc23abf7ee`. Meadowsweet remains saved at `88f6854d9c13dc8bcbf2d308d03f2563b33c6e8c`. Read-only staging fetch/recheck `58c2ec08e9457b778a19f617fad3aded4e4fa0ee` has the same tree as the original staging base. **96 playable cars** on this branch, plus three excluded system templates. The old104 branch and its unpublished eleven cars are separate and untouched.

Sources: [1968 period French brochure](https://www.brochure-catalogue-voiture-neuve.fr/brochures/renault/4/renault-4-1961/FRA-1968/) and [Renault manufacturer history](https://cdn.group.renault.com/ren/master/renault-classic/tools-and-services/Renault4T1.pdf.asset.pdf/379ae4ac61.pdf). Both PDFs retained in refs. Period page2 explicitly identifies1968/new four-speed; page6 distinguishes747cc from optional845cc. Manufacturer history corroborates Export747cc and the1968 gearbox/grille transition.

The period30ch SAE rating and5.1mkg SAE torque remain source facts, separate from assumed runtime26mechanicalhp/46Nm. No SAE-to-DIN/CEE conversion is claimed. Mass650kg, individual gearing/final drive, modern135/80R13 interpretation, net torque curve and other unsupported physics values are labeled estimates in import.json/research.json. Mean brochure wheelbase is modeled symmetrically. Performance is not independently calibrated to factory measurements.

No duplicate or existing alias was found among current decoded car documents; the Renault Export backlog entry was unimplemented. Existing catalog tests retain historical minimum roster assertions; this checkpoint adds the exact96-car assertion. No runtime source code changes.

QA:41 focused source/roster/roundtrip/wheel/import/drivetrain/clutch/allocation tests. Actual editor preview advances production physics before capturing all8views; keyboard and handheld touch driving use production gameplay on an in-memory route, leaving saved races unchanged. Browser outputs, motion telemetry and manifest validation are preserved in qa. Handheld QA is touch-enabled Chromium emulation, not a physical device claim. Art and live gauge fit visually reviewed.

All prior tracked files except the additive manifest and two roster-count test adjustments are compared with the exact Heather base. No original art, references or useful QA were removed or overwritten. File hashes are in qa/sha256.json and base/free-space/integrity evidence in qa/integrity.json. No remote writes, PR, Library transfer, staging/main edits or deletion.
