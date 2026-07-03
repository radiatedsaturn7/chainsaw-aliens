export const LATEST_MAJOR_WORK = {
  inProgress: [
    'Finish shared desktop editor chrome across all editors: horizontal top menus, click-away dropdown drawers, and persistent left-side tool/context panels.',
    'Audit every editor menu so File, Edit, View, Tools, and editor-specific drawers contain real commands instead of duplicate navigation rows.',
    'Preserve the working portrait flows while tightening only obvious overlap, start-screen, and bottom-menu problems.',
    'Bring mobile landscape and gamepad onto the same shared layout rules: landscape keeps left root/right submenu, gamepad replaces the left root with a slide-out submenu.',
    'Reduce per-editor UI drift by moving repeated canvas and DOM chrome into shared RTG Studio helpers and CSS tokens.'
  ],
  recentMajorChanges: [
    '2026-07-02 22:40 EDT - Race Editor and Car Editor desktop playtest End Drive now lives in the Drive top drawer as a release-activated command instead of the persistent left context panel, keeping desktop left panels passive/contextual.',
    '2026-07-02 22:33 EDT - Pixel desktop rendering now clears stale mobile thumbstick geometry before drawing desktop chrome, and the portrait/menu model suite now guards stale thumbstick cleanup across Pixel, Level, MIDI, SFX, and Cutscene desktop paths.',
    '2026-07-02 22:26 EDT - Race Editor and Car Editor now resolve the same viewport modeContract at render dispatch as the other editors, while retaining desktop/landscape shell mode contracts and gamepad slide-out mode contracts from the shared helpers.',
    '2026-07-02 22:21 EDT - Pixel, Level, Actor, MIDI, SFX, and Cutscene render entry points now retain the shared viewport modeContract before branching into desktop, portrait, landscape, or gamepad shells, with source-level coverage and docs locking that renderer handoff.',
    '2026-07-02 22:15 EDT - resolveEditorViewportModeFlags now returns the combined modeContract alongside desktop/portrait/landscape/gamepad booleans, so renderer entry points can choose the active mode and consume the same shared contract object in one call.',
    '2026-07-02 22:10 EDT - Specialized desktop, landscape, and gamepad shell helpers now expose the same combined modeContract as the generic editor layout plan, with desktop and gamepad consuming shared presentation/interaction directly and landscape narrowing only optional right-rail/bottom-rail presentation surfaces.',
    '2026-07-02 22:04 EDT - Shared editor mode contracts now expose a combined getEditorModeContract() API, giving renderers one object for required/suppressed surfaces plus presentation and interaction semantics instead of reassembling desktop, portrait, landscape, and gamepad rules locally.',
    '2026-07-02 22:01 EDT - Rendered editor layout contract coverage now imports the shared mode presentation/interaction constants and checks actual desktop, portrait, landscape, and gamepad chrome against those contracts, tying runtime editor renders back to the same desktop top-menu, portrait bottom-rail, landscape right-drawer, and gamepad left-slide-out rules.',
    '2026-07-02 21:56 EDT - Shared presentation/interaction contracts are now centralized per mode with exported constants, a lookup helper, and a validator, so portrait touch sheets, landscape right drawers, desktop mouse dropdowns, and gamepad confirm-button slide-outs cannot silently drift from the shared editor UI contract.',
    '2026-07-02 21:50 EDT - Race playtest scale got another tuning pass: default roads now map to a narrower world width, the third-person car reads larger against the lane, highway-speed projection samples farther ahead with faster stripe motion, launch yaw stays road-aligned, and the starting grid stripe renders as a close black/white checker band.',
    '2026-07-02 21:42 EDT - Specialized desktop and landscape shell helpers now expose presentation/interaction metadata that matches the generic shared layout plan, and gamepad slide-out tests now verify controller semantics against the generic gamepad plan.',
    '2026-07-02 21:38 EDT - Generic editor menu layout plans now expose the same presentation and interaction vocabulary as the specialized shell helpers, covering desktop mouse dropdowns, portrait touch bottom sheets, landscape right drawers, and gamepad controller slide-outs before renderer-specific code runs.',
    '2026-07-02 21:34 EDT - Gamepad slide-out menu plans now expose explicit presentation and interaction metadata so controller submenus identify as left-slide-out drawers with confirm-button activation and controller-owned gesture scroll instead of inheriting desktop dropdown semantics.',
    '2026-07-02 21:31 EDT - Portrait menu models now expose the same explicit bottom-rail placement contract across Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car, with Race/Car promoted to first-class named portrait model builders instead of test-only shortcuts.',
    '2026-07-02 21:26 EDT - Shared desktop dropdown render plans now own filtered drawer scroll metadata after hidden/duplicate/separator rows are resolved, exposing clamped scrollIndex, maxScroll, visibleRows, scrollRegion, and mouse wheel policy for all editor drawers.',
    '2026-07-02 21:22 EDT - Shared desktop top-menu plans now expose fit metadata for every editor, including compression, hidden overflow, full root visibility, visible/total root counts, and minimum recommended width so narrow desktop shells handle crowded root menus consistently.',
    '2026-07-02 21:17 EDT - Race playtest scale tuning now uses a narrower believable road width, a larger third-person car, longer high-speed perspective sampling, a launch-visible black/white checker stripe, and regression coverage for first-gear starts and race scale.',
    '2026-07-02 21:08 EDT - Shared mode surface contracts now have a lookup helper and validator that rejects missing, duplicated, or overlapping required/suppressed surfaces, so a mode cannot accidentally require and suppress the same chrome.',
    '2026-07-02 21:04 EDT - Shared menu layout plans now expose requiredModeSurfaces for portrait, landscape, desktop, and gamepad, pairing each mode suppression list with the surfaces that must be present for every editor.',
    '2026-07-02 21:00 EDT - The generic shared menu layout plan now exposes one per-mode suppressed-surface table for portrait, landscape, desktop, and gamepad, and the desktop/landscape/gamepad specialized shell helpers derive their suppression metadata from that shared table.',
    '2026-07-02 20:56 EDT - Shared portrait menu layout plans now explicitly suppress desktop, landscape, and gamepad chrome while keeping root menus, submenus, and primary actions bottom-first across every editor.',
    '2026-07-02 20:52 EDT - Shared landscape and gamepad shell plans now explicitly declare which opposite-mode surfaces they suppress: touch landscape suppresses desktop top/dropdown/left-inspector chrome, while gamepad slide-out plans suppress the touch right submenu, root drawer, bottom tool rail, and touch thumbstick.',
    '2026-07-02 20:48 EDT - Shared desktop editor shell plans now explicitly list the mobile/controller surfaces suppressed on desktop, including bottom rails, touch thumbsticks, landscape drawers, gamepad hints, and gamepad slide-outs, with all-editor layout coverage locking the contract.',
    '2026-07-02 20:43 EDT - Race playtest scale pass: roads now project narrower in world space, high-speed perspective samples farther ahead, the third-person car is larger relative to the lane, races start in first gear with road-aligned camera yaw, and the start line renders a black/white checkered stripe on the projected road.',
    '2026-07-02 19:48 EDT - Shared editor menu specs now enforce desktop File and Edit baseline ordering at validation time: every editor File drawer must start New, Save, Save As, Open, Export, Import, and every editor Edit drawer must start Undo, Redo before editor-specific edit commands.',
    '2026-07-02 19:44 EDT - Race Editor route authoring now supports map-click node insertion in Draw Road mode, keeps node drag math shared between inserted and existing nodes, stores Tile Editor-backed paint metadata on terrain patches, and projects shoulder ground from edge heights so painted dirt/snow/asphalt terrain stays attached to elevated track geometry.',
    '2026-07-02 19:36 EDT - Desktop File drawer coverage now checks every editor dropdown plan starts with the shared New, Save, Save As, Open, Export, Import baseline, not just selected editor specs.',
    '2026-07-02 19:35 EDT - Desktop dropdown command metadata coverage now validates Actor DOM rows in the same all-editor pass as Pixel, Level, MIDI, SFX, Cutscene, Race, and Car, with Actor-specific dataset assertions kept for DOM details.',
    '2026-07-02 19:33 EDT - Desktop chrome coverage now treats Actor DOM ribbon, top menu, context panel, and dropdown styling as first-class RTG Studio shared editor chrome alongside the canvas desktop painters.',
    '2026-07-02 19:30 EDT - UISpec.md and cross-editor gamepad slide-out coverage now treat Actor as part of the shared editor UI contract instead of a still-unbridged DOM exception.',
    '2026-07-02 19:27 EDT - Actor Editor gamepad slide-out headers now consume the shared buildGamepadSlideOutMenuPlan headerHint, matching the A/B/LB/RB controller hint contract used by the canvas editors.',
    '2026-07-02 19:24 EDT - Race Editor and Car Editor desktop dropdown scroll state now follows the open top-menu drawer root like Pixel, Level, MIDI, SFX, Cutscene, and Actor, removing the last activeRootId scroll-key exception from the shared desktop shell contract.',
    '2026-07-02 19:22 EDT - Race Editor and Car Editor gamepad slide-out root and submenu states now both consume the shared header hint from buildGamepadSlideOutMenuPlan, keeping their left-slide controller menus aligned with the older editors.',
    '2026-07-02 19:19 EDT - Race Editor track authoring now persists dragged top-down nodes as editable road.nodes, playtest route sampling follows those dragged nodes, and painted Tile Editor-backed terrain patches can influence the projected race ground/shoulders.',
    '2026-07-02 19:11 EDT - Gamepad slide-out headers now get their visible A/B/LB/RB hint from the shared slide-out plan across Pixel, Level, MIDI, SFX, and Cutscene, with Race/Car inheriting the same shared default header wording.',
    '2026-07-02 19:04 EDT - Shared gamepad slide-out plans now expose focused root/submenu metadata and Cutscene gamepad drawers render focused rows, tightening controller menu consistency with the landscape-style left slide-out model.',
    '2026-07-02 19:00 EDT - UISpec.md, the editor UI contract, and layout coverage now explicitly require live openedAtMs-driven desktop drawer slide-down motion so future editor shells preserve animated top dropdowns instead of rebuilding static drawers.',
    '2026-07-02 18:57 EDT - Race Editor authoring now has an explicit Move/Paint/Edge mode strip, pulls runtime Tile Editor definitions into the race ground palette, and renders segment edge/ground tiles as attached pseudo-3D shoulder strips instead of a flat background.',
    '2026-07-02 18:48 EDT - Desktop dropdown slide-down animation is now driven by shared openedAtMs timing across Pixel, Level, MIDI, SFX, Cutscene, Race, Car, and Actor instead of being only static render metadata.',
    '2026-07-02 18:39 EDT - Actor Editor desktop DOM drawers now consume the same shared dropdown motion metadata as canvas editors and animate with the RTG Studio slide-down drawer treatment, closing another split between the DOM editor and shared canvas desktop shell.',
    '2026-07-02 18:37 EDT - Desktop dropdown drawers now have a shared slide-down motion contract in buildDesktopDropdownRenderPlan and drawSharedDesktopDropdown, so canvas editors share one top-menu drawer animation model instead of static or per-editor assumptions.',
    '2026-07-02 18:32 EDT - Race Editor top-down authoring now has direct shared-tile swatches, Paint/Edge modes, click-to-apply segment edge tiles, and ground paint elevation sampled along the track path so painted terrain follows the route height instead of floating from isolated node values.',
    '2026-07-02 18:26 EDT - The shared UI contract now explicitly says landscape root drawers keep right submenus visible, with buildEditorMenuLayoutPlan exposing modeSurfaces.rootDrawerKeepsSubmenuVisible so future editor work follows the same left-root/right-submenu rule.',
    '2026-07-02 18:23 EDT - MIDI touch landscape now keeps the active right utility drawer visible while the left root drawer is open, matching the shared landscape left-root/right-submenu model used by Level and Cutscene.',
    '2026-07-02 18:21 EDT - Level touch landscape now reserves the right submenu rail whenever the drawer is open and draws submenu content there while the left root drawer is open, matching the shared left-root/right-submenu landscape model.',
    '2026-07-02 18:17 EDT - Cutscene touch landscape now keeps the right submenu drawer reserved while the left root drawer is open, so Menu shows roots on the left and the active submenu on the right like the shared landscape model.',
    '2026-07-02 18:14 EDT - Race/Car desktop left context panels no longer duplicate builder commands: Generate/Add/Curve/Hill/Surface remain available from the top drawers, while the persistent left panel stays focused on selected race/car details and active playtest exit.',
    '2026-07-02 18:10 EDT - MIDI landscape root drawer scrolling now registers through the shared menuScrollRegions model instead of depending on MIDI-only bounds checks, keeping the touch landscape Menu drawer aligned with the shared scroll/tap contract used by the other editors.',
    '2026-07-02 17:58 EDT - Race Editor authoring now supports dragging track nodes to reshape real segment length/curve/elevation data, tile-backed ground painting with stored elevation patches, and per-segment edge tile overrides while preserving the existing generated terrain fallback for unconfigured races.',
    '2026-07-02 17:50 EDT - Pixel Editor no longer carries the old custom gamepad hint drawer or legacy GAMEPAD_HINTS import; Pixel now relies on the same shared RTG Studio gamepad hint bar contract as the other canvas editors.',
    '2026-07-02 17:47 EDT - Race playtest perspective now pushes the horizon higher at highway speed, narrows the near road, samples farther ahead, and gives destination races a clean percentage readout in the upper-right HUD instead of lap/Point text; Pixel and Cutscene gamepad surfaces also now use the shared RTG Studio hint bar contract.',
    '2026-07-02 17:37 EDT - Race playtest steering fix: touch d-pad steering now survives input polling while the pointer is held, including pointer id 0, and binary steering now reaches full wheel lock quickly when stopped while remaining speed-damped at higher speeds.',
    '2026-07-02 17:34 EDT - SFX portrait Layers now uses the shared compact context ribbon for Add, Duplicate, and Delete, keeping those layer actions out of the scroll list where they were overlapping other portrait controls; the related menu tests now expect the shared ribbon contract and the stale MIDI root-menu assertion was refreshed.',
    '2026-07-02 17:27 EDT - Race playtest steering now separates analog and binary input: analog sticks use shaped speed-sensitive steering, keyboard/mobile D-pad steering sets an assisted binary target instead of accumulating forever, the steering wheel snaps cleanly back to zero after release, RT/LT drive brake input remains supported, and A/B/X/Y-style face-button fallbacks cover go, brake, shift down, and shift up.',
    '2026-07-02 17:23 EDT - Actor, Level, MIDI, SFX, and Cutscene landscape shells now rely on the shared left-origin root drawer default instead of each restating rootDrawerOverlayOrigin: left, reducing per-editor layout drift while preserving the requested landscape left-root/right-submenu model.',
    '2026-07-02 17:20 EDT - SFX landscape now renders the left-origin root drawer and right submenu as separate shared shell surfaces: opening Menu shows roots on the left while the active SFX submenu remains on the right, matching the requested landscape model instead of reusing the right-panel renderer for root menu content.',
    '2026-07-02 17:17 EDT - Started the SFX landscape rail cleanup pass by isolating how root-drawer state affects the waveform work surface; the follow-up 17:20 entry supersedes the interim rail-reservation approach with the final left-root/right-submenu split.',
    '2026-07-02 17:13 EDT - Race playtest now separates car yaw from road yaw: steering rotates an explicit car/camera heading through the world-space road projection, so full 360-degree courses can turn like a first-person/F-Zero-style camera instead of auto-centering every segment into a straight-ish ribbon.',
    '2026-07-02 17:10 EDT - MIDI portrait/mobile tab hit registration now uses a shared-derived workspace tab set instead of repeating literal File/Settings exclusions, keeping tab hit targets aligned with the same MIDI controller root entries used by desktop, landscape, and gamepad menus.',
    '2026-07-02 17:08 EDT - MIDI landscape right-drawer routing now derives File/View/Record/Settings drawer ownership from the shared MIDI controller root entries instead of a literal runtime tab list, preserving the Record -> virtual-instruments alias across desktop, landscape, and gamepad menu paths.',
    '2026-07-02 17:05 EDT - Pixel Editor mobile drawer-opening tabs now derive from the shared Pixel left-panel/controller tab list, excluding only desktop-only Edit/View roots, so the mobile drawer, landscape roots, desktop panel tabs, and controller roots stay on the same shared menu source.',
    '2026-07-02 17:03 EDT - Level Editor now derives its persistent desktop panel tabs and mobile drawer tabs from the shared Level controller root entries, with the embedded MIDI panel appended explicitly; the desktop draw path also now defines the active panel tab before rendering the shared desktop ribbon/context shell.',
    '2026-07-02 17:00 EDT - Pixel Editor now derives its persistent left-panel and landscape root menu tabs from the shared Pixel controller root entries instead of a copied hardcoded root list, keeping File/Edit/View/Draw/Select/Tools/Canvas/Layers/Frames/Rigging aliases aligned across desktop, landscape, portrait, and gamepad paths.',
    '2026-07-02 16:57 EDT - Cutscene landscape and gamepad root menus now render from the shared cutscene controller root entries instead of a raw root-id list, so labels, source ids, and submenu routing stay aligned with the shared editor menu spec across portrait, landscape, desktop, and controller paths.',
    '2026-07-02 16:54 EDT - Race playtest road rendering now builds real world-space left/right road edges before projecting them through the camera, so sharp turns and full 360-degree routes can wrap around the car like a first-person pseudo-3D track instead of collapsing into a mostly straight screen-space ribbon.',
    '2026-07-02 16:49 EDT - Race playtest rendering now projects a world-space track path through camera yaw, so square turns and multi-turn routes can rotate the view around the car instead of offsetting a mostly straight road; canvas right-click suppression also now routes through the shared editor pointer policy.',
    '2026-07-02 16:42 EDT - Actor Editor desktop chrome now overrides its generic mobile/tool button gradients with flatter RTG Studio top-menu and dropdown styling, keeping the DOM editor visually closer to the shared canvas desktop app shell without changing portrait behavior.',
    '2026-07-02 16:35 EDT - Race playtest now treats destination races as finishable point-to-point routes instead of wrapping forever, renders road material separately from editor surface swatches, samples future track yaw so left/right turns bend the camera view, adds a compact left minimap, and brings Race portrait back to the shared Menu/Undo/Redo/Play bottom rail.',
    '2026-07-02 15:28 EDT - Race Editor and Car Editor landscape layout now uses the shared gamepad menu state to decide controller-owned right-rail reservation and slide-out rendering, rather than branching directly on raw controller connection.',
    '2026-07-02 15:26 EDT - SFX gamepad slide-out menus now suppress stale virtual thumbstick hit targets as well as the drawn thumbstick, so controller submenu interaction on the left rail cannot be intercepted by the hidden mobile pan control.',
    '2026-07-02 15:23 EDT - SFX gamepad landscape no longer reserves an invisible right submenu rail when the controller submenu slides out on the left, giving the waveform work surface the space that touch landscape reserves for its right drawer.',
    '2026-07-02 15:21 EDT - Car Editor portrait and landscape now keep Race-only builder controls out of the work surface, so the shared Race/Car shell no longer leaks Generate/Add/Curve/Hill/Surface track-authoring buttons into Car tuning views.',
    '2026-07-02 15:17 EDT - Race Editor authoring now opens on a top-down track editor instead of the pseudo-3D preview: it draws a grayscale height-map grid, surface-colored road tiles, selectable track nodes, crest/dip markers, and hard-turn markers while keeping playtest in the F1 Pole Position-style renderer.',
    '2026-07-02 15:11 EDT - Race Editor and Car Editor desktop context panels are now explicitly covered by the shared context-panel contract: their left inspector uses Active language, shows race/car-specific details, and stays distinct from duplicated desktop drawer commands.',
    '2026-07-02 15:09 EDT - Race Editor and Car Editor gamepad root drawers now use the shared gamepad slide-out header chrome instead of hand-drawing the A/B hint row, matching the controller menu header treatment used by the established editors.',
    '2026-07-02 15:07 EDT - Race Editor and Car Editor gamepad landscape submenus now render from the shared buildGamepadSlideOutMenuPlan submenu items, keeping controller root aliases and submenu contents centralized in the shared gamepad plan instead of rebuilding from local active-root state.',
    '2026-07-02 15:05 EDT - Race Editor and Car Editor desktop draw now resolve dropdown state through the shared desktop dropdown helper instead of hand-building the shell dropdown/null state, matching the lifecycle used by the older shared-shell editors.',
    '2026-07-02 15:03 EDT - Race Editor and Car Editor are now explicitly covered by the source-level desktop shared-shell invariant, proving they use the same top menu, left ribbon, left context panel, work surface, and dropdown painter contract as the established canvas editors.',
    '2026-07-02 15:01 EDT - Car Editor is now explicitly named in the broad desktop dropdown auto-open guard coverage, so the shared desktop app menu contract protects Race and Car independently even though they share the same implementation file.',
    '2026-07-02 14:59 EDT - Race physics now uses 2022 Subaru WRX-style car data and drivetrain simulation: manual 6MT and automatic SPT cars, AWD, 271 hp, 258 lb-ft, realistic mass, redline/rev limiter, gear ratios, shift delays, rain/snow grip multipliers, day/night race metadata, roughly 5-6 second 0-60, and about 135 mph top speed.',
    '2026-07-02 14:51 EDT - Shared desktop File/Edit menu contract coverage now includes Race Editor and Car Editor, locking their common New/Save/Save As/Open/Export/Import baseline and editor-specific Edit drawers into the same shared spec assertions as the older editors.',
    '2026-07-02 14:49 EDT - Race playtest steering now targets an F1 Pole Position-style presentation: steering builds a near-road sweep while the vanishing point stays stable, car sprite strafe is reduced, and the chase sprite reads more like a compact Formula car instead of a broad arcade car.',
    '2026-07-02 14:46 EDT - Broad portrait root menu coverage now treats Race Editor and Car Editor as first-class shared-shell editors, using the shared portrait root menu spec to keep their bottom menu roots within the eight-item contract.',
    '2026-07-02 14:44 EDT - Shared compact landscape command rail coverage now verifies disabled/onClick/primary metadata survives the helper path, protecting all editors that use the four-button landscape rail from live-looking inert buttons.',
    '2026-07-02 14:41 EDT - Race Editor and Car Editor direct portrait/landscape rails now disable unavailable Undo/Redo history commands instead of rendering them as live buttons that only produced no-op status text.',
    '2026-07-02 14:37 EDT - Race Editor and Car Editor now collapse gamepad-only menu state when the controller disconnects, preventing stale left-slide submenu flags from surviving into touch landscape mode.',
    '2026-07-02 14:35 EDT - Race Editor and Car Editor mobile layouts now clear stale desktop dropdown state through the same shared resolver as the older shared-shell editors when leaving desktop mode.',
    '2026-07-02 14:33 EDT - Race playtest now starts in Neutral, supports Reverse/Neutral/1-6 gear states, lets G rev the engine without requiring Up, treats touch pointer id 0 as a valid held G/R input, separates diagonal steering from vertical shifts, shrinks the HUD, and uses a stable Pole Position-style vanishing point instead of F-Zero-style camera yaw.',
    '2026-07-02 14:22 EDT - Race desktop left-panel commands now use release-only activation: End Drive no longer ends the session on pointer-down, drag-off cancels it, and the behavior matches the desktop dropdown release lifecycle.',
    '2026-07-02 14:19 EDT - Race desktop playtest pointer routing now preserves desktop dropdown press/release semantics: top drawers can open during playtest, drawer commands wait for pointer release, and the mobile handheld controls remain on the playtest-specific touch path.',
    '2026-07-02 14:17 EDT - Race desktop playtest no longer places End Drive over the race preview; the session control now lives in the left desktop context panel so the work surface stays clean while the exit remains visible.',
    '2026-07-02 14:15 EDT - Race Editor and Car Editor desktop work surfaces no longer duplicate route/play commands in an over-canvas builder strip; desktop commands stay in the top dropdown drawers and passive left context panels, while touch portrait/landscape keep direct Generate/Add/Curve/Hill/Surface/Play shortcuts.',
    '2026-07-02 14:13 EDT - Race Editor and Car Editor desktop top menus now have rendered coverage for normal desktop hover-switch behavior: after opening File, hovering Road or Drivetrain switches the open dropdown drawer without mutating the persistent left context panel.',
    '2026-07-02 14:11 EDT - Race Editor and Car Editor are now explicitly covered by the shared controller root/menu parity tests: their gamepad roots resolve through the same helper path as the older editors, and rendered Car gamepad landscape now verifies the submenu replaces the left rail instead of appearing on the right.',
    '2026-07-02 14:07 EDT - Race Editor and Car Editor landscape root Menus now use the same shared all-visible root drawer grid as Pixel, Level, Actor, MIDI, SFX, and Cutscene, keeping their main categories visible without unnecessary left-menu scrolling while preserving gamepad slide-out submenu behavior.',
    '2026-07-02 13:59 EDT - Race Editor playtest and authoring got a direct usability pass: route-building controls now sit on the race work surface, desktop playtest renders the live race screen, the in-race HUD is smaller, acceleration/auto-shift are less coupled to steering input, and Mode 7 speed/curve/elevation cues are stronger.',
    '2026-07-02 13:56 EDT - Removed the unused Race/Car one-off compact shell with its custom top bar, Back button, sidebar, and preview layout; Race and Car now only keep the shared desktop, portrait, landscape, gamepad, and handheld playtest render paths, with regression coverage rejecting the stale compact shell.',
    '2026-07-02 13:54 EDT - The shared desktop pointer policy now treats Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car as app work surfaces with wheel zoom, middle/right-drag pan, browser context-menu suppression, fallback pan, and no desktop thumbstick; coverage now loops every editor so new shared-shell editors cannot fall off the desktop mouse contract.',
    '2026-07-02 13:51 EDT - Race Editor and Car Editor desktop left panels are now passive inspectors instead of duplicated command surfaces: Generate/Add/Play remain in mobile rails and desktop top drawers, while the left column now shows selected segment/car details such as surface, length, tire grip, and final drive.',
    '2026-07-02 13:49 EDT - Race Editor portrait now puts Generate, Add, and Play directly on the bottom rail, Race landscape swaps the compact quick action to Generate, playtest throttle input now uses held/pulsed input state instead of feeling tied to d-pad presses, auto-shift assist prevents G from feeling stalled in low gears, and Mode 7 playtest motion/hill cueing is stronger while keeping the HUD compact.',
    '2026-07-02 13:46 EDT - Race Editor and Car Editor now clear stale desktop dropdown state through the shared desktop dropdown resolver, expose gamepad landscape state through the shared gamepad state object instead of a legacy wrapper, and the broad editor menu-model coverage includes Race/Car in the same shared desktop/gamepad source contracts as the other editors.',
    '2026-07-02 13:40 EDT - The broad editor UI layout contract suite is green again: Level, SFX, Pixel, and Cutscene desktop dropdown assertions now match the current shared command-hit helper path, and Race/Car desktop top-menu/context-panel coverage is included through the shared RaceEditor shell.',
    '2026-07-02 13:37 EDT - Race playtest HUD overlays are now much smaller, throttle revs the tach before road speed catches up, Mode 7 playtest motion has faster stripes/roadside markers/stronger curve and elevation cues, and Race Editor now opens on race-building controls with visible Generate/Add Segment shortcuts in portrait, landscape, and desktop context surfaces.',
    '2026-07-02 13:28 EDT - Race playtest now has a needle tachometer with a redline marker, visible pressed states for G/R controls, keyboard G/R/arrow driving support, forward-sampled Mode 7 road bands, animated braking/front-wheel steering, and a top-down per-component damage diagram for wheels, suspension, panels, engine, and transmission.',
    '2026-07-02 13:20 EDT - Desktop dropdown command metadata now has a shared createDesktopDropdownCommandHit helper, and MIDI, SFX, Cutscene, Race, and Car use it for consistent release-hit records instead of hand-building row objects.',
    '2026-07-02 13:15 EDT - Actor Editor desktop dropdown rows now expose DOM command metadata matching the canvas editors, and rendered desktop coverage now includes Actor in the File -> New release-activation contract.',
    '2026-07-02 13:13 EDT - MIDI and Cutscene desktop dropdown rows now expose the same stable command id, action, nested bounds, and desktop-dropdown metadata as the other canvas editors; unit coverage now locks this command metadata contract for Pixel, Level, MIDI, SFX, Cutscene, Race, and Car.',
    '2026-07-02 13:10 EDT - Desktop dropdown command plumbing is now more consistent: Pixel, Level, and SFX desktop drawer rows carry stable command ids/action metadata, and rendered layout coverage now verifies File -> New fires on pointer release, not pointer down, across Level, Pixel, MIDI, SFX, Cutscene, Race, and Car.',
    '2026-07-02 13:07 EDT - Race Editor now has Generate Random Race in the Race drawer, creating a point-to-point course with varied turn severity, surfaces, guaranteed crests/jumps, hazards, and co-driver calls that can immediately be playtested.',
    '2026-07-02 13:07 EDT - Race playtest now shows a racing HUD with time/lap in the upper right, tachometer/gear/progress in the lower right, and car status in the lower left; panels, engine, transmission, tires, and suspension now accumulate damage/wear that affects acceleration, grip, shift delay/gear failure, and steering pull.',
    '2026-07-02 12:59 EDT - Race Editor road tools now edit real race data: Draw Road appends/selects segments, Road controls cycle length/curve/elevation/square-turn/width, Surface controls paint the selected segment, and preview/context panels show the active segment instead of scaffold-only messaging.',
    '2026-07-02 12:59 EDT - Race playtest now uses the shared Game Boy/Game Gear shell renderers when available, drives the road from playtest distance, hides preview scaffold text and the large editor HUD on mobile, moves the car laterally, slows steering response, auto-centers released steering, and switches first/third person from Select instead of the pause menu.',
    '2026-07-02 12:52 EDT - Rendered desktop coverage now opens the real File drawer in Level, Pixel, MIDI, SFX, Cutscene, Race, Car, and Actor and verifies the shared New, Save, Save As, Open, Export, Import baseline rows appear below the top bar with no mobile rails.',
    '2026-07-02 12:50 EDT - Rendered gamepad landscape coverage now opens real controller submenus in Pixel, Level, MIDI, SFX, Cutscene, and Actor and verifies the submenu renders on the left slide-out rail instead of a right rail or desktop dropdown.',
    '2026-07-02 12:51 EDT - Shared landscape layout coverage now verifies Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car root drawers fit every root category in the phone-landscape left-origin drawer without forcing main-menu scrolling.',
    '2026-07-02 12:45 EDT - Race and Car now use Drive as the shared desktop/root menu id instead of the stale internal test root, while keeping the Playtest action compatible with the existing race controls.',
    '2026-07-02 12:42 EDT - RaceEditorSpec.md no longer describes the old End Test editor-preview flow; the spec now calls the current mobile playtest a handheld race surface with Drive/Playtest language.',
    '2026-07-02 12:39 EDT - UISpec.md and RaceEditorSpec.md now use Drive/Playtest language for Race and Car instead of the older Test Drive wording, matching the current handheld race playtest surface.',
    '2026-07-02 12:36 EDT - Race Editor mobile Playtest now opens as a playable handheld race surface: portrait uses the Game Boy-style frame, landscape uses the Game Gear-style frame, G accelerates, R brakes, double-tap R handbrakes, d-pad/analog steer and shift gears, and pause can switch third-person/first-person camera.',
    '2026-07-02 12:29 EDT - Race Editor and Car Editor desktop dropdown rows now use the shared pending-hit press/release lifecycle, so commands fire on release instead of pointer-down and drag-off suppresses activation.',
    '2026-07-02 12:25 EDT - Race Editor and Car Editor portrait bottom rails now use the shared portrait action rail helper, matching the established editor rail layout while preserving their four-button Menu/Undo/Redo/Test flow.',
    '2026-07-02 12:23 EDT - MIDI portrait thumbstick state now stays owned by the shared bottom action rail after draw, so the visible portrait control keeps its hit target while desktop still clears mobile thumbstick state.',
    '2026-07-02 12:21 EDT - MIDI portrait now matches the SFX/Level/Cutscene portrait rail contract: the shared bottom action rail owns the thumbstick, while the separate pan joystick is limited to mobile landscape.',
    '2026-07-02 12:18 EDT - SFX portrait now lets the shared bottom action rail own the thumbstick and action buttons, removing the duplicate portrait pan-joystick draw that could visually collide with Generate/Layers/Settings menu content.',
    '2026-07-02 12:14 EDT - Rendered mobile gamepad landscape coverage now exercises Race Editor and Car Editor slide-out behavior: root selection collapses the left root rail, submenu commands replace it on the left, and no right submenu appears.',
    '2026-07-02 12:12 EDT - Rendered mobile landscape coverage now exercises Race Editor and Car Editor menu interaction: Menu opens the left root drawer, root selection keeps it open, submenu commands appear on the right, and Test stays in the bottom rail.',
    '2026-07-02 12:10 EDT - Rendered mobile portrait layout coverage now spans Level, Pixel, MIDI, SFX, Cutscene, Race, Car, and Actor, checking bottom-first menus and rejecting desktop/gamepad chrome in portrait mode.',
    '2026-07-02 12:08 EDT - The rendered desktop-with-controller layout contract now includes Actor Editor, verifying it keeps desktop top menus and does not render gamepad slide-out, portrait sheet, or landscape right-rail chrome on desktop.',
    '2026-07-02 12:06 EDT - Race Editor and Car Editor now expose the same shared gamepad mode helper predicates as the other canvas editors, and rendered desktop-with-controller coverage now includes every canvas editor instead of only Level and MIDI.',
    '2026-07-02 12:03 EDT - Car Editor landscape touch now has explicit regression coverage matching Race Editor: root drawer remains on the left, Art submenu commands stay on the right, and Test remains in the bottom rail.',
    '2026-07-02 12:01 EDT - Race Editor and Car Editor landscape bottom rails now show persistent race/car status plus Test/End Test controls instead of duplicating the active right-rail submenu commands.',
    '2026-07-02 11:59 EDT - Race Editor and Car Editor landscape touch now keep the root drawer open on the left while the selected submenu updates on the right, matching the shared landscape contract; gamepad still replaces the left rail with the submenu.',
    '2026-07-02 11:56 EDT - Cutscene desktop top-menu active state no longer falls back to the active cutscene tab when no drawer is open; rendered desktop layout coverage now cycles every canvas editor top drawer open and closed through its registered hit target.',
    '2026-07-02 11:53 EDT - Race Editor Test Drive now starts a visible in-editor playtest HUD after the car picker: the session advances route distance and speed from selected car tuning, shows AI/hazard/co-driver state, displays next co-driver and hazard cues, and can be ended from the preview.',
    '2026-07-02 11:49 EDT - RaceEditorSpec.md now explicitly covers Race Editor playtesting with a Car Editor car picker, optional AI racers, solo runs, combat hazards, jumps, damage walls, and co-driver calls; desktop layout regression coverage now inspects every known top-menu button store and Actor click-away behavior.',
    '2026-07-02 11:46 EDT - Race Editor and Car Editor touch/gamepad menu drawers now keep overflowing root/submenu/tool rows scrollable instead of clipping hidden commands; wheel and drag scrolling update shared menu scroll state, and tap-release still activates rows only when the pointer did not move past the drag threshold.',
    '2026-07-02 11:42 EDT - UISpec.md and ui/EDITORS_UI_CONTRACT.md now document the shared desktop File drawer baseline directly: New, Save, Save As, Open, Export, Import, with unsupported baseline actions remaining visible as disabled inert rows; doc regression tests now lock that wording.',
    '2026-07-02 11:39 EDT - Race Editor and Car Editor menu rows now distinguish implemented scaffold commands from planned commands: unavailable File/road/tuning/etc. actions render disabled across desktop and touch drawers instead of acting like live no-op buttons, while implemented actions such as New, drivetrain, weather, race type, finish return, exit, and Test Drive remain clickable.',
    '2026-07-02 11:35 EDT - Shared editor File menu specs now require the same desktop baseline order across Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car: New, Save, Save As, Open, Export, Import, then editor-specific extras and Exit; Actor keeps unsupported Import/Export visible as disabled standard rows instead of hiding them.',
    '2026-07-02 11:32 EDT - UISpec.md and the editor UI contract now explicitly require desktop dropdown drawers to start closed, open only from top-menu interaction, and remain closed after click-away redraw; source-level tests now reject passing active panels/tabs as default open desktop roots.',
    '2026-07-02 11:28 EDT - Desktop editor menus across Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car now share a proper desktop-app default: top menus are visible, drawers start closed, and drawers only open from explicit top-menu interaction instead of following the active editor panel.',
    '2026-07-02 11:24 EDT - Race Editor and Car Editor desktop top menus now behave like normal desktop menus: drawers start closed, open from the top menu, hover-switch while open, and stay closed after click-away instead of forcing the File drawer back open.',
    '2026-07-02 11:21 EDT - Race Editor and Car Editor gamepad landscape now follow the shared slide-out contract: Menu opens the left root drawer, choosing a root replaces it with the selected submenu on the left, and B/cancel backs from submenu to root before closing the menu.',
    '2026-07-02 11:18 EDT - Race Editor Test Drive now opens a car picker backed by Car Editor data and creates a playtest session containing the selected car, enabled AI racers, race hazards, and co-driver calls; race data now models solo/AI/combat modes, zombie packs, jumps, damage walls, and co-driver instructions.',
    '2026-07-02 11:12 EDT - Race Editor and Car Editor compact modes now use shared portrait bottom action rails and shared landscape left-rail/right-submenu/bottom-rail surfaces instead of the original one-off mobile top-bar layout.',
    '2026-07-02 11:08 EDT - UISpec.md and the editor UI contract now list Race Editor and Car Editor as first-class shared-shell editors, with tests locking their canonical root menus and desktop contract coverage.',
    '2026-07-02 11:04 EDT - Race Editor and Car Editor now participate in the shared editor menu spec and desktop shell contract, using the common top menu, dropdown drawer, ribbon, and left context panel primitives instead of a one-off desktop bar.',
    '2026-07-02 10:59 EDT - Game menu now includes first-class Race Editor and Car Editor entries, with a shared race/car data scaffold, Mode 7-style preview surface, drivetrain/tuning defaults, and RaceEditorSpec.md documenting the staged racing engine plan.',
    '2026-07-02 10:51 EDT - Game menu now exposes Tile Editor again, and tile definitions are shared/data-driven so Tile Editor property overrides can change solidity, one-way behavior, slipperiness, conveyor speed/direction, hazards, liquids, elevator metadata, and destructible metadata in the game engine.',
    '2026-07-02 10:44 EDT - Main menu Options now opens a clean hub with separate Controls and Display submenus, keeping Songs and Latest Changes at the top-level Options screen.',
    '2026-07-02 10:37 EDT - Pixel layer and frame list labels now use shared RTG Studio text and font tokens through the fitted-label helper instead of legacy Courier typography in desktop/right-rail workflow panels.',
    '2026-07-02 10:34 EDT - Cutscene timeline horizontal and vertical scrollbars now use shared RTG Studio panel, border, and accent tokens instead of raw translucent/hand-colored scrollbar chrome.',
    '2026-07-02 10:32 EDT - SFX waveform control wells, layer/frame strips, and the custom waveform editor now use shared RTG Studio panel and border chrome instead of raw translucent hand-drawn panels.',
    '2026-07-02 10:30 EDT - Level Editor mobile/landscape drawer content and tile/prefab/enemy picker preview labels now use shared RTG Studio panelAlt, panel, border, text, and font tokens instead of hand-drawn translucent/Courier UI chrome.',
    '2026-07-02 10:27 EDT - MIDI instrument lists, instrument settings, and embedded track mixer rows now use shared RTG Studio panelAlt, panel, border, text, muted, accent, and font tokens instead of legacy black/white/Courier workflow chrome.',
    '2026-07-02 10:22 EDT - Level Editor Settings now exposes MIDI as a real shared Settings command, and both desktop/controller panel drawers and portrait/mobile drawers route it through setPanelTab("midi") so the MIDI grid opens immediately.',
    '2026-07-02 10:19 EDT - MIDI Settings and Controller Help panels now use shared RTG Studio panelAlt, border, text, muted, and font tokens instead of editor-local surface/Courier drawer chrome.',
    '2026-07-02 10:17 EDT - MIDI pedal board overview and pedal picker now use shared RTG Studio panelAlt, border, text, muted, and font tokens instead of editor-local surface/Courier chrome.',
    '2026-07-02 10:14 EDT - Pixel tool options, canvas switches, background controls, and hue/saturation rail labels now use shared RTG Studio text, muted, panelAlt, border, and font tokens instead of legacy white/Courier panel styling.',
    '2026-07-02 10:12 EDT - Pixel paste-import preview cards and layer preview panel now use shared RTG Studio panelAlt, border/accent, text, muted, and font tokens instead of hand-drawn black/Courier chrome.',
    '2026-07-02 10:11 EDT - Cutscene editor draw-recovery screen now uses the shared RTG Studio background, panelAlt, border, text, muted, and font tokens instead of hardcoded dark/Courier styling.',
    '2026-07-02 10:09 EDT - Pixel tile picker screen labels now use shared RTG Studio text, muted, and font tokens instead of legacy white/Courier styling.',
    '2026-07-02 10:07 EDT - Pixel brush picker modal now uses the shared RTG Studio panelAlt shell and font token instead of hand-drawn panel chrome and raw monospace text.',
    '2026-07-02 10:04 EDT - Level Editor HUD overlays, music/trigger labels, radial labels, preview captions, enemy info, and tooltips now use shared RTG Studio text, muted, border, and font tokens instead of legacy white/Courier styling.',
    '2026-07-02 10:01 EDT - SFX settings, envelope, and action rail labels now use shared RTG Studio muted text and font tokens instead of legacy white Courier styling.',
    '2026-07-02 09:59 EDT - MIDI portrait track picker, master volume, and record settings panels now use shared RTG Studio panelAlt and border tokens instead of legacy hardcoded dark panel fills.',
    '2026-07-02 09:56 EDT - MIDI note-length picker and tempo slider popovers now use shared RTG Studio panelAlt, border, text, and font tokens instead of old hardcoded dark/Courier chrome.',
    '2026-07-02 09:54 EDT - MIDI Settings dialog shell now uses shared RTG Studio panelAlt, border, text, and font tokens instead of the old hardcoded dark/Courier modal chrome.',
    '2026-07-02 09:52 EDT - Pixel transform and paste-import modal shells now use shared RTG Studio panelAlt, border, text, and font tokens instead of hardcoded dark/Courier chrome.',
    '2026-07-02 09:49 EDT - Level Editor random/resize level dialog now uses shared RTG Studio panel, border, text, muted, and font tokens instead of the older black/Courier modal chrome.',
    '2026-07-02 09:47 EDT - Pixel landscape zoom control now uses the shared RTG Studio panelAlt surface instead of its old hardcoded dark panel fill.',
    '2026-07-02 09:45 EDT - MIDI tab and transport rails now use shared RTG Studio panelAlt, text, accent, and font tokens instead of the older editor-shell translucent surface and Courier labels.',
    '2026-07-02 09:44 EDT - SFX waveform and timeline labels now use shared RTG Studio text, muted color, and font tokens instead of legacy Courier/white styling.',
    '2026-07-02 09:41 EDT - MIDI portrait quick controls and landscape horizontal zoom rails now use the shared RTG Studio panelAlt surface instead of the older editor-local translucent black shell color.',
    '2026-07-02 09:39 EDT - Cutscene editor shell chrome now uses shared RTG Studio background and panelAlt tokens for the canvas, timeline, and action strip instead of legacy hardcoded dark fills.',
    '2026-07-02 09:35 EDT - MIDI desktop transport chrome now uses the shared RTG Studio panelAlt token directly, with a regression check preventing the left desktop transport panel from drifting back to editor-local shell colors.',
    '2026-07-02 09:35 EDT - Level Editor Settings -> MIDI now switches the active editor mode to MIDI when the tab is selected, so the MIDI grid and controls open immediately instead of only changing the drawer label.',
    '2026-07-02 09:31 EDT - Cutscene desktop, controller, and landscape drawer labels now resolve through one shared menu-label helper instead of repeating separate raw-id fallbacks.',
    '2026-07-02 09:27 EDT - SFX desktop ribbon subtitles now use the shared root menu label map, matching the context panel instead of hand-title-casing raw tab ids.',
    '2026-07-02 09:24 EDT - Cutscene desktop ribbon subtitles now use the same human-readable desktop menu labels as the context panel instead of raw uppercase menu ids.',
    '2026-07-02 09:22 EDT - SFX desktop transport panel labels now use shared RTG Studio font and muted text tokens instead of leftover Courier styling.',
    '2026-07-02 09:19 EDT - MIDI desktop transport labels now use shared RTG Studio font and text color tokens instead of leftover Courier/white styling.',
    '2026-07-02 09:16 EDT - Pixel desktop Layers and Frames utility labels now use shared RTG Studio typography and text color tokens instead of the older white Courier styling.',
    '2026-07-02 09:14 EDT - Pixel desktop now keeps Layers persistently on the right rail while Frames stay in the bottom strip, matching the desktop app layout instead of swapping the right rail by active menu.',
    '2026-07-02 09:09 EDT - Level portrait Settings -> MIDI now registers MIDI as a real panel tab, so the submenu opens the MIDI controls instead of dropping the tap.',
    '2026-07-02 09:06 EDT - Actor landscape now splits the left-origin root drawer from the right submenu rail, so opening the main Menu no longer consumes the submenu surface.',
    '2026-07-02 09:03 EDT - Actor portrait Menu now opens the bottom root sheet even when the active Actor/Settings section has no right-rail content.',
    '2026-07-02 09:03 EDT - SFX portrait menus now clip registered hit targets to the visible sheet, remove the overlapping Layer ribbon, and move Custom waveform editing higher in Generate.',
    '2026-07-02 08:58 EDT - Pixel landscape no longer uses a work-surface root-menu exception; it now opens the main Menu from the left drawer and shows the selected submenu on the right while keeping zoom/tools in the bottom rail.',
    '2026-07-02 08:53 EDT - MIDI Record portrait exits now route File, Settings, Grid, Song, Mixer, and Pedals through mobile panel activation instead of desktop dropdowns.',
    '2026-07-02 08:51 EDT - MIDI portrait root buttons now activate mobile panels directly, restoring Grid, Song, Mixer, Record, and Pedals navigation instead of opening desktop dropdown state.',
    '2026-07-02 08:48 EDT - Cutscene static storage hydration now resolves relative image asset refs against the served storage path, so cutscenes such as c3 remain visible and openable from the Cutscene editor.',
    '2026-07-02 08:48 EDT - Cutscene portrait File menus now filter divider rows before drawing touch buttons, removing the blank button cell from the portrait menu.',
    '2026-07-02 08:44 EDT - Actor desktop shell coverage now explicitly rejects rendering the landscape bottom rail on desktop, tightening the no-mobile-rails desktop contract.',
    '2026-07-02 08:42 EDT - Actor desktop dropdown scrolling now keys off the open top-menu drawer root like the canvas editors, removing the last active-left-panel fallback from the shared desktop shell test.',
    '2026-07-02 08:40 EDT - UISpec and the editor UI contract now lock Pixel landscape zoom to the bottom control rail, with tests preventing a drift back to the separate top zoom strip.',
    '2026-07-02 08:35 EDT - Pixel landscape now keeps the four-button left rail fixed, removes the separate top zoom strip, and folds zoom into the bottom control rail so the Menu overlay, zoom, and bottom tools do not fight for space.',
    '2026-07-02 08:33 EDT - MIDI desktop Pedals view now shows each pedal knob label and value inline on the board, while compact/mobile pedal cards keep the simpler dot treatment.',
    '2026-07-02 08:30 EDT - Cutscene File menu rows now pass New/Open/Save/Save As/Import/Export handlers into the shared File model, making desktop dropdowns and touch/controller drawers agree on live commands.',
    '2026-07-02 08:28 EDT - MIDI portrait layouts now expose the same bottom-root `rootTabs` and upper-content `subRail`/`sheetContent` contract as the other editors without changing the existing portrait geometry.',
    '2026-07-02 08:25 EDT - Actor desktop dropdown styling now keeps its RTG Studio scroll containment in the main desktop dropdown rule, reducing DOM editor style drift from the shared desktop chrome.',
    '2026-07-02 08:22 EDT - Level, MIDI, SFX, and Cutscene landscape root Menus now match Pixel and Actor by rendering fixed all-visible category grids instead of scrollable root pickers.',
    '2026-07-02 08:17 EDT - Pixel landscape root navigation now opens as a left-anchored all-visible Menu panel from the four-button rail, removing the right-rail flash and root-menu scrolling.',
    '2026-07-02 08:14 EDT - Level landscape input bounds now use the same left-root/right-submenu shell surfaces as rendering, keeping drawer hit regions and zoom rails aligned with the visible layout.',
    '2026-07-02 08:11 EDT - Cutscene landscape now reserves the shared right submenu rail for clip/options panels while keeping the root Menu on the left-origin drawer and preserving gamepad slide-out behavior.',
    '2026-07-02 08:08 EDT - Actor landscape now reserves the shared right submenu rail for contextual options while keeping the root Menu on the left-origin drawer and preserving gamepad slide-out behavior.',
    '2026-07-02 08:05 EDT - Level landscape now splits root Menu and selected panel drawers across the shared shell: root categories expand from the left rail, while active panel content reserves the right submenu rail.',
    '2026-07-02 08:01 EDT - MIDI landscape right utility drawers now use the shared reserved submenu rail when active, while the root Menu remains a left-origin drawer and the grid keeps full width when no utility drawer is open.',
    '2026-07-02 07:59 EDT - Shared landscape shells can now keep the full root Menu as a left-origin overlay while reserving a real right submenu rail; SFX landscape is the first editor migrated to that stronger contract.',
    '2026-07-02 07:53 EDT - Pixel landscape Menu now opens as a stable work-surface overlay instead of a right rail, while the fixed four-button left rail and separate top zoom rail remain intact.',
    '2026-07-02 07:49 EDT - MIDI portrait grid quick controls now bottom-align inside their rail, keeping secondary portrait controls consistent with the bottom-first editor menu contract.',
    '2026-07-02 07:47 EDT - Shared desktop dropdown render plans now dedupe repeated action ids before drawing clickable rows, preventing editor-local action builders from showing duplicate desktop menu commands.',
    '2026-07-02 07:44 EDT - Cutscene desktop left context/transport panel is now named and tested as left options instead of a menu panel, matching the shared desktop app contract.',
    '2026-07-02 07:42 EDT - Cutscene landscape now clears stale portrait thumbstick state before drawing its landscape shell, preventing invisible thumbstick hit zones beside landscape drawers.',
    '2026-07-02 07:39 EDT - MIDI landscape now suppresses the touch pan thumbstick while its root drawer is open, matching the shared menu-owned rail behavior in Level and SFX.',
    '2026-07-02 07:37 EDT - Level landscape now suppresses the touch pan thumbstick while any mobile menu drawer is open, matching the SFX drawer-owned rail behavior.',
    '2026-07-02 07:33 EDT - SFX landscape now suppresses the touch pan thumbstick while the root menu drawer is open, preventing the menu surface and virtual joystick from competing for the left rail.',
    '2026-07-02 07:30 EDT - UISpec and the editor UI contract now document Pixel landscape as the deliberate right-overlay root-menu exception while preserving the shared fixed four-action left rail contract.',
    '2026-07-02 07:28 EDT - Pixel landscape keeps the compact four-button left rail fixed while the full Menu drawer opens as a right-side overlay again, avoiding the scroll-heavy left main menu.',
    '2026-07-02 07:26 EDT - Gamepad B now only backs out of active menus; after selecting a command and returning to the editor surface, it no longer reopens the root menu.',
    '2026-07-02 07:23 EDT - Actor Linked Parts desktop drawer now opens the real Link Child Actor workflow instead of generic actor settings.',
    '2026-07-02 07:19 EDT - SFX shared Generate menu spec no longer includes the duplicate Open Generate navigation row.',
    '2026-07-02 07:16 EDT - Actor desktop top-menu open and close helpers now use the stored shared dropdown snapshot.',
    '2026-07-02 07:14 EDT - Actor desktop now records and clears dropdown state through the same shared resolver as the canvas editors.',
    '2026-07-02 07:11 EDT - All editor landscape command rails now render compact portrait-style Menu, Undo, and Redo symbols while keeping full command labels for semantics.',
    '2026-07-02 07:05 EDT - Pixel landscape zoom is now hard-bound to the top zoom rail so it cannot fall back onto the bottom palette/tool rail.',
    '2026-07-02 07:00 EDT - UISpec and the editor UI contract now document the fixed 84px landscape command rail and remove stale placeholder menu rows.',
    '2026-07-02 06:58 EDT - MIDI and SFX shared menu specs no longer list stale Open-current-panel rows that runtime drawers intentionally removed.',
    '2026-07-02 06:55 EDT - MIDI portrait rail actions now use the same canonical Menu, Undo, Redo, Play ids as the other editors while preserving existing hit targets.',
    '2026-07-02 06:52 EDT - The shared four-button landscape command rail is now fixed, while full drawers and tool panels remain gesture-scrollable.',
    '2026-07-02 06:50 EDT - Shared mobile landscape shells now default to an 84px portrait-style command rail across editors instead of wide left menu rails.',
    '2026-07-02 06:47 EDT - Pixel landscape now uses a narrow portrait-style four-button command rail, while desktop dropdown release-close behavior is covered across canvas editors.',
    '2026-07-02 06:44 EDT - Shared gamepad slide-out plans now use controller root entries, so alias submenu ids match the editor controller menus.',
    '2026-07-02 06:41 EDT - Shared controller root entries now carry controller submenu ids, removing the remaining Pixel-specific Frames/Rigging mapper.',
    '2026-07-02 06:35 EDT - Editor controller root ids and root label maps now come from shared menu-spec helpers instead of repeated per-editor mapping code.',
    '2026-07-02 06:26 EDT - Level, MIDI, SFX, and Cutscene desktop dropdowns now use live controller/action menu rows only, with mobile/spec fallback rows removed.',
    '2026-07-02 06:24 EDT - Pixel, Level, MIDI, SFX, Cutscene, and Actor now inherit the shared landscape left-root-drawer default instead of passing per-editor overrides.',
    '2026-07-02 06:19 EDT - The shared landscape shell now defaults full root Menu drawers to the compact left rail, with right-overlay behavior left as an explicit opt-out.',
    '2026-07-02 06:15 EDT - All editors now have a single desktop-shell contract test that rejects falling back to mobile/landscape chrome on desktop.',
    '2026-07-02 06:13 EDT - Pixel portrait cleanup removed the unused top-tab helper so portrait tool menus stay tied to the bottom-sheet contract.',
    '2026-07-02 06:11 EDT - Level portrait asset/settings submenus now keep their secondary tabs at the bottom of the sheet instead of placing them above the content list.',
    '2026-07-02 06:07 EDT - The shared landscape mode plan now treats the main Menu drawer as a left-origin drawer by default, while keeping active submenus on the right.',
    '2026-07-02 06:04 EDT - Shared landscape shell plans now support an explicit top zoom rail so Pixel-style zoom strips are standardized instead of editor-local layout math.',
    '2026-07-02 06:00 EDT - Pixel landscape now keeps zoom in its own top strip, keeps the bottom rail clear for tools/palette, and draws the full Menu drawer as a stable left-origin scrollable surface.',
    '2026-07-02 05:55 EDT - Actor desktop top-menu focus now follows the same already-open drawer switching rule as hover instead of opening drawers just from focus.',
    '2026-07-02 05:53 EDT - The shared desktop context-panel helper now defaults to context-only panels, so transport controls appear only when an editor explicitly opts in.',
    '2026-07-02 05:49 EDT - Desktop left-panel transport placement is now explicit: Pixel and Level stay context-only, while MIDI, SFX, and Cutscene intentionally keep transport in the left desktop column.',
    '2026-07-02 05:45 EDT - MIDI and Cutscene landscape root Menus now use the shared left-origin root drawer while their submenu/context drawers stay on the right.',
    '2026-07-02 05:39 EDT - Shared landscape shell plans now distinguish root Menu drawers from generic right overlays, letting Pixel, Level, SFX, and Actor open root drawers from the compact left rail.',
    '2026-07-02 05:33 EDT - Pixel landscape Menu now opens from the compact left rail instead of appearing as a right-side drawer, and the floating zoom chip is right-aligned inside the work surface.',
    '2026-07-02 05:29 EDT - Actor desktop top menu and dropdown rows now expose DOM menu roles and stable root/action ids, matching the shared desktop menu contract more closely.',
    '2026-07-02 05:18 EDT - Pixel, Level, MIDI, SFX, and Cutscene now share one helper for scrolled landscape root-drawer grid rows.',
    '2026-07-02 05:16 EDT - MIDI, SFX, and Cutscene landscape Menu drawers now preserve root-grid scroll and clip drawer rows like Pixel and Level.',
    '2026-07-02 05:10 EDT - Level landscape Menu drawer now keeps and applies root-grid scroll offset instead of resetting to the top each frame.',
    '2026-07-02 05:07 EDT - Pixel landscape left rail now visually matches the portrait quick rail more closely, and the full Menu drawer has real clipped scroll offset behavior for short landscape screens.',
    '2026-07-02 05:03 EDT - Desktop top-menu dropdown opening now uses one shared open-state resolver across Pixel, Level, MIDI, SFX, Cutscene, and Actor.',
    '2026-07-02 04:54 EDT - Desktop dropdown wheel-scroll state now uses one shared helper across Pixel, Level, MIDI, SFX, Cutscene, and Actor.',
    '2026-07-02 04:49 EDT - SFX gamepad slide-out menus now suppress the touch virtual thumbstick while the submenu owns the left rail, and the landscape contract documents stable root drawers.',
    '2026-07-02 04:44 EDT - Level, MIDI, SFX, Cutscene, and Actor landscape Menu category picks now keep the root drawer open, matching Pixel and reducing right-rail flashing while browsing sections.',
    '2026-07-02 04:39 EDT - Pixel landscape Menu now stays open while switching categories, and the zoom slider moves to the upper-left work surface so it avoids both the drawer and bottom rail.',
    '2026-07-02 04:34 EDT - Desktop top-menu hover switching now uses one shared resolver across all editors instead of per-editor local gates.',
    '2026-07-02 04:28 EDT - Desktop top-menu hover now only switches already-open drawers across Pixel, Level, MIDI, SFX, Cutscene, and Actor.',
    '2026-07-02 04:24 EDT - Actor desktop top-menu hover now switches drawers only after a drawer is open, matching normal desktop menu behavior.',
    '2026-07-02 04:21 EDT - Actor landscape root drawer now uses the shared Menu grid helper with fixed DOM button geometry instead of CSS auto-fit drift.',
    '2026-07-02 04:18 EDT - Level and Cutscene landscape root drawers now use the shared all-visible Menu grid helper, completing the canvas-editor root-grid hookup.',
    '2026-07-02 04:14 EDT - Pixel, MIDI, and SFX landscape root drawers now share one grid-layout helper for all-visible Menu category pickers.',
    '2026-07-02 04:07 EDT - Pixel landscape now keeps the left rail to four fixed actions, uses the right drawer only as an all-visible Menu picker, and moves zoom off the bottom rail.',
    '2026-07-02 04:02 EDT - Level desktop/controller drawers no longer include duplicate Open Toolbox, Open Graphics, or Open Music navigation rows.',
    '2026-07-02 03:59 EDT - MIDI and SFX desktop drawers no longer start with duplicate Open-current-panel navigation rows.',
    '2026-07-02 03:55 EDT - Level editor menu separators and trigger value readouts no longer register empty click handlers, reducing dead-button behavior.',
    '2026-07-02 03:51 EDT - Actor landscape Menu now uses a grid-style right overlay drawer instead of a vertical scrolling root list.',
    '2026-07-02 03:50 EDT - Level landscape Menu now shows every root category in an all-visible right-drawer grid instead of a scroll list.',
    '2026-07-02 03:48 EDT - MIDI landscape Menu now uses the shared compact left rail plus all-visible right-drawer root grid pattern.',
    '2026-07-02 03:45 EDT - SFX landscape Menu now uses the same compact left rail and all-visible right-drawer root grid as Pixel and Cutscene.',
    '2026-07-02 03:43 EDT - Cutscene landscape Menu now matches Pixel with a compact left rail and all-visible right-drawer root grid.',
    '2026-07-02 03:40 EDT - Pixel landscape Menu now opens a right overlay drawer with a non-scrolling category grid instead of hiding root items in a narrow vertical list.',
    '2026-07-02 03:38 EDT - Pixel, Level, MIDI, SFX, and Cutscene desktop dropdown release handling now all use the shared pending-hit helper lifecycle.',
    '2026-07-02 03:34 EDT - Pixel, Level, and SFX desktop dropdown release handling now use shared pending-hit helpers instead of duplicated press/move/release math.',
    '2026-07-02 03:28 EDT - Actor desktop context labels now come from the shared menu root label map instead of a local duplicate map.',
    '2026-07-02 03:26 EDT - Actor landscape now uses the same shared compact rail button layout as the canvas editors.',
    '2026-07-02 03:22 EDT - Pixel, Level, MIDI, SFX, and Cutscene now share one compact landscape rail button layout for Menu, Undo, Redo, and the contextual quick action.',
    '2026-07-02 03:15 EDT - Shared layout plans now explicitly separate the landscape four-button compact rail from the full root drawer across all editors.',
    '2026-07-02 03:08 EDT - Desktop context panels now use shared menu labels instead of raw internal ids across Pixel, Level, MIDI, and SFX.',
    '2026-07-02 03:03 EDT - MIDI and SFX shared root-menu builders no longer expose an option to inject Undo and Redo into root drawers.',
    '2026-07-02 03:00 EDT - Level landscape root drawers now omit duplicate Undo and Redo rows, leaving history on the fixed compact rail.',
    '2026-07-02 02:57 EDT - Pixel landscape now keeps the left rail to Menu, Undo, Redo, and a contextual quick action while opening a scrollable full menu drawer on the right.',
    '2026-07-02 00:32 EDT - Cutscene desktop dropdowns now use the same strict actionless-row disabling as the other editors instead of registering fallback handlers.',
    '2026-07-02 00:29 EDT - Actor portrait Menu now opens the main bottom sheet instead of preselecting File, bringing it closer to the shared bottom-menu behavior.',
    '2026-07-02 00:27 EDT - SFX portrait Menu now opens the Generate/root sheet instead of toggling back to the timeline, matching the shared bottom-menu opener contract.',
    '2026-07-02 00:22 EDT - Level desktop and landscape root menus now resolve shared root aliases to the existing Level panel tabs before opening drawers.',
    '2026-07-02 00:19 EDT - MIDI desktop/gamepad mixer and record controller routing now uses the shared menu spec aliases instead of a local editor-only branch.',
    '2026-07-02 00:14 EDT - Pixel desktop Frames/Rigging routing now comes from the shared menu spec, including the controller submenu aliases used by gamepad drawers.',
    '2026-07-02 00:12 EDT - Actor desktop root-to-section routing now comes from the shared menu spec instead of a local editor-only map.',
    '2026-07-02 00:08 EDT - Shared menu spec validation now rejects portrait bottom buttons that do not resolve to a real root, section, panel, or runtime alias.',
    '2026-07-02 00:03 EDT - Shared desktop dropdown render plans can now disable actionless rows, with Pixel, Level, MIDI, SFX, and Actor opted in.',
    '2026-07-01 23:58 EDT - Pixel and Level generated menu rows now disable missing actions instead of falling back to clickable no-op handlers.',
    '2026-07-01 23:55 EDT - Pixel landscape now reads the same compact command rail surface as the other editors, completing the shared landscape rail hookup.',
    '2026-07-01 23:51 EDT - Shared landscape shell plans now separate the compact left command rail from the full root drawer, and editors read that named surface.',
    '2026-07-01 23:46 EDT - MIDI desktop dropdown commands now require the press and release to stay on the same drawer row, matching the shared desktop menu click contract.',
    '2026-07-01 23:43 EDT - Shared canvas desktop dropdown drawers now draw the same RTG Studio shadow treatment as the Actor DOM desktop dropdown.',
    '2026-07-01 23:40 EDT - Actor gamepad slide-out rendering now reads the same shared gamepad menu state object as the canvas editors instead of recomputing its own landscape condition.',
    '2026-07-01 23:36 EDT - Shared editor menu spec validation now rejects root alias drift and duplicated alias runtime ids before desktop top-menu routing can become inconsistent.',
    '2026-07-01 23:32 EDT - Shared portrait editor layouts now publish the bottom-root placement marker, bringing Level onto the same named portrait menu contract as the other editors.',
    '2026-07-01 23:29 EDT - Actor desktop top-menu drawers now clear stale closed-root state before reopening, matching the shared canvas desktop dropdown behavior.',
    '2026-07-01 23:26 EDT - Shared mobile landscape shells now keep compact left command rails tall enough for four actions even when a virtual thumbstick is still reserved.',
    '2026-07-01 23:23 EDT - Pixel mobile landscape now uses a full-height four-action left rail and moves zoom into the bottom tool rail so the menu and slider no longer compete for space.',
    '2026-07-01 23:17 EDT - Cutscene controller drawers now normalize disabled and active row state, matching the desktop/controller drawer model used by the other editors.',
    '2026-07-01 23:13 EDT - Pixel desktop/controller Edit drawer now disables selection-only Cut and Clear Selection commands when no pixel selection is active.',
    '2026-07-01 23:10 EDT - Level desktop/controller Edit drawer now disables Copy, Cut, Paste, and Delete when selection or clipboard state makes those commands unavailable.',
    '2026-07-01 23:08 EDT - Desktop left context panels now use the shared Active inspector label across canvas editors and Actor instead of the older generic Context heading.',
    '2026-07-01 23:02 EDT - Mobile landscape drawers now share an overlay surface capped above the bottom rail across Pixel, Level, MIDI, SFX, Cutscene, and Actor so zoom/ribbon/tool controls remain visible.',
    '2026-07-01 22:57 EDT - MIDI desktop Edit drawer now disables unavailable Select All, Copy, Cut, Paste, and Delete commands based on pattern selection and clipboard state.',
    '2026-07-01 22:54 EDT - SFX desktop Edit drawer now carries disabled state for unavailable layer clipboard commands so unavailable rows do not look like live buttons.',
    '2026-07-01 22:51 EDT - SFX mobile landscape transport rail no longer repeats the Menu button; root menu access stays on the compact left rail.',
    '2026-07-01 22:49 EDT - Pixel mobile landscape bottom toolbar now stays contextual by removing duplicate Menu, Undo, and Redo buttons that already live on the compact left rail.',
    '2026-07-01 22:46 EDT - Cutscene mobile landscape bottom rail now holds workspace view and timeline zoom controls instead of duplicating Undo, Redo, and Play from the compact left rail.',
    '2026-07-01 22:42 EDT - Actor mobile landscape now uses the same compact left command rail as the canvas editors and opens the full root menu as a right-side overlay drawer.',
    '2026-07-01 22:39 EDT - MIDI mobile landscape now uses the compact left command rail and opens root/utility drawers as right-side overlays so the grid width stays stable.',
    '2026-07-01 22:33 EDT - Cutscene mobile landscape now uses the shared compact left command rail, keeps the stage/timeline width stable, and opens the full root list in a scrollable right drawer.',
    '2026-07-01 22:28 EDT - SFX mobile landscape now uses the shared compact left command rail and opens the full root list inside a scrollable right drawer instead of crowding the left edge.',
    '2026-07-01 22:24 EDT - Level mobile landscape now uses the shared compact left command rail, opens the full root list in a scrollable overlay drawer, and avoids resizing the canvas when the drawer appears.',
    '2026-07-01 22:16 EDT - Pixel mobile landscape now uses a compact four-action left rail, overlays the right drawer instead of resizing the canvas, and constrains zoom controls to the work surface.',
    '2026-07-01 22:12 EDT - MIDI portrait control layout now publishes rootTabs and portraitRootPlacement bottom-rail aliases, aligning its specialized rail stack with the shared editor portrait contract.',
    '2026-07-01 22:10 EDT - Pixel portrait layout now also publishes the explicit portraitRootPlacement bottom-rail marker, making the reference editor use the same named contract as Actor, SFX, and Cutscene.',
    '2026-07-01 22:09 EDT - Actor portrait sheets now expose rootTabs/subRail and portraitRootPlacement like the other bottom-menu editors, while keeping the existing DOM layout behavior.',
    '2026-07-01 22:07 EDT - SFX portrait sheets now publish and consume explicit rootTabs/subRail bottom-menu surfaces, matching the Pixel-style bottom-root contract used by the other editors.',
    '2026-07-01 22:05 EDT - MIDI cleanup removed the stale unused controller action list that still carried Place Note and Erase Note labels, keeping desktop/gamepad menus aligned with tap-the-grid note editing.',
    '2026-07-01 22:02 EDT - SFX gamepad slide-out menus now render the live root menu with action-backed rows and open submenus from the left slide-out instead of showing an empty root panel.',
    '2026-07-01 21:58 EDT - Cutscene portrait menus now publish and consume the same bottom rootTabs/subRail surfaces as Pixel, with all editor portrait root menus explicitly tested at eight-or-fewer bottom items.',
    '2026-07-01 21:55 EDT - Actor landscape main panels now flex and scroll above the new bottom quick-action rail, preventing the rail from being pushed off-screen by tall editor content.',
    '2026-07-01 21:53 EDT - UISpec and the editor UI contract now explicitly define the landscape bottom rail as the shared persistent tool/options/zoom/ribbon surface.',
    '2026-07-01 21:51 EDT - Actor landscape now reserves the shared bottom tool-options rail and uses a dedicated quick-action strip for Undo, Redo, and Play Scene.',
    '2026-07-01 21:48 EDT - Level landscape now reserves the shared bottom tool-options rail and places its zoom slider there, matching the landscape bottom-control contract.',
    '2026-07-01 21:46 EDT - Pixel landscape now reserves the shared bottom tool-options rail and draws palette or management controls there instead of leaving landscape without a bottom tool surface.',
    '2026-07-01 21:42 EDT - Desktop dropdown commands now close their top drawer after selection across Pixel, Level, MIDI, SFX, Cutscene, and Actor, matching normal desktop application menus.',
    '2026-07-01 21:37 EDT - Level portrait root menus now use the shared Pixel-style bottom multi-row strip, keeping every editor root menu bottom-aligned and capped at eight items.',
    '2026-07-01 21:32 EDT - Pixel desktop dropdown commands now use release-only activation, completing the same desktop drawer click contract across Pixel, Level, MIDI, SFX, and Cutscene.',
    '2026-07-01 21:30 EDT - Level desktop dropdown commands now use release-only activation, keeping top drawers consistent with MIDI, SFX, and Cutscene.',
    '2026-07-01 21:26 EDT - Cutscene desktop dropdown commands now fire on pointer release only, matching the SFX and MIDI desktop drawer click contract.',
    '2026-07-01 21:24 EDT - SFX desktop dropdown commands now fire on pointer release only, matching MIDI and preventing press/release double activation through changing drawers.',
    '2026-07-01 21:20 EDT - Cutscene desktop dropdown click targets are now separate from the left context panel, enforcing the top-drawer command surface contract.',
    '2026-07-01 21:16 EDT - Cutscene portrait menus now use the shared Pixel-style bottom tab strip, keeping the root menu at the bottom and capped at eight items.',
    '2026-07-01 21:11 EDT - MIDI desktop dropdown commands now fire on pointer release only, preventing press/release double activation through menu transitions.',
    '2026-07-01 21:06 EDT - Pixel and Level desktop left panels now use the shared context/transport layout helper with transport disabled, matching the other canvas editors.',
    '2026-07-01 21:03 EDT - Actor portrait now enters the shared bottom-sheet layout through a named helper with rootRail and sheetContent surfaces.',
    '2026-07-01 21:01 EDT - Cutscene portrait layout now exposes separate bottom root and sheet-content surfaces like Pixel and SFX.',
    '2026-07-01 20:57 EDT - SFX portrait now uses a Pixel-style enlarged bottom root rail with a two-row bottom-aligned menu strip.',
    '2026-07-01 20:53 EDT - SFX and Cutscene landscape/gamepad layout now derive slide-out, right-drawer, and overlay decisions from one shared gamepad state per frame.',
    '2026-07-01 20:49 EDT - Level mobile landscape now suppresses stale right drawer layout while gamepad owns the left slide-out submenu.',
    '2026-07-01 20:46 EDT - MIDI landscape now uses shared gamepad menu state to suppress right drawers and bottom rails while gamepad owns the left rail.',
    '2026-07-01 20:44 EDT - Pixel mobile landscape now suppresses stale right-drawer reservation while the gamepad left slide-out submenu is active.',
    '2026-07-01 20:42 EDT - Actor mobile landscape now builds the shared landscape shell for both touch and gamepad, with gamepad disabling only the right rail.',
    '2026-07-01 20:40 EDT - UISpec editor root lists now include View as the shared third desktop root across Pixel, Level, Actor, MIDI, SFX, and Cutscene.',
    '2026-07-01 20:38 EDT - Shared gamepad layout plans now identify the left slide rail separately from landscape left rails and expose the submenu-replaces-root contract.',
    '2026-07-01 20:36 EDT - Actor portrait DOM menus now use bottom-menu naming and selectors, with tests rejecting the stale portrait-top path.',
    '2026-07-01 20:32 EDT - Actor desktop dropdown disabled rows no longer register click handlers, matching the shared canvas dropdown behavior.',
    '2026-07-01 20:30 EDT - GameCore now derives editor cleanup, editor-active body class, and virtual-input clearing from one shared editor-state map instead of duplicated hard-coded lists.',
    '2026-07-01 20:27 EDT - Actor Editor DOM overlay now suppresses browser context menus, matching the canvas editors desktop right-click behavior.',
    '2026-07-01 20:23 EDT - Cutscene Editor now participates in shared editor transition cleanup and clears transient menu, pointer, thumbstick, transport, and controller-menu state like the other editors.',
    '2026-07-01 20:21 EDT - Pixel, Level, MIDI, SFX, Actor, and Cutscene now close active controller menus when gamepad input disconnects, preventing stale gamepad UI from leaking into other modes.',
    '2026-07-01 20:18 EDT - The runtime stylesheet now aliases the canonical editor shell tokens to the RTG Studio theme, keeping DOM and canvas editor chrome on the same palette contract.',
    '2026-07-01 20:14 EDT - Cutscene gamepad slide-out submenus now publish scroll bounds and update controllerMenu scroll during drag like the other canvas editors.',
    '2026-07-01 20:12 EDT - Actor DOM menu rails now explicitly use contained touch scrolling, including the gamepad slide-out submenu surface.',
    '2026-07-01 20:09 EDT - MIDI gamepad slide-out submenus now capture list bounds and use the shared drag-scroll helper, while preserving tap-to-select when the gesture does not move.',
    '2026-07-01 20:04 EDT - Pixel gamepad slide-out submenus now register scroll bounds and update controllerMenu scroll during drag, matching the shared scrollable slide-out behavior.',
    '2026-07-01 20:00 EDT - Level gamepad slide-out menus now publish scroll bounds and read panel scroll state so gesture drag scrolling works like the other slide-out panels.',
    '2026-07-01 19:57 EDT - Desktop dropdown drawers now preserve shared menu dividers as inert separator rows, including Actor DOM drawers, so File menus read more like desktop application menus.',
    '2026-07-01 19:54 EDT - Shared File menu extras now normalize onClick/action aliases like standard and footer rows, so editor-specific File drawer commands use one consistent item contract.',
    '2026-07-01 19:50 EDT - Shared portrait multi-row tab strips now support bottom alignment, and Pixel/MIDI portrait root tabs use it so bottom menu rows stay pinned like the Pixel editor pattern.',
    '2026-07-01 19:46 EDT - Portrait bottom menus now come from a shared per-editor portraitRoot spec, keeping every editor capped at eight bottom items while desktop keeps the full File/Edit/View root set.',
    '2026-07-01 19:41 EDT - Shared File menu rows now expose the same action alias as footer rows, making desktop File drawers consume one consistent item shape.',
    '2026-07-01 19:38 EDT - Cutscene desktop right-click now follows the shared pointer policy and opens existing clip/track context options without starting drag edits.',
    '2026-07-01 19:34 EDT - Actor collision-zone modal now uses the shared pointer policy so desktop drops the virtual thumbstick while touch/gamepad can keep it.',
    '2026-07-01 19:31 EDT - SFX thumbstick input now follows the shared editor pointer policy, matching the Cutscene desktop/mobile thumbstick split.',
    '2026-07-01 19:27 EDT - Cutscene thumbstick input now follows the shared editor pointer policy, so desktop suppression is enforced in input handling instead of only during render reset.',
    '2026-07-01 19:24 EDT - Added cross-editor coverage that desktop top-menu hover/click opens drawers without changing the persistent left context panel.',
    '2026-07-01 19:19 EDT - Pixel, MIDI, and SFX landscape touch now render the new View root as a real submenu instead of ignoring it or treating it as desktop-only.',
    '2026-07-01 19:15 EDT - Level landscape/gamepad now treats the new View root as a real panel tab with zoom and playtest actions instead of a desktop-only dropdown.',
    '2026-07-01 19:12 EDT - Added View as a required shared desktop root after File and Edit, with live view/display actions wired across Pixel, Level, Actor, MIDI, SFX, and Cutscene.',
    '2026-07-01 19:06 EDT - Removed the stale SFX gamepad right-options panel implementation so SFX now has only the shared left slide-out gamepad submenu path.',
    '2026-07-01 19:04 EDT - SFX gamepad landscape now uses the left slide-out submenu without also drawing a right-side options panel, keeping gamepad distinct from touch landscape.',
    '2026-07-01 19:00 EDT - Added a cross-editor desktop dropdown regression so Pixel, Level, MIDI, SFX, Cutscene, and Actor stay backed by live action menus instead of inert spec rows.',
    '2026-07-01 18:58 EDT - Actor controller-menu rows now preserve active, disabled, and source ids so desktop dropdown and gamepad menu state stay aligned.',
    '2026-07-01 18:57 EDT - Pixel and MIDI desktop dropdowns now also build live controller-menu rows so mouse desktop drawers do not fall back to inert spec-only rows.',
    '2026-07-01 18:55 EDT - SFX desktop dropdowns now build current controller-menu rows directly, so desktop drawer buttons no longer depend on prior gamepad menu initialization.',
    '2026-07-01 18:53 EDT - Cutscene desktop dropdowns now use controller-menu action rows like the other desktop editor shells, while preserving disabled and active menu state.',
    '2026-07-01 18:51 EDT - Level desktop dropdowns now use the same controller-menu action source as the other desktop editors while keeping tile, actor, and structure previews.',
    '2026-07-01 18:46 EDT - Portrait editor root rails are now explicitly validated as bottom-anchored across shared canvas layouts, Pixel, MIDI, Cutscene, and Actor.',
    '2026-07-01 18:44 EDT - SFX desktop layout now explicitly clears stale mobile thumbstick state when switching into the desktop shell.',
    '2026-07-01 18:39 EDT - Level desktop custom dropdown rows now honor disabled state with muted styling and no click registration, matching the shared dropdown behavior.',
    '2026-07-01 18:37 EDT - Actor desktop dropdown disabled styling now uses RTG Studio CSS classes instead of inline opacity, matching the shared desktop chrome direction.',
    '2026-07-01 18:34 EDT - Desktop dropdown drawers now render disabled rows as muted, inert menu items instead of hiding or registering them as clickable actions.',
    '2026-07-01 18:31 EDT - Portrait root menus are now capped at eight items across editors, with Cutscene Export folded back into File and Cutscene portrait tabs moved to the bottom of the sheet.',
    '2026-07-01 18:28 EDT - Level desktop/controller drawers now pull concrete panel actions for triggers, graphics, music, settings, and content pickers, reducing dead-looking menu rows.',
    '2026-07-01 18:24 EDT - Shared menu specs now require File and Edit as the first desktop roots and validate required desktop actions across every editor.',
    '2026-07-01 18:24 EDT - Pixel, Level, Actor, MIDI, SFX, and Cutscene menu specs have been audited away from placeholder rows toward concrete runtime drawer commands.',
    '2026-07-01 17:50 EDT - UISpec and the editor UI contract now document the shared desktop command/context surface roles.',
    '2026-07-01 17:40 EDT - Desktop left panels now describe active context instead of presenting themselves as duplicate menus across the canvas editors.',
    '2026-07-01 17:34 EDT - Desktop drawer click-away close state now uses one shared resolver across Pixel, Level, MIDI, SFX, Cutscene, and Actor.',
    '2026-07-01 16:57 EDT - Canvas desktop dropdown drawers now share one RTG Studio drawer painter across Pixel, Level, MIDI, SFX, and Cutscene.',
    '2026-07-01 16:53 EDT - Canvas desktop context panels now share one RTG Studio helper across Pixel, MIDI, SFX, and Cutscene, with Level added shortly after.',
    '2026-07-01 16:41 EDT - Canvas desktop top menus now share one RTG Studio painter across Pixel, Level, MIDI, SFX, and Cutscene.',
    '2026-07-01 16:35 EDT - Gamepad hint bars and slide-out headers now share RTG Studio chrome across the canvas editors, with Actor DOM gamepad chrome moved into CSS.',
    '2026-07-01 16:15 EDT - Editors now share the RTG Studio main menu theme across canvas editors and the Actor DOM editor.'
  ]
};

