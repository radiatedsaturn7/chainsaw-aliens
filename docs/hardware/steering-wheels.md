# Steering wheels and force feedback

## Status and setup

This is an **experimental, hardware-untested integration**, not a certified wheel compatibility list. Keyboard, normal gamepad and touchscreen controls remain available. No companion app, WASM module, new npm package or native dependency is required.

Open **Options → Vibration → Steering wheel / pedals / force feedback** (Studio: Options → Driving vibration). The Menu Editor also offers a **Steering wheel settings** action.

1. For Gamepad API devices, press a button so the browser exposes them. Select each device/axis from the steering and pedal sections. Wheel and pedals may be separate devices.
2. If Gamepad input is unavailable, use **Add WebHID input device**. This opens a permission picker and reads generic absolute axis/button reports; it sends no output commands.
3. Capture full left, center, full right, then each pedal's released and fully pressed positions. Reversed/asymmetric axes are supported. Live raw values appear at the top. Bind shift up/down, handbrake, camera and pause buttons separately.
4. Set the physical rotation to match the wheel driver's setting and the desired travel for full in-game steering. These settings scale input; they do not reprogram the wheel's hardware stops. Enable calibrated input and Apply. Bindings are stored separately in `wheel-settings`; existing control preferences are not overwritten.
5. For feedback, use **Connect WebHID feedback device** and inspect its diagnostics. Detection of a wheel, input reports, or the WebHID API alone does **not** imply compatible force output. Rejected descriptors stay input-only.
6. Start with a low motor limit in the manufacturer's own software. Click **Save calibration and enable force feedback**. Forces remain zero in menus, countdown, loading, pause and results. Cancel/close the form after this explicit action to keep it armed; Apply intentionally disables feedback when changing settings. Focus loss, stale physics, unplugging, transport failure or explicit Disable disarms it. Re-enable after fixing the cause. Permission is not the same as authorization to start forces; neither arming nor motor effects are restored on page load.

**Use mock feedback backend** disconnects physical feedback and records normalized torque without hardware. Enable it using the same button; no wheel calibration is required for mock mode. Drive with existing keyboard/touch/gamepad input and reopen diagnostics to inspect the torque and clipping indicator. The latest 500 output samples are available on `window.__game.wheelService.driver.samples` when the developer game handle is enabled. No scripted motor direction test is run.

## Compatibility boundaries

| Device family | Input | WebHID force feedback in this implementation |
| --- | --- | --- |
| Logitech G-series | Gamepad axes/buttons if exposed by OS/browser; calibrate | Typically proprietary protocol, as noted by LibreCorsa. No proprietary Logitech encoder implemented. Rejected without the complete standard PID layout. |
| Thrustmaster | Calibrated Gamepad or compatible generic HID input | Model, mode and driver dependent. No brand-specific protocol or compatibility claim. Complete strict PID descriptor required. |
| Fanatec | Same; separate pedals/button boxes can be bound | Some modes may expose PID; not assumed from brand or device name. Untested, strict checks apply. |
| Moza | Same | LibreCorsa includes Moza-related descriptor cases, but that is not verification here. Signed magnitude, explicit millisecond duration, allocation, gain and X-axis control must all pass. |
| Simagic | Same | Candidate PID backend only; no hardware verification. |
| Simucube | Same | Candidate PID backend only; no hardware verification. |
| VRS, Asetek, OpenFFBoard and other bases | Same | Potentially usable standard PID descriptors; no certified models. Unknown, unsigned-force, ambiguous-axis or incomplete layouts are refused. |
| Phone / Backbone / ordinary controllers | Existing input and rumble remain | Phone/controller vibration is separate from steering torque. No conversion of rumble into steering resistance. |

**Verified hardware:** none. **Automated support:** synthetic PID descriptors, mock output, generic Gamepad and HID axis/button decoding. Firmware, PC/console mode, OS drivers and USB interface ownership can change both input and output availability. USB permission and successful report writes cannot prove the motor interpreted a command correctly.

WebHID is generally a desktop Chromium feature, requiring HTTPS or localhost and user permission. Firefox, Safari and ordinary mobile browser deployments should expect input/rumble fallback rather than WebHID FFB. Detect `navigator.hid` and secure context at runtime rather than choosing by user-agent. Linux device access may require administrator-configured `hidraw` permissions. OS drivers or other applications may own an interface. A LAN HTTP URL is not equivalent to localhost. Packaged applications must explicitly provide a compatible backend; packaging alone adds no wheel support.

