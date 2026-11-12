# 2023 Volt-Hound GT: provisional EV calibration

Original fictional 2994 salvage crossover, not an OEM replica. Manufacturer reference: https://www.kiamedia.com/us/en/models/ev6/2023/specifications (US 2023 GT, not GT-Line). Research packet records official indexed table access; full page returned403.

## Sourced versus assumed

Sourced combined output430kW and545lb-ft (738.92078Nm),4795lb minimum curb mass (2174.9754kg), AWD,10.65single reduction,184.8×74.4×60.8in body,114.2in wheelbase,64.1/64.4in tracks,6.1in clearance. Published576hp is separately rounded from430kW (576.64mechanicalhp). No per-motor double counting.

77.4kWh is gross capacity, **not** runtime usable energy. Runtime74kWh usable is explicitly assumed. Motor20000rpm cutoff, constant-torque/constant-power envelope,92% drive/80% regen efficiencies,100Nm/60kW regen limits,35% lift-off demand,5rad/s regen threshold and2kW winding loss are modeling assumptions. No OEM drive-mode/thermal/SOC maps.

255/40R21 tire geometry,36psi and.368m effective radius are provisional simulation choices because indexed OEM tire string is malformed. Existing street tire model reused.50:50 static distribution,CG height.5m,Cd.30, collider subshapes, all suspension/differential/brake/handling values are estimates. Artwork wheel anchors are measured artistic placement, not engineering dimensions. Salvage attachments do not silently inflate sourced curb mass.

## Actual runner smoke measurements

120Hz chassis/360Hz tires, flat asphalt friction1, TC enabled. Full-power launch reaches60mph in approximately4.33s versus manufacturer's3.4s target. **Not performance calibrated**; no power multiplier added to force target. At10s speed47.53m/s,energy use4.00MJ. Five-second powered rolling case starts20m/s at25% throttle and ends28.55m/s; this is not a steady-speed consumption/range test.

Five-second lift-off from20m/s at half charge ends16.83m/s and recovers72.96kJ.100J depletion case reaches zero energy and zero drive torque. Depleted vehicle can still move from gravity/contact settling; no claim of immobility. Automated tests preserve these directional invariants, not exact platform-sensitive decimals.

At.368m effective radius,20000rpm/10.65 implies72.37m/s (161.88mph) shaft ceiling. Manufacturer161mph is a reference; aero, load, slip and cutoff behavior mean actual sustained top speed is unverified. No electronic161mph speed limiter is claimed.

## Pending release gates

Rendered all-angle body/wheel alignment, dashboard/shared wheel placement and full in-game playtest. Source pack and runtime tests are ready; artwork/config are provisional until visual QA. No maps are changed. No traction thermal/charging/DC-DC/EV wear model or OEM friction/regen blending.
