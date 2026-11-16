# Gorse 2015

Original logo-free 2994 utility inspired by the UK/European RHD 2015 Land Rover Defender 90 Station Wagon 2.2 diesel six-speed manual, with optional 235/85 R16 heavy-duty steel wheels. High range only. Not the 110/130, 2020 model, or limited higher-power edition.

The retained manufacturer brochure confirms 2,198 cc, 90 kW (122 PS) at 3,500 rpm, 360 Nm at 2,000 rpm, 90 mph and 14.7 seconds to 60 mph. The 1,902 kg minimum kerb figure includes full fuel and a 75 kg driver; no second driver mass was added. Dimensions and optional tire selection are attributed in import.json. Gear ratios, effective high-range final drive, torque-curve interpolation and other simulation settings are explicitly estimates. Auto Assist operates the manual ratios; it is not a factory automatic.

body.png and dashboard.png are original generated artwork. Native eight-view import uses measured wheel openings, shared moving tire layers, and a vehicle-specific RHD dashboard with live speed, RPM and gear readouts. rejected/ preserves the first body generation. references/ preserves the original brochure and compact technical excerpts. qa/ preserves eight production editor views, cockpit, moving keyboard/touch screenshots and telemetry, focused tests, manifest validation and integrity hashes.

Local-only addition from 0ecdf094fce29d1f2f596f0310c7b4ee7cec54b7: 100 playable cars, excluding three system templates. This is separate from the old unpublished 104-car branch. No existing car, race, art or earlier QA package is replaced. Staging fetch 58c2ec08e9457b778a19f617fad3aded4e4fa0ee has the same tree as original base 9588b8424c64653ff4864df0ff26764c3d51f0c8. No publication or remote writes.

Review: all eight production exterior angles were visually inspected for orientation, silhouette and wheel coverage; both moving cockpit views show the fitted instruments. The initial focused test exposed a high-rpm interpolation point that inflated normalized peak output to 123 hp; lowering that estimated point restored the source-derived 121 hp. The failed log is retained, and the complete focused suite and browser driving checks were rerun on the corrected document.