References: [Chrome WebHID guide](https://developer.chrome.com/docs/capabilities/hid), [WebHID explainer/platform limitations](https://github.com/whatwg/hid/blob/main/README.md), [report descriptor units](https://hid.spec.whatwg.org/), [USB PID specification](https://www.usb.org/document-library/device-class-definition-pid-10).

## Architecture

`WheelInput` → calibrated input frame → `applyWheelRaceInput` → existing `RaceSimulation` / `VehicleDynamicsRunner`.

Existing authoritative tire telemetry → `WheelTelemetry` / `WheelForceModel` → `WheelService` safety gate → `WheelOutputBackend` (`PidWheelDriver` or `MockWheelDriver`).

- The existing simulation-wheel control mode provides direct steering response. The saved car handling preset and physics engine remain in place. Wheel steering skips the controller deadzone/sensitivity pass; keyboard and touch steering may override it. Assigned wheel/pedal gamepads are excluded from generic controller interpretation so pedal axes don't also move the camera. Other controllers remain available. Missing/invalid calibrated input falls back to the existing input path; stale wheel clutch/handbrake states are released.
- Input and feedback devices are selected separately. Nothing assumes a Gamepad name is the matching HID output interface. Duplicate identical Gamepad devices use the browser index as part of their key; recalibration/reselection may be necessary after reconnecting in a different order. Identically named HID devices with identical VID/PID/report layouts are ambiguous and should not be used together yet.
- The existing application is static ES modules with no TypeScript build step. Reused protocol source remains TypeScript; checked-in JS is generated by `node tools/build-wheel-protocol.mjs` (Node 24+), with `--check` for reproducibility. New application glue uses existing JS conventions; `WheelBackend.d.ts` defines the swappable backend contract. No runtime compiler is shipped.
- Optional native support can implement this interface later. No WebSocket bridge is started, discovered, downloaded or required. A future bridge must enforce origin authorization, explicit device selection, single-client ownership, fresh-message watchdogs, finite effects and torque limits independently of the page.

## Physics effects and known limits

- **Alignment / traction lightness:** sums front tire `selfAligningMomentNm` after the existing brush/contact solver has resolved slip, grip, load and tire damage. No synthetic tire model or guessed grip state. Normalization uses 150 Nm of simulated rack moment as an arcade scale, not motor torque calibration. Test direction on real hardware before raising strength; an inversion setting is available.
- **Surface texture / suspension hits:** uses the left/right difference in actual front suspension compression velocity, capped to a small contribution. Rough terrain only generates this cue when it changes suspension travel; there is no arbitrary constant dirt buzz. Missing compression telemetry omits this contribution.
- **Collision impulses:** uses reported impulse magnitude and world normal projected onto the car's right axis, once per event. Many body collisions currently lack a usable normal and are intentionally omitted. Smallest extension: publish the solver's dominant contact normal/point alongside every existing impact event, including worker snapshots; no need to invent collision direction or change collision physics.
- **Damage:** existing tire damage affects tire moments; existing suspension deformation/load imbalance affects the measured aligning and suspension signals. No extra scripted random steering shake is added on top. Mechanical damage not represented in these outputs has no additional effect yet.
- **Engine vibration:** RPM alone is not a measured steering-column force. Engine firing vibration is not synthesized in this first integration. A future optional effect should use existing crank torque/firing telemetry, with a low default strength, rather than inventing a damage or engine-force variable.
- No physical caster/rack ratio calibration, gyroscopic torque, hard motor end stops or guaranteed Nm output. These would require additional car/device data and hardware validation. This is feedback for the existing arcade game, not a replacement steering simulation.

## Safety and scheduling

Force strength defaults to 0.5 with a software cap of 0.20; software maximum is 0.35. PID device gain adds another 35% ceiling, so these limits multiply. These are fractions of the wheel driver's configured strength, **not Nm**. Leave a conservative torque limit in the manufacturer's software, especially for direct-drive bases.

The parser derives report IDs, selectors and bit offsets from descriptors. The output backend additionally requires signed bipolar magnitude, explicit X-axis selection, verified allocation/status/index, start/stop, one loop, gains starting at zero, enable/disable and an explicitly millisecond-scaled finite duration. It never assumes effect block 1 or an unsigned midpoint means zero. Device setup allocates an effect at zero only following explicit Enable.

A 50 Hz timer is independent of render cadence. Only the latest available physics sample is used; no accumulated force-command backlog. A 100 ms stale-physics cutoff disarms output. Each hardware effect lasts 120 ms and uses a single loop; renewed output is required to continue. Thus a compliant device expires the force even if the browser main thread stalls and cannot run its software watchdog. The descriptor cannot prove firmware obeys duration; real hardware validation remains essential.

Writes are serialized with bounded I/O waits. Pause sends zero and stops the effect; focus/page visibility loss disarms and disables actuators. Shutdown invalidates pending work so a late magnitude write cannot be followed by a new start. Failed writes disable feedback instead of automatically retrying with rising force. Teardown attempts zero, stop, disable and release; unplugged/unresponsive hardware cannot acknowledge them. USB completion after a timeout is not cancellable by WebHID, so the finite hardware duration remains the backstop.

## LibreCorsa investigation and licensing

Inspected [KhazP/librecorsa](https://github.com/KhazP/librecorsa) at commit `b6bd7a419d5f4c12f34254a79e5aec05c74d7867` (2026-10-26). Its root license is MIT, copyright 2026 KhazP. Reviewed source files carry no overriding license. No assets, models, sounds, textures, tracks, logos or simulator systems were imported. `CREDITS.md` distinguishes code from restricted assets; its Next.js/React/Three.js stack and offline LGPL tools are not dependencies of this integration.

| Source file | Relevant findings | Reuse decision |
| --- | --- | --- |
| `src/lib/input/webhid-ffb.ts` | User-gesture HID picker; descriptor-derived PID selectors, packed fields, feature allocation, constant force, gain/control; one-in-flight writer, 2 ms minimum interval, failure tracking; disconnect/teardown. No external imports. | Adapted only descriptor parsing/encoding and minimal types into `vendor/PidDescriptor.ts`. Added input-report parsing and unit metadata. MIT license preserved alongside it. Output lifecycle implemented independently, with stricter safety gates and finite duration. |
| `src/lib/input/device-input.ts` | Gamepad-based steering/pedal calibration, per-device bindings, button edges, wheel detection heuristics and rotation mapping. Depends on local bindings. | Architectural reference; independent implementation fitted to our input system. No wholesale import or dependencies. |
| `src/lib/input/bindings.ts` | Existing simulator keyboard/pad defaults and actions. | Reviewed, not imported. Preserve Last on the Grid bindings. |
| `src/lib/input/wheel-ffb.ts` | Physics torque shaping, sign conversion, smoothing, damping, soft lock, 150 ms HID watchdog, optional localhost WebSocket sink. | Reference only. Independent force model reads our existing telemetry. No transplanted physics or automatic native fallback. |
| `scripts/ffb-bridge.ts` | Optional Windows helper launcher, localhost WebSocket server, origin checks, single-client replacement, telemetry relay. Uses Node built-ins. | Reviewed, not shipped or executed. Potential optional future backend. |
| `scripts/ffb-bridge/FfbHelper.cs` | DirectInput constant force, approximately 333 Hz loop, interpolation, limits and stale-packet watchdog; depends on Windows/.NET/DirectInput. | Reviewed, not shipped, compiled or reused. No native licensing/dependency burden added. |
| `scripts/verify-webhid-ffb.ts` | Synthetic nested PID descriptors, signed/packed fields, selectors, range handling, allocation, rate limiting, disconnect and setup/teardown fixtures. | Adapted synthetic descriptor fixture with MIT notice; tests rewritten for our stricter backend. Rejected unsigned/infinite/block-1 assumptions are tested as unsupported. |
| `scripts/verify-input.ts` | Pedal inversion, center/deadzone/rotation, binding and button-edge cases. | Test ideas adapted independently; no source imported. |
| `src/components/menu/steps/WheelStep.tsx` | Setup/calibration/feedback UI in LibreCorsa's React wizard. | Reviewed, not copied; use our shared expandable settings form. |

License: [`LICENSE.librecorsa`](../../src/hardware/wheels/vendor/LICENSE.librecorsa). Retain it and the source attribution when redistributing adapted source or generated JS. The copied protocol subset and fixture have no third-party runtime dependencies.

## Validation

Run `node --test tests/unit/wheelHardware.test.js tests/unit/raceHaptics.test.js tests/unit/phoneHaptics.test.js tests/unit/steeringCommandMapping.test.js tests/unit/raceCameraInput.test.js`.

Tests cover descriptor rejection/acceptance, bit encoding, signed normalization/clipping, allocation errors, no output before enable, finite effect duration, single loops, in-flight stop, quiet/resume, I/O timeout, disconnect, unsupported browser, calibration/inversion, generic HID decoding, input fallback, original-controller preservation, invalid/stale physics, focus loss and mock operation without hardware. Browser settings coverage is in `tests/playwright/wheel-settings.spec.js`; run in the project's GitHub Docker environment. Termux cannot execute the supported Playwright browser locally.

Before adding a verified device entry, record model, firmware, OS, browser, driver/mode, descriptor, torque cap and observed force direction; test stop/pause, tab blur, unplug, blocked main thread and failed output while using a low driver-side limit. No successful automated test is evidence that a particular physical wheel is compatible.