export const LATEST_CHANGES = [
  {
    date: '2026-07-02',
    time: '22:40 EDT',
    area: 'Desktop Editor UI',
    summary: 'Moved Race/Car desktop End Drive into the Drive top drawer.',
    details: [
      'Race and Car desktop playtest sessions now expose End Drive through the Drive dropdown drawer when a playtest is active.',
      'The persistent left context panel stays informational instead of registering playtest command buttons.',
      'Race desktop tests now verify End Drive is a release-activated desktop dropdown item, matching the proper desktop app menu model.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:33 EDT',
    area: 'Desktop Editor UI',
    summary: 'Cleared stale mobile thumbstick state from Pixel desktop rendering.',
    details: [
      'Pixel desktop draw now resets the shared pan joystick whenever the active viewport mode is not mobile, preventing leftover mobile thumbstick geometry from surviving a mode switch.',
      'Added cross-editor source coverage that Pixel, Level, MIDI, SFX, and Cutscene clear or reset mobile thumbstick state on desktop paths.',
      'This keeps desktop editor chrome closer to a proper desktop app by removing mobile control state from desktop interaction surfaces.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:26 EDT',
    area: 'Shared Editor UI',
    summary: 'Brought Race Editor and Car Editor into the shared renderer mode-contract handoff.',
    details: [
      'RaceEditor now resolves viewportMode at the top of draw(), stores activeModeContract and activeViewportMode, and dispatches desktop, portrait, landscape, or mobile playtest from that shared mode decision.',
      'Race/Car desktop and landscape renderers retain the modeContract returned by the shared shell helpers, and gamepad slide-out rendering retains the gamepad menu modeContract.',
      'The shared editor layout test now includes Race and Car in the same renderer-entry contract guard as Pixel, Level, Actor, MIDI, SFX, and Cutscene.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:21 EDT',
    area: 'Shared Editor UI',
    summary: 'Threaded the shared viewport mode contract into the main editor renderer entry points.',
    details: [
      'Pixel, Level, Actor, MIDI, SFX, and Cutscene now retain viewportMode.modeContract before desktop, portrait, landscape, or gamepad render branches run.',
      'Actor collision editing keeps a separate collisionModeContract because it computes viewport mode for that sub-panel independently.',
      'The editor UI contract and layout tests now require renderer entry points to keep the shared mode contract available instead of rebuilding per-mode rules locally.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:15 EDT',
    area: 'Shared Editor UI',
    summary: 'Exposed the combined mode contract from viewport mode flags.',
    details: [
      'resolveEditorViewportModeFlags now returns modeContract next to the existing desktop, portrait, landscape, and gamepad booleans.',
      'Pixel, Actor, MIDI, Level, SFX, and Cutscene already call this resolver, so their render entry points can now consume the canonical mode contract without another lookup.',
      'The shared UI contract docs now require viewport mode flags to carry modeContract for renderer-level mode decisions.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:10 EDT',
    area: 'Shared Editor UI',
    summary: 'Aligned specialized shell helpers with the combined shared mode contract.',
    details: [
      'Desktop, landscape, and gamepad shell helpers now expose modeContract like buildEditorMenuLayoutPlan.',
      'Desktop and gamepad helpers now read presentation and interaction from the combined shared contract instead of hand-built literals.',
      'Landscape keeps its helper-specific optional right-rail and bottom-rail presentation adjustments while preserving shared required/suppressed surfaces and touch interaction semantics.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:04 EDT',
    area: 'Shared Editor UI',
    summary: 'Added a combined shared mode contract helper for editor renderers.',
    details: [
      'getEditorModeContract now returns required surfaces, suppressed surfaces, presentation, and interaction metadata as one renderer-facing object.',
      'buildEditorMenuLayoutPlan exposes that combined modeContract directly so editor code and tests can compare against one canonical source.',
      'The shared UI contract docs now tell editor renderers to use the combined contract instead of rebuilding per-mode rules locally.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:01 EDT',
    area: 'Shared Editor UI',
    summary: 'Connected rendered editor layout coverage to the shared mode contracts.',
    details: [
      'The rendered layout contract spec now imports the shared presentation and interaction constants used by the planner.',
      'Desktop, portrait, landscape, and gamepad runtime assertions now compare observed editor chrome to the expected top-menu, bottom-rail, right-drawer, and left-slide-out surfaces.',
      'Focused unit contract checks pass; Playwright execution is blocked in this Termux Android environment by Playwright unsupported-platform browser registry handling.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:56 EDT',
    area: 'Shared Editor UI',
    summary: 'Centralized shared presentation and interaction contracts per editor mode.',
    details: [
      'Portrait, landscape, desktop, and gamepad presentation surfaces now live in exported shared constants instead of inline planner literals.',
      'Pointer and activation semantics are centralized too: desktop release, touch tap-release, and gamepad A/B confirm/back behavior now validate per mode.',
      'The shared layout tests and UI contract docs now verify the constants, fallback lookup, and validator so editor-specific code cannot quietly drift.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:50 EDT',
    area: 'Race Editor',
    summary: 'Retuned race playtest road scale, speed perspective, and launch behavior.',
    details: [
      'Default race road width now maps to a narrower world-space lane while the third-person car renders larger relative to that road.',
      'High-speed playtest projection samples farther down the route and moves visual road stripes faster so 100+ mph reads less static.',
      'Race starts now hold camera/car yaw aligned to the road for the first moment in first gear, and the start line draws a close black/white checker band near launch.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:42 EDT',
    area: 'Shared Editor UI',
    summary: 'Aligned specialized shell helper metadata with the generic layout plan.',
    details: [
      'Desktop shell plans now expose the same presentation and interaction metadata as the generic desktop mode plan.',
      'Landscape touch shell plans now expose matching root drawer, right submenu, bottom rail, tap-release, and gesture-scroll metadata.',
      'The shared layout tests now compare specialized desktop, landscape, and gamepad helper semantics against the generic mode plan for every editor.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:38 EDT',
    area: 'Shared Editor UI',
    summary: 'Added generic presentation and interaction metadata to shared editor layout plans.',
    details: [
      'buildEditorMenuLayoutPlan now reports root, command, submenu, context, navigation, drawer, and replacement surfaces for every mode.',
      'Generic interaction metadata now distinguishes desktop release activation, portrait/landscape tap-release, and gamepad confirm-button activation.',
      'The shared layout tests verify the generic mode plan metadata for Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:34 EDT',
    area: 'Shared Editor UI',
    summary: 'Made gamepad slide-out submenu semantics explicit across editors.',
    details: [
      'buildGamepadSlideOutMenuPlan now exposes presentation metadata for the left slide rail, left slide-out submenu, and root-replacement behavior.',
      'Controller submenu plans now identify as gamepad-slide-out surfaces with confirm-button row activation and controller-owned gesture scrolling.',
      'The shared layout tests now verify Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car all share the same gamepad slide-out semantics.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:31 EDT',
    area: 'Shared Editor UI',
    summary: 'Aligned every editor portrait menu model on an explicit bottom-rail contract.',
    details: [
      'Race Editor and Car Editor now expose named portrait menu model builders like the older editors.',
      'Every editor portrait menu model now reports portraitRootPlacement as bottom-rail, matching the requested portrait bottom-menu behavior.',
      'The portrait model tests now verify Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car all share the bottom-sized root menu contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:26 EDT',
    area: 'Shared Editor UI',
    summary: 'Moved filtered desktop drawer scroll metadata into the shared dropdown render plan.',
    details: [
      'buildDesktopDropdownRenderPlan now clamps scrollIndex after hidden, duplicate, and separator rows are resolved.',
      'The shared render plan now exposes maxScroll, visibleRows, scrollRegion, and mouse wheel scroll policy so long desktop drawers behave consistently across editors.',
      'The shared layout tests now cover filtered drawer scrolling, including hidden rows and out-of-range scroll state.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:22 EDT',
    area: 'Shared Editor UI',
    summary: 'Added shared desktop top-menu fit metadata across all editors.',
    details: [
      'Desktop top-menu plans now report whether root menus are compressed, whether overflow roots are hidden, and whether all root menus remain visible.',
      'The desktop shell tests now verify Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car all expose the same top-menu fit contract.',
      'The editor UI contract now documents the fit metadata so future desktop menu work uses the shared geometry instead of editor-specific guesses.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:17 EDT',
    area: 'Race Editor',
    summary: 'Tuned race playtest road/car scale and start-line launch behavior.',
    details: [
      'Default race roads now project closer to a two-lane scale instead of an oversized multi-lane highway, making speed read better against the car.',
      'The third-person car is wider relative to the road and high-speed projection samples farther ahead for a longer road perspective.',
      'Playtests still start in first gear, and the black/white checker stripe now renders near the launch pose with unit coverage protecting it.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:08 EDT',
    area: 'Shared Editor UI',
    summary: 'Added validation for shared mode surface contracts.',
    details: [
      'Added getEditorModeSurfaceContract so layout code and tests can query required/suppressed surfaces from one helper.',
      'Added validateEditorModeSurfaceContracts to reject missing lists, duplicates, and required/suppressed overlap.',
      'The editor UI contract now documents that a surface cannot be both required and suppressed in the same mode.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:04 EDT',
    area: 'Shared Editor UI',
    summary: 'Added required mode-surface metadata beside the shared suppression table.',
    details: [
      'Added REQUIRED_MODE_SURFACES for portrait, landscape touch, desktop, and gamepad.',
      'Generic editor menu layout plans now expose requiredModeSurfaces in every mode across every editor.',
      'The editor UI contract and layout tests now pair each mode suppression list with the surfaces that must be present, making mode drift easier to catch.'
    ]
  },
  {
    date: '2026-07-02',
    time: '21:00 EDT',
    area: 'Shared Editor UI',
    summary: 'Unified per-mode suppressed-surface metadata in the generic layout plan.',
    details: [
      'Added one shared SUPPRESSED_MODE_SURFACES table for portrait, landscape touch, desktop, and gamepad.',
      'Generic editor menu layout plans now expose suppressedModeSurfaces in every mode, not just portrait.',
      'Desktop, landscape, and gamepad shell helpers now derive their specialized suppression metadata from the same table, reducing drift between mode contracts.'
    ]
  },
  {
    date: '2026-07-02',
    time: '20:56 EDT',
    area: 'Shared Editor UI',
    summary: 'Made portrait bottom-first mode suppression explicit across all editors.',
    details: [
      'Portrait menu layout plans now expose suppressedModeSurfaces for desktop top menus, desktop dropdowns, desktop left inspectors, landscape root drawers, landscape right submenus, and gamepad slide-outs.',
      'The lower-level editor UI contract documents that portrait must stay bottom-first and avoid desktop, landscape, and controller chrome.',
      'The all-editor portrait layout test now verifies the suppression list alongside bottom-rail roots, bottom-sheet submenus, and bottom action rails.'
    ]
  },
  {
    date: '2026-07-02',
    time: '20:52 EDT',
    area: 'Shared Editor UI',
    summary: 'Made landscape and gamepad opposite-mode surface suppression explicit.',
    details: [
      'Landscape touch shell plans now expose suppressedDesktopSurfaces for desktop top menus, desktop dropdowns, and desktop left inspectors.',
      'Gamepad slide-out plans now expose suppressedTouchSurfaces for the touch right submenu, touch root drawer, bottom tool rail, and touch thumbstick.',
      'The all-editor layout contract now verifies those mode-surface boundaries so landscape and gamepad cannot silently duplicate each other.'
    ]
  },
  {
    date: '2026-07-02',
    time: '20:48 EDT',
    area: 'Shared Editor UI',
    summary: 'Made desktop mobile-chrome suppression explicit in the shared shell plan.',
    details: [
      'Desktop editor shell plans now expose suppressedMobileSurfaces for bottom action rails, bottom tool rails, touch thumbsticks, landscape root drawers, landscape right submenus, gamepad hint bars, and gamepad slide-outs.',
      'The lower-level editor UI contract documents that suppression list so desktop stays a top-menu plus left-inspector app shell.',
      'The all-editor layout test now verifies every shared desktop shell receives the same suppression contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '20:43 EDT',
    area: 'Race Editor',
    summary: 'Tuned race playtest scale, launch gear, and start-line rendering.',
    details: [
      'Reduced the world-space road half-width and narrowed the projected road so speed no longer reads like driving down an oversized runway.',
      'Increased third-person car size and extended high-speed lookahead/perspective so road width, car scale, and motion better agree.',
      'Added a projected black/white checkered stripe at the start line and changed race playtests to start in first gear with the camera aligned to the road heading.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:48 EDT',
    area: 'Shared Editor UI',
    summary: 'Enforced shared desktop File and Edit drawer ordering across every editor.',
    details: [
      'UISpec.md and the lower-level editor UI contract now explicitly require every desktop Edit drawer to start with Undo and Redo.',
      'The shared menu spec validator now rejects File or Edit baseline actions that are present but out of order.',
      'The all-editor desktop dropdown-plan test now checks both File and Edit baselines for Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:44 EDT',
    area: 'Race Editor',
    summary: 'Improved track node drawing and Tile Editor-backed terrain painting.',
    details: [
      'Draw Road mode now lets you click the top-down map to append a real draggable route node instead of only changing segment values.',
      'Inserted nodes and dragged existing nodes now share the same segment length, curve, and elevation sync path.',
      'Ground paint patches now store Tile Editor source metadata and labels, while projected shoulders use edge/paint elevation so dirt, snow, asphalt, and other terrain tiles stay visually attached to raised track sections.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:36 EDT',
    area: 'Shared Editor UI',
    summary: 'Strengthened the shared desktop File drawer baseline coverage across every editor.',
    details: [
      'editorMenuLayout now loops Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car through buildDesktopDropdownPlan(file).',
      'Each rendered desktop File dropdown plan must start with New, Save, Save As, Open, Export, and Import.',
      'This gives stronger evidence that desktop File drawers stay consistent at the actual dropdown-plan layer.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:35 EDT',
    area: 'Shared Editor UI',
    summary: 'Broadened desktop dropdown command metadata coverage across all editors.',
    details: [
      'The editorMenuLayout contract now checks Actor together with the canvas editors for stable desktop dropdown command ids/actions and dropdown-item metadata.',
      'Actor keeps a focused DOM dataset assertion for actionId, sourceId, and desktopDropdownItem.',
      'This reduces the remaining split between canvas desktop dropdown rows and the Actor DOM desktop menu path.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:33 EDT',
    area: 'Shared Editor UI',
    summary: 'Broadened desktop chrome coverage so Actor DOM chrome is validated with the shared editor chrome contract.',
    details: [
      'Renamed canvas-only desktop chrome tests to cover desktop editor chrome generally.',
      'Added Actor DOM ribbon, top menu, context panel, and dropdown CSS/source assertions beside the canvas shared painter assertions.',
      'This keeps Actor from drifting out of the same RTG Studio desktop app-style menu and drawer expectations.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:30 EDT',
    area: 'Shared Editor UI',
    summary: 'Updated the shared UI spec and tests so Actor is treated as covered by the same editor contracts.',
    details: [
      'UISpec rollout now says to keep Actor covered by shared desktop, landscape, portrait, and gamepad contracts instead of saying it still needs to be bridged.',
      'The gamepad slide-out header chrome test now includes Actor DOM slide-out hint usage alongside the canvas editor shared header checks.',
      'Added a regression rejecting the stale Actor bridge roadmap wording.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:27 EDT',
    area: 'Shared Editor UI',
    summary: 'Aligned Actor gamepad slide-out hint text with the shared controller menu plan.',
    details: [
      'Actor Editor DOM slide-out headers now render plan.headerHint instead of hardcoded A/B-only copy.',
      'The Actor gamepad menu test now rejects falling back to the older A Select / B Back literal.',
      'This brings the DOM Actor editor in line with the shared A Select, B Back, LB/RB Tabs wording used by canvas editors.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:24 EDT',
    area: 'Shared Editor UI',
    summary: 'Aligned Race/Car desktop dropdown scroll keys with the shared open-root drawer contract.',
    details: [
      'Race/Car desktop shell now names and passes openDesktopRootId into buildDesktopEditorShellPlan.',
      'Dropdown scroll lookup now uses this.desktopDropdownScroll?.[openDesktopRootId], matching the other desktop editors.',
      'Updated the broad portrait/menu-model contract test to reject Race/Car falling back to activeRootId scroll keys.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:22 EDT',
    area: 'Shared Editor UI',
    summary: 'Aligned Race/Car gamepad slide-out headers with the shared controller menu plan.',
    details: [
      'Race/Car root drawers now pass buildGamepadSlideOutMenuPlan headerHint into the shared slide-out header.',
      'Race/Car gamepad submenus now draw the same shared slide-out header and reserve space before rendering action rows.',
      'Added regression coverage so the Race/Car controller menu path stays consistent with the shared landscape/gamepad contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:19 EDT',
    area: 'Race Editor',
    summary: 'Persisted dragged track nodes as editable race road nodes and made playtest route/ground sampling follow that authored path.',
    details: [
      'Dragging a top-down race node now creates and updates road.nodes instead of only nudging segment parameters.',
      'Route length and projected playtest sampling now use those edited nodes when present, so the driven track follows the layout you changed.',
      'Ground paint remains backed by Tile Editor tile definitions, and projected shoulders now sample nearby painted terrain patches before falling back to segment edge/surface colors.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:11 EDT',
    summary: 'Centralized gamepad slide-out header hints across editors.',
    details: [
      'buildGamepadSlideOutMenuPlan now exposes a shared headerHint that includes A Select, B Back, and LB/RB Tabs.',
      'Pixel, Level, MIDI, SFX, and Cutscene slide-out headers now pass plan.headerHint into the shared header painter instead of relying on local/default copy.',
      'The shared gamepad header default now matches that same wording, so Race and Car root drawers inherit consistent controller chrome too.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:04 EDT',
    summary: 'Improved shared gamepad slide-out focus metadata and Cutscene focus rendering.',
    details: [
      'buildGamepadSlideOutMenuPlan now returns focusedRootEntry, focusedSubmenuItem, and a normalized focus surface/id payload.',
      'Cutscene gamepad slide-out rows now pass focused state into the shared menu button chrome instead of only showing active rows.',
      'Added coverage for focused root/submenu metadata and Cutscene focused-row rendering so controller menus keep moving toward a consistent landscape-style slide-out model.'
    ]
  },
  {
    date: '2026-07-02',
    time: '19:00 EDT',
    summary: 'Locked the live desktop dropdown animation contract into the shared UI spec.',
    details: [
      'UISpec.md now states that desktop drawers preserve shared openedAtMs timing and pass live dropdown state into buildDesktopDropdownRenderPlan.',
      'ui/EDITORS_UI_CONTRACT.md now documents the same resolveDesktopDropdownState({ previousDropdown }) path for canvas and DOM drawers.',
      'The shared layout test now guards the live slide-down state contract alongside the existing desktop top-menu, click-away, and File baseline rules.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:57 EDT',
    summary: 'Improved Race Editor node editing and tile-based terrain rendering.',
    details: [
      'Added a visible Move mode beside Paint and Edge so track nodes can be dragged deliberately after switching away from paint or edge assignment.',
      'Race ground swatches now include runtime Tile Editor definitions when available, while asphalt/dirt/gravel/snow/wet-asphalt use distinct ground palettes.',
      'The pseudo-3D race renderer now draws left and right ground shoulder strips per road slice from each segment edge tile or fallback surface, so assigned terrain follows the projected road instead of sitting as a flat background.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:48 EDT',
    summary: 'Made desktop dropdown slide-down animation state live across editors.',
    details: [
      'resolveOpenDesktopDropdownState now stamps a shared openedAtMs value and resolveDesktopDropdownState preserves it when editor shells rebuild their dropdown plans.',
      'Pixel, Level, MIDI, SFX, Cutscene, Race/Car, and Actor now pass the preserved live dropdown state into their render plans so the shared slide-down progress can actually animate.',
      'Added coverage for preserving dropdown timing and for Actor/canvas render paths using the live dropdown state instead of rebuilt static shell dropdowns.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:39 EDT',
    summary: 'Aligned Actor desktop DOM drawers with the shared slide-down dropdown contract.',
    details: [
      'Actor desktop dropdowns now read motion metadata from buildDesktopDropdownRenderPlan and stamp the drawer with slide-down/top-menu origin metadata.',
      'Added the same RTG Studio slide-down keyframe treatment to the Actor DOM dropdown CSS so it behaves like the shared canvas desktop drawers.',
      'Extended Actor desktop layout coverage so the DOM editor cannot drift back to static desktop drawers.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:37 EDT',
    summary: 'Added a shared slide-down motion contract for desktop dropdown drawers.',
    details: [
      'buildDesktopDropdownRenderPlan now emits motion metadata for top-menu dropdowns, including slide-down progress, duration, opacity, and top-menu origin.',
      'drawSharedDesktopDropdown now consumes that shared motion metadata so dropdown panel and row hit bounds move together when animation progress is supplied.',
      'Added shared layout coverage for the desktop drawer motion contract while keeping portrait, landscape, and gamepad layouts unchanged.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:32 EDT',
    summary: 'Improved Race Editor track authoring with direct tile painting and edge assignment.',
    details: [
      'The top-down race editor now shows Paint and Edge modes plus shared Tile Editor-backed swatches for asphalt, dirt, snow, metal, water, and other configured tiles.',
      'Ground painting now stores the selected tile and samples interpolated track elevation, so painted terrain follows the route height more naturally.',
      'Edge mode now lets you click a road segment to apply the selected tile as that segment edge, while node dragging remains available for changing length, curve, and elevation.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:26 EDT',
    summary: 'Made the landscape dual-drawer rule explicit in the shared UI contract.',
    details: [
      'buildEditorMenuLayoutPlan now exposes modeSurfaces.rootDrawerKeepsSubmenuVisible for landscape touch mode.',
      'UISpec.md and ui/EDITORS_UI_CONTRACT.md now state that opening the left root drawer must keep the right submenu rail available.',
      'Added layout-plan coverage so the shared contract protects the left-root/right-submenu behavior going forward.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:23 EDT',
    summary: 'Aligned MIDI touch landscape root drawers with persistent right utility drawers.',
    details: [
      'MIDI now renders the active right utility drawer while the left root drawer is open when the selected tab owns a landscape right drawer.',
      'This keeps File, View, Record, and Settings drawer content visible on the right while Menu roots are visible on the left.',
      'Updated the shared menu-model coverage so MIDI preserves the dual-drawer landscape behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:21 EDT',
    summary: 'Aligned Level touch landscape with the left-root/right-submenu drawer model.',
    details: [
      'Level landscape now reserves the right submenu rail whenever the drawer is open, not only after the root drawer closes.',
      'When the left root drawer is open, Level now renders the active submenu content into the right rail so roots and tools remain visible together.',
      'Updated Level layout coverage to reject the old root-only drawer reservation behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:17 EDT',
    summary: 'Aligned Cutscene touch landscape with the left-root/right-submenu drawer model.',
    details: [
      'Cutscene landscape now reserves the right submenu rail while the left root drawer is open.',
      'Opening Menu in touch landscape draws the root drawer on the left and the active submenu drawer on the right instead of hiding the submenu.',
      'Updated the shared editor menu coverage so Cutscene cannot drift back to suppressing the right submenu while the root drawer is open.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:14 EDT',
    summary: 'Removed duplicate Race desktop builder commands from the left context panel.',
    details: [
      'Race and Car desktop now keep builder commands in the horizontal top-menu drawers instead of also rendering a Race Builder command block in the persistent left panel.',
      'The left context panel remains a passive inspector for selected race/car details, with End Drive still available there during desktop playtest.',
      'Updated Race desktop coverage so Generate Random Race is expected in the Race drawer and context-panel command buttons are rejected.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:10 EDT',
    summary: 'Moved MIDI landscape root drawer scrolling onto shared menu scroll-region bookkeeping.',
    details: [
      'MIDI now resets and registers menuScrollRegions during its draw pass like the other shared-shell editors.',
      'Touch-drag and wheel scrolling for the landscape root drawer now resolve through findScrollableMenuRegion and buildMenuScrollDragState instead of a MIDI-only mobileLandscapeRootMenuBounds branch.',
      'Updated the MIDI landscape regression test so it protects the shared scroll-region path and the existing tap-to-select behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:07 EDT',
    summary: 'Removed the last Pixel-only legacy gamepad hint state.',
    details: [
      'Pixel Editor no longer keeps gamepadHintVisible or logs a separate gamepad-detected path when a controller connects.',
      'Removed the unused pixel-editor/gamepad.js module so Pixel relies on the shared gamepad hint and input contracts like the other editors.',
      'The portrait/menu regression suite now rejects the stale gamepadHintVisible path and legacy GAMEPAD_HINTS import.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:04 EDT',
    summary: 'Moved Actor portrait rail button sizing onto the shared portrait rail layout primitive.',
    details: [
      'Actor Editor portrait still uses its DOM rail and existing Menu, Undo, Redo, Play Scene actions, but the button bounds now come from getSharedPortraitRailActionButtons.',
      'The regression coverage now rejects the old fixed 54px Actor portrait buttons so the DOM editor stays closer to the shared canvas editor bottom-rail contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '18:02 EDT',
    summary: 'Aligned Race surface authoring docs with the shared menu spec.',
    details: [
      'UISpec.md now names the Race Surface drawer commands for selected ground tile, ground painting, and selected-segment edge tile assignment.',
      'The shared editor menu spec tests now lock the Race Surface drawer order so runtime menus and the canonical UI spec stay aligned.'
    ]
  },
  {
    date: '2026-07-02',
    time: '17:58 EDT',
    summary: 'Added draggable race nodes and tile-backed terrain authoring.',
    details: [
      'Race Editor track nodes can now be dragged on the top-down map to update real segment length, curve, and elevation data.',
      'Surface tools now include a selected ground tile cycle, ground paint mode, and selected-segment edge tile assignment.',
      'Painted ground stores tile id plus elevation, while unpainted ground keeps the generated height terrain fallback.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:28 EDT',
    summary: 'Aligned Race/Car landscape gamepad layout with shared menu state.',
    details: [
      'Race and Car landscape now derive controller-owned layout decisions from getGamepadMenuState(width, height).',
      'Right-rail reservation and gamepad slide-out rendering are gated by the shared isLandscapeMenuMode value instead of a raw connected-controller boolean.',
      'Race/Car layout coverage now locks this shared-state path so controller landscape remains consistent with the other editors.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:26 EDT',
    summary: 'Aligned SFX gamepad slide-out pointer suppression with drawing.',
    details: [
      'SFX pointer handling now suppresses the virtual thumbstick while the gamepad left slide-out menu is active.',
      'This prevents stale mobile pan thumbstick hit targets from intercepting touches underneath the controller submenu.',
      'The menu-model coverage now locks the same gamepad-aware thumbstick suppression used by the SFX draw path.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:23 EDT',
    summary: 'Fixed SFX gamepad landscape right-rail reservation.',
    details: [
      'SFX landscape now reserves the right submenu rail only for touch landscape.',
      'When gamepad mode owns submenus on the left slide-out rail, the SFX waveform work surface no longer gives up space to an invisible right drawer.',
      'The shared UI contract tests now expect the conditional right-rail reservation for SFX gamepad mode.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:21 EDT',
    summary: 'Stopped Race builder controls from leaking into Car Editor.',
    details: [
      'Car portrait and landscape now skip the Race builder overlay, keeping Car mode focused on its tuning/play surface.',
      'Rendered Race/Car layout coverage now verifies Car mode does not expose Generate, Add Road, Curve, Hill, Surface, or related Race-only controls outside menu drawers.',
      'Race mode still keeps the builder overlay and top-down track editor for route authoring.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:17 EDT',
    summary: 'Made Race Editor authoring top-down and tightened WRX simulation.',
    details: [
      'Race authoring now renders a top-down height-map track editor by default, with grayscale terrain, surface-colored road tiles, selectable nodes, elevation markers, and hard-turn markers.',
      'Pointer/tap selection on the map chooses the nearest road segment so the existing Curve, Hill, Surface, and road controls edit the selected track piece.',
      'Race playtest still uses the F1 Pole Position-style renderer, while WRX manual/automatic tuning now includes explicit rev limiter drop, shift RPMs, torque falloff, and automatic drivetrain calibration.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:11 EDT',
    summary: 'Locked Race/Car desktop context panels to inspector language.',
    details: [
      'The shared desktop context-panel test now asserts Race and Car use Active context language instead of Menu labels.',
      'Race context lines are covered for selected race details, and Car context lines are covered for selected car tuning details.',
      'This protects the desktop left panel as a persistent inspector while top dropdown drawers own commands.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:09 EDT',
    summary: 'Moved Race/Car gamepad root drawer headers onto shared chrome.',
    details: [
      'Race Editor and Car Editor now call drawSharedGamepadSlideOutHeader for the gamepad root drawer.',
      'The old hand-drawn A Select / B Back header row was removed from that path.',
      'The root drawer reserves the taller shared header height so the menu rows do not collide with the controller hint text.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:07 EDT',
    summary: 'Moved Race/Car gamepad submenu rows onto the shared slide-out plan.',
    details: [
      'Race Editor and Car Editor now pass buildGamepadSlideOutMenuPlan submenu items directly into the left slide-out submenu renderer.',
      'This keeps controller root aliases and submenu contents centralized in the shared gamepad plan.',
      'The gamepad submenu scroll key now follows the resolved shared active root id.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:05 EDT',
    summary: 'Moved Race/Car desktop dropdown state onto the shared resolver.',
    details: [
      'Race Editor and Car Editor desktop drawing now calls resolveDesktopDropdownState for open and closed dropdown state.',
      'This removes a local shell.dropdown ternary in the Race/Car desktop path so it matches the shared desktop dropdown lifecycle.',
      'Regression coverage now rejects the old hand-built desktop dropdown assignment.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:03 EDT',
    summary: 'Added Race/Car to desktop shared-shell source coverage.',
    details: [
      'The desktop shared-shell regression now names Race Editor and Car Editor beside Pixel, Level, MIDI, SFX, and Cutscene.',
      'The test verifies the shared desktop top menu, ribbon, context panel, dropdown drawer, and shell plan usage for the Race/Car implementation.',
      'This tightens the desktop-app contract without changing the working portrait layout.'
    ]
  },
  {
    date: '2026-07-02',
    time: '15:01 EDT',
    summary: 'Named Car Editor in desktop dropdown guard coverage.',
    details: [
      'The broad desktop dropdown auto-open regression now lists Car Editor explicitly.',
      'This keeps Car tied to the same top-menu/dropdown rule as Race: desktop drawers open only from explicit top-menu interaction, never from active mobile or panel state.',
      'The change hardens shared UI contract coverage without changing portrait behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:59 EDT',
    summary: 'Reworked race playtest toward 2022 WRX drivetrain physics.',
    details: [
      'Default race projects now include a 2022 Subaru WRX 6MT and a 2022 Subaru WRX SPT automatic, both AWD with 271 hp and 258 lb-ft tuning data.',
      'Race playtest acceleration now comes from torque, gear ratio, final drive, wheel radius, mass, traction, drag, shift delay, and rev limiter behavior instead of simple per-gear target speeds.',
      'Regression tests now cover manual and automatic shifting, neutral rev limiting, roughly 5-6 second 0-60 behavior, about 135 mph top speed, and rain/snow grip hooks.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:51 EDT',
    summary: 'Added Race/Car desktop menu baseline coverage.',
    details: [
      'The shared File/Edit menu spec test now includes Race Editor and Car Editor.',
      'Race and Car desktop dropdown plans are now checked for the same File baseline order as the rest of RTG Studio.',
      'Their editor-specific Edit drawers are also covered so segment and car-layer commands cannot drift out of the shared desktop menu contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:49 EDT',
    summary: 'Shifted Race playtest toward F1 Pole Position-style steering.',
    details: [
      'Race steering now feeds a road-view sweep so the near road moves under the car while the vanishing point remains stable.',
      'The third-person race car sprite now strafes less and draws more like a small Formula-style car with open wheels and a pointed body.',
      'Race regression coverage now checks for the Pole Position-style road sweep instead of only checking for a fixed center line.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:46 EDT',
    summary: 'Added Race/Car to broad portrait root menu coverage.',
    details: [
      'The shared portrait bottom-menu size test now includes Race Editor and Car Editor.',
      'Race and Car are pulled from the shared editor menu spec, so the test protects the canonical portrait roots instead of duplicating local assumptions.',
      'This keeps the newer Race/Car editors under the same no-more-than-eight bottom-menu rule as Pixel, Level, Actor, MIDI, SFX, and Cutscene.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:44 EDT',
    summary: 'Hardened shared landscape rail metadata coverage.',
    details: [
      'The shared compact landscape command rail test now verifies disabled, onClick, and primary metadata survives the helper path.',
      'This protects all editors using the four-button landscape rail from accidentally turning disabled or inert commands into live-looking buttons.',
      'This supports the Race/Car rail cleanup by locking the shared helper contract underneath it.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:41 EDT',
    summary: 'Disabled unavailable Race/Car rail history buttons.',
    details: [
      'Race Editor and Car Editor direct portrait and landscape rails now route Undo/Redo through the same availability check as menu drawer rows.',
      'Unavailable Undo/Redo actions stay visible for rail consistency but render disabled and do not fire no-op status text.',
      'Regression coverage now checks Car portrait and Race/Car landscape rails for disabled history buttons.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:37 EDT',
    summary: 'Fixed Race/Car gamepad menu state after controller disconnect.',
    details: [
      'Race Editor and Car Editor now collapse gamepad-only root/submenu state when the controller disconnects.',
      'This prevents a gamepad slide-out submenu flag from surviving into touch landscape mode after the input mode changes.',
      'Rendered Race/Car layout coverage now simulates a disconnect from an active gamepad submenu and verifies the left slide-out state is gone.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:35 EDT',
    summary: 'Aligned Race/Car mobile desktop-dropdown cleanup with shared editors.',
    details: [
      'Race Editor and Car Editor mobile draw now clear stale desktop dropdown state through resolveDesktopDropdownState instead of a raw null assignment.',
      'The broad portrait/menu model coverage now asserts RaceEditor uses the same shared mobile cleanup path as Level, MIDI, SFX, Cutscene, Actor, and Pixel.',
      'Intentional command-close dropdown resets remain unchanged; this only normalizes the desktop-to-mobile layout transition.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:33 EDT',
    summary: 'Reworked Race playtest controls toward Pole Position handling.',
    details: [
      'Race playtest now starts in Neutral and supports Reverse, Neutral, and gears 1 through 6; G revs in Neutral without needing Up and first gear moves the car after shifting.',
      'Touch G/R now treats pointer id 0 as a real held input, fixing devices where G appeared dead unless another input was pressed.',
      'D-pad diagonals now steer instead of accidentally shifting, while straight up/down still shift gears.',
      'The renderer now keeps a stable Pole Position-style vanishing point, with the road bending from track data and only a small steering lean instead of a F-Zero-style camera yaw.',
      'Race HUD panels were reduced again, including the tach, time, co-driver, and damage overlays, so they cover less of the track.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:22 EDT',
    summary: 'Made Race desktop left-panel commands release-activated.',
    details: [
      'Desktop non-dropdown Race/Car command hits now keep a separate pending command state instead of firing immediately on pointer-down.',
      'End Drive in the desktop left context panel now waits for release before ending the playtest.',
      'Dragging away from End Drive cancels the action, matching the desktop dropdown drag-off behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:19 EDT',
    summary: 'Fixed Race desktop playtest dropdown input routing.',
    details: [
      'Desktop playtest no longer lets the handheld playtest pointer path swallow desktop dropdown rows.',
      'File/New during desktop playtest now waits for pointer release before resetting the project, matching the rest of the desktop editors.',
      'Mobile playtest controls still use the dedicated handheld hit path for d-pad, G, R, Start, and Select.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:17 EDT',
    summary: 'Moved Race desktop End Drive out of the preview surface.',
    details: [
      'Desktop Race playtest now renders End Drive in the left context panel instead of over the race preview.',
      'The race preview/work surface stays clean while the desktop session control remains visible.',
      'Regression coverage verifies the desktop End Drive button is left of the work surface and rejects the old preview-corner placement.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:15 EDT',
    summary: 'Removed duplicate Race/Car command overlay from desktop work surfaces.',
    details: [
      'Race and Car desktop now keep route/build/play commands in the app-style top dropdown drawers instead of also drawing them as a builder strip over the preview.',
      'Portrait and landscape touch still expose the direct route-building shortcuts where quick tap access matters.',
      'Regression coverage now rejects non-drawer Generate/Add/Curve/Hill/Surface/Play buttons on Race desktop and non-drawer Play on Car desktop.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:13 EDT',
    summary: 'Covered Race and Car desktop top-menu hover switching.',
    details: [
      'Rendered Race Editor coverage now opens File, hovers Road, and verifies the Road dropdown replaces File with Draw Road visible.',
      'Rendered Car Editor coverage now opens File, hovers Drivetrain, and verifies the Drivetrain dropdown replaces File with RWD visible.',
      'The broad desktop hover contract now also checks RaceEditor uses the shared resolveDesktopDropdownHoverSwitch path.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:11 EDT',
    summary: 'Locked Race and Car into the shared gamepad menu root contract.',
    details: [
      'Shared menu spec coverage now includes Race and Car controller root ids, labels, and submenu ids alongside Pixel, Level, Actor, MIDI, SFX, and Cutscene.',
      'Rendered Car Editor gamepad landscape coverage now opens the Drivetrain root and verifies its submenu replaces the left rail instead of drawing on the right.',
      'This keeps Race and Car aligned with the landscape/gamepad model while the broader editor UI standardization continues.'
    ]
  },
  {
    date: '2026-07-02',
    time: '14:07 EDT',
    summary: 'Aligned Race and Car landscape root menus with the shared editor grid.',
    details: [
      'Race Editor and Car Editor landscape Menu drawers now use buildLandscapeRootDrawerGridLayout and buildScrolledLandscapeRootDrawerItems like the mature canvas editors.',
      'The real Race and Car landscape drawers now show every root category at phone-landscape size without requiring main-menu scrolling.',
      'The change keeps submenu drawers on the right for touch landscape and preserves gamepad mode where the selected submenu replaces the left rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '13:59 EDT',
    summary: 'Improved Race Editor route creation and playtest readability.',
    details: [
      'Added an always-visible race builder overlay on the race work surface with Generate, Add Segment, Prev/Next, Curve, Hill, Surface, and Play controls so creating or changing a race is not hidden inside drawers.',
      'Desktop playtest now renders the same live race screen path as handheld playtest instead of the passive editor preview, with an End Drive control kept available.',
      'Shrank the tach/time/damage HUD panels so they cover less of the road and tuned acceleration, auto-shift, road stripe speed, curve projection, elevation pitch, roadside markers, and speed streaks so 160 mph, hills, bumps, and turns read more clearly.',
      'Race and Car desktop preview dragging now consumes the shared editor pointer policy for middle/right drag scrubbing without interfering with top menus or scrollable drawers.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:39 EDT',
    summary: 'Aligned Race and Car specs with Drive/Playtest naming.',
    details: [
      'UISpec.md now lists Race and Car root menus ending in Drive instead of Test.',
      'RaceEditorSpec.md now describes the current handheld race playtest surface with G/R, steering, shifting, pause, and camera switching.',
      'Updated the menu spec regression test so future UI work keeps the product-facing Drive wording.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:36 EDT',
    summary: 'Made Race Editor mobile Playtest a playable handheld race mode.',
    details: [
      'After choosing a car, mobile Race Playtest now takes over the viewport with the existing portrait Game Boy-style or landscape Game Gear-style handheld frame.',
      'Controls now map to racing inputs: left/right steer, up/down shift gears, G accelerates, R brakes, and double-tapping R engages handbrake.',
      'The playtest supports analog steering/triggers, speed-limited steering authority, pause, and switching between third-person and first-person with a rotating steering wheel.',
      'Renamed product-facing default race/play labels away from unit-test wording: the sample race is Studio Sprint, the jump is Crest Jump, and the menu action reads Playtest/Drive.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:29 EDT',
    summary: 'Moved Race and Car desktop dropdown commands to release activation.',
    details: [
      'Race Editor and Car Editor desktop dropdown rows now use the shared pending-hit lifecycle used by the other canvas editors.',
      'Pressing a dropdown command no longer fires immediately; it activates only on clean release inside the same row.',
      'Disabled scaffold rows stay actionless, and moving off the row before release suppresses activation.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:25 EDT',
    summary: 'Moved Race and Car portrait bottom rails onto the shared action rail helper.',
    details: [
      'Race Editor and Car Editor portrait now draw Menu, Undo, Redo, and Test through drawSharedPortraitActionRail.',
      'The change keeps the existing portrait menu sheet behavior, but removes the local hand-laid-out action row from the newest editors.',
      'Added Race/Car portrait regression coverage for the shared four-button bottom rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:23 EDT',
    summary: 'Kept MIDI portrait thumbstick hit state after drawing the shared rail.',
    details: [
      'MIDI portrait no longer clears the thumbstick geometry immediately after the shared bottom rail draws it.',
      'Mobile landscape still draws the separate pan joystick, and desktop still clears mobile thumbstick state.',
      'Updated the source guard to lock the portrait, landscape, and desktop split.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:21 EDT',
    summary: 'Limited MIDI pan joystick drawing to mobile landscape.',
    details: [
      'MIDI portrait now relies on the shared bottom action rail to draw the reserved thumbstick and Menu/Undo/Redo/Play buttons.',
      'The outer MIDI draw path only draws the separate pan joystick in mobile landscape, preventing duplicate portrait thumbstick chrome.',
      'Updated the portrait menu source guard so future edits preserve the portrait-vs-landscape split.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:18 EDT',
    summary: 'Removed the duplicate SFX portrait thumbstick draw.',
    details: [
      'SFX portrait now relies on the shared bottom action rail to draw the thumbstick and Menu/Undo/Redo/Play buttons.',
      'The separate portrait pan-joystick draw call was removed so it cannot overlap Generate, Layers, or Settings content after the menu sheet renders.',
      'Added a portrait menu regression assertion that keeps the SFX portrait path from drawing the extra joystick again.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:14 EDT',
    summary: 'Added rendered Race and Car gamepad slide-out coverage.',
    details: [
      'The mobile gamepad landscape browser contract now opens Race/Car menus with a connected controller.',
      'It verifies selecting a root collapses the left root rail and shows the submenu on the left.',
      'It also verifies no right-side submenu is rendered in gamepad mode.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:12 EDT',
    summary: 'Added rendered Race and Car landscape menu interaction coverage.',
    details: [
      'The mobile landscape browser contract now taps the Race/Car Menu rail and selects a root category.',
      'It verifies the root drawer remains on the left while the selected submenu command appears on the right.',
      'It also verifies submenu commands are not duplicated and Test Drive remains on the bottom rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:10 EDT',
    summary: 'Added rendered mobile portrait contract coverage across editors.',
    details: [
      'The Playwright layout contract now opens every canvas editor in portrait mobile mode and verifies bottom action/menu hit targets exist.',
      'The same portrait contract rejects desktop dropdowns, desktop root buttons, and landscape flags in portrait mode.',
      'Actor portrait coverage now verifies the bottom menu path renders while legacy top, desktop, and gamepad slide-out chrome stay absent.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:08 EDT',
    summary: 'Expanded desktop-with-controller coverage to Actor Editor.',
    details: [
      'The rendered layout contract now opens Actor with a connected controller in desktop viewport mode.',
      'The test verifies Actor keeps its desktop top menu and top-menu buttons.',
      'The same contract now rejects Actor rendering gamepad slide-out, portrait sheet, or landscape right-rail chrome on desktop.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:06 EDT',
    summary: 'Aligned Race and Car gamepad mode helpers with the canvas editor contract.',
    details: [
      'Race/Car now expose isGamepadLandscapeMenuMode, shouldDrawGamepadSubmenuOnLeft, and shouldDrawControllerOverlay predicates.',
      'Desktop with a connected controller now remains desktop-only for Race/Car, matching the older canvas editors.',
      'The rendered desktop-with-controller layout contract now covers Level, Pixel, MIDI, SFX, Cutscene, Race, and Car.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:03 EDT',
    summary: 'Added explicit Car Editor landscape contract coverage.',
    details: [
      'Race/Car landscape tests now share a helper for opening root drawers through the visible Menu rail.',
      'Car Editor landscape coverage verifies the Art root remains on the left while Edit Shell appears on the right submenu.',
      'The test also locks Test Drive to the bottom rail so Car cannot regress into duplicated submenu buttons.'
    ]
  },
  {
    date: '2026-07-02',
    time: '12:01 EDT',
    summary: 'Removed duplicate Race and Car landscape submenu commands from the bottom rail.',
    details: [
      'Race/Car landscape touch now keeps submenu commands on the right rail only.',
      'The bottom rail now shows persistent race or car status plus Test or End Test controls.',
      'Regression coverage verifies a selected Road command appears once on the right rail while Test remains in the bottom rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:59 EDT',
    summary: 'Aligned Race and Car landscape menus with the shared left/right drawer model.',
    details: [
      'Touch landscape root category picks now keep the left root drawer open instead of collapsing it.',
      'The selected Race/Car submenu now updates on the right rail while the root drawer remains available on the left.',
      'Gamepad landscape keeps the existing replacement behavior where selecting a root swaps the left rail into the submenu.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:56 EDT',
    summary: 'Tightened desktop drawer behavior across canvas editors.',
    details: [
      'Cutscene desktop top-menu highlighting now uses the shared desktop dropdown resolver instead of falling back to the active cutscene tab.',
      'The desktop layout browser contract now opens and click-away closes top drawers for Level, Pixel, MIDI, SFX, Cutscene, Race, and Car through each editor registered hit target.',
      'Regression coverage now rejects Cutscene reintroducing an active-tab fallback for desktop top-menu drawer state.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:53 EDT',
    summary: 'Added a visible Race Editor playtest HUD.',
    details: [
      'Test Drive still asks which Car Editor car to use, then starts a running in-editor playtest session.',
      'The playtest HUD now shows selected car, drivetrain, speed, route progress, enabled AI count, hazard count, next co-driver call, and next hazard.',
      'Race Editor playtest sessions now advance distance and speed from selected car tuning and can be ended from an End Test control or controller cancel.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:49 EDT',
    summary: 'Expanded race playtest planning and tightened desktop chrome coverage.',
    details: [
      'RaceEditorSpec.md now calls out car-pick playtesting, solo race testing, AI racer packs, combat hazards, hard jumps, damage walls, and co-driver instruction playback.',
      'The desktop editor layout contract now counts top-menu buttons across all known editor button stores instead of only one canvas button array.',
      'Actor desktop layout coverage now verifies visible top-menu buttons, no initial dropdown, and click-away closing behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:46 EDT',
    summary: 'Made Race and Car touch menu drawers scrollable.',
    details: [
      'Race and Car action rows now register scroll regions when root, submenu, or tool rows overflow their drawer.',
      'Wheel scrolling and tap-drag scrolling update drawer scroll state instead of clipping hidden commands.',
      'Tap-release still activates a row when there was no drag, while drag movement suppresses accidental row activation.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:42 EDT',
    summary: 'Documented the shared desktop File drawer baseline.',
    details: [
      'UISpec.md now states that every editor File drawer starts with New, Save, Save As, Open, Export, Import.',
      'ui/EDITORS_UI_CONTRACT.md now says unsupported baseline File actions must remain visible as disabled inert rows.',
      'The documentation regression now verifies the desktop File drawer baseline alongside the existing closed-drawer desktop contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:39 EDT',
    summary: 'Disabled planned Race and Car menu commands instead of showing no-op buttons.',
    details: [
      'Race and Car menu items now carry explicit availability state.',
      'Unavailable scaffold commands remain visible but disabled across desktop dropdowns and touch/gamepad drawers.',
      'Implemented scaffold commands still work, including New, drivetrain changes, weather changes, race type changes, finish return, exit, and Test Drive.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:35 EDT',
    summary: 'Standardized shared desktop File menu order across editors.',
    details: [
      'Shared editor menu specs now require New, Save, Save As, Open, Export, and Import in that order for every editor File drawer.',
      'Actor, Race, and Car now participate in the same File menu action baseline as Pixel, Level, MIDI, SFX, and Cutscene.',
      'Actor keeps unsupported Import/Export rows visible as disabled standard File menu rows, preserving a consistent desktop drawer shape without pretending those handlers exist.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:32 EDT',
    summary: 'Documented and locked the desktop closed-drawer contract.',
    details: [
      'UISpec.md now states that desktop root drawers start closed, open only from top-menu interaction, and stay closed after click-away redraw.',
      'ui/EDITORS_UI_CONTRACT.md now forbids using the active panel, tool, tab, or document context as the default open desktop dropdown root.',
      'Added source-level regression coverage so Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car keep desktop drawer state independent from persistent context panels.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:28 EDT',
    summary: 'Aligned desktop menu initial state across every editor.',
    details: [
      'Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car now show desktop top menus without forcing a dropdown drawer open by default.',
      'Desktop dropdowns now open from explicit top-menu interaction instead of mirroring the active tool or panel.',
      'Updated rendered/source contracts so desktop chrome means top-menu presence, not an always-open drawer.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:24 EDT',
    summary: 'Fixed Race and Car desktop dropdown open/close behavior.',
    details: [
      'Race and Car desktop drawers now start closed instead of always forcing the File drawer open.',
      'Top menu clicks use the shared desktop dropdown open/close state helpers.',
      'Click-away now leaves the drawer closed on the next draw, matching normal desktop application menus.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:21 EDT',
    summary: 'Aligned Race and Car gamepad landscape menus with the shared slide-out contract.',
    details: [
      'Race and Car gamepad landscape now use the shared gamepad slide-out menu plan.',
      'Pressing Menu opens the left root drawer; selecting a root replaces that drawer with the selected submenu on the left instead of falling through to the touch landscape right-rail model.',
      'Cancel/B now backs from submenu to root, then closes the menu, before exiting the editor.'
    ]
  },
  {
    date: '2026-07-02',
    time: '11:18 EDT',
    summary: 'Added Race Editor playtest car selection and richer race scenario data.',
    details: [
      'Race Editor Test Drive now opens a modal car picker before starting a playtest session.',
      'Playtest sessions record the selected car, race id, enabled AI drivers, hazards, and co-driver calls.',
      'Race data now includes solo/AI/combat competition modes, zombie-pack hazards, jumps, damage walls, and co-driver instructions for future runtime implementation.'
    ]
  },
  {
    date: '2026-07-02',
    time: '09:06 EDT',
    summary: 'Split Actor landscape root and submenu drawers.',
    details: [
      'Actor landscape now keeps the compact left command rail, opens the root Menu in its own left-origin drawer host, and leaves the right rail available for submenu content.',
      'The right submenu rail remains reserved even while the root drawer is open.',
      'Updated regression coverage so Actor landscape cannot collapse root and submenu drawers back into one surface.'
    ]
  },
  {
    date: '2026-07-02',
    time: '09:03 EDT',
    summary: 'Fixed Actor portrait Menu and SFX portrait menu usability.',
    details: [
      'Actor portrait Menu now opens the bottom sheet from the quick rail even when the active Actor/Settings section has no right-side panel.',
      'SFX portrait no longer draws the floating Layer/Duplicate/Delete ribbon over the waveform.',
      'SFX portrait menu hit targets are clipped to the visible sheet, preventing offscreen Generate controls from intercepting Settings/root taps.',
      'SFX Custom waveform editing now appears higher in the Generate panel on portrait.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:58 EDT',
    summary: 'Aligned Pixel landscape with the shared left-menu/right-submenu shell.',
    details: [
      'Removed Pixel landscape\'s work-surface root-menu overlay exception.',
      'Pixel landscape now uses the shared left-origin root drawer for the main Menu and reserves the right rail for the selected submenu when the menu is open.',
      'Kept Pixel zoom and tool controls in the bottom landscape rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:53 EDT',
    summary: 'Fixed MIDI Record portrait menu exits.',
    details: [
      'Updated the active Record-mode pointer path so mobile root taps leave Record and open the selected portrait panel directly.',
      'File and Settings exits now open their portrait sheets on mobile instead of calling the desktop dropdown opener.',
      'Kept desktop Record mode on the shared desktop shell and desktop dropdown path.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:51 EDT',
    summary: 'Restored MIDI portrait root menu navigation.',
    details: [
      'Changed MIDI portrait root-tab taps to activate mobile panels directly.',
      'Grid, Song, Mixer, Record, and Pedals no longer route through the desktop dropdown opener in portrait.',
      'Added regression coverage so portrait MIDI root buttons stay on the mobile activation path.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:48 EDT',
    summary: 'Fixed Cutscene c3 visibility and the portrait File menu blank button.',
    details: [
      'Confirmed `c3` still exists in server storage and in the cutscene manifest.',
      'Updated static storage hydration so relative cutscene image asset refs resolve against the served storage path instead of causing the whole document to be skipped.',
      'Filtered divider rows out of the Cutscene touch menu grid so portrait File menus no longer draw a blank button.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:44 EDT',
    summary: 'Hardened the Actor desktop shell against landscape rail bleed-through.',
    details: [
      'Extended the shared desktop-shell regression so Actor desktop must keep its landscape bottom rail behind the landscape tool-options surface.',
      'Added coverage that desktop Actor rendering does not append the landscape bottom rail from an `isDesktopLayout` branch.',
      'This keeps the DOM editor aligned with the canvas editors: desktop uses top menus and left context panels, while mobile/landscape rails stay out of desktop.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:42 EDT',
    summary: 'Aligned Actor desktop dropdown scroll state with the canvas editors.',
    details: [
      'Changed Actor desktop shell planning so dropdown scroll state is keyed only by the currently open top-menu root.',
      'Removed the Actor-specific fallback to the active left-panel root, matching Pixel, Level, MIDI, SFX, and Cutscene.',
      'Extended the shared desktop dropdown scroll-key regression to cover Actor as well as the canvas editors.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:40 EDT',
    summary: 'Locked the Pixel landscape zoom contract into the UI specs.',
    details: [
      'Updated `UISpec.md` to state that Pixel landscape keeps zoom in the bottom rail beside palette, layer, and frame controls.',
      'Updated `ui/EDITORS_UI_CONTRACT.md` to document that Pixel intentionally leaves the shell zoom surface null and draws zoom from its bottom control rail.',
      'Extended the shared landscape shell test so future layout passes cannot quietly move Pixel landscape zoom back into a separate top strip.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:35 EDT',
    summary: 'Refined Pixel landscape around the portrait-style command rail.',
    details: [
      'Kept Pixel landscape on the fixed four-action left rail: Menu, Undo, Redo, and the contextual Brush/Play quick action.',
      'Removed the separate top zoom strip in landscape so the canvas and bottom controls no longer have a competing zoom surface.',
      'Folded zoom into the right side of the bottom control rail when width allows, leaving palette/layer controls in the same bottom rail without overlap.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:33 EDT',
    summary: 'Improved MIDI desktop pedal-board visibility.',
    details: [
      'Changed the desktop-sized MIDI Pedals board to show real knob labels and 0-10 values directly on each pedal card.',
      'Kept compact, embedded, portrait, and mobile pedal cards on the simpler visual treatment so the existing mobile layouts are not disturbed.',
      'Added coverage that the inline pedal overview is gated to desktop-sized pedal boards.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:30 EDT',
    summary: 'Wired Cutscene File commands through the shared file model.',
    details: [
      'Added Cutscene New, Open, Save, Save As, Export MP4, and Import handlers directly to `buildSharedEditorFileMenu`.',
      'This keeps Cutscene desktop dropdowns, touch drawers, and controller menus backed by the same live File rows instead of relying on later id-specific dispatch.',
      'Extended file-menu coverage so the Cutscene shared File menu cannot regress to actionless standard rows.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:28 EDT',
    summary: 'Aligned MIDI portrait layout naming with the shared bottom-root contract.',
    details: [
      'Added shared `rootTabs`, `subRail`, and `sheetContent` aliases to MIDI portrait control and full-screen sheet layouts.',
      'Kept the existing MIDI portrait rail positions intact while making its layout contract match Pixel, SFX, Cutscene, Actor, and Level.',
      'Extended portrait layout coverage so MIDI root tabs stay bottom-first and sheet content stays above them.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:25 EDT',
    summary: 'Tightened Actor desktop dropdown CSS consistency.',
    details: [
      'Moved Actor desktop dropdown scroll containment into the main desktop dropdown rule instead of a mixed rail/options selector.',
      'Added regression coverage that the Actor desktop dropdown has a single primary style block with RTG Studio panel, border, shadow, and scroll containment.',
      'Kept the DOM editor on the same top-menu/dropdown contract while avoiding portrait or landscape behavior changes.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:22 EDT',
    summary: 'Standardized landscape root Menus as fixed category grids.',
    details: [
      'Changed Level, MIDI, SFX, and Cutscene landscape root drawers to draw every root category directly from the shared grid layout.',
      'Removed root-menu scroll registration from those landscape drawers so the main Menu behaves like a quick picker instead of a hidden vertical list.',
      'Kept scroll behavior available for real submenu and content drawers, preserving gesture drag where panels can actually overflow.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:17 EDT',
    summary: 'Made Pixel landscape root Menu stable and all-visible.',
    details: [
      'Changed Pixel landscape so the Menu button opens a left-anchored panel inside the work surface instead of a centered or right-feeling overlay.',
      'Removed Pixel landscape root-menu scroll handling because all root categories now render as a fixed visible grid.',
      'Kept the persistent left rail to the portrait-style Menu, Undo, Redo, and contextual quick action, with zoom still isolated in the top strip.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:14 EDT',
    summary: 'Aligned Level landscape input bounds with the rendered shell.',
    details: [
      'Changed Level updateLayoutBounds to use the same conditional right submenu rail as the draw path.',
      'Kept root Menu bounds on the left-origin drawer while selected panel bounds use the right submenu rail.',
      'Added coverage so Level landscape hit/zoom bounds cannot drift back to the old generic overlay surface.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:11 EDT',
    summary: 'Moved Cutscene landscape drawers onto split root and submenu surfaces.',
    details: [
      'Changed Cutscene landscape so root Menu uses the shared left-origin root drawer.',
      'Changed Cutscene submenu and clip-options panels to reserve the shared right submenu rail when open.',
      'Kept gamepad slide-out mode from reserving the right rail so controller submenus still replace the left rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:08 EDT',
    summary: 'Moved Actor landscape options onto the shared right submenu rail.',
    details: [
      'Changed Actor landscape so normal contextual options reserve the shared right submenu rail.',
      'Kept Actor root Menu on the left-origin landscape drawer path.',
      'Kept gamepad slide-out mode from reserving the right rail, so controller submenus still replace the left rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:05 EDT',
    summary: 'Moved Level landscape drawers onto separate root and submenu surfaces.',
    details: [
      'Changed Level landscape so the root Menu grid uses the shared left-origin root drawer.',
      'Changed selected Level panel drawers to reserve the shared right submenu rail instead of sharing the root drawer surface.',
      'Kept gamepad slide-out behavior suppressing the right rail so controller submenus still replace the left rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '08:01 EDT',
    summary: 'Migrated MIDI landscape utility drawers to the shared submenu rail.',
    details: [
      'Changed MIDI landscape to reserve the shared right submenu rail only when a right utility drawer is active.',
      'Kept the full MIDI root Menu on the left-origin drawer path instead of the generic right overlay fallback.',
      'Updated layout coverage so MIDI proves it reads `surfaces.submenu` for right drawers while preserving full grid width when no utility drawer is needed.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:59 EDT',
    summary: 'Moved SFX landscape onto the left-root/right-submenu shell contract.',
    details: [
      'Extended the shared landscape shell so a left-origin root Menu can coexist with a reserved right submenu rail.',
      'Changed SFX landscape to reserve the right submenu rail instead of relying on the generic overlay fallback.',
      'Updated focused layout coverage so the shared shell proves root Menu on the left and submenu content on the right.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:53 EDT',
    summary: 'Stabilized Pixel landscape Menu and rail layout.',
    details: [
      'Changed Pixel landscape so the Menu button opens a work-surface overlay instead of a right-side rail that appears and disappears.',
      'Kept the left landscape rail to four fixed portrait-style actions: Menu, Undo, Redo, and the contextual quick action.',
      'Added regression coverage proving the Pixel landscape Menu overlay stays inside the work surface and never overlaps the top zoom rail or bottom tool rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:23 EDT',
    summary: 'Fixed the Actor Linked Parts desktop action.',
    details: [
      'Changed the Actor add-linked-part desktop drawer row from Root Actor Settings to Link Child Actor.',
      'Extracted the existing Link child actor browser flow into a shared Actor Editor method used by both the panel button and the desktop drawer.',
      'Added coverage so the linked-parts drawer keeps calling the real link workflow.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:19 EDT',
    summary: 'Removed stale SFX Generate navigation from the shared menu spec.',
    details: [
      'Removed open-generate from the canonical SFX Generate menu so generated desktop drawers do not get a duplicate Open Generate row.',
      'Kept the real SFX Generate commands available: Generate plus wave type shortcuts.',
      'Extended menu-spec and SFX desktop drawer tests to reject the stale navigation row.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:16 EDT',
    summary: 'Tightened Actor desktop top-menu state handling.',
    details: [
      'Changed Actor desktop open helpers to pass the stored shared dropdown snapshot into the shared open-state resolver.',
      'Changed Actor desktop close helpers to use the shared close-state resolver instead of manually clearing root ids.',
      'Extended Actor desktop top-menu coverage so open and close helpers stay on the shared dropdown-state path.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:14 EDT',
    summary: 'Aligned Actor desktop dropdown state with the shared editor contract.',
    details: [
      'Added the shared desktop dropdown state resolver to Actor Editor so its desktop dropdown snapshot is represented consistently.',
      'Actor now clears that shared dropdown state automatically when leaving desktop layout, matching Pixel, Level, MIDI, SFX, and Cutscene.',
      'Extended the shared desktop dropdown-state test so Actor is included with the other editors.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:11 EDT',
    summary: 'Standardized compact landscape rail display labels across editors.',
    details: [
      'Added shared compact display labels for Menu, Undo, and Redo in the landscape command rail helper.',
      'Updated Pixel, Level, MIDI, SFX, Cutscene, and Actor landscape rail renderers to use the compact display label while preserving the original command label for behavior and accessibility.',
      'Added unit coverage so the shared rail helper keeps the portrait-style compact symbols for landscape rails.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:05 EDT',
    summary: 'Hardened Pixel landscape zoom against bottom-rail overlap.',
    details: [
      'Changed Pixel mobile landscape layout so zoomStrip comes only from the explicit shared top rail.',
      'Overrode the Pixel landscape zoom surface to null instead of falling back to the bottom rail if a tiny viewport cannot fit the top rail.',
      'Extended the Pixel landscape layout test to prove zoom uses the top rail and does not share the bottom tool rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '07:00 EDT',
    summary: 'Updated the canonical UI docs for the current shared menu contract.',
    details: [
      'Documented the fixed 84px landscape command rail and clarified that full drawers and tool panels scroll, not the four-button rail.',
      'Updated UISpec editor menu sections to remove stale placeholder rows such as layer list, frame list, MIDI arrangement, SFX scrub, and generic keyframe placeholders.',
      'Added tests so the docs stay aligned with the shared landscape shell and runtime command menu specs.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:58 EDT',
    summary: 'Removed stale open-current-panel rows from shared menu specs.',
    details: [
      'Aligned the MIDI shared menu spec with the runtime drawers by removing Open Grid, Open Song, Open Mixer, Open Record, Open Pedals, and Open Settings rows.',
      'Kept dynamic MIDI track rows owned by the runtime menu builder instead of static spec placeholder rows.',
      'Removed the stale SFX Open Settings spec row so Settings contains the real Loop command only.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:55 EDT',
    summary: 'Canonicalized MIDI portrait rail action ids.',
    details: [
      'Changed the MIDI portrait rail model from internal fileButton/undoButton/redoButton ids to shared Menu, Undo, Redo, and Play action ids.',
      'Mapped those canonical ids back to the existing MIDI bounds keys so pointer handling remains compatible.',
      'Added coverage that MIDI now matches the shared portrait rail naming used by Pixel, Level, SFX, Actor, and Cutscene.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:52 EDT',
    summary: 'Made the landscape command rail fixed instead of scrollable.',
    details: [
      'Updated the shared landscape scroll policy so compactCommandRail and leftRail are fixed four-button command surfaces.',
      'Kept root drawers, right drawers, bottom rails, and work surfaces on touch drag semantics.',
      'Added coverage that every editor inherits the fixed command rail while full Menu drawers remain scrollable.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:50 EDT',
    summary: 'Standardized the landscape command rail width across editors.',
    details: [
      'Added a shared 84px compact landscape command-rail width in the editor layout shell.',
      'Removed Pixel and Actor local left-rail width overrides so all landscape editors inherit the same portrait-style Menu, Undo, Redo, quick-action rail.',
      'Kept editor-specific right drawers and bottom tool/zoom rails intact so landscape remains optimized per editor.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:47 EDT',
    summary: 'Tightened Pixel landscape rail behavior and desktop dropdown coverage.',
    details: [
      'Narrowed Pixel mobile landscape to a portrait-style four-button command rail for Menu, Undo, Redo, and the contextual quick tool.',
      'Kept Pixel landscape full Menu access on the left-origin overlay drawer instead of using a persistent right rail.',
      'Added cross-editor coverage that release-activated desktop dropdown commands close through the shared close-state resolver.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:44 EDT',
    summary: 'Aligned gamepad slide-out plans with controller root entries.',
    details: [
      'Changed the shared gamepad slide-out plan to use controller root entries instead of plain root entries.',
      'Added layout coverage that Pixel Frames/Rigging, Level Tile Art, and MIDI Mixer aliases carry the same controller submenu ids in gamepad planning.',
      'This keeps gamepad slide-outs aligned with the shared landscape/menu controller model after the recent controller-entry cleanup.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:41 EDT',
    summary: 'Added shared controller root entry submenu ids.',
    details: [
      'Extended shared menu-spec controller root entries with a controllerMenuId field so runtime display ids and controller submenu ids stay paired.',
      'Removed Pixel Studio’s local Frames/Rigging submenu mapper and switched all editor controller root entry constants to the shared controller-entry helper.',
      'Added spec coverage for Pixel, Level, and MIDI alias entries so desktop drawers, landscape menus, and gamepad slide-outs keep matching submenu ids.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:35 EDT',
    summary: 'Shared editor controller root id and label helpers.',
    details: [
      'Added shared menu-spec helpers for controller root menu ids and root label maps, including runtime aliases like Pixel Frames/Bones and Level Tile Art/Actors.',
      'Updated Pixel, Level, MIDI, SFX, Cutscene, and Actor to use those shared helpers instead of each rebuilding sibling/root id lists and label maps locally.',
      'Added menu-spec coverage so controller root ids and alias labels stay consistent across desktop dropdowns, landscape menus, and gamepad slide-outs.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:26 EDT',
    summary: 'Removed desktop dropdown fallback rows.',
    details: [
      'Changed Level, MIDI, SFX, and Cutscene desktop dropdowns to render from live controller/action menu rows instead of falling back to panel config, spec, or local menu rows.',
      'Updated the cross-editor desktop dropdown regression so canvas editor top drawers reject fallback row sources and stay backed by actionable menu items.',
      'Left Actor on its DOM desktop action path, which already builds dropdown actions directly for the selected root.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:24 EDT',
    summary: 'Removed per-editor landscape root drawer overrides.',
    details: [
      'Removed redundant rootDrawerOverlayOrigin overrides from Pixel, Level, MIDI, SFX, Cutscene, and Actor now that left-origin root drawers are the shared default.',
      'Added cross-editor regression coverage so editors rely on the shared landscape default instead of each carrying local left-origin menu flags.',
      'Kept the explicit right-overlay opt-out covered in the shared layout tests for any future specialized landscape surface.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:19 EDT',
    summary: 'Made left-origin landscape root drawers the shared default.',
    details: [
      'Changed the shared landscape shell so full root Menu drawers open from the compact left rail by default when no right submenu rail is reserved.',
      'Updated layout coverage so the default contract expects left-overlay drawers and still verifies an explicit right-overlay opt-out path.',
      'Tightened UISpec and the editor UI contract wording so the implementation, tests, and product spec all describe the same landscape Menu behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:15 EDT',
    summary: 'Locked all editors to the shared desktop shell.',
    details: [
      'Added a cross-editor contract test covering Pixel, Level, MIDI, SFX, Cutscene, and Actor desktop shell entry points.',
      'The test verifies canvas editors use shared top menus, ribbons, context panels, and dropdown drawers instead of mobile landscape chrome.',
      'Actor desktop is now explicitly checked for top-menu/dropdown/left-panel DOM equivalents and for suppressing the mobile right rail on desktop.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:13 EDT',
    summary: 'Removed stale Pixel portrait top-tab helper.',
    details: [
      'Deleted the unused Pixel drawPortraitToolTabs helper that still described a top-row portrait tab pattern.',
      'Kept the active Pixel portrait root menu on the shared bottom multi-row tab strip.',
      'Added regression coverage so the stale top-tab helper name does not return.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:11 EDT',
    summary: 'Level portrait secondary menus moved bottom-first.',
    details: [
      'Moved Level portrait asset/settings subgroup chips to a bottom strip inside the menu sheet.',
      'Reserved space for that bottom subgroup strip before sizing the scrollable content list.',
      'Added regression coverage so Level portrait secondary tabs stay below content instead of returning to the top.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:07 EDT',
    summary: 'Landscape root drawer contracts now default to left-origin menus.',
    details: [
      'Changed the shared high-level landscape menu plan so rootDrawer reports left-overlay-drawer instead of right-drawer.',
      'Added regression coverage that root Menu drawers originate from the left while submenus remain right-drawer surfaces.',
      'Updated UISpec and the editor UI contract to make left-origin landscape main menus the expected pattern.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:04 EDT',
    summary: 'Landscape top zoom strips are now a shared shell option.',
    details: [
      'Added an opt-in topRailHeight option to the shared landscape touch shell plan.',
      'Refactored Pixel landscape to use the shared top zoom rail instead of local work-surface offset math.',
      'Documented the top zoom rail as an exception for editors whose bottom rail is already dedicated to tool or palette controls.'
    ]
  },
  {
    date: '2026-07-02',
    time: '06:00 EDT',
    summary: 'Pixel landscape rail and zoom layout were tightened.',
    details: [
      'Added a dedicated Pixel landscape zoom strip above the canvas so the slider no longer overlaps the bottom rail.',
      'Kept the landscape left rail fixed to Menu, Undo, Redo, and the contextual quick action while the full Menu opens from that rail.',
      'Changed the landscape Menu drawer to use its full available surface with scroll hints instead of visually collapsing to its content height.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:55 EDT',
    summary: 'Actor desktop top-menu focus behavior now matches hover switching.',
    details: [
      'Changed Actor desktop top-menu focus to use the shared hover-switch resolver.',
      'Kept click as the explicit way to open a closed Actor desktop drawer.',
      'Added regression coverage so focus alone does not reopen desktop drawers unexpectedly.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:53 EDT',
    summary: 'Desktop context panels now default to context-only layout.',
    details: [
      'Changed the shared desktop context/transport layout helper so transport is opt-in instead of the default.',
      'Kept MIDI, SFX, and Cutscene transport explicit while Pixel and Level remain context-only.',
      'Added a regression assertion so new desktop panels do not accidentally inherit mobile-style transport controls.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:49 EDT',
    summary: 'Desktop transport placement is now explicit across editor left panels.',
    details: [
      'Pinned SFX and Cutscene desktop context panels to explicitly keep transport in the left column.',
      'Kept MIDI transport conditional and explicit so the instruments desktop workflow can use the full left context area.',
      'Tightened desktop layout tests so transport cannot silently drift back into mobile-style bottom rails.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:45 EDT',
    summary: 'MIDI and Cutscene landscape drawers now separate main Menu from right submenus.',
    details: [
      'Moved MIDI landscape root Menu rendering to the shared left-origin rootDrawer surface.',
      'Added separate Cutscene rootMenuBounds so the root Menu opens from the left rail while submenu panels stay on the right.',
      'Updated UISpec and the editor UI contract to document left-origin root drawers separately from right submenu drawers.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:39 EDT',
    summary: 'Landscape root Menu drawers now have a shared left-origin surface.',
    details: [
      'Added a shared landscape rootDrawer surface that can open from the compact left rail while keeping the generic right overlay available.',
      'Moved Pixel, Level, SFX, and Actor root Menu drawer layout onto the shared left-origin surface.',
      'Added layout tests so root Menu drawers and right-side contextual overlays stay distinct.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:33 EDT',
    summary: 'Pixel landscape Menu now behaves more like the portrait bottom Menu pattern.',
    details: [
      'Kept the Pixel landscape left rail as four stable controls: Menu, Undo, Redo, and the contextual quick action.',
      'Moved the full landscape Menu drawer to open from the left rail instead of appearing as a right-side rail.',
      'Right-aligned the floating zoom control inside the work surface so it stays away from the bottom tool rail and the left Menu drawer.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:29 EDT',
    summary: 'Actor desktop menu semantics now match the shared desktop menu model more closely.',
    details: [
      'Added menubar and menu roles to the Actor desktop top menu and dropdown drawer.',
      'Added stable root and action ids to Actor desktop root buttons and dropdown rows.',
      'Exposed aria-expanded on Actor desktop root buttons so the DOM editor behaves more like a regular desktop menu.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:18 EDT',
    summary: 'Landscape root drawer scroll rendering was moved into a shared helper.',
    details: [
      'Added a shared scrolled landscape root drawer helper that clamps scroll and returns only visible grid rows.',
      'Moved Pixel, Level, MIDI, SFX, and Cutscene landscape root drawers onto that shared helper.',
      'Updated layout contract tests so the canvas editors no longer carry separate root drawer scroll math.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:16 EDT',
    summary: 'MIDI, SFX, and Cutscene landscape root drawers now honor scroll position.',
    details: [
      'Stopped MIDI landscape root Menu from resetting controller root scroll while the drawer is open.',
      'Stopped SFX landscape root Menu from resetting controller root scroll while browsing root categories.',
      'Stopped Cutscene landscape root Menu from resetting its root drawer scroll and clipped all three grids to their drawer bounds.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:10 EDT',
    summary: 'Level landscape root Menu drawer now honors scroll position.',
    details: [
      'Stopped the Level landscape root drawer from resetting root menu scroll to zero while it is open.',
      'Applied the shared root-grid line-height offset while drawing the landscape Menu grid.',
      'Clipped the Level landscape Menu grid to the drawer list bounds so short landscape screens scroll cleanly.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:07 EDT',
    summary: 'Pixel landscape rail and Menu drawer were tightened after device testing.',
    details: [
      'Kept the Pixel landscape left rail to the compact Menu, Undo, Redo, and contextual quick action pattern.',
      'Rendered the landscape Brush quick action as the same brush preview chip used by portrait instead of another text-like menu button.',
      'Added actual clipped scroll offset handling to the Pixel landscape Menu drawer for short landscape viewports.'
    ]
  },
  {
    date: '2026-07-02',
    time: '05:03 EDT',
    summary: 'Desktop top-menu dropdown opening moved onto a shared resolver.',
    details: [
      'Added a shared desktop dropdown open-state resolver that clears stale closed roots and selects the requested top-menu root.',
      'Moved Pixel, Level, MIDI, SFX, Cutscene, and Actor top-menu click/hover open paths onto the shared resolver.',
      'Kept editor-specific side effects, such as Cutscene closing clip option panels and Actor rerendering after DOM menu changes.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:54 EDT',
    summary: 'Desktop dropdown wheel scrolling now shares one state updater.',
    details: [
      'Added a shared desktop dropdown wheel-scroll state helper next to the existing dropdown wheel resolver.',
      'Moved Pixel, Level, MIDI, SFX, Cutscene, and Actor onto the shared helper so every editor updates dropdown scroll maps the same way.',
      'Updated regressions to reject the older per-editor root-index assignment pattern.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:49 EDT',
    summary: 'SFX gamepad slide-out no longer competes with touch thumbstick chrome.',
    details: [
      'Changed SFX landscape/gamepad rendering so the virtual touch thumbstick is reset while the physical-gamepad slide-out submenu owns the left rail.',
      'Kept touch landscape behavior intact when gamepad slide-out is not active.',
      'Updated UISpec and the editor UI contract to document stable landscape root drawers and suppression of touch-only menu thumbsticks in gamepad slide-out mode.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:44 EDT',
    summary: 'Landscape Menu category picks now stay open across editors.',
    details: [
      'Updated Level, MIDI, SFX, Cutscene, and Actor landscape root/category handlers so choosing a category keeps the Menu drawer open.',
      'Left outside-tap, mode-exit, and explicit Menu button close behavior intact so the drawer still has predictable ways to dismiss.',
      'Added focused source regressions covering the category-pick handlers so future changes do not reintroduce immediate drawer collapse.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:39 EDT',
    summary: 'Pixel landscape Menu and zoom behavior tightened after device testing.',
    details: [
      'Kept the landscape left rail as the four fixed actions: Menu, Undo, Redo, and the contextual quick action.',
      'Changed landscape Menu category taps to keep the right drawer open instead of dismissing it immediately, so the drawer no longer flashes in and out while browsing sections.',
      'Moved the landscape zoom slider to the upper-left of the work surface so it stays clear of the right Menu drawer and the bottom palette/layer/frame rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:34 EDT',
    summary: 'Desktop top-menu hover switching moved into a shared resolver.',
    details: [
      'Added a shared desktop hover-switch resolver that only returns a new root when a drawer is already open.',
      'Replaced local hover gate logic in Pixel, Level, MIDI, SFX, Cutscene, and Actor with the shared resolver.',
      'Added unit coverage so passive hover cannot reopen closed desktop drawers.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:28 EDT',
    summary: 'Desktop top-menu hover no longer passively opens closed drawers.',
    details: [
      'Aligned Pixel, Level, MIDI, SFX, Cutscene, and Actor so hover only switches desktop drawers after one is already open.',
      'Kept click and keyboard focus as the explicit ways to open a desktop top-menu drawer.',
      'Updated regressions to preserve normal desktop menu behavior after click-away closes a drawer.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:24 EDT',
    summary: 'Actor desktop top-menu hover behavior now matches desktop menu expectations.',
    details: [
      'Changed Actor desktop top-menu hover so moving across the top bar only switches drawers after a drawer is already open.',
      'Kept explicit click and keyboard focus behavior opening desktop drawers.',
      'Added a regression so Actor DOM desktop chrome stays aligned with the shared canvas editor menu contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:21 EDT',
    summary: 'Actor landscape Menu root drawer joined the shared grid contract.',
    details: [
      'Moved the Actor DOM landscape root drawer onto the shared all-visible Menu grid helper.',
      'Changed the Actor landscape root drawer from CSS auto-fit columns to fixed button bounds from the shared layout helper.',
      'Updated Actor regressions so its DOM drawer stays aligned with the canvas editors while keeping the same compact left rail and bottom context rail.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:18 EDT',
    summary: 'Level and Cutscene landscape Menu root grids now use the shared helper.',
    details: [
      'Moved Cutscene landscape root drawer button geometry to the shared all-visible grid helper.',
      'Moved the Level landscape root picker inside the right drawer to the same shared grid helper while preserving the existing submenu/content drawer flow.',
      'Updated regressions so Pixel, Level, MIDI, SFX, and Cutscene all reject local landscape root-grid math.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:14 EDT',
    summary: 'Shared landscape root drawer grid layout started replacing local editor math.',
    details: [
      'Added a pure shared helper for landscape Menu root grids so editors agree on columns, button bounds, line height, and scroll limits.',
      'Moved Pixel, MIDI, and SFX landscape root drawers onto the shared helper while preserving their existing compact left rails.',
      'Added unit coverage for the shared all-visible grid behavior and updated editor regressions to reject local root-grid drift.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:07 EDT',
    summary: 'Pixel landscape menu and zoom placement were cleaned up.',
    details: [
      'Kept the Pixel landscape left rail focused on Menu, Undo, Redo, and the contextual quick action.',
      'Changed the landscape Menu drawer to act as a root picker only; choosing a category closes the drawer instead of leaving a mixed right menu/content panel open.',
      'Moved the landscape zoom slider into a compact floating control over the canvas so it no longer competes with the bottom rail palette, layer, or frame controls.'
    ]
  },
  {
    date: '2026-07-02',
    time: '04:02 EDT',
    summary: 'Level desktop drawers now avoid duplicate open-current-panel rows.',
    details: [
      'Removed Open Toolbox, Open Graphics, and Open Music rows from Level controller/desktop drawer data.',
      'Kept concrete Level drawer actions such as tool modes, graphics rows, music rows, tile art, and Open MIDI Composer.',
      'Updated regressions so Level drawers stay command-focused like MIDI and SFX.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:59 EDT',
    summary: 'MIDI and SFX desktop drawers now prioritize commands over duplicate navigation.',
    details: [
      'Removed MIDI drawer rows such as Open Grid, Open Song, Open Mixer, Open Record Tab, Open Pedals, and Open Settings where the top menu already provides that context.',
      'Removed SFX Open Generate Panel and Open Settings rows from desktop/controller drawers.',
      'Added regressions so desktop drawers stay command-focused instead of repeating mobile-style panel navigation.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:55 EDT',
    summary: 'Level editor dead-button rows were made inert.',
    details: [
      'Removed empty click handlers from Level NPC separator rows so headers do not behave like dead buttons.',
      'Changed trigger action numeric and volume readouts to disabled inert controls while keeping their minus and plus buttons active.',
      'Added regressions so no-op Level menu controls do not creep back into desktop or shared menu surfaces.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:51 EDT',
    summary: 'Actor landscape Menu now uses a grid root drawer.',
    details: [
      'Kept the Actor landscape left rail to Menu, Undo, Redo, and Play.',
      'Changed the DOM root drawer from a vertical scrolling list to a responsive grid.',
      'Kept selected Actor sections opening through the existing right overlay and contextual panel flow.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:50 EDT',
    summary: 'Level landscape Menu now uses an all-visible root grid.',
    details: [
      'Kept the Level landscape left rail to Menu, Undo, Redo, and Play.',
      'Changed the opened landscape root drawer to a multi-column category grid so all Level roots are visible at once.',
      'Kept zoom controls on the shared bottom rail and preserved the selected panel drawer behavior after choosing a root.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:48 EDT',
    summary: 'MIDI landscape Menu now uses an all-visible root grid.',
    details: [
      'Kept the MIDI landscape left rail to Menu, Undo, Redo, and Play.',
      'Changed the opened MIDI landscape root drawer from a scroll list to a compact category grid.',
      'Kept MIDI File, View, Settings, and Record utility drawers on the existing right overlay path.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:45 EDT',
    summary: 'SFX landscape Menu now uses an all-visible root grid.',
    details: [
      'Kept the SFX landscape left rail to Menu, Undo, Redo, and Play.',
      'Changed the opened root drawer from a scroll list to a compact category grid.',
      'Kept the selected SFX panels and bottom transport/options rail behavior intact.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:43 EDT',
    summary: 'Cutscene landscape Menu now uses an all-visible root grid.',
    details: [
      'Kept the Cutscene landscape left rail to Menu, Undo, Redo, and Play.',
      'Changed the opened landscape Menu drawer from a single-column scroll list to a compact root grid.',
      'Preserved the existing right-drawer submenu behavior after selecting a root category.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:40 EDT',
    summary: 'Pixel landscape Menu no longer uses a scrolling left root list.',
    details: [
      'Kept the Pixel landscape left rail to the four portrait-style commands: Menu, Undo, Redo, and the contextual quick action.',
      'Changed the opened landscape Menu drawer to show all root categories in a compact top grid, with the selected panel below.',
      'Left the drawer as a right-side overlay so opening menus does not resize the canvas or make the work area jump.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:38 EDT',
    summary: 'All canvas editors now share desktop dropdown pending-hit behavior.',
    details: [
      'Moved Cutscene desktop dropdown press, drag, and release handling onto the same shared pending-hit helper used by Pixel, Level, MIDI, and SFX.',
      'Confirmed MIDI is already on the helper path and updated the regression coverage to enforce shared activation behavior there too.',
      'Kept dropdown commands release-only so desktop menus do not double-trigger when the pressed item changes the visible drawer underneath the pointer.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:34 EDT',
    summary: 'Shared desktop dropdown pending-hit helpers now cover Pixel, Level, and SFX.',
    details: [
      'Added shared helpers to create, update, and resolve desktop dropdown pending hits so rows activate only on clean pointer release.',
      'Moved Pixel, Level, and SFX desktop dropdown press/move/release lifecycle code onto the shared helper path.',
      'Added layout-helper coverage and updated editor regressions so duplicated 6px movement threshold logic does not creep back into those editors.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:28 EDT',
    summary: 'Actor desktop labels now use shared menu root labels.',
    details: [
      'Removed the local hard-coded Actor desktop root label table.',
      'Expanded the Actor root label map to include shared spec ids and runtime ids from the shared menu entries.',
      'Updated Actor desktop coverage so the persistent left context panel stays aligned with the shared menu spec labels.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:26 EDT',
    summary: 'Actor landscape now shares compact rail geometry with the other editors.',
    details: [
      'Changed the Actor DOM landscape command rail to consume the shared compact landscape button-layout helper.',
      'Passed the shared landscape compact rail bounds into the Actor rail so Menu, Undo, Redo, and Play align with the canvas editors.',
      'Updated Actor landscape coverage so the DOM editor stays tied to the same shared four-action rail contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:22 EDT',
    summary: 'Canvas editors now share compact landscape rail button geometry.',
    details: [
      'Added a shared compact landscape command rail button-layout helper with the four-action limit baked into the layout path.',
      'Updated Pixel, Level, MIDI, SFX, and Cutscene landscape rails to use the shared helper for Menu, Undo, Redo, and their contextual quick action.',
      'Added layout and cross-editor source coverage so canvas editors do not drift back to different compact rail spacing or sizing.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:15 EDT',
    summary: 'Shared landscape plans now distinguish compact rails from full root drawers.',
    details: [
      'Added explicit compactCommandRail and rootDrawer surfaces to the shared editor menu layout plan for landscape touch mode.',
      'Added a persistentNavigationActionLimit of 4 for landscape touch so editors keep the left rail to Menu, Undo, Redo, and one contextual quick action.',
      'Updated UISpec, the editor UI contract, and layout tests so future editor work does not treat the compact left rail as a scrollable full root menu.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:08 EDT',
    summary: 'Desktop context panels now show shared menu labels.',
    details: [
      'Changed Pixel, Level, MIDI, and SFX desktop left/context panels to display shared menu labels instead of raw internal tab ids.',
      'Kept the desktop left panels reserved for persistent context/tool state while top drawers remain the command surface.',
      'Added regression coverage so these editors keep using shared label maps for desktop panel subtitles and Active inspector text.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:03 EDT',
    summary: 'MIDI and SFX root menu builders now stay root-only.',
    details: [
      'Removed the unused includeUndoRedo option from the MIDI shared root menu builder.',
      'Removed the same unused history-row injection option from the SFX shared root menu builder.',
      'Updated coverage so MIDI and SFX landscape/gamepad root drawers cannot regain duplicate Undo and Redo rows through shared root-entry helpers.'
    ]
  },
  {
    date: '2026-07-02',
    time: '03:00 EDT',
    summary: 'Level landscape root drawer no longer duplicates Undo and Redo.',
    details: [
      'Changed the Level mobile landscape root drawer model so it lists only real menu roots.',
      'Kept Undo, Redo, and Play on the fixed compact left rail where they match the Pixel-style landscape controls.',
      'Updated coverage so the Level right root drawer cannot reintroduce history command rows.'
    ]
  },
  {
    date: '2026-07-02',
    time: '02:57 EDT',
    summary: 'Pixel landscape now uses a fixed compact rail and a scrollable right menu drawer.',
    details: [
      'Kept the Pixel landscape left rail to the portrait-style four actions: Menu, Undo, Redo, and the contextual Brush/Play quick control.',
      'Added a landscape-only right drawer that shows the full Pixel root menu alongside the selected contextual submenu/content.',
      'Added drag-scroll state for the landscape root drawer and stopped landscape drawer state from reserving extra bottom/control width.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:32 EDT',
    summary: 'Cutscene desktop dropdowns now disable actionless rows.',
    details: [
      'Enabled the shared disableActionlessItems dropdown plan for Cutscene desktop drawers.',
      'Stopped Cutscene desktop dropdown registration from falling back to handleButton for rows without a real action.',
      'Updated desktop dropdown coverage so Cutscene now follows the same strict row-click contract as Pixel, Level, MIDI, SFX, and Actor.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:29 EDT',
    summary: 'Actor portrait Menu opens the main bottom sheet first.',
    details: [
      'Changed the Actor portrait quick Menu action so opening the bottom sheet no longer forces the File submenu first.',
      'The File button remains available inside the Actor portrait sheet, but the default opened state now lands on the main Settings/root context.',
      'Updated portrait coverage to lock in the Actor bottom-menu opener behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:27 EDT',
    summary: 'SFX portrait Menu now opens the bottom menu sheet.',
    details: [
      'Changed the SFX portrait Menu action to always open the Generate/root sheet instead of toggling between Generate and Timeline.',
      'Reset controller focus and root scroll when opening the SFX portrait menu so the sheet starts in a predictable state.',
      'Updated portrait menu coverage so SFX keeps the shared bottom-menu opener behavior.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:22 EDT',
    summary: 'Level root menus now resolve shared aliases before opening panels.',
    details: [
      'Added Level root-to-panel helpers around the shared menu spec aliases.',
      'Changed Level controller root rows so shared roots like Tools, Tile Art, Actors, and Structures open the existing Toolbox, Pixels, NPCs, and Prefabs panels.',
      'Changed Level desktop dropdown lookup to use the resolved panel id for live menu items while keeping the shared desktop root id for top-menu highlighting.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:19 EDT',
    summary: 'MIDI mixer and record routing moved into shared menu aliases.',
    details: [
      'Changed MIDI desktop/controller menu lookup to use shared spec aliases for Mixer and Record panels.',
      'Preserved the existing tap-the-grid note workflow by routing only the menu/panel identifiers, not adding note placement commands back to desktop menus.',
      'Added shared-spec coverage for MIDI instruments and virtual-instruments alias routing.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:14 EDT',
    summary: 'Pixel desktop panel routing moved into the shared menu spec.',
    details: [
      'Added shared helpers for desktop root-to-section, section-to-root, and controller-menu lookup.',
      'Moved Pixel Frames and Rigging desktop routing through those shared helpers while preserving the existing Frames and Bones controller submenu ids.',
      'Added coverage so Pixel desktop drawer routing is tested at the shared spec layer instead of living only inside PixelStudio.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:12 EDT',
    summary: 'Actor desktop root routing moved into the shared menu spec.',
    details: [
      'Added a shared desktop section mapping helper to the editor menu spec.',
      'Moved Actor desktop root-to-panel routing into that shared mapping so top-menu roots, controller roots, and desktop sections derive from the same spec.',
      'Added coverage for Actor desktop section routing, including rejection of unknown desktop roots.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:08 EDT',
    summary: 'Portrait root buttons now have validated targets.',
    details: [
      'Added shared validation so portrait root menu entries must resolve through a root menu, section, panel, or runtime alias.',
      'Added explicit shared grouping sections for Level Assets and Actor Settings/Tools so their portrait bottom buttons are documented in the menu spec.',
      'Expanded menu spec coverage to catch unresolved portrait bottom buttons before they become dead mobile controls.'
    ]
  },
  {
    date: '2026-07-02',
    time: '00:03 EDT',
    summary: 'Shared desktop dropdowns can disable actionless rows.',
    details: [
      'Added an opt-in disableActionlessItems flag to the shared desktop dropdown render plan.',
      'Enabled the flag for Pixel, Level, MIDI, SFX, and Actor desktop dropdowns, where rows are expected to carry explicit handlers.',
      'Left Cutscene on its existing id-router path because its desktop rows intentionally call handleButton(item.id).'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:58 EDT',
    summary: 'Generated menu rows no longer fall back to no-op clicks.',
    details: [
      'Changed Pixel controller menu file rows so missing handlers produce disabled rows instead of clickable empty actions.',
      'Changed Level generated panel rows and Level File menu normalization to preserve real handlers and disable rows that do not have one.',
      'Added coverage to prevent Pixel and Level menu generation from reintroducing empty clickable fallback handlers.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:55 EDT',
    summary: 'Pixel landscape uses the shared compact rail surface.',
    details: [
      'Changed Pixel landscape rendering to read surfaces.compactCommandRail before the legacy rootMenu fallback.',
      'Updated the cross-editor UI regression so Pixel is checked against the same named compact rail contract as Level, MIDI, SFX, Cutscene, and Actor.',
      'This finishes the follow-through from the shared landscape shell split between the always-visible four-action rail and the full scrollable root drawer.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:51 EDT',
    summary: 'Landscape compact command rail contract shared across editors.',
    details: [
      'Added shared compactCommandRail and rootDrawer surfaces to the landscape touch shell plan so the left rail is explicitly the four-action quick rail, not the full root menu.',
      'Updated Level, MIDI, SFX, Cutscene, and Actor landscape render paths to read the compact command rail surface before falling back to the legacy rootMenu surface.',
      'Updated UISpec and the editor UI contract so landscape touch formally separates Menu/Undo/Redo/context quick actions from the full scrollable root drawer.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:46 EDT',
    summary: 'MIDI desktop dropdown activation now matches the other editors.',
    details: [
      'Added pending-hit tracking for MIDI desktop drawer rows so commands only run when the pointer press starts on a row and releases on that same row.',
      'Dragging out of a MIDI desktop drawer row cancels activation, preventing accidental command fires during desktop menu transitions.',
      'Expanded the desktop menu regression test so MIDI can no longer fall back to release-only hit detection without a matching press.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:43 EDT',
    title: 'Desktop dropdown shadow shared',
    details: [
      'The shared canvas desktop dropdown painter now draws the same soft drawer shadow used by the Actor DOM desktop dropdown.',
      'Pixel, Level, MIDI, SFX, and Cutscene top-menu drawers inherit the updated RTG Studio desktop menu surface automatically.',
      'Added coverage tying the shared canvas drawer shadow to the Actor DOM dropdown styling so the desktop chrome stays visually aligned.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:40 EDT',
    title: 'Actor gamepad state shared',
    details: [
      'Actor render now derives activeSubmenuId and drawSlideOut from one getGamepadMenuState call.',
      'This aligns the DOM editor with Pixel, Level, MIDI, SFX, and Cutscene so gamepad submenus replace the left rail from the shared state contract.',
      'Updated the Actor gamepad regression to reject the old inline landscape-controller condition.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:36 EDT',
    title: 'Menu alias validation tightened',
    details: [
      'Shared editor menu specs now validate that runtime aliases point to real desktop root sections.',
      'The validator also rejects duplicated alias runtime ids, which can otherwise make top-menu drawers route to the wrong editor panel.',
      'Added focused coverage so future File, Edit, View, and editor-specific root menus keep their spec ids and runtime ids aligned.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:32 EDT',
    title: 'Shared portrait placement marker added',
    details: [
      'The shared mobile portrait editor layout now exposes portraitRootPlacement as bottom-rail alongside rootTabs, rootRail, subRail, and sheetContent.',
      'Level inherits the same named bottom-root menu contract that Pixel, MIDI, SFX, Cutscene, and Actor already expose.',
      'Expanded portrait layout coverage so the shared layout and Level-style portrait path stay bottom-anchored.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:29 EDT',
    title: 'Actor desktop drawer reopen aligned',
    details: [
      'Actor desktop top-menu drawers now allow the same root to reopen when a stale closed-root state is present.',
      'This matches the shared canvas editor desktop dropdown behavior after click-away closes a drawer.',
      'Added regression coverage so the DOM Actor editor does not drift from the shared desktop drawer state contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:26 EDT',
    title: 'Landscape command rail floor shared',
    details: [
      'The shared mobile landscape shell now derives a minimum left-rail height from the canonical four compact actions plus shared gaps and padding.',
      'This protects compact Menu, Undo, Redo, and quick-action rails from being clipped on short landscape viewports while editors that still need thumbsticks can keep their reserved touch zone.',
      'Added focused layout coverage for short landscape shells so the shared compact rail contract applies beyond the Pixel editor.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:23 EDT',
    title: 'Pixel landscape rail tightened',
    details: [
      'Pixel mobile landscape now asks the shared landscape shell for a full-height compact command rail, keeping Menu, Undo, Redo, and the contextual quick action visible without a left-menu scroll.',
      'The Pixel landscape bottom rail now splits palette or management controls from a dedicated zoom slider instead of drawing the floating mobile pan/zoom overlay near the bottom edge.',
      'The shared landscape layout gained an explicit reserveThumbstickSpace option so dense editors can opt into portrait-style compact rails without changing other editors.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:17 EDT',
    title: 'Cutscene drawer state normalized',
    details: [
      'Cutscene controller menus now coerce disabled and active row flags to booleans before handing them to desktop and gamepad drawer rendering.',
      'The existing Cutscene Edit drawer disabled rows for Copy, Cut, Paste, and Delete are now covered alongside controller normalization.',
      'This keeps Cutscene aligned with the Pixel, Level, MIDI, SFX, and Actor drawer state model.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:13 EDT',
    title: 'Pixel Edit drawer states tightened',
    details: [
      'Pixel Edit drawer now computes whether a pixel selection is active before building controller and desktop drawer rows.',
      'Cut and Clear Selection now render disabled when there is no active selection.',
      'Copy and Paste remain live because Copy intentionally falls back to select-all and Paste can read from the system clipboard.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:10 EDT',
    title: 'Level Edit drawer states tightened',
    details: [
      'Level Edit commands now compute selected decal/trigger and clipboard availability before building the menu.',
      'Copy, Cut, and Delete disable when there is no editable selection; Paste disables when the Level clipboard is empty.',
      'The disabled state is preserved through the desktop/controller drawer model so unavailable Level Edit rows no longer look like live no-op buttons.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:08 EDT',
    title: 'Desktop context labels standardized',
    details: [
      'The shared desktop context panel now titles the left inspector as Active by default.',
      'Actor desktop uses the same Active label in its DOM left panel.',
      'This keeps the persistent desktop left column reading as context/inspector state rather than another command menu.'
    ]
  },
  {
    date: '2026-07-01',
    time: '23:02 EDT',
    title: 'Landscape drawer geometry standardized',
    details: [
      'Shared mobile landscape layout now exposes an overlay drawer surface that sits on the right edge without reserving layout width.',
      'The overlay drawer is capped above the bottom rail so zoom sliders, ribbons, and tool option rails stay visible while menus are open.',
      'Pixel, Level, MIDI, SFX, Cutscene, and Actor now consume that shared overlay drawer surface instead of hard-coding full-height right drawers.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:57 EDT',
    title: 'MIDI Edit drawer states tightened',
    details: [
      'MIDI desktop Edit rows now disable Select All when the active pattern is empty.',
      'Copy, Cut, and Delete now disable when no notes are selected, and Paste disables when the MIDI clipboard is empty.',
      'The disabled state is preserved through the desktop controller menu model so unavailable rows render like real desktop menu items instead of no-op buttons.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:54 EDT',
    title: 'SFX Edit drawer states tightened',
    details: [
      'SFX Edit rows now mark Copy, Cut, Paste, and Delete disabled when the selected layer or clipboard state is missing.',
      'The disabled state is preserved through the controller menu model used by desktop dropdown drawers.',
      'This makes unavailable SFX edit commands render like normal disabled desktop menu items instead of live-looking no-op buttons.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:51 EDT',
    title: 'SFX landscape transport cleaned up',
    details: [
      'SFX mobile landscape keeps Menu, Undo, Redo, and Play on the compact left rail.',
      'The bottom transport rail no longer repeats the Menu button.',
      'Transport controls such as start, step, play, stop, and end remain in the bottom rail.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:49 EDT',
    title: 'Pixel landscape toolbar cleaned up',
    details: [
      'Pixel mobile landscape keeps Menu, Undo, Redo, and the quick Brush or Play action on the compact left rail.',
      'The bottom toolbar no longer repeats Menu, Undo, or Redo.',
      'The bottom toolbar remains focused on contextual pixel controls such as brush preview, color register, clone controls, animation play, and actor test actions.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:46 EDT',
    title: 'Cutscene landscape bottom rail cleaned up',
    details: [
      'Cutscene mobile landscape keeps Menu, Undo, Redo, and Play on the compact left rail.',
      'The bottom rail now shows Canvas, Split, Timeline, Zoom -, and Zoom + controls.',
      'This keeps landscape bottom controls focused on view and timeline options instead of duplicating quick actions.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:42 EDT',
    title: 'Actor landscape rail simplified',
    details: [
      'Actor mobile landscape now uses Menu, Undo, Redo, and Play on the left rail.',
      'The full Actor root menu opens in a gesture-scrollable right overlay drawer instead of forcing the left rail to carry every root.',
      'The Actor landscape bottom rail now holds contextual actor actions instead of duplicating Undo, Redo, and Play.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:39 EDT',
    title: 'MIDI landscape rail simplified',
    details: [
      'MIDI mobile landscape now uses the compact left rail with Menu, Undo, Redo, and Play.',
      'The Menu button opens the full MIDI root list in a gesture-scrollable right drawer.',
      'Root and utility drawers now overlay the composer instead of reserving right-side width, so the grid does not resize as drawers open and close.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:33 EDT',
    title: 'Cutscene landscape rail simplified',
    details: [
      'Cutscene mobile landscape now uses the shared compact rail with Menu, Undo, Redo, and Play on the left edge.',
      'The Menu button opens the full Cutscene root menu in a gesture-scrollable right drawer.',
      'The right drawer overlays instead of shrinking the stage and timeline workspace.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:28 EDT',
    title: 'SFX landscape rail simplified',
    details: [
      'SFX mobile landscape now uses the shared compact rail with Menu, Undo, Redo, and Play on the left edge.',
      'The Menu button opens the full SFX root menu in the right drawer with gesture drag scrolling.',
      'Gamepad slide-out behavior and portrait bottom menus are left on their existing shared paths.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:24 EDT',
    title: 'Level landscape rail simplified',
    details: [
      'Level mobile landscape now uses the shared compact command rail pattern: Menu, Undo, Redo, and Play.',
      'The Menu button opens the full Level root list in a gesture-scrollable overlay drawer instead of forcing the left rail itself to scroll.',
      'The Level drawer overlays the work area instead of reserving right-rail width, so the canvas does not resize as drawers open and close.'
    ]
  },
  {
    date: '2026-07-01',
    time: '22:16 EDT',
    title: 'Pixel landscape rail simplified',
    details: [
      'Pixel mobile landscape now shows only Menu, Undo, Redo, and one contextual quick action on the left rail.',
      'The right drawer overlays the editor instead of causing the canvas and rails to resize when it appears or disappears.',
      'Landscape zoom and thumbstick controls now draw inside the work surface so the zoom slider does not overlap the bottom tool rail.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:55 EDT',
    title: 'Actor landscape rail stays visible',
    details: [
      'Actor mobile landscape now gives the main editor panel flexible scroll space above the bottom quick-action rail.',
      'The bottom rail remains fixed in the center column while tall actor settings or state forms scroll independently.',
      'Added coverage for the landscape DOM sizing contract so the bottom rail is not pushed out by main content.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:53 EDT',
    title: 'Landscape bottom rail contract documented',
    details: [
      'Updated UISpec to state that landscape keeps root menus on the left, submenus on the right, and persistent tool/options controls in the bottom rail.',
      'Updated the lower-level editor UI contract so BottomRail maps to toolOptions, zoom, and ribbon surfaces in shared landscape plans.',
      'Added coverage that the written contract stays aligned with the shared landscape shell helper.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:51 EDT',
    title: 'Actor landscape gets bottom rail',
    details: [
      'Actor mobile landscape now requests the shared bottom tool-options rail from the landscape shell.',
      'Added a dedicated landscape quick-action strip for Undo, Redo, and Play Scene instead of reusing the portrait menu/thumbstick rail.',
      'Added coverage that Actor landscape keeps root menus left, submenus right, and quick controls in the bottom rail.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:48 EDT',
    title: 'Level landscape zoom moves bottom',
    details: [
      'Level mobile landscape now reserves the shared bottom tool-options rail.',
      'The Level zoom slider now uses that bottom rail surface for both hit bounds and rendering.',
      'Added coverage that Level landscape uses the shared bottom rail while keeping root menus on the left and submenus on the right.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:46 EDT',
    title: 'Pixel landscape gets bottom tool rail',
    details: [
      'Pixel mobile landscape now asks the shared landscape shell for a bottom tool-options rail.',
      'Palette, clone, hue-shift, animation, and layer management rails now render into that bottom surface instead of relying on portrait-only bottom controls.',
      'Added coverage that Pixel landscape keeps the bottom rail separate from the canvas while preserving the left root menu and optional right submenu surfaces.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:42 EDT',
    title: 'Desktop menu commands close drawers',
    details: [
      'Updated Pixel, Level, SFX, and Cutscene release handlers so a selected dropdown command closes the active desktop drawer after it runs.',
      'Updated MIDI and Actor desktop dropdown command paths to use their existing close helpers after command selection.',
      'Added regression coverage so desktop dropdown commands still fire on release and now clear the open drawer state.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:37 EDT',
    title: 'Portrait menus bottom-align across editors',
    details: [
      'Moved the Level portrait root menu onto the shared Pixel-style multi-row bottom strip.',
      'Kept the consolidated Level portrait roots at File, Tools, Assets, and Settings, with Playtest staying in the bottom action rail.',
      'Added regression coverage that Level stays bottom-aligned and that all editor portrait root menus remain capped at eight items.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:32 EDT',
    title: 'Pixel desktop dropdown clicks fire once',
    details: [
      'Tagged Pixel desktop dropdown rows separately from ordinary UI buttons.',
      'Dropdown commands now record a pending hit on pointer-down and execute only on pointer-up if the pointer did not drag away.',
      'Added coverage so Pixel desktop drawer commands cannot fire through the immediate UI click path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:30 EDT',
    title: 'Level desktop dropdown clicks fire once',
    details: [
      'Tagged Level desktop dropdown rows separately from ordinary UI buttons.',
      'Dropdown commands now record a pending hit on pointer-down and execute only on pointer-up if the pointer did not drag away.',
      'Added coverage so Level desktop drawer commands cannot fire through the immediate UI click path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:26 EDT',
    title: 'Cutscene desktop dropdown clicks fire once',
    details: [
      'Changed Cutscene desktop dropdown command rows to record a pending hit on pointer-down.',
      'Commands now execute only on pointer-up when the pointer releases on the same row and did not drag.',
      'Added coverage so Cutscene desktop drawers follow the same release-only command contract as SFX and MIDI.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:24 EDT',
    title: 'SFX desktop dropdown clicks fire once',
    details: [
      'Moved SFX desktop dropdown rows out of the immediate button hit list and into dedicated dropdown hit targets.',
      'Dropdown commands now execute on pointer release and cancel if the pointer drags before release.',
      'Added coverage for the SFX release-only dropdown path so desktop menu presses cannot double-activate through layout changes.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:20 EDT',
    title: 'Cutscene desktop command surface cleaned up',
    details: [
      'Split Cutscene desktop dropdown hit targets into a dedicated desktopDropdownItems list.',
      'Kept the left desktop panel as context/transport only, so it no longer shares state with dropdown command rows.',
      'Added coverage that Cutscene desktop dropdown commands stay separate from the left context panel.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:16 EDT',
    title: 'Cutscene portrait menu matches Pixel bottom rail',
    details: [
      'Moved the Cutscene portrait root menu onto the shared bottom-aligned multi-row tab strip used by the other portrait editor menus.',
      'Kept Cutscene portrait roots capped at eight items, with command content staying above the bottom root rail.',
      'Updated the portrait menu regression so Cutscene cannot drift back to a top tab strip.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:11 EDT',
    title: 'MIDI desktop dropdown clicks fire once',
    details: [
      'Removed MIDI desktop dropdown command execution from pointer-down handling.',
      'Dropdown commands still run from the pointer-up path, so a click cannot trigger one command on press and another on release after the layout changes.',
      'Added coverage that MIDI desktop dropdown actions are release-only while top menu drawer opening remains separate.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:06 EDT',
    title: 'Pixel and Level share desktop context layout',
    details: [
      'Changed Pixel desktop context drawing to pass through buildSharedDesktopContextTransportLayout with transport disabled before rendering the left inspector.',
      'Changed Level desktop context drawing to use the same shared context layout helper for its left inspector panel.',
      'Extended desktop context coverage so Pixel and Level stay on the same shared left-panel layout path as MIDI, SFX, and Cutscene.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:03 EDT',
    title: 'Actor portrait uses a shared layout helper',
    details: [
      'Added buildActorPortraitEditorLayout so Actor portrait exposes rootRail and sheetContent surfaces like the other editor bottom sheets.',
      'Changed Actor render setup to call the named portrait helper instead of embedding the shared layout options inside render.',
      'Extended portrait layout coverage so Actor participates in the same bottom-root and sheet-content surface contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '21:01 EDT',
    title: 'Cutscene portrait menu uses shared bottom surfaces',
    details: [
      'Added a Cutscene portrait layout helper that exposes rootRail and sheetContent surfaces like Pixel and SFX.',
      'Changed Cutscene portrait menu drawing to place root tabs from rootRail and menu items from sheetContent instead of deriving both from one full-sheet rectangle.',
      'Added coverage for Cutscene portrait root geometry and the split content/menu drawing contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:57 EDT',
    title: 'SFX portrait menu now matches Pixel bottom rail',
    details: [
      'Added a SFX portrait layout helper that expands the bottom root rail inside the menu sheet like Pixel Studio.',
      'Changed SFX portrait root tabs to use the shared multi-row bottom-aligned tab strip so its seven root items fit as a bottom menu instead of a short single-row scroller.',
      'Added coverage for SFX root-rail geometry and bottom-aligned multi-row rendering.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:53 EDT',
    title: 'SFX and Cutscene share one gamepad layout state',
    details: [
      'Changed SFX landscape drawing to resolve gamepad menu state once before deciding left slide-out, right drawer reservation, and controller overlay rendering.',
      'Changed Cutscene drawing and layout computation to pass the resolved gamepad state through instead of re-querying slide-out state in separate branches.',
      'Updated regression coverage so both editors keep touch landscape right drawers separate from gamepad left slide-out menus through the shared state path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:49 EDT',
    title: 'Level gamepad no longer reserves stale right drawers',
    details: [
      'Changed Level mobile drawing to read the shared gamepad menu state before building the landscape shell.',
      'Level now suppresses right drawer layout reservation whenever gamepad slide-out mode owns the left menu surface.',
      'Drawer bounds and drawer rendering now use the same drawerOpenForLayout gate, with coverage rejecting the stale drawer.open reservation path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:46 EDT',
    title: 'MIDI gamepad state now owns landscape suppression',
    details: [
      'Changed MIDI landscape layout to read the shared gamepad menu state once before reserving drawers or bottom rails.',
      'MIDI now suppresses touch landscape right drawers and grid bottom rails whenever shared gamepad landscape mode owns the menu surface.',
      'Updated MIDI layout coverage so gamepad slide-out rendering, right-drawer suppression, and bottom-rail suppression all come from the same shared state.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:44 EDT',
    title: 'Pixel gamepad no longer reserves a right drawer',
    details: [
      'Cached Pixel gamepad slide-out state before building the mobile landscape layout.',
      'Pixel now passes drawerOpen as false when the gamepad left slide-out submenu is active, preventing stale mobile drawers from shrinking the work surface.',
      'Updated Pixel gamepad coverage so the slide-out state controls both right-drawer reservation and left slide-out rendering.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:42 EDT',
    title: 'Actor gamepad now uses the shared landscape shell',
    details: [
      'Changed Actor mobile landscape rendering to build the shared landscape shell even when the gamepad slide-out submenu owns the left rail.',
      'Gamepad Actor mode now disables only the right submenu rail through reserveRightRail while keeping shared left rail sizing and work-surface layout.',
      'Updated Actor layout coverage so the old branch that skipped the shared landscape shell during gamepad slide-out cannot return.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:40 EDT',
    title: 'Canonical editor roots now include View',
    details: [
      'Updated UISpec.md so every editor root list includes View after File and Edit, matching the shared desktop menu contract.',
      'Added unit coverage that checks the canonical UI spec root lines for Pixel, Level, Actor, MIDI, SFX, and Cutscene.',
      'This keeps future desktop work aligned with the top-menu File, Edit, View ordering already enforced in the shared menu spec.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:38 EDT',
    title: 'Gamepad layout contract now names the slide rail',
    details: [
      'Changed the shared editor layout plan so gamepad persistent navigation reports left-slide-rail instead of the static landscape left-rail.',
      'Added explicit gamepad rootSurface, submenuSurface, and submenuReplacesRoot flags for every editor mode plan.',
      'Updated the editor UI contract and tests so future editor work targets the gamepad submenu replacing the root rail instead of drifting back toward landscape rails.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:36 EDT',
    title: 'Actor portrait menu naming now matches bottom placement',
    details: [
      'Renamed Actor portrait menu selectors from the stale portrait-top path to portrait-bottom-menu while preserving the existing bottom sheet behavior.',
      'Updated Actor portrait scrolling selectors and CSS so the DOM editor follows the same bottom-first portrait menu vocabulary as the shared canvas editors.',
      'Added test assertions that reject the old portrait-top class, making the bottom-menu contract harder to regress.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:32 EDT',
    title: 'Actor desktop disabled rows are inert',
    details: [
      'Changed Actor desktop dropdown rendering so disabled DOM rows are styled and disabled without registering onclick handlers.',
      'This matches the shared canvas dropdown painter, which renders disabled rows but does not register click actions for them.',
      'Added coverage beside the Actor desktop drawer assertions to keep the DOM dropdown contract aligned with the shared canvas drawer contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:30 EDT',
    title: 'Editor state routing now uses one shared map',
    details: [
      'Added a shared GameCore editor-state helper derived from editorStateTargetKeys.',
      'Transition cleanup, editor-active body class assignment, and virtual input clearing now use that shared helper instead of duplicated editor-state chains.',
      'Expanded Cutscene/GameCore coverage so future editor states are less likely to be routed into one mode path while missing another.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:27 EDT',
    title: 'Actor desktop suppresses browser context menus',
    details: [
      'Added a contextmenu guard to the Actor Editor DOM overlay so desktop right-clicks do not open the browser menu over editor chrome.',
      'This aligns Actor with the canvas editors, where the main canvas already suppresses browser context menus for editor work surfaces.',
      'Added coverage beside the Actor desktop drawer tests so DOM desktop pointer behavior stays aligned with the shared policy.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:23 EDT',
    title: 'Cutscene editor now uses shared transition cleanup',
    details: [
      'Added Cutscene Editor to the shared editor state cleanup list so entering and leaving it clears transient input state like the other editors.',
      'Cutscene now marks the body with editor-active during transitions, matching the desktop/mobile chrome behavior used by Pixel, Level, MIDI, SFX, and Actor.',
      'Added a Cutscene resetTransientInteractionState hook that clears open menus, drag state, scroll drags, thumbstick state, transport popovers, zoom slider state, and controller-menu focus.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:21 EDT',
    title: 'Gamepad disconnect closes editor controller menus',
    details: [
      'Aligned Pixel, Level, MIDI, SFX, Actor, and Cutscene so active controller menus close when gamepad input disconnects.',
      'This prevents stale gamepad slide-outs or menu sheets from affecting normal mobile, landscape, or desktop layouts after disconnect.',
      'Added cross-editor coverage so every editor keeps the same controller-menu lifecycle rule.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:18 EDT',
    title: 'Editor shell tokens now match RTG Studio theme',
    details: [
      'Added runtime --editor-* CSS token aliases in styles.css so the shared EditorShell contract inherits the same RTG Studio colors, font, spacing, and chrome dimensions.',
      'Kept the existing --ui-* palette as the source of truth while exposing the canonical editor contract names used by shared shell code.',
      'Expanded style coverage so the aliases stay wired to the main RTG Studio theme instead of drifting into a separate editor look.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:14 EDT',
    title: 'Cutscene gamepad slide-out menus can be dragged',
    details: [
      'Changed Cutscene gamepad slide-out rendering to publish its submenu content bounds, menu id, and scroll limit.',
      'Dragging inside the Cutscene gamepad slide-out now updates controllerMenu scroll for the active submenu.',
      'This brings Cutscene in line with Pixel, MIDI, Level, SFX, and Actor slide-out menu scrolling.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:12 EDT',
    title: 'Actor gamepad menus use contained scrolling',
    details: [
      'Made Actor DOM menu rails, file subrails, desktop option panels, and desktop dropdowns explicitly contain overscroll like the shared editor chrome.',
      'Added touch pan-y handling to Actor menu rails and the gamepad slide-out so long menus drag-scroll reliably on touch devices.',
      'Locked the gamepad slide-out submenu to a real flex scroll area so it behaves like the canvas editors instead of clipping long lists.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:09 EDT',
    title: 'MIDI gamepad slide-out menus can be dragged',
    details: [
      'Changed MIDI gamepad slide-out submenu rendering to capture list bounds, item bounds, scroll limits, and visible scroll offset.',
      'Pointer drag inside a long MIDI gamepad submenu now updates controllerMenu scroll through the shared menu scroll helper.',
      'Tap without drag still invokes the pending submenu item, preserving normal A/touch selection behavior.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:04 EDT',
    title: 'Pixel gamepad slide-out menus can be dragged',
    details: [
      'Changed Pixel Studio gamepad slide-out submenu rendering to use mobile list drawer sizing.',
      'The slide-out now captures list bounds and scroll limits from the shared drawer helper.',
      'Dragging a long Pixel gamepad submenu updates controllerMenu scroll, matching the other scrollable slide-out panels.'
    ]
  },
  {
    date: '2026-07-01',
    time: '20:00 EDT',
    title: 'Level gamepad slide-out now uses shared scroll state',
    details: [
      'Changed the Level Editor gamepad slide-out panel to publish its list bounds to the existing mobile menu scroll-drag handler.',
      'The slide-out now records per-menu scroll limits and reads panelScroll before falling back to controllerMenu scroll.',
      'Added coverage so the Level gamepad slide-out remains wired into the shared gesture-scroll path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:57 EDT',
    title: 'Desktop drawers now keep menu separators',
    details: [
      'Changed the shared desktop dropdown render plan to keep divider and separator rows from shared File menus.',
      'Changed canvas desktop dropdown rendering to draw separators as inert divider lines instead of filtering them out.',
      'Changed Actor desktop DOM dropdowns to render matching separator rows so its File drawer follows the same grouped menu style.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:54 EDT',
    title: 'File menu extras now share the same action shape',
    details: [
      'Changed the shared editor File menu builder to normalize every non-divider row with both onClick and action callbacks.',
      'This covers editor-specific File extras as well as standard File rows and footer rows.',
      'Added coverage for extras that start with only onClick or only action so desktop drawers can consume one consistent item shape.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:50 EDT',
    title: 'Portrait multi-row root menus pin to the bottom',
    details: [
      'Added vertical alignment support to the shared portrait multi-row tab layout helper.',
      'Changed Pixel and MIDI portrait root tab strips to request bottom alignment instead of relying on centered rows inside the rail.',
      'Restored the MIDI mobile File button behavior where tapping File again closes the File panel.',
      'Added focused regressions for shared bottom alignment plus Pixel and MIDI portrait root rail geometry.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:46 EDT',
    title: 'Portrait editor bottom menus now share one spec',
    details: [
      'Added portraitRoot entries to the shared editor menu spec for Pixel, Level, Actor, MIDI, SFX, and Cutscene.',
      'Changed all portrait menu model builders to read those shared portrait roots instead of keeping separate hard-coded bottom menu lists.',
      'Locked Cutscene portrait to eight bottom items with Export folded under File, while desktop keeps the full File, Edit, View, and editor-specific top menus.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:41 EDT',
    title: 'Shared File menu rows now have consistent actions',
    details: [
      'Changed buildStandardFileMenu so standard File rows expose action as an alias of onClick, matching the existing footer rows.',
      'Added shared coverage for the File menu order and action alias contract so every editor File drawer inherits the same item shape.',
      'Kept editor-specific labels, disabled states, and extras untouched.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:38 EDT',
    title: 'Cutscene desktop right-click uses shared pointer policy',
    details: [
      'Added a Cutscene desktop context pointer path gated by pointerPolicy.rightClick.opensContextMenu.',
      'Right-click now selects clips, tracks, or keyframes and opens the existing options panel without entering timeline, track, or stage drag modes.',
      'Added regression coverage that the right-click context path runs before drag handlers and stays tied to the shared pointer policy.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:34 EDT',
    title: 'Actor collision modal now follows shared pointer policy',
    details: [
      'Changed the Actor collision-zone editor modal to ask the shared pointer policy before rendering its virtual thumbstick column.',
      'Desktop now gets a cleaner single-column tool area in that modal while touch/gamepad modes can keep the panning stick.',
      'Updated shared policy coverage so Actor touch mode is explicitly allowed to use work-surface thumbstick controls.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:31 EDT',
    title: 'SFX thumbstick input now uses shared mode policy',
    details: [
      'Changed SFX pointer-down handling to call getEditorPointerInteractionPolicy before activating the virtual thumbstick.',
      'Kept touch and gamepad thumbstick behavior available while making desktop suppression part of the shared pointer policy.',
      'Added regression coverage so SFX cannot return to local mobile-only thumbstick checks.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:27 EDT',
    title: 'Cutscene thumbstick input now follows shared mode policy',
    details: [
      'Changed Cutscene pointer-down handling to ask the shared editor pointer policy before activating the virtual thumbstick.',
      'Kept mobile landscape and gamepad thumbstick behavior available while preventing desktop input from depending only on render-side thumbstick reset.',
      'Updated coverage so Cutscene desktop mode proves both stale thumbstick reset and shared pointer-policy gating.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:24 EDT',
    title: 'Desktop menus no longer drive persistent context',
    details: [
      'Audited Pixel, Level, MIDI, SFX, Cutscene, and Actor desktop top-menu handlers against the real desktop-app rule.',
      'Added regression coverage that top-menu hover/click opens dropdown drawers without changing the left context/tool panel.',
      'Kept portrait and landscape behavior untouched while locking down the desktop drawer/context split.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:19 EDT',
    title: 'View drawers now work in more landscape editors',
    details: [
      'Added Pixel View to the legal panel tabs and routed it to the shared controller submenu renderer.',
      'Added MIDI View to the landscape right-drawer allowlist and render path.',
      'Added SFX View handling to the mobile right-panel renderer so landscape touch can open real View actions.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:15 EDT',
    title: 'Level View root works outside desktop too',
    details: [
      'Added View to the Level Editor panel tab list so mobile landscape and gamepad root selection can focus it.',
      'Gave the Level View panel concrete Zoom In, Zoom Out, Reset Zoom, and Start Playtest actions.',
      'Updated coverage so the shared View root cannot become a desktop-only dropdown while landscape/gamepad rails expose it.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:12 EDT',
    title: 'Desktop menus now require a real View drawer',
    details: [
      'Changed the shared editor menu spec so File, Edit, and View are the required first desktop roots for every editor.',
      'Added live View drawer actions across Pixel, Level, Actor, MIDI, SFX, and Cutscene instead of relying on placeholder spec rows.',
      'Kept compact portrait menu models separate so the new desktop View root does not add another portrait bottom button.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:06 EDT',
    title: 'SFX stale gamepad right-panel code removed',
    details: [
      'Audited Cutscene and MIDI landscape/gamepad branches against the shared rule: touch landscape can use a right drawer, gamepad uses the left slide-out.',
      'Removed the old SFX drawGamepadRightOptionsPanel method so there is no separate right-side gamepad submenu path left behind.',
      'Updated coverage to fail if SFX reintroduces that gamepad right-options panel.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:04 EDT',
    title: 'SFX gamepad layout no longer draws a right options rail',
    details: [
      'Changed SFX mobile landscape rendering so gamepad mode removes the right submenu surface instead of recreating a fallback right panel.',
      'Kept touch landscape behavior intact: root menu stays left, submenu stays right, and tool options remain on the bottom rail.',
      'Updated regression coverage so SFX gamepad mode proves the submenu lives on the left slide-out rather than duplicating options on the right.'
    ]
  },
  {
    date: '2026-07-01',
    time: '19:00 EDT',
    title: 'Desktop dropdown action wiring is now covered across editors',
    details: [
      'Added a cross-editor regression that verifies canvas desktop drawers build live controller-menu rows before rendering.',
      'Covered Actor separately through its live desktop action source so the DOM editor stays aligned with the same action-backed drawer rule.',
      'Locked in the recent Pixel, Level, MIDI, SFX, Cutscene, and Actor desktop drawer wiring fixes against future inert-menu regressions.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:58 EDT',
    title: 'Actor desktop and gamepad menus preserve row state',
    details: [
      'Changed Actor controller-menu rows to retain active and disabled state from the same desktop dropdown action source.',
      'Added source ids to Actor controller rows so derived state-list and file rows can stay traceable across desktop/gamepad surfaces.',
      'Added coverage that Actor menu metadata stays aligned with the shared desktop/gamepad menu direction.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:57 EDT',
    title: 'Pixel and MIDI desktop drawers use live action menus',
    details: [
      'Changed Pixel desktop dropdown rendering to build current controller-menu rows before drawing top-menu drawers.',
      'Changed MIDI desktop dropdown rendering to build current controller-menu rows before falling back to older controllerMenu.menus state.',
      'Added coverage so Pixel and MIDI desktop drawers keep real actions even without gamepad menu initialization.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:55 EDT',
    title: 'SFX desktop drawer buttons use live controller menus',
    details: [
      'Changed SFX desktop dropdown rendering to build current controller-menu rows directly instead of depending on controllerMenu.menus populated by gamepad input.',
      'Kept the existing fallback to shared spec rows only for missing runtime menus.',
      'Updated coverage so SFX desktop drawers keep real onSelect actions in mouse/desktop use.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:53 EDT',
    title: 'Cutscene desktop dropdowns use controller-menu actions',
    details: [
      'Changed Cutscene desktop dropdown rendering to use buildControllerMenus() and controllerMenu.getItems() before falling back to direct getMenuItems().',
      'Preserved active and disabled states in Cutscene controller menu rows so desktop drawers still show view mode and unavailable command state correctly.',
      'Updated coverage so Cutscene desktop dropdowns stay aligned with the shared controller-menu-backed desktop shell direction.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:51 EDT',
    title: 'Level desktop dropdowns use shared controller actions',
    details: [
      'Changed Level desktop dropdown rendering to pull rows from the controller menu definitions used by desktop/gamepad navigation, with panel-config fallback only when a menu is missing.',
      'Kept rich dropdown previews by carrying tile, actor, structure, track, and disabled metadata through Level controller menu items.',
      'Updated coverage so Level desktop dropdowns stay on the shared action path instead of rebuilding separate desktop-only command rows.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:46 EDT',
    title: 'Portrait editor menus are locked to bottom rails',
    details: [
      'Kept every editor portrait root menu at eight items or fewer, matching the Pixel Editor bottom menu constraint.',
      'Added regression coverage that shared portrait layouts, Pixel, MIDI, Cutscene, and Actor keep root menu rails bottom-anchored instead of drifting back to top tabs.',
      'Added an explicit Actor portrait bottom-menu sheet class while preserving the existing class names used by styles and layout tests.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:44 EDT',
    title: 'SFX desktop clears stale mobile thumbstick state',
    details: [
      'Added an explicit thumbstick reset in the SFX desktop render branch.',
      'Kept mobile portrait and mobile landscape thumbstick behavior unchanged.',
      'Added coverage so SFX desktop stays free of stale mobile thumbstick state while using the shared desktop shell.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:39 EDT',
    title: 'Level custom desktop dropdowns now honor disabled rows',
    details: [
      'Updated the Level Editor custom dropdown button helper to accept disabled state.',
      'Muted disabled Level dropdown rows and skipped registering them as clickable UI buttons.',
      'Added coverage so Level custom dropdown rendering stays aligned with the shared desktop disabled-row behavior.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:37 EDT',
    title: 'Actor desktop disabled dropdown rows moved into CSS',
    details: [
      'Changed Actor desktop dropdown buttons to add a disabled CSS class instead of setting inline opacity.',
      'Added tokenized CSS for disabled Actor dropdown rows and suppressed hover/focus chrome on disabled rows.',
      'Expanded coverage so Actor desktop dropdown disabled styling stays CSS-owned like the rest of the RTG Studio desktop chrome.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:34 EDT',
    title: 'Desktop dropdowns now keep disabled rows visible and inert',
    details: [
      'Changed the shared desktop dropdown painter to mute disabled rows and skip registering them as clickable buttons.',
      'Changed Cutscene desktop dropdowns to pass disabled rows through instead of filtering them out, so disabled Copy, Paste, Delete, and export states look like normal desktop app menus.',
      'Added coverage that disabled dropdown rows still render but do not receive click handlers.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:31 EDT',
    title: 'Portrait root menus now cap at eight bottom items',
    details: [
      'Removed the separate Cutscene Export portrait root so Cutscene now has eight portrait root menu buttons instead of nine.',
      'Moved the Cutscene portrait tab strip to the bottom of the menu sheet so it matches the Pixel-style bottom-first portrait menu behavior.',
      'Added coverage that Pixel, Level, Actor, MIDI, SFX, and Cutscene portrait root menus stay at eight items or fewer.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:28 EDT',
    title: 'Level drawers now expose concrete action rows',
    details: [
      'Changed Level controller/dropdown drawers for Triggers, Graphics, Music, Settings, Tiles, Actors, Powerups, and Structures to expose concrete runnable rows instead of thin placeholder menus.',
      'Kept portrait panel behavior intact by reusing the existing panel item sources for the dropdown/controller surfaces.',
      'Removed the SFX scrub placeholder from the shared Timeline menu because scrub is a direct timeline gesture, not a dropdown command.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:24 EDT',
    title: 'Latest Changes now keeps major work separate from small updates',
    details: [
      'Tightened the top Major Items I am Working Toward list so it describes the active strategic UI work streams.',
      'Changed Most Recent Major Changes back into larger milestone bullets instead of narrow per-command implementation notes.',
      'Kept the smaller timestamped implementation notes in the detailed running log below the major summaries.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:24 EDT',
    title: 'Pixel Rigging spec now uses concrete drawer commands',
    details: [
      'Changed the Pixel Rigging shared spec to the runtime Add Bone, Bind Layer, Bind Selection, and Bake commands.',
      'Removed placeholder rigging rows for bone-list and bone-timeline from the shared menu contract.',
      'Added coverage so Pixel Rigging stays aligned with concrete desktop/gamepad drawer commands.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:22 EDT',
    title: 'SFX Layers spec no longer uses placeholder rows',
    details: [
      'Changed the SFX Layers shared spec to the runtime Add Layer, Duplicate Layer, and Delete Layer commands.',
      'Removed placeholder rows for layer-list and reorder-layer from the SFX menu contract.',
      'Added coverage so SFX Layers stays aligned with the concrete desktop/gamepad drawer commands.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:20 EDT',
    title: 'Actor menu specs now include concrete desktop drawer rows',
    details: [
      'Added Actor Settings drawer rows for aggression and loot rules so the shared spec matches the desktop DOM drawer.',
      'Added Visuals, Collision, and Preview spec rows for state graph, body damage, and collision shortcuts.',
      'Added coverage so Actor shared specs stay aligned with the concrete desktop drawer actions.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:18 EDT',
    title: 'MIDI menu specs now match runtime drawer commands',
    details: [
      'Changed MIDI Grid, Song, Tracks, Record, Pedals, and Settings shared specs to use concrete runtime command ids.',
      'Replaced placeholder rows like track-list, virtual-instruments, and audio-settings with commands such as open-tracks, open-record, enter-record, open-settings, preview, and contrast.',
      'Updated dropdown layout coverage so the desktop Tracks drawer resolves through the runtime alias to the real Open Mixer command.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:16 EDT',
    title: 'Pixel desktop layer and frame drawers gained management commands',
    details: [
      'Added Layer management commands like Add, Duplicate, Rename, Move, Merge, and Flatten to the Pixel desktop/controller Layers drawer before the dynamic layer list.',
      'Added Frame management commands like Add, Duplicate, Delay, Loop, Play, Step, Rewind, and Move to the Pixel desktop/controller Frames drawer before the dynamic frame list.',
      'Updated the shared Pixel menu spec and coverage so Layers and Frames use concrete runtime commands instead of list placeholders.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:12 EDT',
    title: 'Level menu specs now use stable runtime commands',
    details: [
      'Replaced placeholder Level rows like tile-list, actor-list, trigger-list, and structure-list with stable runtime command ids.',
      'Aligned toolbox, triggers, graphics, music, settings, and playtest specs with real drawer actions such as trigger-draw, graphics-apply-decal, music-trigger, resize-level, and playtest.',
      'Added coverage so Level desktop/gamepad menu specs stay tied to concrete commands instead of abstract list placeholders.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:05 EDT',
    title: 'Cutscene menu specs now match real drawer commands',
    details: [
      'Replaced conceptual Cutscene spec rows like zoom, position, scale, opacity, and workspace-mode with the concrete runtime command ids used by the editor.',
      'Aligned Timeline, Clips, Keyframes, Stage, Audio, Export, and Settings specs with the desktop dropdown rows users can actually click.',
      'Added coverage so Cutscene shared menu specs stay tied to real drawer commands as the desktop shell standardization continues.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:02 EDT',
    title: 'SFX menu specs now match real Generate commands',
    details: [
      'Replaced abstract SFX Generate spec placeholders with the runtime actions open-generate, generate, and the concrete wave choices.',
      'Changed the SFX Settings spec to match the actual Open Settings and Loop commands instead of unused duration/sample-rate placeholders.',
      'Added coverage so the shared desktop/menu contract stays tied to real SFX command ids.'
    ]
  },
  {
    date: '2026-07-01',
    time: '18:00 EDT',
    title: 'Actor desktop Body Damage now lands on the matching setting',
    details: [
      'Changed the Actor desktop Collision > Body Damage drawer action to open Actor Settings with contact damage as its focus target.',
      'Added focused styling and data-setting markers to the Body contact damage and Contact damage amount fields.',
      'Updated regression coverage so that drawer row cannot regress into a vague settings jump or a no-op-looking button.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:57 EDT',
    title: 'Latest Changes now separates major goals from the running log',
    details: [
      'Renamed the top Latest Changes summary sections to Major Items I am Working Toward and Most Recent Major Changes.',
      'Expanded the major-goals bullets so the current cross-editor UI standardization work is easier to scan.',
      'Kept the timestamped detailed change log below the major summaries for the smaller implementation updates.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:55 EDT',
    title: 'MIDI File drawers no longer duplicate navigation roots',
    details: [
      'Removed Grid, Mixer, Record, Pedals, and Settings navigation rows from the MIDI File drawer.',
      'Kept file, import/export, rescue save, save-and-paint, theme, sample, playback, and exit actions in File.',
      'Updated coverage so MIDI navigation stays on the shared root menus instead of drifting back into the File drawer.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:52 EDT',
    title: 'Pixel Tools drawers no longer duplicate Edit commands',
    details: [
      'Changed the shared Pixel Tools menu spec from Undo/Redo/Copy/Paste to real tool actions like Eraser, Eyedropper, Clone, Dither, and Hue Shift.',
      'Changed the Pixel runtime Tools controller menu to use the tool registry category instead of hardcoded Edit-style commands.',
      'Added coverage so Pixel desktop and controller Tools drawers do not drift back into duplicate Edit command surfaces.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:50 EDT',
    title: 'UI specs now document the shared desktop surface contract',
    details: [
      'Updated UISpec.md to name buildEditorMenuLayoutPlan surface roles and the top-dropdown desktop command surface.',
      'Updated ui/EDITORS_UI_CONTRACT.md with the shared desktop command surfaces, persistent surfaces, and desktopMobileRailsHidden requirement.',
      'Added coverage so the docs keep describing the same desktop command/context split that the shared layout helper enforces.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:48 EDT',
    title: 'Actor desktop menu buttons now use desktop CSS chrome',
    details: [
      'Removed old inline rail-button styling from Actor desktop top-menu and dropdown buttons.',
      'Added desktop-specific Actor menu button classes for app-style top menus and dropdown rows.',
      'Expanded coverage so Actor desktop menu chrome stays CSS-owned instead of drifting back to mobile rail styling.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:46 EDT',
    title: 'Actor desktop dropdown scrolling uses the shared resolver',
    details: [
      'Moved Actor Editor desktop dropdown wheel handling onto resolveDesktopDropdownWheelScroll.',
      'Stored Actor desktop drawer scroll by the shared resolver root id, matching Pixel, Level, MIDI, SFX, and Cutscene.',
      'Updated coverage so all six editors use the same desktop dropdown wheel-scroll contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:44 EDT',
    title: 'Actor desktop context wording now matches the other editors',
    details: [
      'Changed the Actor Editor desktop left context panel from a Menu row to an Active row.',
      'Aligned Actor with Pixel, Level, MIDI, SFX, and Cutscene so desktop left panels read as context/inspector panels instead of command menus.',
      'Expanded coverage so this cross-editor desktop context wording stays consistent.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:42 EDT',
    title: 'MIDI desktop no longer calls the mobile joystick renderer',
    details: [
      'Changed MIDI desktop drawing to reset touch thumbstick state directly instead of calling drawMobilePanJoystick after desktop layout.',
      'Kept mobile portrait and landscape joystick behavior unchanged by only branching at the desktop/mobile boundary.',
      'Added coverage so MIDI desktop stays out of mobile joystick rendering while broader editor chrome cleanup continues.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:40 EDT',
    title: 'Desktop left panels now read as context, not menus',
    details: [
      'Changed Pixel, Level, MIDI, SFX, and Cutscene desktop left panels from Menu labels to Active context labels.',
      'Kept command selection in the desktop top dropdown drawers while the left panels focus on document, tool, track, layer, and selection status.',
      'Added coverage so shared canvas desktop context panels do not drift back into menu-surface wording.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:38 EDT',
    title: 'Editor mode plans now name command and context surfaces',
    details: [
      'Added shared surface-role metadata to every editor layout mode so desktop commands are explicitly tied to top dropdown drawers.',
      'Marked desktop mobile rails hidden in the shared plan while keeping portrait, landscape, and gamepad surfaces distinct.',
      'Expanded layout coverage so Pixel, Level, Actor, MIDI, SFX, and Cutscene all prove the same command/context split.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:34 EDT',
    title: 'Desktop dropdown click-away state now shares one resolver',
    details: [
      'Added a shared desktop dropdown close-state resolver for recording the closed root and clearing the open drawer.',
      'Updated Pixel, Level, MIDI, SFX, Cutscene, and Actor desktop dropdown close paths to use the shared resolver.',
      'Added coverage so click-away drawer closing does not drift back to per-editor state assignments.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:29 EDT',
    title: 'Editor root menu labels now come from the shared spec',
    details: [
      'Added canonical root menu label overrides to the shared editor menu spec for runtime aliases like Level Tile Art, Level Actors, MIDI Mixer, and MIDI Record.',
      'Removed duplicate Pixel, Level, and MIDI label override maps from desktop and gamepad shell setup.',
      'Added coverage so shared root menu entries preserve runtime ids while producing consistent display labels across modes.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:26 EDT',
    title: 'Desktop context and transport split now uses shared layout',
    details: [
      'Added a shared desktop context/transport layout helper for the left-side panel split used by audio and cutscene editors.',
      'Updated MIDI, SFX, and Cutscene desktop side panels to use the shared geometry while preserving their existing transport controls.',
      'Added coverage so those editors do not drift back to local one-off context and transport panel sizing math.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:21 EDT',
    title: 'Pixel desktop context panel no longer double-draws its frame',
    details: [
      'Removed the extra Pixel Editor desktop left-options panel draw that sat underneath the shared context-panel helper.',
      'Kept the Pixel context content unchanged while making the shared RTG Studio context panel fully own its desktop frame.',
      'Added coverage so Pixel desktop shell chrome does not reintroduce a duplicate left-options panel pass.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:19 EDT',
    title: 'Canvas desktop ribbons now use one shared painter',
    details: [
      'Added a shared RTG Studio desktop ribbon painter for the left-side editor identity and active-menu header.',
      'Updated Pixel, Level, MIDI, SFX, and Cutscene desktop ribbons to use the same two-line RTG Studio ribbon style.',
      'Changed SFX desktop from a one-off split header to the same desktop ribbon pattern used by the other editors.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:13 EDT',
    title: 'Level desktop dropdowns joined the shared drawer painter',
    details: [
      'Moved the Level Editor desktop dropdown frame and iteration path onto the shared RTG Studio dropdown painter.',
      'Kept Level-specific tile, NPC, and structure preview thumbnails by adding a custom row-render hook to the shared drawer helper.',
      'Expanded desktop dropdown coverage so Pixel, Level, MIDI, SFX, and Cutscene all stay on the same shared canvas drawer contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:09 EDT',
    title: 'Actor desktop side chrome now follows RTG Studio CSS',
    details: [
      'Moved the Actor desktop left ribbon and context panel styling out of JavaScript and into tokenized RTG Studio CSS classes.',
      'Replaced inline context row colors and text truncation with reusable desktop context key/value classes.',
      'Added regression coverage so Actor desktop side panels keep their themed CSS contract while the broader editor shell standardization continues.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:04 EDT',
    title: 'Latest Changes now starts with major work summaries',
    details: [
      'Added a Major Work In Progress section above the detailed changelog so the current big-picture direction is visible.',
      'Added a Recent Major Changes section that summarizes the largest completed UI standardization steps.',
      'Moved Actor desktop top menu and dropdown static chrome into RTG Studio CSS classes so the DOM desktop shell uses tokenized styling instead of inline panel styling.'
    ]
  },
  {
    date: '2026-07-01',
    time: '17:01 EDT',
    title: 'Level desktop context panel uses shared RTG Studio chrome',
    details: [
      'Moved the Level Editor desktop context panel onto the shared desktop context-panel helper.',
      'Kept Level-specific tile, actor, structure, music, MIDI, trigger, and level-size context lines intact.',
      'Expanded coverage so Pixel, Level, MIDI, SFX, and Cutscene all share the same canvas desktop context-panel contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:57 EDT',
    title: 'Desktop dropdown drawers now share RTG Studio chrome',
    details: [
      'Added a shared desktop dropdown drawer painter for canvas editor top-menu drawers.',
      'Updated Pixel, MIDI, SFX, and Cutscene dropdown drawers to use the shared panel, row, label, active, and focus chrome while preserving editor-specific click handling.',
      'Added coverage so canvas dropdown drawers stay on the shared RTG Studio drawing path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:53 EDT',
    title: 'Desktop context panels now share RTG Studio chrome',
    details: [
      'Added a shared desktop context-panel helper for the left-side contextual panels used by canvas editors.',
      'Updated Pixel, MIDI, SFX, and Cutscene desktop context panels to use the same RTG Studio title, text, muted status, panel, and border drawing path.',
      'Added coverage so repeated desktop context panels stay tied to the shared helper instead of drifting per editor.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:50 EDT',
    title: 'Level desktop top menu joins the shared RTG Studio painter',
    details: [
      'Updated the Level Editor desktop top menu to use the shared horizontal RTG Studio menu painter.',
      'Preserved Level-specific Playtest behavior and hover-to-open drawer handling while removing the hand-drawn top menu chrome.',
      'Expanded coverage so Pixel, Level, MIDI, SFX, and Cutscene all stay tied to the shared canvas desktop top-menu contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:41 EDT',
    title: 'Canvas desktop top menus now share one RTG Studio painter',
    details: [
      'Added a shared desktop top-menu helper that draws horizontal editor menus with the RTG Studio panel, border, focus, and button chrome.',
      'Updated Pixel, MIDI, SFX, and Cutscene desktop top menus to use the shared painter while preserving their existing hit registration and dropdown actions.',
      'Added coverage so canvas editor desktop menu bars stay on the shared visual contract instead of drifting per editor.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:41 EDT',
    title: 'Shared controller system overlays use RTG Studio chrome',
    details: [
      'Added a shared canvas controller menu overlay helper using RTG Studio panel, border, text, muted, and gold selection tokens.',
      'Updated the shared controller menu stack so Pixel, Level, MIDI, SFX, and Cutscene system overlays inherit the same drawing path.',
      'Matched the DOM controller overlay rows and prompts to the same RTG Studio CSS tokens and added coverage against drifting back to hardcoded white chrome.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:38 EDT',
    title: 'Actor gamepad slide-out uses RTG Studio DOM chrome',
    details: [
      'Moved Actor gamepad slide-out header styling from inline DOM styles into shared CSS classes.',
      'Matched Actor gamepad hint and slide-out prompt colors to the RTG Studio panel, gold label, and muted hint palette.',
      'Added coverage so the Actor DOM editor stays aligned with the shared gamepad styling contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:35 EDT',
    title: 'Canvas gamepad slide-out headers now share one chrome helper',
    details: [
      'Added a shared RTG Studio slide-out header helper for canvas editor gamepad menus.',
      'Updated Pixel, Level, MIDI, SFX, and Cutscene gamepad slide-out panels to use the shared header.',
      'Added coverage so canvas slide-out headers no longer drift into per-editor fonts, colors, or prompt text.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:30 EDT',
    title: 'Gamepad hint bars now share RTG Studio chrome',
    details: [
      'Added a shared canvas helper for gamepad hint bars using the RTG Studio panel, gold label, muted hint text, and shared font.',
      'Updated Level, MIDI, and SFX hint bars to delegate to the shared helper instead of drawing their own older dark strip.',
      'Added coverage so gamepad hint bars stay tied to the shared theme instead of drifting per editor.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:27 EDT',
    title: 'Level Edit drawer commands now perform real clipboard work',
    details: [
      'Added a Level Editor clipboard for selected decals and triggers.',
      'Changed Level Copy, Cut, and Paste menu items from empty placeholder handlers into real editor actions.',
      'Pasted decals offset in pixels and pasted triggers offset by one tile, then autosave through the existing Level persistence path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:24 EDT',
    title: 'Desktop dropdown buttons now carry real actions',
    details: [
      'Changed shared desktop dropdown rendering so divider and separator rows are not treated like clickable commands.',
      'Updated Cutscene desktop dropdown hit records to call the rendered item action directly, preserving shared File menu callbacks like close and exit.',
      'Added coverage for actionable desktop dropdown rows so canvas editor drawers are less likely to render dead-looking buttons.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:15 EDT',
    title: 'Editors now share the RTG Studio main menu theme',
    details: [
      'Updated shared canvas editor UI tokens to match the main menu dark blue-black panels, gold accent, teal secondary accent, and sans-serif typography.',
      'Updated Actor DOM editor CSS variables and buttons to use the same RTG Studio palette and left-accent button style.',
      'Added coverage so both canvas editors and DOM editor chrome stay tied to the shared RTG Studio theme.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:10 EDT',
    title: 'SFX desktop left options are separated from mobile drawers',
    details: [
      'Split SFX desktop context and transport drawing into a dedicated drawDesktopLeftOptions path.',
      'Left the SFX right-panel renderer focused on mobile and landscape drawer content instead of desktop transport.',
      'Updated coverage so SFX desktop keeps commands in top dropdown drawers and context/transport in the left column.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:07 EDT',
    title: 'Actor landscape uses shared named layout surfaces',
    details: [
      'Changed the Actor Editor landscape DOM shell to size its root rail and submenu rail from shared rootMenu and submenu surfaces.',
      'Kept the existing left main menu and right submenu layout while removing raw landscape rail lookups.',
      'Updated coverage so Actor follows the same landscape surface contract as the canvas editors.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:05 EDT',
    title: 'Level landscape uses shared named layout surfaces',
    details: [
      'Changed Level mobile landscape bounds setup and draw layout to read rootMenu, submenu, and workSurface from the shared surface map.',
      'Kept portrait layout untouched while preserving the landscape left rail, right drawer, and editor canvas behavior.',
      'Updated coverage so Level cannot drift back to raw landscape rail/mainEditor lookups.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:02 EDT',
    title: 'Pixel landscape uses shared named layout surfaces',
    details: [
      'Changed Pixel mobile landscape drawing to resolve rootMenu, submenu, and workSurface from the shared surface map.',
      'Kept the existing left rail, drawer, and canvas placement behavior while removing raw landscape rail lookups from the draw path.',
      'Updated coverage so Pixel remains the reference editor for the shared landscape surface contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '16:00 EDT',
    title: 'MIDI landscape uses shared named layout surfaces',
    details: [
      'Changed MIDI mobile landscape layout to read rootMenu, submenu, toolOptions, and workSurface from the shared surface map.',
      'Kept the right drawer behavior for File, Settings, and virtual instruments while routing it through the shared submenu surface.',
      'Updated coverage so MIDI landscape stays aligned with SFX and Cutscene surface handling.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:58 EDT',
    title: 'Cutscene desktop ribbon no longer duplicates Edit commands',
    details: [
      'Removed the persistent Undo and Redo buttons from the Cutscene desktop left ribbon.',
      'Kept Cutscene history commands available through the desktop Edit drawer so command actions stay in top dropdowns.',
      'Expanded ribbon coverage so Cutscene is checked with the other editors for duplicate desktop history controls.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:55 EDT',
    title: 'Level desktop root menus now come from the shared shell plan',
    details: [
      'Removed the duplicate hardcoded Level Editor desktop root menu list and render from shellLayout.topMenu.buttons instead.',
      'Kept File, Edit, tools, content drawers, settings, and Playtest in the same visible top-menu flow while tying labels and ordering to the shared menu spec.',
      'Updated coverage so Level desktop cannot drift back to a separate hand-maintained root menu list.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:52 EDT',
    title: 'Cutscene landscape uses shared named layout surfaces',
    details: [
      'Changed the Cutscene landscape layout to read workSurface, toolOptions, rootMenu, and submenu from the shared landscape surface map.',
      'Kept the existing left root rail, right submenu drawer, and bottom action rail behavior while removing raw rail lookups from the layout return path.',
      'Updated coverage so Cutscene landscape stays aligned with the shared surface contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:50 EDT',
    title: 'SFX landscape uses shared named layout surfaces',
    details: [
      'Changed the SFX mobile landscape branch to consume shared rootMenu, submenu, toolOptions, and workSurface slots from the landscape shell plan.',
      'Kept gamepad submenu replacement behavior intact while removing editor-specific raw rail interpretation from the SFX placement path.',
      'Added coverage so SFX landscape stays tied to the shared named surface contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:47 EDT',
    title: 'SFX portrait Generate panel is clipped and scrollable',
    details: [
      'Clipped SFX mobile menu panel drawing to the portrait sheet bounds so tall controls cannot spill into the bottom action rail.',
      'Added Generate panel drag-scroll registration when its controls exceed the available portrait menu height.',
      'Added coverage so the SFX portrait Generate panel keeps its prompt, compact grid, clipping, and scroll behavior.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:45 EDT',
    title: 'SFX portrait now starts on Generate',
    details: [
      'Changed new SFX editor sessions and newly-created SFX documents to open on the Generate tab instead of File.',
      'Changed the portrait menu button to toggle between Timeline and Generate so the first useful creation panel is one tap away.',
      'Compacted the portrait Generate wave selector into a two-column grid with a short prompt to reduce overlap and make the first action clearer.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:40 EDT',
    title: 'Level Editor mobile draw freeze is fixed',
    details: [
      'Fixed the Level Editor HUD crash caused by a stale mobilePortraitLayout reference in the mobile zoom and thumbstick guard.',
      'Added a Level Editor draw smoke test that covers desktop, portrait, and landscape layouts so this freeze path is checked directly.',
      'Also named shared landscape surfaces for root menu, submenu, tool options, zoom, ribbon, and work surface to keep future landscape editor layout work aligned.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:34 EDT',
    title: 'Pixel desktop no longer draws the gamepad hint panel',
    details: [
      'Removed the Pixel Studio desktop-only gamepad hint overlay so desktop stays focused on top menus and app-style panels.',
      'Kept the shared controller menu path intact for actual controller navigation modes.',
      'Expanded desktop hint coverage so Pixel is checked with the other editors for mobile-style hint regressions.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:32 EDT',
    title: 'Actor desktop drawer click-away now uses the shared helper',
    details: [
      'Moved the Actor Editor desktop drawer outside-click decision into the shared editor menu layout helper.',
      'Kept Actor on its DOM desktop shell while aligning its drawer close behavior with the shared canvas editor dropdown contract.',
      'Added coverage for the shared DOM helper and updated Actor desktop tests to require the shared click-away path.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:29 EDT',
    title: 'Latest Changes timestamps are visible in the dialog',
    details: [
      'Confirmed the Latest Changes dialog renders each entry with both date and time in the heading.',
      'Kept the text formatter using the same timestamp so copied summaries match the in-app dialog.',
      'Added this timestamped entry so the running log shows when the timestamp request was handled.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:27 EDT',
    title: 'Desktop dropdown state is initialized across canvas editors',
    details: [
      'Initialized desktopDropdown in Pixel, Level, and Cutscene constructors to match MIDI and SFX.',
      'Kept Actor on its DOM shell-local dropdown path while normalizing the canvas editors that read this.desktopDropdown in pointer and wheel handlers.',
      'Added coverage so every canvas-style desktop dropdown owner starts with explicit dropdown state.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:25 EDT',
    title: 'Desktop drawer scroll state is initialized across editors',
    details: [
      'Initialized desktopDropdownScroll in Pixel, Level, and Cutscene constructors to match Actor, MIDI, and SFX.',
      'Kept desktop drawers on the shared top-menu/dropdown contract while making scroll state explicit in every editor.',
      'Added coverage so every editor starts with a consistent desktop drawer scroll state shape.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:23 EDT',
    title: 'Actor desktop drawer scroll state is initialized',
    details: [
      'Initialized Actor Editor desktopDropdownScroll in the constructor like the canvas editors.',
      'Kept Actor desktop drawers on the shared top-menu/dropdown shell while making scroll state stable across repeated drawer opens.',
      'Added coverage so Actor desktop drawer scrolling remains part of the shared desktop drawer contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:20 EDT',
    title: 'Pixel controller roots now use the shared menu spec',
    details: [
      'Changed Pixel Studio controller and gamepad sibling order to derive from getEditorRootMenuEntries("pixel").',
      'Kept the existing Frames and Rigging runtime aliases while rendering root labels from the shared Pixel menu spec.',
      'Updated coverage so Pixel is no longer the last editor with a hard-coded controller root order.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:19 EDT',
    title: 'Level controller roots now use the shared root entries',
    details: [
      'Changed Level Editor controller and gamepad sibling order to read from shared spec-backed Level root entries.',
      'Changed the Level controller root menu to render labels from the same alias-aware entries used by mobile landscape roots.',
      'Kept the portrait compact menu model unchanged while reducing non-portrait root drift.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:18 EDT',
    title: 'MIDI controller roots now use the shared root builder',
    details: [
      'Changed MIDI Composer controller and gamepad sibling order to derive from buildMidiSharedRootMenuEntries().',
      'Kept the visible Mixer and Record runtime roots while preserving controller submenu order through the shared spec ids.',
      'Updated coverage so MIDI controller roots cannot drift away from the shared menu spec.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:14 EDT',
    title: 'SFX roots now use the shared root builder',
    details: [
      'Changed SFX Editor controller and gamepad sibling order to read from buildSfxSharedRootMenuEntries().',
      'Changed the SFX controller root menu to render root items from the same shared root entries used by landscape and desktop surfaces.',
      'Updated coverage so SFX non-portrait root menus stay tied to the shared menu spec.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:11 EDT',
    title: 'Actor roots now come from the shared menu spec',
    details: [
      'Changed Actor Editor gamepad and controller root menu ids to derive from getEditorRootMenuEntries("actor").',
      'Kept the compact portrait Actor menu model unchanged while tying desktop and gamepad root labels to the shared editor menu spec.',
      'Updated coverage so Actor non-portrait menus cannot drift back to a hard-coded root list.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:08 EDT',
    title: 'Cutscene roots now come from the shared menu spec',
    details: [
      'Changed Cutscene desktop, landscape, and gamepad root menu ids to derive from getEditorRootMenuEntries("cutscene").',
      'Kept the compact portrait Cutscene tabs unchanged while tying non-portrait roots and labels to the shared editor menu spec.',
      'Updated coverage so Cutscene cannot drift back to a hard-coded root list separate from the shared spec.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:08 EDT',
    title: 'MIDI landscape root rail uses shared drag scrolling',
    details: [
      'Changed the MIDI Composer landscape root rail scroll gesture to use buildMenuScrollDragState and resolveMenuScrollDrag.',
      'Kept the tap-to-select behavior for unmoved root rail presses while routing drag movement through the same shared helper as the other editors.',
      'Added coverage that MIDI landscape menu scrolling now depends on the shared drag-scroll contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:04 EDT',
    title: 'Pixel portrait action rail is backed by its menu model',
    details: [
      'Changed Pixel Studio portrait toolbar actions to read buildPixelPortraitMenuModel().bottomRailActions.',
      'Kept the contextual fourth action for animation play, bone playback, actor-state test, or brush settings without changing portrait behavior.',
      'Added coverage that Pixel portrait toolbar rendering stays linked to the exported portrait menu model.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:02 EDT',
    title: 'Actor portrait quickrail is backed by its menu model',
    details: [
      'Changed the Actor Editor portrait quickrail to read buildActorPortraitMenuModel().bottomRailActions.',
      'Kept the runtime quickrail as Menu, Undo, Redo, and Play Scene while making the portrait model the source of truth.',
      'Added coverage that Actor portrait quickrail rendering stays linked to the exported portrait menu model.'
    ]
  },
  {
    date: '2026-07-01',
    time: '15:00 EDT',
    title: 'MIDI portrait action rail is backed by its menu model',
    details: [
      'Changed the MIDI Composer compact portrait rail to read buildMidiPortraitMenuModel().bottomRailActions.',
      'Kept the runtime bounds and actions for File, Undo, Redo, and Play unchanged so existing pointer handling still works.',
      'Added coverage that MIDI portrait rail rendering stays linked to the exported portrait menu model.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:58 EDT',
    title: 'SFX portrait action rail is backed by its menu model',
    details: [
      'Changed the SFX Editor portrait action rail to read buildSfxPortraitMenuModel().bottomRailActions.',
      'Kept the runtime rail as Menu, Undo, Redo, and Play while leaving loop controls in the menu model instead of the rail.',
      'Added coverage that SFX portrait rail rendering stays linked to the exported portrait menu model.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:56 EDT',
    title: 'Level portrait action rail is backed by its menu model',
    details: [
      'Changed the Level Editor portrait action rail to read buildLevelPortraitMenuModel().bottomRailActions.',
      'Kept the runtime rail as Menu, Undo, Redo, and Playtest while making the portrait model the source of truth.',
      'Added coverage that Level portrait rail rendering stays linked to the exported portrait menu model.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:54 EDT',
    title: 'Cutscene portrait action rail is backed by its menu model',
    details: [
      'Changed Cutscene drawActionRail so portrait actions come from buildCutscenePortraitMenuModel().bottomRailActions.',
      'Kept the runtime actions as Menu, Undo, Redo, and Play while making the exported portrait model the source of truth.',
      'Added coverage that the Cutscene portrait rail remains linked to the shared portrait model.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:52 EDT',
    title: 'Actor editor DOM controls use shared rounded chrome',
    details: [
      'Updated reusable Actor Editor DOM buttons, cards, inputs, state rows, and previews to use tokenized borders and 6px radii.',
      'Kept the Actor layout behavior unchanged while making its DOM controls visually closer to the canvas editors shared menu chrome.',
      'Added style coverage so the Actor Editor does not drift back to square one-off controls.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:49 EDT',
    title: 'Cutscene portrait menu now has shared model parity',
    details: [
      'Added buildCutscenePortraitMenuModel so Cutscene has the same explicit portrait menu model pattern as the other editors.',
      'Expanded Cutscene portrait root tabs beyond File, Add, and Stage to include Timeline, Clips, Keyframes, Audio, Export, and Settings.',
      'Changed the Cutscene portrait drawer tab strip to two compact rows so the expanded roots fit on phone widths while Undo, Redo, and Play stay on the bottom action rail.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:45 EDT',
    title: 'Shared menu specs now enforce desktop File and Edit roots',
    details: [
      'Added shared validation that every editor keeps File and Edit as the first two root menus for desktop-style consistency.',
      'Added shared required File actions for New, Save, Save As, Open, and Exit to Main Menu across editor specs.',
      'Added shared required Edit history actions so every editor keeps Undo and Redo in the Edit drawer.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:43 EDT',
    title: 'Portrait menu surfaces are locked to bottom-first',
    details: [
      'Added shared mode surface metadata so portrait root menus, submenus, and primary actions are explicitly bottom surfaces.',
      'Added cross-editor coverage for Pixel, Level, Actor, MIDI, SFX, and Cutscene portrait menu plans.',
      'Also covered the distinct landscape, desktop, and gamepad surface maps so mode-specific layouts cannot collapse into each other.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:41 EDT',
    title: 'Shared landscape and gamepad menu roles are explicit',
    details: [
      'Added shared landscape shell role fields for left root rail, right submenu drawer, bottom tool rail, and gesture scrolling.',
      'Added shared gamepad slide-out role fields so submenu panels are defined as replacing the left root rail instead of using the right rail.',
      'Added cross-editor coverage for Pixel, Level, Actor, MIDI, SFX, and Cutscene so those role contracts stay consistent.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:37 EDT',
    title: 'Shared desktop layout plan names command and context roles',
    details: [
      'Added explicit desktop plan fields that identify top dropdowns as the command surface.',
      'Marked the desktop left column as a context and inspector panel instead of a duplicate command rail.',
      'Added shared layout and shell coverage across every editor so future changes can test against the desktop app-style contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:36 EDT',
    title: 'Latest Changes timestamps are now required',
    details: [
      'Updated AGENTS.md so every future Latest Changes entry includes both date and time.',
      'Kept the running list timestamped so recent work shows when it landed, not just the day it changed.',
      'Left the existing formatter compatibility in place for older entries that predate the timestamp field.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:33 EDT',
    title: 'Desktop editor spec matches contextual panels',
    details: [
      'Updated UISpec.md so desktop top drawers are the command surface and desktop left columns are persistent context or inspector panels.',
      'Updated ui/EDITORS_UI_CONTRACT.md with the same shell rule so future editor work does not reintroduce duplicate command rails.',
      'Documented that editor-specific always-visible panels can still live on right or bottom rails when that fits the workflow.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:30 EDT',
    title: 'Actor desktop left panel is contextual',
    details: [
      'Changed the Actor Editor desktop options rail from duplicate command buttons into a persistent context panel.',
      'Kept Actor commands in the top desktop dropdown drawers while the left panel reports actor, menu, state, parts, collision, and scene context.',
      'Added coverage that Actor desktop left options no longer render getActorDesktopActions as button rows.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:29 EDT',
    title: 'Pixel desktop left panel is contextual',
    details: [
      'Changed Pixel Studio desktop left options from duplicate File/Edit/Tool/Canvas panels into a persistent context panel.',
      'Kept Pixel commands in the top desktop dropdown drawers while layers remain on the right and frames remain along the bottom.',
      'Added coverage that Pixel desktop calls drawDesktopContextPanel instead of reusing the mobile left panel content renderer.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:27 EDT',
    title: 'Level desktop left panel is contextual',
    details: [
      'Changed the Level Editor desktop left column from a duplicate active menu list into a persistent context panel.',
      'Kept Level commands, tile choices, NPC choices, prefabs, music tools, and settings in the top desktop dropdown drawers.',
      'Added coverage that Level desktop left options no longer render command lists while dropdowns still use getPanelConfig for active states and previews.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:24 EDT',
    title: 'MIDI desktop left panel is contextual',
    details: [
      'Changed the MIDI Composer desktop left column from a duplicate controller submenu into a persistent song, track, pattern, tempo, and note context panel.',
      'Kept MIDI commands in the top desktop dropdown drawers, including the hidden desktop grid place/erase note actions.',
      'Added coverage that MIDI desktop left options no longer call drawControllerSubmenuPanel while the dropdown remains the command surface.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:22 EDT',
    title: 'SFX desktop left panel is contextual',
    details: [
      'Changed the SFX Editor desktop left column from a duplicate active menu list into a persistent context and transport panel.',
      'Kept File, Edit, Timeline, Layers, Tools, Settings, Envelopes, and Generate commands in the top desktop dropdown drawers.',
      'Added coverage that SFX desktop returns after drawing context plus transport instead of falling through to mobile-style menu panels.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:19 EDT',
    title: 'Cutscene desktop left panel is contextual',
    details: [
      'Changed the Cutscene Editor desktop left column from a duplicate command list into a persistent context and transport panel.',
      'Kept Cutscene commands in the top desktop dropdown drawers so desktop behavior is closer to a regular app menu.',
      'Added coverage that the Cutscene desktop panel no longer pushes duplicate menu buttons from getMenuItems().'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:17 EDT',
    title: 'Cutscene desktop clears stale thumbstick state',
    details: [
      'Reset Cutscene Editor thumbstick state when entering desktop layout so mobile controls cannot leave invisible hit targets.',
      'Kept the desktop shell on the top-menu/dropdown model while clearing only the mobile pan control state.',
      'Added coverage that the desktop layout branch explicitly clears stale mobile thumbstick geometry.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:15 EDT',
    title: 'Pixel desktop canvas pan uses shared pointer policy',
    details: [
      'Routed Pixel Studio desktop canvas middle/right-button pan through the shared editor pointer interaction policy.',
      'Kept selection context-menu handling ahead of pan so right-click selection actions still open correctly.',
      'Added coverage so Pixel follows the same shared desktop mouse contract as Level and MIDI.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:12 EDT',
    title: 'MIDI desktop grid pan uses shared pointer policy',
    details: [
      'Routed MIDI Composer desktop grid middle/right-button pan through the shared editor pointer interaction policy.',
      'Kept touch pan and Alt-pan behavior intact while removing the hard-coded desktop button predicate.',
      'Added coverage so MIDI grid panning follows the same desktop mouse contract as Level.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:09 EDT',
    title: 'Level desktop pan uses shared pointer policy',
    details: [
      'Routed Level Editor desktop middle/right-button pan checks through the shared editor pointer interaction policy.',
      'Kept Space + left-button pan behavior while making the desktop mouse contract explicit in runtime code.',
      'Updated coverage so Level desktop pan behavior stays ahead of tile placement and erase handling.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:07 EDT',
    title: 'File menu legacy helper cleanup',
    details: [
      'Removed unused legacy File drawer helper imports from the Level Editor.',
      'Added coverage that editor files stay on the shared File menu model instead of the old unified drawer item builder.',
      'Kept the shared render drawer helper in place where editors still use it to draw the shared File menu items.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:05 EDT',
    title: 'Actor desktop click-away matches canvas editors',
    details: [
      'Changed Actor Editor desktop click-away handling to close any visible top-menu drawer, not only drawers opened by hover state.',
      'Aligned the DOM-based Actor shell with the canvas editors that close based on shared visible dropdown state.',
      'Added regression coverage so Actor desktop drawers cannot stay open just because openDesktopDropdownRootId is null.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:04 EDT',
    title: 'Desktop dropdown scroll keys standardized',
    details: [
      'Changed MIDI, SFX, and Cutscene desktop shells to read dropdown scroll state from the open drawer root.',
      'Aligned those editors with Pixel and Level so hovering between top menus does not reuse a persistent panel scroll key.',
      'Added coverage that all canvas editors use openDesktopRootId for desktop drawer scroll state.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:02 EDT',
    title: 'Latest Changes entries now include time',
    details: [
      'Added a time field to the newest Latest Changes entries so recent work shows when it happened.',
      'Updated the text formatter and dialog headings to display date and time together when available.',
      'Kept older entries compatible so the running history still renders even before every old item has a timestamp.'
    ]
  },
  {
    date: '2026-07-01',
    time: '14:00 EDT',
    title: 'Pixel desktop shell is always app-style',
    details: [
      'Removed the leftover left-sidebar gate from Pixel desktop shell creation so desktop always uses the top menu shell.',
      'Changed Pixel desktop dropdown scrolling to follow the currently open drawer rather than the persistent panel tab.',
      'Added regression coverage for the desktop shell and drawer scroll contract.'
    ]
  },
  {
    date: '2026-07-01',
    time: '13:56 EDT',
    title: 'Actor desktop left-panel cleanup',
    details: [
      'Stopped Actor Editor desktop from building mobile right-rail content before moving it into the left panel.',
      'Kept desktop options in the dedicated left panel under the top menu.',
      'Preserved right-rail content for portrait, landscape touch, and gamepad layouts.'
    ]
  },
  {
    date: '2026-07-01',
    time: '13:49 EDT',
    title: 'MIDI desktop record mode shell cleanup',
    details: [
      'Removed the stale MIDI record-mode desktop fallback that could draw the old left-panel layout.',
      'Kept desktop record mode routed through the shared top-menu desktop shell.',
      'Added regression coverage so MIDI record mode stays mobile-only for the special record layout.'
    ]
  },
  {
    date: '2026-07-01',
    time: '13:43 EDT',
    title: 'Level portrait freeze guard and desktop Edit menu',
    details: [
      'Normalized the Level Editor mobile draw path so portraitLayout is declared once before every portrait/mobile branch that reads it.',
      'Added regression coverage for the Level portrait layout scope so it cannot fall back to an undefined runtime variable.',
      'Verified the Level desktop menu keeps Edit directly beside File with Undo, Redo, Copy, Cut, Paste, and Delete.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Desktop ribbons no longer duplicate Undo and Redo',
    details: [
      'Removed standalone Undo and Redo buttons from Pixel, Level, MIDI, and Actor desktop ribbons/sidebar menus.',
      'Cleared MIDI desktop history button hit bounds so removed ribbon controls cannot receive stale clicks.',
      'Kept mobile portrait quick undo/redo controls intact.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Landscape root rails are section-only',
    details: [
      'Removed MIDI Undo and Redo from the landscape root rail so the left rail stays focused on menu sections.',
      'Changed SFX shared root menu entries to omit Undo and Redo by default, matching the desktop and gamepad section model.',
      'Kept portrait bottom quick rails for Undo and Redo intact.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Root menus now route history through Edit',
    details: [
      'Removed loose Undo and Redo entries from editor controller root menus now that every editor has an Edit drawer.',
      'Removed Level desktop top-menu Undo and Redo buttons so history commands live under Edit instead of appearing as extra root menus.',
      'Kept portrait quick undo/redo rails and editor toolbar shortcuts intact where they are intentionally part of the mobile workflow.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared menu spec and gamepad order alignment',
    details: [
      'Updated UISpec.md so every editor root list documents the new File, Edit, then editor-specific menu order.',
      'Aligned Pixel, MIDI, and SFX controller sibling order with the shared Edit roots so gamepad section switching matches desktop menus.',
      'Added regression coverage for the updated runtime sibling orders.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor desktop Edit drawer',
    details: [
      'Added an Actor Editor shared/desktop Edit root immediately after File.',
      'Moved Actor Undo, Redo, Copy State, Paste State, Duplicate State, and Delete State into the Edit drawer.',
      'Kept the States drawer focused on adding states and browsing the state list.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'MIDI desktop Edit drawer',
    details: [
      'Added a MIDI Composer shared/desktop Edit root immediately after File while preserving the portrait root menu.',
      'Moved MIDI Undo, Redo, Select All, Copy, Cut, Paste, and Delete into the Edit drawer.',
      'Kept MIDI note placement and erasing as direct grid interactions instead of desktop menu commands.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'SFX desktop Edit drawer',
    details: [
      'Added an SFX Editor shared/desktop Edit root immediately after File without changing the portrait root tabs.',
      'Moved SFX Undo, Redo, Copy, Cut, Paste, and Delete into the Edit drawer.',
      'Kept SFX Tools focused on audio operations such as split, trim, normalize, fade, reverse, bitcrusher, time stretch, and loop wizard.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Level desktop Edit drawer polish',
    details: [
      'Kept Level Editor desktop Copy, Cut, Paste, Delete, Undo, and Redo grouped under the Edit drawer beside File.',
      'Changed Level desktop top-menu highlighting and drawer scroll state to follow the open drawer instead of the persistent left panel.',
      'Restarted the local server so the Level portrait-layout freeze fix and desktop menu updates are served from the latest source.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Cutscene desktop Edit drawer',
    details: [
      'Added a Cutscene Editor Edit root immediately after File in the shared menu model.',
      'Moved Cutscene Undo and Redo out of File and into Edit alongside Copy, Cut, Paste, and Delete.',
      'Backed the new Cutscene Edit drawer with existing clip clipboard and delete handlers.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Pixel desktop Edit drawer',
    details: [
      'Added a Pixel Editor desktop/shared Edit root immediately after File.',
      'Backed the Pixel Edit drawer with Undo, Redo, Copy, Cut, Paste, and Clear Selection actions.',
      'Updated Pixel desktop top-menu highlighting to follow the open drawer root from the shared shell plan.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor desktop drawer click-away',
    details: [
      'Added Actor Editor desktop click-away handling so an open top drawer closes when clicking back into the workspace or left panel.',
      'Changed Actor desktop top-menu highlighting to follow the open drawer root from the shared shell plan.',
      'Cleared stale Actor desktop drawer state when rendering mobile layouts.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'MIDI and SFX desktop drawers decoupled',
    details: [
      'Changed MIDI Composer desktop top-menu hover and clicks to open dropdown drawers without switching the persistent left options panel.',
      'Changed SFX Editor desktop top-menu hover and clicks to use the same open drawer state instead of mutating the active editor tab.',
      'Added click-away closing for MIDI and SFX desktop drawers so they behave like normal desktop app menus.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Level desktop Edit menu and freeze fix',
    details: [
      'Fixed the Level Editor crash caused by the desktop drawer reading a portrait-only layout variable.',
      'Added a Level Editor desktop Edit drawer next to File with Undo, Redo, Copy, Cut, Paste, and Delete entries.',
      'Kept Copy/Cut/Paste as visible placeholders until the level editor has a real selection clipboard, and wired Delete to existing decal/trigger deletion.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor collision action and Cutscene desktop drawers',
    details: [
      'Fixed Actor Editor desktop Collision -> Body Damage so it opens the actor settings where body contact damage lives.',
      'Separated Cutscene desktop top-menu drawer state from the persistent left/context panel.',
      'Added Cutscene desktop click-away drawer closing so top drawers behave more like a desktop app.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'MIDI main-menu exit and Pixel desktop rails',
    details: [
      'Fixed MIDI Composer Exit to Main Menu so it forces the title screen instead of returning to the previous editor state.',
      'Stopped Pixel desktop Draw from rendering a second palette column over the left panel.',
      'Started the Pixel desktop split with Layers reserved on the right rail and Frames shown in a bottom strip.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Latest Changes stays as a dialog',
    details: [
      'Wired the Latest Changes overlay into the main canvas overlay gate so clicks cannot fall through into the game or title menu underneath.',
      'Kept Latest Changes as a scrollable readme-style dialog with its newest work at the top.',
      'Updated the running list so this fix appears first when opened from Options.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'MIDI shared File menu model',
    details: [
      'Moved MIDI Composer file menu items onto the shared editor file menu builder.',
      'Kept MIDI navigation, rescue save, export, playback, theme, sample, and exit actions as shared file menu extras.',
      'Fixed the standard MIDI file actions to call the existing handleFileMenu path instead of a missing handler alias.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Pixel shared File menu model',
    details: [
      'Moved Pixel Editor file menu items onto the shared editor file menu builder.',
      'Kept Pixel-specific copy, paste, decal-session, and exit actions as shared file menu extras.',
      'Added coverage so Pixel stays on the shared File menu model while filtering unsupported undo and redo entries.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Removed legacy gamepad landscape wrappers',
    details: [
      'Removed unused isGamepadLandscapeMenuMode wrappers from Pixel, Level, MIDI, Cutscene, and Actor.',
      'Kept gamepad submenu and overlay behavior routed through the shared getGamepadMenuState path.',
      'Added coverage so editors keep using shared gamepad menu state instead of reintroducing local landscape wrappers.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Level shared viewport mode flags',
    details: [
      'Moved Level Editor main shell portrait, mobile, and desktop mode decisions onto the shared viewport mode helper.',
      'Kept the existing portrait sheet, landscape rail, and desktop shell geometry intact.',
      'Updated coverage so Level shell branching follows the same viewport mode contract as the other editors.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'MIDI shared viewport mode flags',
    details: [
      'Moved MIDI Composer top-level draw mode detection onto the shared viewport mode helper.',
      'Kept mobile record mode and desktop shell routing intact while standardizing the mobile-versus-desktop branch.',
      'Updated coverage so MIDI shell branching uses the same viewport mode contract as the other editors.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Pixel shared viewport mode flags',
    details: [
      'Moved Pixel Editor top-level draw mode detection onto the shared viewport mode helper.',
      'Kept Pixel-specific portrait and landscape layout geometry intact while standardizing desktop, mobile, and gamepad-aware shell flags.',
      'Updated coverage so Pixel shell branching keeps using the shared viewport mode contract.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Cutscene shared viewport mode flags',
    details: [
      'Moved Cutscene Editor computeLayout mode branching onto the shared viewport mode helper.',
      'Kept existing portrait, desktop, landscape, and gamepad geometry while standardizing how those modes are detected.',
      'Removed the Cutscene-only mobile portrait import from its layout branch.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor shared viewport mode flags',
    details: [
      'Moved Actor Editor desktop, portrait, landscape, and gamepad-landscape render flags onto the shared viewport mode helper.',
      'Kept the existing Actor DOM shell structure while aligning its mode decisions with the canvas editors.',
      'Updated coverage so Actor gamepad slide-out layout depends on the shared gamepad-landscape flag.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared editor viewport mode flags',
    details: [
      'Added a shared helper for desktop, portrait, landscape touch, and gamepad-landscape mode flags.',
      'Moved SFX Editor gamepad-landscape detection onto the shared viewport mode helper.',
      'Covered the helper so desktop never becomes gamepad layout just because a controller is connected.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared desktop dropdown state resolver',
    details: [
      'Added a shared resolver for active desktop dropdown state so dropdown drawers only persist in desktop layout.',
      'Moved Pixel, Level, MIDI, SFX, and Cutscene desktop-dropdown assignment and mobile cleanup onto the shared resolver.',
      'Updated coverage so stale desktop drawers cannot leak into portrait, landscape touch, or gamepad layouts.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Latest Changes readme dialog guard',
    details: [
      'Kept Latest Changes as a blocking scrollable dialog instead of allowing delayed menu input to reach the game underneath.',
      'Added capture-phase input shielding for mouse, touch, wheel, and context-menu events while the changelog is open.',
      'Locked page scrolling while the dialog is open and restored overlay cleanup when reopening it.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'SFX and Actor shared gamepad menu state',
    details: [
      'Moved SFX and Actor gamepad menu filtering onto the shared gamepad menu state resolver.',
      'Kept SFX landscape overlay behavior accurate by passing viewport dimensions into the shared resolver.',
      'Completed the first pass of shared gamepad submenu state gating across all editors.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'MIDI and Cutscene shared gamepad menu state',
    details: [
      'Moved MIDI and Cutscene gamepad slide-out gating onto the shared gamepad menu state resolver.',
      'Kept controller overlay behavior for system, help, and exit-confirm menus.',
      'Further reduced duplicated landscape gamepad menu filtering across editors.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared gamepad menu state resolver',
    details: [
      'Added a shared resolver for gamepad landscape menu state, active submenu ids, slide-out visibility, and controller overlays.',
      'Moved Pixel and Level gamepad slide-out gating onto the shared resolver.',
      'Kept existing A/B slide-out behavior while removing duplicated root/system/help/exit filtering in those editors.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor Editor shared desktop dropdown render plan',
    details: [
      'Added stable action ids for Actor desktop dropdown actions.',
      'Moved Actor desktop dropdown row slicing onto the shared render-plan helper.',
      'Improved Actor state-list drawer scrolling by slicing live expanded state rows instead of spec rows.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Level Editor shared desktop dropdown render plan',
    details: [
      'Moved Level desktop dropdown row mapping and drawer sizing onto the shared render-plan helper.',
      'Kept Level-specific separators, dividers, previews, active state, and callbacks intact.',
      'Finished the canvas editor migration for shared desktop dropdown render planning.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared desktop dropdown render planning',
    details: [
      'Added a shared render-plan helper for desktop dropdown drawers.',
      'Moved Pixel, MIDI, SFX, and Cutscene dropdown row mapping and drawer sizing onto the shared helper.',
      'Kept editor-specific drawing, focus, and action callbacks local while removing duplicated action lookup logic.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Level and MIDI shared desktop hover switching',
    details: [
      'Moved Level desktop top-menu hover switching onto the shared root-hit helper while preserving undo, redo, and playtest exclusions.',
      'Moved MIDI desktop top-menu hover switching onto the same helper using its existing File, tab, and Settings bounds.',
      'Reduced more one-off desktop menu hit testing so top-menu drawer behavior keeps converging across editors.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared desktop top-menu hover hit testing',
    details: [
      'Added a shared helper for resolving desktop top-menu root hits from pointer hover.',
      'Moved Pixel, SFX, and Cutscene drawer switching onto the shared hover-hit path.',
      'Covered custom root ids and prefixed desktop-root ids so more editors can migrate safely.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared desktop dropdown wheel scrolling',
    details: [
      'Moved desktop top-menu drawer wheel scrolling into shared editor menu helpers.',
      'Updated Pixel, Level, MIDI, SFX, Cutscene, and Actor dropdown drawers to use the shared clamp behavior.',
      'Added coverage so every editor keeps the same desktop drawer scroll semantics.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Level Editor shared menu drag scrolling',
    details: [
      'Extended the shared menu drag-scroll helper to support continuous pixel-based scroll panels.',
      'Moved the Level Editor mobile root rail and drawer scroll drag path onto the shared helper.',
      'Kept Level tap behavior intact while preserving the existing drag distance and scroll feel.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Latest Changes dialog input guard',
    details: [
      'Kept the Latest Changes button as a dialog-only action instead of letting canvas input leak through underneath it.',
      'Added a global overlay guard so menu clicks, mouse movement, and wheel input do not keep driving the game canvas while the changelog is open.',
      'Stopped Latest Changes overlay pointer and click events from bubbling into the launcher.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Cutscene Editor shared menu drag scrolling',
    details: [
      'Moved Cutscene landscape root rail and submenu drag scrolling onto the shared menu drag-scroll helper.',
      'Kept tap activation intact for menus that fit without scrolling.',
      'Covered Cutscene shared helper usage so its landscape menu drag behavior stays aligned with SFX.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared menu drag-scroll helper',
    details: [
      'Added shared helpers for finding scrollable menu regions and resolving drag-scroll state.',
      'Moved SFX mobile rail and drawer drag scrolling onto the shared helper path.',
      'Covered the drag threshold behavior so taps only suppress button activation after real movement.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared editor menu spec validation',
    details: [
      'Tightened the shared editor menu validator so duplicated root menus and duplicated section actions are caught.',
      'Added validation for action ids missing from the generated actions map.',
      'Added an alias collision guard so runtime aliases cannot hide an existing root menu.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor Editor landscape rail containment',
    details: [
      'Constrained the Actor Editor landscape left rail so menu content scrolls inside the rail instead of spilling outside it.',
      'Set the Actor root rail to vertical pan behavior for landscape while preserving portrait behavior.',
      'Added coverage for the Actor landscape rail containment contract.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'SFX Editor mobile menu drag scrolling',
    details: [
      'Added gesture-drag scroll state for SFX mobile root rails and submenu drawers.',
      'Drag movement now scrolls the relevant menu instead of firing the original button tap.',
      'File and Layers drawers now keep shared scroll offsets when their content overflows.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor Editor desktop drawer scrolling',
    details: [
      'Changed the Actor Editor desktop drawer to honor the shared visible-row cap.',
      'Added mouse-wheel scrolling for long Actor desktop drawers, including expanded state lists.',
      'Covered the Actor drawer path so it stays aligned with the shared desktop shell.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Actor Editor desktop gamepad chrome',
    details: [
      'Stopped the Actor Editor from showing the mobile gamepad hint bar in desktop mode.',
      'Kept the hint bar available for mobile/controller layouts where it belongs.',
      'Added coverage so Actor follows the same desktop no-mobile-hints rule as the other editors.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Shared desktop menu drawer sizing',
    details: [
      'Capped desktop drop-down drawer rows from the available viewport height.',
      'Applied the behavior through the shared editor shell so all editors inherit bounded, scrollable top menus.',
      'Added coverage for short desktop windows where long menus need to scroll instead of running off-screen.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Latest Changes dialog behavior',
    details: [
      'Changed Latest Changes from a game-state modal into a scrollable dialog overlay.',
      'The dialog now stays over the current menu instead of switching into the game prompt state.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Level Editor desktop menu labels',
    details: [
      'Changed Level Editor desktop top menu labels from all caps to title case.',
      'Cleaned up the NPCs desktop label so it no longer appears as NPCS.',
      'Added a guard so the desktop menu does not regress back to all-caps labels.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Latest Changes panel',
    details: [
      'Added an Options menu entry that opens this running list.',
      'Updated modal prompts so multi-line change summaries are readable.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Editor desktop UI consistency',
    details: [
      'Aligned the shared File menu order across editor specs.',
      'Stopped Level and MIDI from showing persistent mobile gamepad hint bars on desktop.',
      'Added coverage for desktop hover drawers across every editor.'
    ]
  },
  {
    date: '2026-07-01',
    title: 'Main menu loading splash',
    details: [
      'Added the RTG Studio loading splash while main-menu requirements load.',
      'Kept main-menu buttons inactive until loading finishes.'
    ]
  }
];

export function formatLatestChangeTimestamp(entry) {
  return [entry?.date, entry?.time].filter(Boolean).join(' ');
}

export function formatLatestChanges(limit = LATEST_CHANGES.length) {
  const entries = LATEST_CHANGES.slice(0, Math.max(1, limit));
  return [
    'Latest Changes',
    '',
    'Major Items I am Working Toward',
    ...LATEST_MAJOR_WORK.inProgress.map((item) => `- ${item}`),
    '',
    'Most Recent Major Changes',
    ...LATEST_MAJOR_WORK.recentMajorChanges.map((item) => `- ${item}`),
    '',
    'Detailed Change Log',
    '',
    ...entries.flatMap((entry) => [
      `${formatLatestChangeTimestamp(entry)} - ${entry.title || entry.summary || 'Latest change'}`,
      ...entry.details.map((detail) => `- ${detail}`),
      ''
    ])
  ].join('\n').trimEnd();
}

function ensureOverlayRoot() {
  let root = document.getElementById('global-overlay-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'global-overlay-root';
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none'
    });
    document.body.appendChild(root);
  }
  return root;
}

export function isLatestChangesOverlayOpen() {
  if (typeof document === 'undefined') return false;
  return Boolean(document.getElementById('latest-changes-overlay'));
}

function installLatestChangesInputGuard(overlay) {
  const blockedEvents = [
    'pointerdown',
    'pointerup',
    'click',
    'mousedown',
    'mouseup',
    'touchstart',
    'touchmove',
    'touchend',
    'wheel',
    'contextmenu'
  ];
  const guard = (event) => {
    if (!isLatestChangesOverlayOpen()) return;
    if (overlay.contains?.(event.target)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
  };
  blockedEvents.forEach((type) => document.addEventListener(type, guard, true));
  return () => blockedEvents.forEach((type) => document.removeEventListener(type, guard, true));
}

export function openLatestChangesOverlay({ limit = LATEST_CHANGES.length } = {}) {
  if (typeof document === 'undefined') return null;
  const root = ensureOverlayRoot();
  const existing = document.getElementById('latest-changes-overlay');
  if (existing) {
    if (typeof existing.__closeLatestChanges === 'function') {
      existing.__closeLatestChanges();
    } else {
      existing.remove();
    }
  }
  root.style.pointerEvents = 'auto';

  const overlay = document.createElement('div');
  overlay.id = 'latest-changes-overlay';
  overlay.setAttribute?.('role', 'dialog');
  overlay.setAttribute?.('aria-modal', 'true');
  overlay.setAttribute?.('aria-label', 'Latest Changes');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    background: 'rgba(0,0,0,0.52)',
    pointerEvents: 'auto',
    touchAction: 'none',
    boxSizing: 'border-box'
  });

  const panel = document.createElement('section');
  Object.assign(panel.style, {
    width: 'min(720px, 100%)',
    maxHeight: 'min(720px, 86dvh)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    boxSizing: 'border-box',
    background: 'rgba(8,12,20,0.97)',
    color: '#f8fbff',
    border: '1px solid rgba(255,225,106,0.45)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    fontFamily: 'Courier New, monospace',
    touchAction: 'pan-y'
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: '0 0 auto'
  });

  const title = document.createElement('h2');
  title.textContent = 'Latest Changes';
  Object.assign(title.style, {
    margin: '0',
    flex: '1 1 auto',
    color: '#ffe16a',
    fontSize: '18px',
    lineHeight: '1.2'
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  Object.assign(close.style, {
    minHeight: '36px',
    padding: '7px 12px',
    background: 'rgba(0,0,0,0.58)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.32)',
    fontFamily: 'inherit',
    cursor: 'pointer'
  });

  const list = document.createElement('div');
  Object.assign(list.style, {
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    paddingRight: '6px',
    lineHeight: '1.45',
    fontSize: '13px',
    touchAction: 'pan-y'
  });

  const addSummarySection = (headingText, items) => {
    const section = document.createElement('section');
    Object.assign(section.style, {
      padding: '10px 0',
      borderTop: '1px solid rgba(255,225,106,0.22)'
    });
    const heading = document.createElement('h3');
    heading.textContent = headingText;
    Object.assign(heading.style, {
      margin: '0 0 6px',
      color: '#ffe16a',
      fontSize: '14px'
    });
    const ul = document.createElement('ul');
    Object.assign(ul.style, {
      margin: '0',
      paddingLeft: '18px'
    });
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    section.append(heading, ul);
    list.appendChild(section);
  };

  addSummarySection('Major Items I am Working Toward', LATEST_MAJOR_WORK.inProgress);
  addSummarySection('Most Recent Major Changes', LATEST_MAJOR_WORK.recentMajorChanges);

  LATEST_CHANGES.slice(0, Math.max(1, limit)).forEach((entry) => {
    const block = document.createElement('article');
    Object.assign(block.style, {
      padding: '10px 0',
      borderTop: '1px solid rgba(255,255,255,0.12)'
    });
    const heading = document.createElement('h3');
    heading.textContent = `${formatLatestChangeTimestamp(entry)} - ${entry.title || entry.summary || 'Latest change'}`;
    Object.assign(heading.style, {
      margin: '0 0 6px',
      color: '#9ddcff',
      fontSize: '14px'
    });
    const ul = document.createElement('ul');
    Object.assign(ul.style, {
      margin: '0',
      paddingLeft: '18px'
    });
    entry.details.forEach((detail) => {
      const li = document.createElement('li');
      li.textContent = detail;
      ul.appendChild(li);
    });
    block.append(heading, ul);
    list.appendChild(block);
  });

  const removeInputGuard = installLatestChangesInputGuard(overlay);
  const previousBodyOverflow = document.body?.style?.overflow;
  if (document.body?.style) document.body.style.overflow = 'hidden';
  let closed = false;
  const remove = () => {
    if (closed) return;
    closed = true;
    removeInputGuard();
    overlay.remove();
    if (document.body?.style) document.body.style.overflow = previousBodyOverflow || '';
    if (!root.children?.length) root.style.pointerEvents = 'none';
  };
  overlay.__closeLatestChanges = remove;
  close.onclick = remove;
  const stopOverlayEvent = (event) => {
    event.stopPropagation?.();
  };
  overlay.onpointerdown = stopOverlayEvent;
  overlay.onpointerup = stopOverlayEvent;
  overlay.onclick = (event) => {
    event.stopPropagation?.();
    if (event.target === overlay) remove();
  };
  overlay.onkeydown = (event) => {
    if (event.key === 'Escape') remove();
  };

  header.append(title, close);
  panel.append(header, list);
  overlay.appendChild(panel);
  root.appendChild(overlay);
  close.focus();
  return overlay;
}
