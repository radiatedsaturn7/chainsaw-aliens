export const LATEST_MAJOR_WORK = {
  inProgress: [
    'Build race simulator validation tools: skidpad, acceleration/braking, quarter-mile, slalom, jump analysis, ghost comparison, and AI consistency laps so physics changes can be tested instead of judged only by feel.',
    'Finish shared desktop editor chrome across all editors: horizontal top menus, click-away dropdown drawers, and persistent left-side tool/context panels.',
    'Rework desktop editor menu information architecture: keep dropdowns usable while selecting commands, move common edit commands into one Edit area, and make left panels contextual instead of duplicating top drawers.',
    'Audit every editor menu so File, Edit, View, Tools, and editor-specific drawers contain real commands instead of duplicate navigation rows.',
    'Preserve the working portrait flows while tightening only obvious overlap, start-screen, and bottom-menu problems.',
    'Bring mobile landscape and gamepad onto the same shared layout rules: landscape keeps left root/right submenu, gamepad replaces the left root with a slide-out submenu.',
    'Reduce per-editor UI drift by moving repeated canvas and DOM chrome into shared RTG Studio helpers and CSS tokens.'
  ],
  recentMajorChanges: [
    '2026-07-21 19:42 EDT - Optimized the Race Editor top-down road and terrain placement preview by using the lightweight canonical surface bake instead of the heavy terrain debug bake and capping long-route section drawing for smoother load and panning.',
    '2026-07-21 19:33 EDT - Added a default Race Editor top-down road and terrain surface preview from the same canonical surface bake used by playtest so doodad and tree placement can be judged against the real road corridor.',
    '2026-07-21 19:10 EDT - Fixed race playtest drivetrain RPM coupling so airborne driven wheels unload the engine and let it free-rev in gear while tire drive and brake forces remain disabled off the ground.',
    '2026-07-21 10:02 EDT - Improved race doodad rendering performance by caching normalized doodad documents, reusing unchanged Three doodad mesh groups between frames, and avoiding repeated texture upload flags for cached doodad materials.',
    '2026-07-21 09:53 EDT - Fixed MIDI Record touch landscape popups so Settings draws as a visible landscape overlay and Virtual opens in a full record overlay instead of being clipped inside the piano.',
    '2026-07-21 09:46 EDT - Raised the MIDI Record touch landscape pedal strip so it no longer overlaps the virtual instrument and moved record-mode virtual instrument popup buttons onto the shared blue editor chrome.',
    '2026-07-21 09:41 EDT - Fixed MIDI Record touch landscape so the More popup draws and handles taps above the piano, and removed the Pedal Board title from record-mode pedal strips in portrait and landscape.',
    '2026-07-21 09:36 EDT - Removed the old Quant/Count In/Click settings rail and note preview from MIDI Record touch landscape, leaving the lower virtual instrument at half-screen height with the pedal strip above it.',
    '2026-07-21 09:27 EDT - Reworked MIDI Record touch landscape as a unique screen with a horizontal top Menu/Undo/Redo/Play/More bar, a More dropdown for Virtual/Settings/Record, no right-side menu, and the pedal board above the lower virtual instrument.',
    '2026-07-21 09:19 EDT - Made the MIDI Song touch landscape More menu scrollable like the Pixel landscape More menu, with bounded visible rows, drag-safe row activation, wheel scrolling, and scroll hints.',
    '2026-07-21 09:14 EDT - Standardized touch landscape right-menu widths against the Pixel Editor by removing wider MIDI/Cutscene and narrow Actor/SFX right-rail overrides so shared editors use one right drawer size.',
    '2026-07-21 09:09 EDT - Corrected MIDI Song touch landscape so the Song mode selector lives in the right rail while the left rail stays on the standard Menu, Undo, Redo, and Play hotbar.',
    '2026-07-21 09:02 EDT - Reworked MIDI Song touch landscape so the left hotbar shows the active Music/Edit/Tools/Vol/Pan mode with a More menu for all modes, removes the bottom mode-tab row, and suppresses the duplicate landscape zoom slider.',
    '2026-07-21 08:56 EDT - Fixed MIDI touch landscape hotbars so Grid shows Track, BPM, Repeat, and Note instead of the duplicate Menu rail, Song no longer paints the generic bottom menu, and Record landscape reserves a compact pedal strip below the shorter piano surface.',
    '2026-07-21 08:48 EDT - Fixed MIDI touch landscape grid/song by treating the empty right menu as a MIDI exception, restoring the bottom hotbar path, keeping zoom in a lower-right bottom slot, and making landscape Song/Grid root taps close the drawer after switching.',
    '2026-07-21 08:41 EDT - Fixed SFX touch landscape left menu interactions so compact rail actions skip document-history snapshots and root drawer selections close the drawer after switching panels.',
    '2026-07-21 08:35 EDT - Standardized touch landscape shell zoom placement so shared editors use the Pixel-style right submenu rail with a separate bottom-right zoom slot, Tile/Cutscene/Level reserve that right rail consistently outside gamepad slide-out mode, SFX/Race draw functional zoom sliders in that slot, and MIDI grid/song landscape keeps its bottom hotbar plus the lower-right zoom slider.',
    '2026-07-21 08:27 EDT - Fixed MIDI Composer mobile landscape rendering by resolving the viewport mode inside drawMobileLayout before the landscape branch reads it.',
    '2026-07-21 08:21 EDT - Tile Editor landscape Menu now uses the same touch root list as portrait, including Exit, and MIDI landscape root drawer taps now activate the visible menu buttons instead of closing the drawer immediately.',
    '2026-07-21 00:09 EDT - SFX Editor landscape Menu now draws its portrait-derived root buttons inside the same readable RTG Studio panel chrome as the Pixel-reference landscape menu drawer.',
    '2026-07-20 23:55 EDT - Touch editor root menus now derive landscape drawers from the same portrait root buttons, append the short Exit button to portrait roots, and align compact landscape context/play buttons with their portrait counterparts.',
    '2026-07-20 22:15 EDT - Actor Editor DOM buttons now paint the same top-half overlay over the dark blue button fill as canvas editors, fixing the visual mismatch where Actor buttons lacked the light-blue top half.',
    '2026-07-20 21:56 EDT - Portrait editor buttons now share one exported square chrome source for canvas and DOM editors, removing per-editor opacity and inline Actor style copies while preserving the shared 4px accent strip and active gradient.',
    '2026-07-20 21:09 EDT - Actor Editor portrait settings now use Pixel-style square panel/button/toggle chrome with shared gradients, 4px accent strips, hover/focus states, transparent main surface, and opaque dark settings panels.',
    '2026-07-20 16:36 EDT - Level Tile Editor portrait menus now draw above the bottom action rail so open tile/menu sheets no longer appear underneath Menu, Undo, Redo, or Play buttons.',
    '2026-07-20 16:28 EDT - Portrait File menus now use one Pixel-style sheet border by suppressing nested File drawer panels inside portrait sheets, including Level, Pixel, and MIDI.',
    '2026-07-20 16:25 EDT - Portrait editor menu typography now stays on the shared 12px menu size, including MIDI buttons and Pixel portrait action rails that previously scaled larger.',
    '2026-07-20 16:22 EDT - Actor Editor portrait sheets now match the shared portrait editor style with an opaque bottom sheet, transparent inner rails, and rounded RTG Studio menu buttons instead of square black DOM-only controls.',
    '2026-07-20 15:26 EDT - Portrait File menus now consistently use two-column command grids with a full-width sticky Exit footer, including SFX canvas drawers and Actor DOM file rails.',
    '2026-07-20 14:16 EDT - MIDI Editor portrait File now groups JSON, MIDI, MIDI ZIP, and WAV exports behind a single Export submenu and no longer draws the horizontal zoom slider over the File sheet.',
    '2026-07-19 13:49 EDT - Tile Editor portrait menu sheets now draw above the tile list and block underlying list drag hits, so File and Properties menu buttons stay visually and interactively on top.',
    '2026-07-19 13:45 EDT - Tile Editor portrait now has a live thumbstick, Menu, Undo, Redo, and Tile context rail; Menu opens the File sheet and the Tile context button opens the Properties sheet.',
    '2026-07-19 13:22 EDT - Actor Editor portrait settings now keeps the bottom thumbstick/Menu/Undo/Redo/Actor rail hit areas local to the visible rail and prevents shared button styling from stretching those controls over each other.',
    '2026-07-19 12:48 EDT - Shared sticky File drawer exits now defensively compact legacy Exit to Main Menu labels to Exit while preserving editor-return labels, keeping portrait editor exit buttons standardized.',
    '2026-07-19 12:36 EDT - Actor Editor portrait Menu now opens the File sheet as a clean File-only state, with File tab and controller File entry no longer leaving the Actor context sheet marked open.',
    '2026-07-19 00:24 EDT - Tile Editor portrait now uses the shared mobile portrait mode flag instead of falling through to landscape chrome, and Actor portrait now matches the Pixel-style thumbstick, Menu, Undo, Redo, Context rail with File opening first.',
    '2026-07-19 00:17 EDT - Portrait editors now start with their menu sheets closed while defaulting the first opened menu to File, keeping each File drawer on the shared sticky Exit footer geometry.',
    '2026-07-19 00:08 EDT - Portrait File menus now share the same full-width sticky Exit footer geometry across canvas and DOM editors, including SFX, Cutscene, Race, Car, Doodad, and Actor.',
    '2026-07-18 21:38 EDT - Portrait editor rails now use Pixel-style icon labels consistently across Race, Car, and Doodad, and shared editor File exits now use the compact big Exit label instead of Exit to Main Menu.',
    '2026-07-18 04:37 EDT - Shared mobile File drawer sticky exits now use the compact Exit label that Pixel landscape established, while desktop File dropdowns keep the full Exit to Main Menu footer label.',
    '2026-07-18 04:32 EDT - Doodad Editor portrait File sheet now uses the same shared getDoodadFileMenuItems source as landscape and desktop, keeping Export and Import available consistently.',
    '2026-07-18 04:30 EDT - Doodad Editor menu rows now rely on shared editor spec action labels, with broad coverage requiring every shared editor command declared in the spec to provide a non-empty label.',
    '2026-07-18 04:27 EDT - Doodad Editor buttons now draw with the shared RTG Studio menu button chrome and label helpers instead of hand-rolled fill, stroke, and text styling.',
    '2026-07-18 04:24 EDT - Doodad Editor File drawers now use buildSharedEditorFileMenu for the standard New, Save, Save As, Open, Export, Import, and Exit command order.',
    '2026-07-18 04:21 EDT - Broad gamepad resolver coverage now rejects ignored mode/rootOpen/submenuOpen/focusedItemId inputs and requires viewport, mobile, connection, and active menu state across shared editors.',
    '2026-07-18 04:20 EDT - Doodad Editor gamepad landscape now passes viewport, mobile, and active menu inputs into the shared gamepad resolver so it actually enters the shared slide-out path.',
    '2026-07-18 04:17 EDT - Doodad Editor tests now exercise the real gamepad landscape draw path for focused root and submenu rows so the shared focus-ring behavior is covered at runtime.',
    '2026-07-18 04:16 EDT - Doodad Editor gamepad slide-out root and submenu rows now honor the shared planned focus state and draw the shared focus ring while keeping touch landscape rows unchanged.',
    '2026-07-18 04:13 EDT - Doodad Editor gamepad landscape now draws the shared RTG Studio gamepad hint bar with the shared editor prompt labels, matching the Pixel-style gamepad chrome.',
    '2026-07-18 04:11 EDT - Doodad Editor portrait menu roots now come from the shared editor spec, replacing the local art id with the shared artwork root while keeping the artwork hot-panel behavior.',
    '2026-07-18 04:08 EDT - Broad desktop dropdown coverage now includes Doodad Editor for live command actions, drag-safe scroll regions, mobile close clearing, click-away closure, and active-panel-open prevention.',
    '2026-07-18 04:05 EDT - Doodad Editor desktop dropdown commands now use the shared pending-hit release activation flow and close through resolveClosedDesktopDropdownState after activation.',
    '2026-07-18 04:02 EDT - Doodad Editor desktop dropdown wheel scrolling now uses the shared applyDesktopDropdownWheelScrollState path and open-root keyed dropdownScroll like the other canvas editors.',
    '2026-07-18 04:00 EDT - Doodad Editor desktop dropdowns now render through drawSharedDesktopDropdown directly, replacing the remaining local dropdown panel/row drawing while keeping shared command hit metadata.',
    '2026-07-18 03:57 EDT - Broad desktop chrome coverage now includes Doodad Editor for the shared top menu, ribbon, context panel, and dropdown drawer contracts.',
    '2026-07-18 03:56 EDT - Broad desktop hover-switch coverage now includes Doodad Editor so its top menu drawers stay on the same shared resolveDesktopDropdownHoverSwitch path as the other canvas editors.',
    '2026-07-18 03:54 EDT - Broad landscape menu coverage now requires every shared editor to opt into the Pixel-style capped right submenu and verifies the shared shell caps submenu height to the compact left rail.',
    '2026-07-18 03:52 EDT - MIDI Editor landscape touch now opts into the shared Pixel-style capped right utility drawer while keeping its grid/song bottom rail, right-drawer tab gating, and gamepad slide-out behavior unchanged.',
    '2026-07-18 03:51 EDT - Cutscene Editor landscape touch now opts into the shared Pixel-style capped right submenu while preserving its left root drawer, bottom rail, stage, and timeline layout.',
    '2026-07-18 03:49 EDT - SFX Editor landscape touch now opts into the shared Pixel-style capped right submenu so the waveform keeps more usable vertical space while the bottom transport rail and gamepad slide-out behavior stay unchanged.',
    '2026-07-18 03:47 EDT - Doodad Editor desktop top menus now use the shared hover-switch helper so open dropdown drawers can move between roots like the Pixel, Level, SFX, Cutscene, Actor, MIDI, and Race editors.',
    '2026-07-18 03:43 EDT - Doodad Editor desktop dropdowns now use the shared open/closed root state so click-away closure stays closed across redraws and root clicks follow the shared top-menu behavior.',
    '2026-07-18 03:42 EDT - Race and Car desktop left inspectors now use the shared desktop context/action split so workflow quick controls stay in a defined lower inspector region beneath the persistent context summary.',
    '2026-07-18 03:39 EDT - Actor Editor landscape touch now opts into the shared Pixel-style capped right submenu while preserving its scrollable submenu content and bottom rail controls.',
    '2026-07-18 03:38 EDT - Race, Car, and Doodad landscape touch now opt into the shared Pixel-style capped right submenu while keeping their bottom rail controls and portrait flows unchanged.',
    '2026-07-18 03:35 EDT - Doodad Editor desktop left inspector now uses the shared desktop ribbon and context panel chrome while preserving its direct artwork, size, hitbox, and collision controls.',
    '2026-07-18 03:28 EDT - Level Editor landscape now opts into the shared Pixel-style right submenu cap and uses the shared zoom surface so zoom moves below the right drawer while the bottom rail remains available for tools.',
    '2026-07-18 03:24 EDT - Shared landscape touch editor layout can now cap Pixel-style right submenus to the compact left rail and place zoom below them, keeping Pixel landscape behavior in the shared shell without changing portrait flows.',
    '2026-07-17 01:29 EDT - Pixel Editor desktop left color dock now stacks the Palette button below the brush settings chip instead of placing them side by side.',
    '2026-07-17 01:25 EDT - Pixel Editor desktop Frames keeps the header add/delete controls, removes the lower thumbnail reorder arrows, and keeps the Palette button after the brush settings chip in the left color dock.',
    '2026-07-17 01:18 EDT - Pixel Editor desktop left palette now uses a 3x3 eraser-first swatch grid, desktop Draw/Select tools return to two columns, and layer rows now keep visibility and opacity inline.',
    '2026-07-17 01:05 EDT - Pixel Editor desktop now removes the duplicate bottom palette rail, keeps brush sizing out of the left panel, and reserves a full-width bottom frame strip so side panels stop above the animation controls.',
    '2026-07-17 00:46 EDT - Pixel Editor desktop now removes Draw and Select from the top menu, groups Select and Draw tools into two-column left-panel sections, and pins recent swatches, brush, and Palette controls at the bottom of the desktop left panel.',
    '2026-07-17 00:30 EDT - Pixel Editor desktop tool grid now uses the existing compact tool label map instead of an undefined label constant, restoring desktop render startup.',
    '2026-07-17 00:15 EDT - Pixel Editor landscape root menu now shortens the main-menu exit label to Exit while preserving return-to-editor labels.',
    '2026-07-17 00:13 EDT - Pixel Editor portrait and landscape popup menus, sheets, and modals now use opaque Pixel panel fills instead of translucent menu surfaces.',
    '2026-07-16 23:45 EDT - Pixel Editor landscape Pose now keeps a More button directly under the timeline so the full pose actions remain reachable after moving Set/Delete Key out of the rail.',
    '2026-07-16 23:42 EDT - Pixel Editor landscape Pose now starts its right rail with the pose timeline and timeline zoom instead of Set/Delete Key buttons, portrait Pose removes duplicate Copy/Paste buttons, and landscape Tools shows Frames directly below Bake.',
    '2026-07-16 23:25 EDT - Pixel Editor color adjustment rails now keep Apply and Reset side by side, landscape Rigging mode now shows Build Add/Remove/More, Rig Assign/Unassign/More, and Tools Bake/More summaries, and portrait Pose actions follow the requested key/reset/clipboard/target order.',
    '2026-07-16 22:55 EDT - Pixel Editor landscape Rigging right rail now focuses on Assign, Remove, and More, with More opening the full bind menu, and the portrait Rigging bind sheet is taller so Clear fits.',
    '2026-07-16 22:52 EDT - Pixel Editor rigging bind mode now ignores stale canvas-sized UI hit boxes before routing canvas taps, so portrait and landscape rig pixel selections start normally while real rigging controls still capture touches.',
    '2026-07-16 22:49 EDT - Pixel Editor landscape Layers now opens Manage and Order as centered action modals while keeping the layer list on the right rail, and the landscape Frames rail now matches portrait with a Play button instead of Order.',
    '2026-07-16 22:42 EDT - Pixel Editor landscape Canvas menu now keeps View, Background, and Transform on the right rail, moves the selected group options into the bottom rail, and removes redundant Export and Back actions from that landscape flow.',
    '2026-07-16 22:40 EDT - Pixel Editor color adjustments are split into separate Hue, Saturation, Brightness, and Contrast tools, each with a single left-side gradient slider and right-side Apply/Reset controls in portrait and landscape rails.',
    '2026-07-16 22:27 EDT - Pixel Editor landscape File menu now keeps New, Save, Save As, and Open on the right rail, moves Import and Export into the bottom rail, and puts Exit to Main Menu at the end of the left root drawer.',
    '2026-07-16 22:20 EDT - Pixel Editor landscape bottom rail now shows contextual Canvas, Layers, Frames, and Rigging groups instead of swatches on those screens, while the zoom slider remains in the lower-right landscape slot and portrait behavior stays unchanged.',
    '2026-07-16 22:08 EDT - Pixel Editor landscape zoom slider is restored below the right submenu, with the right submenu capped to the left menu rail height and the bottom rail returned to palette-only controls.',
    '2026-07-16 21:54 EDT - Pixel Editor landscape Draw, Select, and Tools submenus now share the active item, More, and Tool Options layout, with the lower-right zoom slider restored for those tool menus.',
    '2026-07-16 21:48 EDT - Pixel Editor landscape Draw submenu now starts with the active tool, More, and Tool Options buttons; More opens the right-side tool picker and Tool Options opens the active tool controls without changing portrait or desktop flows.',
    '2026-07-16 20:57 EDT - Pixel Editor landscape bottom rail now returns to the portrait-like swatch and palette workflow instead of replacing it with active tool buttons.',
    '2026-07-16 20:26 EDT - Pixel Editor landscape now keeps the right submenu open persistently, collapses the left root drawer back to that submenu, removes the old tool-list brush settings block, and uses the bottom rail for active tool controls.',
    '2026-07-16 20:08 EDT - Pixel Editor landscape canvas taps now keep the right submenu open, so drawing on the canvas no longer dismisses the active Draw/Select menu.',
    '2026-07-16 19:59 EDT - Pixel Editor landscape right-menu actions such as Draw > Line now close only the left root drawer and keep the Draw submenu open for continued tool work.',
    '2026-07-16 19:48 EDT - Pixel Editor desktop left context panel now opens with useful draw/select tools and active tool controls first, leaving document/status details as a compact footer so desktop controls do not collide.',
    '2026-07-16 19:34 EDT - Pixel Editor landscape now uses the same eight root menu buttons as portrait and closes the landscape drawer after right-submenu commands run.',
    '2026-07-16 19:15 EDT - Landscape touch editors now keep virtual thumbsticks south of the compact left menu rail by using the shared shell thumbstick slot in Pixel, Tile Picker, Race/Car, and Doodad instead of placing the stick inside the work surface.',
    '2026-07-16 18:24 EDT - Tile Editor desktop File drawer rows now route to existing tile reset, autosave, Save As/Open, export, import, and Exit handlers instead of rendering as disabled placeholders.',
    '2026-07-16 18:23 EDT - Race and Car Editor desktop left panels now expose direct Route Tools and Car Tools controls while keeping random race generation in the File dropdown.',
    '2026-07-16 18:22 EDT - MIDI, SFX, and Cutscene desktop root menus no longer expose empty Settings drawers; their portrait Settings panels remain dynamic, and Cutscene controller System Tools now opens Stage settings instead.',
    '2026-07-16 18:21 EDT - SFX Editor desktop Import commands now route through a guarded import picker helper so File and direct desktop Import rows remain safe even if the hidden file input is unavailable.',
    '2026-07-16 18:20 EDT - Cutscene Editor desktop dropdown coverage now audits every visible menu id against the shared button router so File, Edit, View, Add, Timeline, Clips, Keyframes, Audio, and Stage rows stay live.',
    '2026-07-16 18:19 EDT - Pixel Editor landscape touch now keeps the left root drawer and right submenu inside one live drawer hit area and renders the shared lower-left thumbstick from the landscape work surface instead of clearing it.',
    '2026-07-16 18:16 EDT - Actor Editor desktop File menu now keeps Export and Import live by routing them through Save As and Open instead of disabling shared File rows.',
    '2026-07-16 18:16 EDT - MIDI Editor File menu extras now carry direct handlers for rescue save, MIDI/WAV exports, Save and Paint, RobterSession playback, theme generation, sample loading, and Exit so shared desktop and drawer surfaces use the same live actions.',
    '2026-07-16 18:08 EDT - Doodad Editor desktop File menu now wires Export to Save As and Import to Open so every shared desktop File row has a live action.',
    '2026-07-16 18:07 EDT - Race and Car Editor desktop menus now enable live File export/import, Edit undo/redo plus segment copy/paste/delete, and Race view toggles instead of leaving advertised rows inert.',
    '2026-07-16 18:00 EDT - Cutscene Editor desktop left panel now keeps Stage Settings controls for snap, timeline fit, and grid size visible while leaving Add commands in the top dropdown drawer.',
    '2026-07-16 17:58 EDT - SFX Editor desktop left panel now keeps generator waveform, duration, and frequency controls visible as direct settings while preserving top dropdowns for command actions.',
    '2026-07-16 17:56 EDT - Race Editor mobile playtest controls now render and register hit boxes from the same MobileControls handheld gamepad layout used by level playtest, keeping portrait and landscape simulated gamepad screen/button geometry in lockstep.',
    '2026-07-16 17:56 EDT - MIDI Editor desktop left panel now includes direct tempo stepper controls beside the existing note length and loop bar tools, keeping common song timing settings visible without opening a top drawer.',
    '2026-07-16 17:49 EDT - Doodad Editor desktop mode now uses the shared editor top-menu/dropdown shell, keeps artwork/size/hitbox/collision settings in the persistent left panel, and exposes File/Edit/View/Artwork/Size/Hitbox/Collision/Preview commands through shared desktop menu metadata.',
    '2026-07-16 17:42 EDT - Race, Car, and Doodad Editor landscape touch now render the shared lower-left virtual thumbstick and route it through existing pan/preview controls while keeping the north Menu/Undo/Redo/context rail and menu drawer behavior intact.',
    '2026-07-16 15:36 EDT - Added Playwright coverage for Pixel Editor desktop direct controls, landscape contextual rail behavior, and gamepad Context root activation so CI can validate the new editor UI contract surfaces.',
    '2026-07-16 15:33 EDT - Pixel Editor gamepad root slide-out now includes a runtime Context action row that mirrors the landscape contextual command and returns controller focus to the canvas after activation.',
    '2026-07-16 15:31 EDT - Pixel Editor landscape command rail now uses a contextual fourth action for selection clear, clone source picking, animation/bone playback, or brush settings while preserving the shared Menu/Undo/Redo rail.',
    '2026-07-16 15:29 EDT - Pixel Editor desktop context panel now exposes direct active-tool options for shape fill, fill tolerance, magic threshold, dither, gradient, scope, and clone setup so desktop editing needs fewer menu trips.',
    '2026-07-16 15:26 EDT - Pixel Editor desktop left context panel now includes a direct compact tool grid backed by the shared tool registry, making tool switching feel like a graphics editor while leaving portrait rails unchanged.',
    '2026-07-16 15:22 EDT - Pixel Editor desktop frame strip now has direct left/right frame reorder controls on each thumbnail, making animation sequencing editable in the desktop workspace while preserving portrait frame workflows.',
    '2026-07-16 15:19 EDT - Pixel Editor desktop Layers rail now has direct per-layer visibility and lock controls on each row, making common graphics-editor layer changes available without opening a menu while preserving portrait layer workflows.',
    '2026-07-16 15:16 EDT - Pixel Editor desktop palette strip now clips palette preset rows inside the bottom artist palette area and supports wheel/drag scrolling there, preventing long preset lists from spilling over the workspace while leaving mobile portrait unchanged.',
    '2026-07-16 15:11 EDT - Pixel Editor desktop canvas now draws artboard rulers plus a size/zoom chip around the work surface, improving transparent-pixel and coordinate readability without changing portrait, landscape, or gamepad chrome.',
    '2026-07-16 15:08 EDT - Pixel Editor landscape animation mode now keeps frame transport beside the palette and zoom rail on wide landscape surfaces, improving mobile landscape/gamepad animation editing without changing portrait.',
    '2026-07-16 15:06 EDT - Pixel Editor desktop frame strip now includes a loop toggle and quick active-frame delay slider, keeping common animation timing edits in the desktop workspace instead of forcing a menu prompt.',
    '2026-07-16 15:04 EDT - Pixel Editor desktop Layers rail now includes an active-layer opacity slider, giving desktop art editing a direct layer property control without changing portrait layer workflows.',
    '2026-07-16 15:02 EDT - Pixel Editor desktop left inspector now exposes contextual brush size, opacity, and hardness sliders for brush-based tools, making desktop drawing adjustments feel more like a graphics editor while leaving portrait workflows unchanged.',
    '2026-07-16 14:58 EDT - Pixel Editor desktop and controller polish now keeps full-window canvas sizing, persistent desktop palette context, landscape palette rails, gamepad root menus, and mobile zoom/thumbstick fallbacks aligned across real editor instances and focused unit tests.',
    '2026-07-16 14:51 EDT - Pixel Editor desktop palette strip now shows brush preview, active color registers, palette name, and brush size/shape beside the scrollable swatches so the desktop workspace reads more like a graphics tool.',
    '2026-07-16 14:50 EDT - Pixel Editor gamepad slide-out menus now render the real root menu when no submenu is active, keeping focused root rows visible instead of showing an empty controller panel.',
    '2026-07-16 14:48 EDT - Pixel Editor landscape now keeps the bottom rail as persistent palette and zoom controls even when Layers or Frames are active, leaving management commands in the right drawer so touch landscape stays artist-focused.',
    '2026-07-16 14:42 EDT - Pixel Editor desktop now keeps an always-visible palette strip under the canvas workspace and enriches the left inspector with active color and zoom context, making desktop behave more like an artist tool while preserving portrait rails.',
    '2026-07-16 14:27 EDT - Desktop canvas layout now fills the browser viewport directly instead of keeping a fixed-size centered canvas, giving all desktop editors full-window workspace.',
    '2026-07-16 11:59 EDT - Doodad Editor preview hitboxes now render through RaceEditor as actual 3D/WebGL world-space collision cylinders centered on the doodad base instead of screen overlays.',
    '2026-07-16 11:42 EDT - Doodad Editor Studio Sprint hitbox overlays now use the actual embedded playtest doodad placements and RaceEditor camera projection, with preview trees placed closer to the road so all samples remain visible.',
    '2026-07-16 11:30 EDT - Doodad Editor now separates hitbox sizing into its own portrait hot-menu tab, keeps collision behavior controls uncluttered, and aligns red hitbox previews with planted doodad art offsets.',
    '2026-07-16 11:06 EDT - Doodad Editor now saves a Plant offset slider for sinking transparent-bottom artwork into the terrain, and Race Editor applies that offset consistently in 3D/WebGL/fallback rendering while collision uses hitbox width.',
    '2026-07-16 10:55 EDT - Race doodad mesh UVs now map artwork upright, and doodad WebGL clipping now renders any polygon portion that remains in front instead of culling by center depth.',
    '2026-07-16 10:43 EDT - Race doodad close-range rendering now keeps billboard meshes visible until their placed center passes the camera, and Doodad Editor collision controls now expose hitbox width/height with red collision previews.',
    '2026-07-16 01:30 EDT - Race doodad 3D geometry now samples terrain under both bottom corners and uses custom Three/WebGL quads with clamped non-mipmapped art textures, reducing floating on slopes and improving distant tree readability.',
    '2026-07-16 01:20 EDT - Race doodad WebGL/fallback world geometry now converts doodad height from meters into race elevation units, keeping vertical planes rooted to the terrain instead of floating far above the track.',
    '2026-07-16 01:10 EDT - Race doodads now enter the depth-tested 3D world as textured vertical planes in both Three terrain and WebGL-track rendering, with the old 2D overlay skipped when the 3D renderer owns doodad geometry.',
    '2026-07-16 01:00 EDT - Race doodads now store fixed world orientation/projection metadata when painted and render with their own yaw as 3D vertical rectangles instead of rotating to face the playtest camera.',
    '2026-07-16 00:50 EDT - Race Editor doodads now render as world-projected 2D billboards by projecting their fixed ground anchor, side anchors, and top anchor before drawing, preventing playtest camera rotation from making placed doodads drift like screen overlays.',
    '2026-07-16 00:40 EDT - Race Editor doodad billboards now draw from their actual projected ground point instead of a clamped viewport Y position, so painted doodads stay visually rooted to their fixed world location.',
    '2026-07-16 00:30 EDT - Race Editor Ground Doodad painting now bypasses the old sprite-definition requirement, keeps Ground mode active after placement, and forces doodad painting to a single 1x1 brush.',
    '2026-07-16 00:20 EDT - Doodad Editor Studio Sprint preview now uses the in-memory doodad draft for temporary preview billboards, so width and height slider edits resize the in-game preview immediately before saving.',
    '2026-07-16 00:10 EDT - Doodad Editor Studio Sprint preview now renders through the embedded Race playtest path with temporary doodad scenery, and Race Editor Ground Doodad mode makes the second hot button open the Doodads picker directly.',
    '2026-07-16 00:00 EDT - Doodad Editor portrait now requests the real Studio Sprint preview road before drawing billboard samples, Save As uses the Project Browser Doodads flow with confirmed persistence, and the Menu Art root acts as a direct jump to the Artwork hot tab instead of opening an empty submenu.',
    '2026-07-15 10:14 EDT - Added first-class Race Doodads: a new Game-folder Doodad Editor saves reusable billboard collision objects, project/server storage now includes doodads, Race Editor Ground mode can pick and paint saved doodads, and legacy race scenery definitions auto-migrate to doodad files.',
    '2026-07-15 01:47 EDT - Car files are now registered as a first-class server-storage folder so Car Editor saves can persist to the dev server, and Race Editor Play opens the Project Browser filtered to saved Cars before starting a playtest.',
    '2026-07-15 01:33 EDT - Car Editor portrait Menu now keeps the File/Art/Drive/Tune root rail open when Art has no submenu actions, resetting stale Body/Tires/Shadow roots back to Art without drawing the large blank submenu box.',
    '2026-07-15 01:25 EDT - Car Editor playtest now keeps the currently edited in-memory car instead of rehydrating stale saved car data, Race Editor pre-race car selection lists saved car files instead of hardcoded car buttons, and stale empty portrait Art menu roots close instead of drawing a blank panel after preview loops.',
    '2026-07-15 00:22 EDT - Car Editor embedded Studio Sprint preview loops now preserve the active art/menu UI instead of closing into an empty art menu, Body art overrides keep the default ground shadow, and custom Shadow art replaces that shadow while staying anchored to the ground.',
    '2026-07-14 23:42 EDT - Pixel Studio flattened art export now preserves per-pixel alpha with 8-digit hex instead of turning faint transparent pixels opaque, and Race Editor art sprite caches now refresh when a same-named art file such as rtg-001 is re-saved.',
    '2026-07-14 23:00 EDT - Pixel Studio crop now treats an active selection as the only retained canvas content, discarding selected-out pixels during crop, and art document serialization clamps layer data to the current canvas bounds so stale off-canvas pixels cannot be saved.',
    '2026-07-14 22:04 EDT - Pixel Studio Crop now defaults to the active selection or visible opaque artwork bounds and supports independent left/top/right/bottom trims, which fixes cases where saved art such as rtg-001 retained hidden bottom pixels after an attempted crop.',
    '2026-07-14 21:31 EDT - Authored race car body art now uses the billboard shadow layer instead of the procedural Three ground shadow, so the Car Editor Shadow tab and reset state control the visible shadow under graphics such as rtg-001.',
    '2026-07-14 21:23 EDT - Race playtest car damage HUD is taller with a longer vehicle diagram, a thinner/longer transmission shape, and a more engine-like damage block while keeping the compact no-label lower-left status panel.',
    '2026-07-14 21:21 EDT - Race Editor File menu no longer exposes hardcoded built-in track load buttons; generated race creation and normal Open file loading remain available, while built-in track loaders stay internal for regressions.',
    '2026-07-14 21:07 EDT - Project Browser art picking now avoids synchronous first-load behavior and throttles art preview hydration through a two-at-a-time queue, reducing stalls when selecting large car body/tire art such as rtg-001 and tire graphics.',
    '2026-07-14 18:40 EDT - Focused the authored tire-art slowdown path: tire tread scrolling now caches quantized wheel-sized scroll frames so all four wheels reuse prepared tire canvases instead of reslicing the source every draw, the Car Editor Art panel now has a Reset button for clearing Body, Tires, Brakes, or Shadow overrides independently, and the dev-server large-art response cache is guarded for concurrent storage requests.',
    '2026-07-14 18:25 EDT - Dev server storage now caches decoded `/__storage/file` responses by document timestamp/size, reducing repeat stalls when large authored car art such as rtg-001 and tire graphics are reloaded during Car Editor and Race Editor testing.',
    '2026-07-14 18:25 EDT - Fixed another authored car-art slowdown source: the Three playtest car now reuses its dynamic body/wheel/light/shadow meshes across frames and only updates transforms/materials, instead of disposing and rebuilding the procedural car group during Race Editor playtest and the embedded Car Editor Studio Sprint preview.',
    '2026-07-14 18:10 EDT - Race playtest prewarm now binds WebGL mesh textures only for terrain/render texture art, while keeping authored car body/tire/shadow/brake/add-on art as sprite-only preload; diagnostics now report sprite refs, mesh texture refs, and skipped car-only texture refs.',
    '2026-07-14 17:25 EDT - Tightened authored car-art performance: race playtest now preloads tireTreads, brake, shadow, add-on, spoiler, and shell-frame art; car-only art no longer builds terrain texture samplers; projected car sprites draw body/add-ons from scaled cached layers; and the billboard layer cache now evicts oldest entries instead of clearing everything.',
    '2026-07-14 17:11 EDT - Fixed the WRX authored tire/body slowdown path: large tire override art is now scaled into wheel-sized cached canvases before tread scrolling in both the shared billboard renderer and projected car sprites, with a regression covering oversized tire art.',
    '2026-07-14 16:52 EDT - Added a Car Editor performance regression for overridden body/tire/shadow/brake graphics: 120 UI preview frames must reuse the cached Studio Sprint playtest frame and perform no more than 35 expensive embedded race renders.',
    '2026-07-14 16:44 EDT - Authored car tire art now uses per-wheel suspension travel for visible Y bounce while keeping default X slots, and the billboard overlay no longer draws the extra round oval shadow when the real Three car shadow is already rendered.',
    '2026-07-14 16:15 EDT - Car Editor Studio Sprint preview now renders through a capped offscreen frame cache and reuses that frame between refreshes, cutting the expensive embedded race playtest draw from every UI frame while invalidating immediately on car art and scale/offset edits.',
    '2026-07-14 15:59 EDT - Car Editor embedded Studio Sprint preview resets now clear transient menu/pending-hit state and briefly guard Art picker buttons, preventing the project art menu from opening when the AI preview reaches the finish and restarts.',
    '2026-07-14 15:52 EDT - Authored tire artwork now keeps the default billboard X slots while receiving constrained per-wheel Y travel from the physical wheel projection, so replaced tires still bounce with suspension without spreading apart or dropping too low.',
    '2026-07-14 15:44 EDT - Car tire artwork overrides now use the same local billboard tire slots as the default visual tires instead of projected 3D wheel deltas, so overriding tread art no longer spreads the tires farther apart or pushes them lower on the car.',
    '2026-07-14 15:36 EDT - Race playtest tire overrides now hide the default Three procedural wheel boxes while keeping the authored tire art locked to the exact projected physical wheel centers, eliminating the duplicate eight-tire render.',
    '2026-07-14 14:56 EDT - Car Editor and Race playtest tire artwork now skins the existing physical wheel anchors: explicit wheel deltas no longer receive an extra steering translation, preview anchors no longer pre-subtract steering, and the Three procedural wheel rig remains active when tire art is overridden.',
    '2026-07-14 15:07 EDT - Car Editor tire art now anchors to the exact projected wheel centers instead of compressing tire positions, Body X and Body Y scaling are independent, Tires uses Hidden/Front/Rear/Visible visibility modes, and dynamic empty Art root selections close menu state instead of leaving blank menus after preview resets.',
    '2026-07-14 14:47 EDT - Car Editor Visual Components now uses top-row Visible/Art controls, full-width sliders, and a bottom Body/Tires/Brakes/Shadow hot menu; body/tire/brake/shadow scaling can reach 12x, offsets reach +/-4, and body-art vertical rendering no longer clamps height near the default car size.',
    '2026-07-14 14:28 EDT - Car Editor Visual Components preview is shorter to leave room for controls, Body/Tires/Brakes/Shadow tabs now include direct Art buttons with wider scale/offset ranges, and embedded preview restarts preserve menu/dropdown state so empty menus do not appear.',
    '2026-07-14 14:05 EDT - Car Body art no longer hides or replaces default in-game tires: Three playtest now keeps procedural wheel meshes when only Body is overridden, and Car Editor Visual Components now uses Body, Tires, Brakes, and Shadow tabs with per-component visibility plus scale/offset controls.',
    '2026-07-14 13:44 EDT - Race playtest car rendering now treats Body and Treads overrides independently: Body-only artwork keeps the default procedural wheels, while authored Treads intentionally switch the wheel visuals to billboard art.',
    '2026-07-14 13:25 EDT - Car Editor Studio Sprint preview now caches the saved Studio Sprint document by storage timestamp instead of serializing the whole race every frame, loads authored terrain/texture data into the embedded playtest, and uses stronger route-following steering/braking for the preview driver.',
    '2026-07-14 13:05 EDT - Car Editor preview now creates an embedded Studio Sprint playtest session with the selected car, advances it with throttle and steering assist, renders through the actual Race Editor playtest screen, and restarts the preview when it reaches the route end.',
    '2026-07-14 12:43 EDT - Car Editor now shows an explicit save status in its work panel and its car-art review background samples the Studio Sprint route instead of the old straight-highway mock so preview driving starts in a visible bend.',
    '2026-07-14 12:31 EDT - Car Editor save status now reports Saving... immediately and only changes to Saved after the server persistence promise confirms, with failed server syncs shown as save failures instead of false success.',
    '2026-07-14 12:20 EDT - Car Editor Art now includes a Shadow art slot; Race Editor and Car Editor shared billboard rendering draws custom or default shadows behind all car artwork, keeps brake-light override support, and authored tire sprites no longer rotate visually when steering.',
    '2026-07-14 03:46 EDT - Authored car billboard rendering now caches body, tire, brake-light, and add-on layers at their actual draw sizes, avoiding per-frame resampling of large project-art canvases while keeping the Car Editor preview and Race Editor playtest on the same shared layer renderer.',
    '2026-07-14 03:29 EDT - Race playtest authored-car tires now keep the same visual width as the Car Editor preview by using deterministic X anchors and only taking vertical wheel bounce from physics; Car Editor saves now report confirmed server persistence and use a longer server-save timeout for car documents.',
    '2026-07-14 03:12 EDT - Car Editor Art now includes Brake Lights project art plus brake-light scale/position sliders; authored tire sprites no longer visually rotate when steering and instead translate left/right while the underlying tire physics remain unchanged.',
    '2026-07-14 02:57 EDT - Car Editor preview now renders authored car graphics through the same shared race billboard layer helper used by Race Editor third-person playtest, so body, tread scrolling, layer visibility, tire offsets, brake lights, and body/tire scaling match the in-game authored-car overlay.',
    '2026-07-14 02:42 EDT - Authored Car Editor body art now renders as an upright race billboard without procedural body underneath; body scale no longer moves tire anchors, front/rear tire and body offsets are persisted as visual-only controls, tire tread art scrolls in preview/playtest, and the Car Editor preview now simulates driving, steering, bumps, and jumps.',
    '2026-07-14 02:23 EDT - Car Editor graphics controls now include Body, Front, and Rear visibility toggles plus persisted Body/Tire X/Y scale values; authored Body art replaces the procedural body instead of drawing over it, and authored tire tread art scrolls while driving in Race Editor playtest.',
    '2026-07-14 02:05 EDT - Car Editor saved car files now hydrate matching built-in race cars before playtest so authored WRX/BRZ/Civic Body and Treads art appears in Race Editor; Save replaces the active in-memory car with the serialized document, the Car Editor preview now uses a behind-the-car straight-track view, and Body/Tire X/Y sliders tune the in-game billboard scale.',
    '2026-07-14 01:26 EDT - Car Editor Art now exposes Body, Treads, and Add-ons instead of shell-frame controls; Body art writes the canonical car body graphic used in Race Editor playtest, authored treads render with body art, and Car File no longer shows hardcoded Load WRX/BRZ/Civic buttons.',
    '2026-07-13 21:29 EDT - Daytona automatic WRX playtest now uses signed bank physics instead of absolute bank assist, holds the SPT simulated ratios under full throttle instead of short-shifting into the tall 8th step at 150 mph, and adds an automatic WRX steered-lap regression requiring 160 mph before completing Daytona.',
    '2026-07-13 12:19 EDT - Daytona banked-corner physics now feeds banking support into lateral tire load, scrub, and over-limit breakaway so a manual WRX can reach 160 mph on a steered Daytona lap without suspension damage while hard over-driving the bank moves toward tire breakaway instead of artificial speed bleed.',
    '2026-07-13 11:17 EDT - WRX Daytona speed verification now uses cumulative lap distance instead of wrapped circuit progress; WRX 6MT and SPT automatic gear data is tightened to real/simulated ratios, and the WRX high-speed drag calibration lets both manual and automatic reach 160 mph before completing the first Daytona lap in focused probes.',
    '2026-07-13 02:04 EDT - Daytona Tri-Oval road width is now a four-lane 14.4m racing surface instead of the old 24m width, reducing cross-bank elevation swings while preserving the WRX 160 mph-before-one-lap target and zero suspension damage in focused playtest probes.',
    '2026-07-13 00:18 EDT - Added built-in car spec regressions for horsepower, torque, drivetrain, manual/automatic gear counts, and calibrated performance target bands; direct playtest probes now show WRX, BRZ, and Civic Type R acceleration and quarter-mile behavior inside their configured targets.',
    '2026-07-13 00:13 EDT - Audited the three built-in race cars against current reference specs and playtest probes: WRX, BRZ, and Civic Type R now have calibrated acceleration settings that keep straight-line 0-60 and quarter-mile behavior inside target bands while preserving the WRX Daytona 160 mph-before-one-lap requirement.',
    '2026-07-12 22:52 EDT - WRX Daytona calibration now reaches roughly 160 mph on an ideal Daytona line with zero suspension damage in the focused runtime probe; 3D vehicle suspension fallback damping is firmer and Daytona banking transitions blend more gradually to reduce bouncing.',
    '2026-07-12 22:04 EDT - Daytona no longer loads legacy route-relative scenery as a tree at world origin; WRX high-speed tuning now targets the requested 161 mph Daytona calibration with a lower high-speed drag clamp, bank-entry smoothing is more gradual, and legacy suspension bottom-out damage is suppressed while the 3D wheel-contact vehicle model is active.',
    '2026-07-12 18:53 EDT - Daytona procedural car body roll now uses the corrected physical vehicle roll sign instead of the stale visual inversion, so the car body and tires both lean toward the high side of the bank.',
    '2026-07-12 18:48 EDT - Fixed race vehicle wheel handedness so physics wheel labels match canonical track lateral direction; Daytona left wheels now sit on the high bank side and fresh vehicle contact points initialize at each actual wheel instead of the car center.',
    '2026-07-12 18:25 EDT - Daytona procedural tire meshes now apply a separate local-axis roll correction so the wheels visually bank with the road while the underlying player and AI physics roll/contact signs remain unchanged.',
    '2026-07-12 17:39 EDT - Race procedural car wheels now bank with the car body on Daytona, and AI racers now maintain a deterministic 3D vehicle state with wheel contacts, suspension, pitch, roll, banking, and surface friction sampled from the same canonical race surface as the player.',
    '2026-07-12 17:23 EDT - Daytona banking transitions now ease across segment boundaries instead of snapping, the Three.js procedural car roll is corrected to match the road bank visually, and AI racers now sample canonical wheel-contact banking/friction before choosing pace.',
    '2026-07-12 17:06 EDT - Daytona banking now raises the outside edge instead of the inside edge, and corridor-first terrain seams now use the banked road/margin boundary height so banked terrain joins match the road without changing flat-road behavior.',
    '2026-07-12 15:51 EDT - Daytona Tri-Oval now has focused regression coverage for canonical road banking, efficient corridor terrain bake density, and WRX highway-speed acceleration; the race surface model now applies authored banking consistently to road mesh and wheel-contact samples.',
    '2026-07-12 15:30 EDT - Built-in race templates are now seeded as editable race project files for WeatherTech, Nurburgring, Col de Turini, Ouninpohja, and Daytona, and all generated/test tracks inherit Studio Sprint WebGL Track graphic settings by default.',
    '2026-07-12 15:23 EDT - Race playtest now draws custom skybox art farther below the horizon and keeps destination/open-track road sampling extended to draw distance past the finish so unlooped tracks no longer visually stop near the camera.',
    '2026-07-11 16:05 EDT - Race WebGL Track/Three playtest now aligns Three projection to the canonical horizon, keeps signed destination-route start/finish visual extensions in terrain clipping and world bake, widens cut/fill transitions by side slope, welds terrain seam points, caches static Three geometry between frames, and expands magenta coverage regressions for start/progress/finish runtime frames.',
    '2026-07-11 14:54 EDT - Race playtest terrain coverage now keeps a mandatory coarse base mesh separate from optional refinement, budgets terrain by triangles, reports base/refinement drop counters, lets Three render triangle terrain cells, clips large terrain pieces against local corridor samples, and solves road grades symmetrically so magenta coverage diagnostics target real holes instead of dropped base terrain.',
    '2026-07-11 12:24 EDT - Race surface generation has been split out of RaceEditor into focused racing modules for road-deck profiles, corridor baking, terrain clipping, mesh validation, material batching, and vehicle surface contact; Studio Sprint WebGL Track now reuses baked visible terrain and packed vertex buffers so the terrain+texture FPS regression stays above 45 FPS.',
    '2026-07-11 11:54 EDT - Race playtest now maintains a deterministic 3D-contact vehicle physics state under the existing billboard visuals: four canonical-surface wheel contacts drive suspension compression, contact loss, pitch/roll, body height, and camera/body anchoring while preserving current drivetrain, transmission, brake, tire slip, and control mappings.',
    '2026-07-11 11:24 EDT - Race authoring now has a canonical surface preview/debug path that reuses the playtest world bake revision, shows road/margin/shoulder/transition bands plus validation counters, and adds a browser regression for a synthetic ridge-crossing road.',
    '2026-07-11 10:57 EDT - Race material-band semantics are now shared across rendering, wheel physics, and tire FX: margin stays apron/road-deck, shoulder uses adjacent terrain material and friction, and transition starts exactly at the shoulder outer edge.',
    '2026-07-11 10:48 EDT - Race world terrain bake now splits raw terrain triangles against the canonical transition-outer corridor instead of dropping or keeping whole quads by center/corner heuristics, and retained terrain vertices snap to canonical seam points.',
    '2026-07-11 10:40 EDT - Race rendering and wheel-surface physics now share a canonical RaceSurfaceModel with a robust centerline deck profile, explicit surface-geometry revision key, raw terrain outside transitions, and regression coverage proving road/shoulder render and wheel-contact elevations agree.',
    '2026-07-11 08:38 EDT - Race WebGL Track now uses magenta as the default uncovered-background sentinel again, widens the Studio Sprint world terrain bake, raises the visible terrain budget, and adds route-sampled tests proving camera-visible terrain chunks are baked and not budget-dropped.',
    '2026-07-11 07:42 EDT - Superseded diagnostic-only attempt: baked terrain visibility started scanning every visible cell before applying the budget, but the magenta behavior was corrected at 08:38 to stay default-on.',
    '2026-07-11 01:06 EDT - Race magenta diagnostics now drive Studio Sprint forward and backward through dense route samples, checking the full rendered canvas for any visible magenta pixel and attaching only failing diagnostic frames.',
    '2026-07-11 00:56 EDT - Race WebGL Track now keeps baked terrain cell objects stable across frames so cached world vertices and UVs persist, the prewarm bake uses the same terrain sizing as the renderer, Studio Sprint has a shoulder-to-shoulder weave no-damage regression, and the terrain+texture FPS benchmark is back above 45 FPS.',
    '2026-07-11 00:46 EDT - Car Editor now opens on a real car work surface instead of the race road preview, saves schema-v2 car art with 8-way shell frames, reverse frames, tire tread slots, add-ons, tire size, default tire compounds, and physics-backed engine torque curves.',
    '2026-07-11 00:20 EDT - Race magenta diagnostics now use a real Playwright frame/pixel test: Studio Sprint frames render with the skybox visible, transparent WebGL/Three world compositing, and a magenta underlay that fails only when terrain or road holes are actually visible.',
    '2026-07-11 00:02 EDT - Superseded diagnostic step: Race playtest stopped painting the whole viewport magenta, but the empty-clear approach was replaced by the 00:20 frame/pixel coverage test.',
    '2026-07-10 23:51 EDT - Race playtest now uses magenta as the uncovered viewport sentinel, with Studio Sprint render coverage tests proving center, road-edge, and shoulder-edge driving frames cover it; shoulder-edge 30 MPH no-damage finish regressions now cover both sides.',
    '2026-07-10 23:30 EDT - Race roadside terrain now keeps a 0.5m road-height terrain join before easing back to the painted heightmap over roughly 4m, and Studio Sprint now has left-edge and right-edge 30 MPH no-damage finish regressions with only one wheel pair on the road.',
    '2026-07-10 23:08 EDT - Studio Sprint is now normalized as a hazardless road-validation race, hidden shoulders can still define collision while staying visually hidden, and regressions now verify centerline completion at 40 MPH, precise route projection, static baked terrain meshes, and the 45 FPS terrain+texture benchmark.',
    '2026-07-10 22:22 EDT - Race terrain seam blending now stays narrow when margin/shoulder are off or hidden so terrain joins flush to the road or visible margin instead of reading as a second terrain strip; Studio Sprint now has a centerline 30 MPH no-damage finish regression.',
    '2026-07-10 22:07 EDT - Race terrain seams now join to the outermost visible road layer: road when margin/shoulder are off or hidden, margin when only margin is visible, and shoulder when shoulder is visible; saving margin settings also invalidates cached road/terrain geometry.',
    '2026-07-10 21:48 EDT - Race WebGL Track now cuts terrain only under the hard road/margin/shoulder corridor, keeps the road-to-terrain transition on terrain material without green shoulder tint, and speeds the textured terrain mesh builder with typed-array batching so Studio Sprint still clears the 45 FPS terrain+texture benchmark.',
    '2026-07-10 21:25 EDT - Race margin/shoulder rendering now keeps drivable surface layers at the same geometry height, uses render order instead of vertical lifts for road/margin/shoulder visibility, and makes the road-to-terrain transition sample the actual terrain tile material instead of asphalt shoulder green.',
    '2026-07-10 20:59 EDT - Race WebGL Track playtest now precomputes a reusable world terrain bake before driving, carries margin and transition seam vertices through stable road sections, renders road/margin/shoulder/terrain-transition strips as contiguous shared-vertex bands, and keeps Studio Sprint covered by seam-gap plus 45 FPS regression tests.',
    '2026-07-10 20:40 EDT - Race WebGL Track road/terrain rendering now uses one composited track-corridor surface sampler: road, margin, shoulder, and transition strips share baked roadbed vertices, terrain cutouts are center-based so nearby terrain is not over-deleted, and Studio Sprint regressions verify seam sharing plus the 45 FPS terrain+texture benchmark.',
    '2026-07-10 20:00 EDT - Race WebGL Track now separates heightmap terrain from the baked road surface: generic terrain chunks stay raw, road/shoulder/transition geometry comes from a cached surface bake, and Studio Sprint regression coverage verifies the seam plus 45 FPS terrain+texture benchmark.',
    '2026-07-10 19:28 EDT - Race WebGL Track road/terrain ownership now cuts square terrain out of the road, shoulder, and roadside blend corridor, fills the seam with road-owned terrain strips that share exact shoulder vertices with the stable road bands, and uses cached corridor distance so the Studio Sprint terrain+texture benchmark still clears 45 FPS.',
    '2026-07-10 19:00 EDT - Race WebGL Track now builds road, shoulder, margin, marker, and paint geometry from stable route-distance sections instead of camera-adaptive projection bands, and each cross-section resolves one authoritative deck height above terrain before rendering.',
    '2026-07-10 18:09 EDT - Race WebGL Track terrain selection now gives visible off-road/default ground a fair priority against distant road-corridor chunks and raises the coarse terrain budget again, so far terrain should fill in instead of disappearing around the horizon.',
    '2026-07-10 15:18 EDT - Race WebGL Track terrain now renders default ground chunks even when painted terrain exists elsewhere, extends coarse terrain coverage farther toward the horizon, and raises the terrain-cell budget so nearby stitched road terrain no longer starves distant visible terrain.',
    '2026-07-10 15:01 EDT - Race terrain stitching now keeps road-corridor terrain quads instead of deleting them, stamps nearby terrain to the smoothed roadbed so voids do not appear under the road, and adds a chase-camera scale regression that verifies the procedural car still fits on a one-lane road.',
    '2026-07-10 14:49 EDT - Race rendering now uses a cached smoothed roadbed profile built from route plus terrain support, cuts terrain microquads out of the road/margin/shoulder corridor so coarse terrain cannot wash over the road, and adds Studio Sprint regressions for smooth roadbed support, corridor cutouts, and the 45 FPS terrain+texture benchmark.',
    '2026-07-10 13:58 EDT - Race road elevation now builds a smoothed deck from center, left-edge, and right-edge terrain support before stitching the corridor, road/profile caches use quarter-meter precision to reduce height stepping, playtest/preview startup now initializes at the road deck height, and third-person fallback car rendering uses road contact elevation instead of chassis height so the car sits on the road.',
    '2026-07-10 13:23 EDT - Race road placement now uses a corridor-first roadbed model: road height follows a smoothed centerline profile instead of max side terrain, terrain inside the road/margin/shoulder corridor is stamped to the roadbed, and route projection precision was tightened so road edges and terrain stitching line up through curves.',
    '2026-07-10 11:52 EDT - Race road/terrain elevation now uses a smoothed shared height model: raw tile heights remain available for diagnostics, road decks sample a smoothed terrain profile, grade physics uses the same road profile, and per-wheel contact feeds suspension travel, pitch, roll, and bottom-out damage.',
    '2026-07-10 11:10 EDT - Race terrain elevation authoring now supports a wider +/-1.0 range, road decks sample the terrain footprint and stay painted above high terrain, and regression coverage now checks a deterministic random terrain route for road/terrain intersections.',
    '2026-07-10 10:25 EDT - Race WebGL Track Studio Sprint FPS coverage now benchmarks Terrain On and Textures On with deterministic seeded ground art, and the textured terrain diagnostic path uses a lower slice budget so the benchmark must stay above 45 FPS.',
    '2026-07-10 03:37 EDT - Added a Studio Sprint WebGL Track FPS unit test that times repeated terrain-off frames and fails below 30 FPS; the no-terrain/no-texture Track diagnostic path now caps to 36 third-person / 44 first-person Mode 7 slices after the new test initially caught the renderer at 18.2 FPS.',
    '2026-07-10 03:18 EDT - Race WebGL Track debug-simple rendering now skips terrain setup when Terrain is Off, skips surface art lookup when Textures is Off, gates Three-only paint mesh work behind the terrain-enabled Three path, and batches native opaque track meshes into one upload pass so Terrain Off / Textures Off isolates the real remaining road renderer cost.',
    '2026-07-10 01:58 EDT - Race WebGL Track now uses the native WebGL terrain path by default when Terrain is On, with Three.js moved behind an explicit debug toggle; native road/shoulder/margin meshes now resample stitched terrain before projection so the road follows elevation instead of cutting through terrain.',
    '2026-07-10 01:40 EDT - Race Three.js batching now groups by texture/lift instead of color so per-vertex sun/terrain colors do not explode Studio Sprint into dozens of draw calls; default Terrain On budget was lowered again to prioritize nearby road-corridor terrain.',
    '2026-07-10 01:26 EDT - Race Three.js terrain now uses a stronger vertical elevation scale, road/shoulder/paint vertices resample stitched terrain before their small visual lift, Three materials are reused, and native WebGL fallback setup is skipped on successful Three frames.',
    '2026-07-09 23:35 EDT - Race WebGL Track now keeps Three.js road, shoulder, margin, furniture, and paint layers ordered above terrain, extends Studio Sprint/circuit lookahead past one lap, caps Three pixel ratio, and lowers the normal terrain-cell budget so Terrain On is less likely to spend thousands of polygons on non-road ground.',
    '2026-07-09 22:58 EDT - Race WebGL Track restored the fast Terrain Off path, narrowed Three.js race FOV, and raised margin/boundary layers above the road so terrain-enabled rendering keeps aprons and margins visible.',
    '2026-07-09 22:36 EDT - Race WebGL Track now renders terrain, shoulders, road, margins, lane paint, checkers, and quarter-mile posts in one Three.js world scene so the road sits directly on top of the heightmap terrain instead of floating above a separately projected ground layer.',
    '2026-07-09 22:08 EDT - Race WebGL Track terrain now uses a locally vendored Three.js world renderer for heightmap geometry, keeping project-art ground on stable Three BufferGeometry while the native terrain shader remains fallback only.',
    '2026-07-09 21:31 EDT - Superseded native attempt: Race WebGL Track briefly used a custom world-space terrain shader, but that path was replaced by the Three.js renderer after close textures and geometry remained unstable.',
    '2026-07-09 21:23 EDT - Race WebGL Track keeps project-art terrain on the 3D heightmap mesh path while stabilizing close textured ground: mesh shaders now use high precision UV interpolation and textured meshes use tile-aligned local UV origins so tiny texture scales do not feed huge absolute UVs into the shader.',
    '2026-07-09 21:08 EDT - Race WebGL Track terrain textures are back on the real 3D heightmap mesh path; the screen-space stable texture layer is no longer used to replace textured terrain geometry.',
    '2026-07-09 20:57 EDT - Superseded experiment: Race WebGL Track briefly used a screen-space project-art ground layer, but that approach was backed out because it replaced the real 3D heightmap terrain mesh.',
    '2026-07-09 20:04 EDT - Race WebGL textured terrain LOD is now camera-stable around Studio Sprint turns, and slow-camera regression coverage verifies a baked subquad keeps identical vertices and UVs while moving through the node-4 bend.',
    '2026-07-09 19:10 EDT - Race WebGL near-plane clipping now uses one explicit world-space intersection helper, and Studio Sprint bend tests verify terrain UVs stay bounded through raw, normal, and screen-clipped optimization paths without mutating source vertices.',
    '2026-07-09 18:51 EDT - Race WebGL terrain screen-edge clipping now preserves perspective-correct world coordinates and UVs, with regression tests proving textured terrain UVs stay fixed across camera movement and clipped polygons no longer rescale near the camera.',
    '2026-07-09 18:38 EDT - Race Tire FX now has a separate grey Gravel Smoke slot for gravel and wet gravel, and Race WebGL terrain has regression coverage that verifies camera projection never mutates baked terrain vertices or breaks world-anchored UVs.',
    '2026-07-09 17:55 EDT - Race tire FX now treats asphalt smoke as burnout/lockup-only, uses sparse asphalt skid marks for hard cornering, kicks up dirt/gravel dust from normal loose-surface speed, preloads Tire FX art, and prewarms terrain along the route corridor to reduce mid-race hitches.',
    '2026-07-09 17:42 EDT - Race WebGL textured meshes now keep UVs anchored to clipped world polygons instead of centroid-generated triangles, tire temperature now affects per-wheel grip aggressively, and Settings includes Tire FX art overrides for skid smoke, dust, snow dust, grass dust, and wet spray.',
    '2026-07-09 17:17 EDT - Race playtest startup no longer has a launch projection hold or stabilization blend; the third-person camera now renders behind the live car pose immediately so nothing should strafe or reframe during the first seconds of Studio Sprint.',
    '2026-07-09 17:00 EDT - Race reset-to-center now fades fully to black, holds black for 250ms, recenters only while hidden, and preserves vehicle speed so the car keeps moving instead of stopping dead.',
    '2026-07-09 16:54 EDT - Race launch rendering now keeps the camera behind the turning car during startup while still anchoring launch position to the route centerline, so the simulated joystick no longer causes lateral camera drift or a pinned non-following camera.',
    '2026-07-09 16:42 EDT - Race launch rendering now keeps the startup camera on the route centerline even when simulated joystick steering offsets the live car, fixing the remaining first-seconds left/right strafe caused by zero-coordinate fallback during launch.',
    '2026-07-09 16:35 EDT - Race playtest launch projection now keeps the simulated D-pad camera view centered through the startup blend, so steering can still work while the camera no longer strafes left/right during the first seconds of a race.',
    '2026-07-09 16:15 EDT - Race playtest now blocks held left-thumbstick steering while the car is staged behind the starting line, preventing the camera/road view from strafing at race startup; reset-to-center collision effects now fade fully out before moving the car back to the route center.',
    '2026-07-09 16:05 EDT - Race look-around is now physical-gamepad-only: simulated/mobile controls cannot drive camera look, right thumbstick controls look only when a real gamepad is connected, and third-person car rendering still hides while looking away.',
    '2026-07-09 15:54 EDT - Race margin settings now separate margin and shoulder display states (On, Hidden, Off), collision edge selection (road, margin, shoulder), and collision effect (collide or reset-to-center fade) instead of using the temporary hidden-shoulder collision mode.',
    '2026-07-09 15:40 EDT - Race playtest now blends launch projection over the first 18 meters instead of snapping from a 120ms hold, treats under-near-plane geometry as invisible unless explicitly clipped, and adds a margin collision mode that keeps shoulders visible while ignoring shoulder width for solid edge contact.',
    '2026-07-09 15:15 EDT - Race playtest now holds the launch camera projection through the first start-line transition frame and near-clips WebGL terrain/road meshes through one shared camera-space path so close textures and geometry stay stable instead of scaling or popping.',
    '2026-07-09 14:56 EDT - Race procedural car steering visuals now turn the front tires with the same sign convention as the physics, and race scenery plus solid edge collisions now use body and wheel footprint probes instead of center-only contact checks.',
    '2026-07-09 14:49 EDT - Race third-person road sampling now includes a rear span matching the chase camera distance, so moving the camera back no longer leaves the near-camera road unrendered.',
    '2026-07-09 14:39 EDT - Race third-person chase camera now sits farther behind the car using a car-dimension-based distance, so the flat procedural car footprint and tires fit in view instead of clipping off the bottom of the screen.',
    '2026-07-09 14:28 EDT - Race WebGL Track Raw terrain now rejects near-plane-straddling quads that caused close-range texture scaling, and procedural fallback race cars now render as flat road-plane footprints with tires placed from wheelbase/track data.',
    '2026-07-09 14:14 EDT - Race WebGL Track mesh textures now use perspective-correct UV packing in the shared mesh shader, so close-range painted terrain should stay anchored instead of scaling or swimming as it approaches the camera.',
    '2026-07-09 13:55 EDT - Race Texture Scale now has a Raw terrain polygon debug switch that disables terrain vertex clipping/rebuilding for WebGL Track terrain only, so triangle pop-in can be isolated while road, marker, and normal terrain rendering keep the standard optimized path.',
    '2026-07-09 13:27 EDT - Race WebGL Track mile markers now render as short tapered roadside ticks with road-furniture depth priority, so distant markers no longer tower over the track or disappear behind the road.',
    '2026-07-09 13:12 EDT - Race WebGL Track quarter-mile posts now use small cone-sized elevation units and normal mesh depth so they no longer render as giant towers or hide behind the road.',
    '2026-07-09 12:59 EDT - Race WebGL Track now renders quarter-mile markers as real upright WebGL roadside posts and start/finish checkers as world-space road meshes, while removing texture-specific terrain LOD boosts that caused close painted ground to zoom around bends.',
    '2026-07-09 12:44 EDT - Race WebGL Track backed out the overbroad high-detail terrain LOD rule that made close textures zoom worse, and quarter-mile side markers now render as upright post-style overlay ticks after the WebGL track instead of flat apron paint.',
    '2026-07-09 12:20 EDT - Race WebGL Track now keeps textured road-corridor terrain at stable high-detail LOD through bends and draws lane dashes, quarter-mile margin markers, and checker stripes as a final depth-overlay pass so they remain visible above road/apron geometry.',
    '2026-07-09 11:59 EDT - Race WebGL Track now renders road surface textures, lane dashes, margin markers, and start/finish checker stripes through the same depth-tested mesh pass as the road so markers stay narrow and stripes stay on the road instead of drifting under textured aprons.',
    '2026-07-09 11:47 EDT - Race playtest now resets and holds WebGL Track dynamic render scale during launch/pre-start, prewarms terrain from the actual behind-start visual camera distance, and keeps texture preview camera view aligned with the selected playtest view to prevent start zoom/shift snaps.',
    '2026-07-09 11:28 EDT - Race playtest now preserves the negative pre-start visual projection on Studio Sprint and other circuit races until the car actually reaches the start line, preventing the first-frame camera/projection snap.',
    '2026-07-09 11:13 EDT - Race playtest launch now holds the initial camera yaw during the launch lock, and start/finish checker stripes plus distance markers prefer the road renderer projection slices so overlays stay aligned with the road at distance.',
    '2026-07-09 10:51 EDT - Race third-person camera now rides higher while the rendered chase car stays anchored to a compensated road-contact point, so the scene gets more vertical visibility without making the car float off the road.',
    '2026-07-09 09:15 EDT - Car Editor now shows a layered geometric car preview that swaps in authored shell, tire, spoiler, and turn-frame art as each slot is assigned, and its menu rows now expose only real editable car fields instead of planned/no-op layer buttons.',
    '2026-07-09 00:32 EDT - Race playtest now keeps third-person road rendering anchored to stable car travel instead of chase-camera route projection, projects quarter-mile/edge markers onto the apron/margin, fixes reverse yaw to use signed physical speed, and adds direct WRX/BRZ/Civic load actions to Car Editor File.',
    '2026-07-08 23:34 EDT - Race playtest now samples destination road mesh before the start line, keeps checker stripes fixed to true endpoints, prewarms WebGL/art/terrain resources at drive start, and disables the live chase-camera terrain safety clamp to stop mesh-avoidance jumps.',
    '2026-07-08 23:15 EDT - Race WebGL Track now binds selected margin/boundary textures per mesh group, keeps long-distance markers projected between road edges, and adds regression coverage that Car Editor artwork replaces procedural race car sprites.',
    '2026-07-08 22:20 EDT - Race playtest now projects lane markers and start/finish checker cells from world-space road sections to reduce long-distance drift, draws WebGL margin strips after the road so close-camera boundaries remain visible, preloads selected/AI car art, and lets Car Editor shell/turn-frame art replace procedural race cars.',
    '2026-07-08 21:35 EDT - Race playtest now clamps the camera above the highest nearby raw/stitched terrain footprint, carries depth through interpolated mile marker slices, near-clips checker stripes, extends point-to-point start/finish stripes farther, and preloads selected race art refs before driving to reduce first-frame asset hitching.',
    '2026-07-08 21:18 EDT - Race Texture Scale now defaults Detail to Off, Car Editor mode can save/open stock cars as first-class car project files in the Project Browser, and automatic brake-to-reverse gets a regression check so backing up from rest moves opposite the car heading.',
    '2026-07-08 21:07 EDT - Race Texture Scale now includes WebGL Track optimization switches for terrain culling, terrain LOD, terrain budget limiting, and distant road thinning so rendering artifacts can be isolated from the settings preview and saved race debug settings.',
    '2026-07-08 20:44 EDT - Race WebGL Track terrain rendering now stops hard-clipping terrain mesh against the lowered horizon floor, keeps accepted terrain chunks from losing individual subquads, falls back to low-detail chunks at the mesh budget boundary, and splits projection-skip diagnostics into near/offscreen/floor/degenerate counters.',
    '2026-07-08 18:58 EDT - Race WebGL Track terrain culling now uses full chunk/subquad camera bounds instead of center-point tests, adds painted-terrain top-down coverage helpers/tests, and reports terrain coverage misses separately so optimization-related triangle pop-in is easier to diagnose.',
    '2026-07-08 15:20 EDT - Race WebGL Track now forces uniform high-detail LOD for the visible road corridor and side terrain near Studio Sprint, adds terrain projection-skip diagnostics to the playtest polygon counter, and tests that left/right road-adjacent chunks no longer mix incompatible subdivision levels.',
    '2026-07-08 14:43 EDT - Race WebGL Track now samples all tile-map cells covered by a terrain chunk instead of only the center, prioritizes road-corridor terrain before background chunks, keeps road-adjacent terrain LOD compatible, and reports terrain budget/pre-cull drops under the playtest polygon counter to diagnose Studio Sprint triangle popping.',
    '2026-07-08 14:29 EDT - Race WebGL Track now avoids a separate projected-screen terrain cull before mesh generation, reports skipped degenerate triangles, removes the visible sun disc while keeping sun-based terrain shading, and reorganizes the Race Editor portrait ground row into Mode, Paint, Intensity, and Brush controls.',
    '2026-07-08 14:11 EDT - Race WebGL Track now renders destination races with a short visual road extension before the start and beyond the finish, and clipped WebGL terrain polygons use stable deduped centroid triangulation so near-plane/horizon triangles are less likely to flicker or disappear.',
    '2026-07-08 13:53 EDT - Race Texture Scale now defaults to 32px = 1m and 3200% resolution, allows 6400% resolution, removes the stale Camera Angle slider, and clamps extreme WebGL Track render targets to GPU limits while preserving aspect ratio so road overlays stay aligned.',
    '2026-07-08 13:46 EDT - Race Texture Scale resolution now reaches 3200%, WebGL Track can allocate up to a 16384x9216 offscreen buffer, and terrain-map culling now keeps a wider screen margin with a larger terrain-cell budget to reduce missing terrain triangles.',
    '2026-07-08 13:37 EDT - Race Texture Scale resolution now reaches 1600%, WebGL Track can allocate a larger offscreen buffer, and terrain-map rendering searches farther/wider with a larger mesh budget so visible painted terrain polygons are less likely to drop out.',
    '2026-07-08 13:32 EDT - Race Texture Scale resolution now goes up to 800%, and WebGL Track raises its offscreen render buffer cap so settings above 400% can visibly affect the preview/playtest instead of flattening at the old limit.',
    '2026-07-08 13:29 EDT - Race Texture Scale now allows Near Quality up to 32x, WebGL Track resolution above 100% actually increases the offscreen render scale, and custom skybox art scrolls by yaw turns instead of raw radians so it no longer races or appears reversed.',
    '2026-07-08 13:17 EDT - Race Texture Scale now separates Texture Scale from Near Quality: Near Quality no longer changes terrain UV/world scale, WebGL Track adds Crisp/Balanced/Smooth filtering with anisotropic sampling when available, and preview diagnostics report filter/quality instead of implying extra source resolution.',
    '2026-07-08 13:00 EDT - Race Texture Scale now keeps OK/Cancel inside the visible viewport, adds a WebGL Track Near Detail slider, and applies distance-faded close terrain texture density so nearby painted ground can be sharpened without forcing high detail far away.',
    '2026-07-08 12:48 EDT - Race WebGL Track now bakes terrain chunks per route/tile revision and uses adaptive terrain LOD, keeping high subdivision near the road/camera or rough elevation while dropping far and road-distant terrain to cheaper meshes.',
    '2026-07-08 12:08 EDT - Race Texture Scale diagnostics now split terrain, textures, lighting, and detail into separate toggles, make lighting visibly affect textured terrain, avoid texture sampling for untextured WebGL meshes, and show terrain subdivision, texture upload, and WebGL timing counters in the live preview.',
    '2026-07-08 11:31 EDT - Race WebGL Track now caches painted tile-map stats by revision so Studio Sprint no longer scans 22,540 terrain cells every frame, skips sun-shadow tint work for textured ground, and reports visible terrain cells/candidates under the FPS counter.',
    '2026-07-08 12:09 EDT - Race playtest now shows live WebGL polygon and draw-call counts under FPS, culls terrain before tile-map lookup, and budgets Studio Sprint terrain by nearest visible cells first to reduce huge painted-map render cost.',
    '2026-07-08 11:52 EDT - Studio Sprint investigation found the saved track has 22,540 painted 5m cells using providenceGround; Race WebGL Track now samples tile art by each terrain quad world center, uses smaller textured terrain cells, and enables mipmaps for power-of-two project ground art.',
    '2026-07-08 11:35 EDT - Race WebGL Track now adaptively subdivides near-camera textured terrain cells so project-art ground does not intermittently smear across oversized perspective quads while far terrain stays coarse for performance.',
    '2026-07-08 11:22 EDT - Race WebGL Track now batches terrain, shoulder, boundary, and road mesh quads into grouped WebGL uploads instead of issuing a buffer upload and draw call for each tiny road band.',
    '2026-07-08 11:08 EDT - Race playtest performance now caps WebGL Track render resolution, dynamically lowers the offscreen buffer scale under load, avoids scanning every painted terrain cell each frame, and uses wall-clock FPS instead of the capped simulation dt.',
    '2026-07-08 10:49 EDT - Race playtest now uses adaptive Mode 7 road slice counts, coarser non-road WebGL terrain cells, and throttled far shoulder/boundary mesh drawing to improve FPS without removing road smoothing.',
    '2026-07-08 10:34 EDT - Level Editor and Race Editor playtests now show a smoothed FPS readout next to the top pause/stop control so performance is visible while testing.',
    '2026-07-08 10:24 EDT - Race skybox rendering now uses the actual projection horizon instead of the lowered terrain-fill top, and custom skybox art no longer overdraws as far below the horizon after the terrain-distance fixes.',
    '2026-07-08 10:15 EDT - Race WebGL road and shoulder depth bias now operates directly in clip-depth space instead of being diluted across the camera far plane, reducing flat-ground z-fighting where the road appeared to clip into terrain.',
    '2026-07-08 10:05 EDT - Race WebGL terrain now expands its forward mesh distance from the actual farthest road band instead of a fixed 6-8 cell grid, so distant roads should no longer continue past the terrain and appear to float into the sky.',
    '2026-07-08 09:58 EDT - Race playtest now projects road cross-sections at the same elevation as the stitched terrain instead of lifting road geometry upward; WebGL depth bias still keeps the road visible, and a flat straight-road regression test now verifies the centerline stays aligned instead of bending sideways.',
    '2026-07-08 09:22 EDT - Race playtest now clips start/finish checker stripes plus continuous lane and edge markers to the same terrain-top projection boundary as the WebGL ground, and forward road sampling no longer injects a behind-camera near sample unless the camera is side-on or facing backward.',
    '2026-07-08 09:13 EDT - Race WebGL Track now clips road, shoulder, and margin mesh to the same terrain-top boundary used by the ground/sky transition, and removes projection-time road elevation lifts so flat roads no longer render into the sky band above flat terrain.',
    '2026-07-08 09:05 EDT - Race playtest now treats the road as the authoritative elevation surface: heightmap terrain no longer modifies route samples or road cross-sections, and WebGL terrain is carved flat under the road then smoothly stitched back to painted terrain through the shoulder.',
    '2026-07-08 08:58 EDT - Race playtest now keeps road elevation tied to centerline terrain instead of shoulder/edge height samples, caps lane/edge marker drawing to five marker intervals near the car, and skips markers above the horizon or behind the near plane so quarter-mile posts stop showing through hills.',
    '2026-07-08 08:42 EDT - Race playtest now draws a shorter far-road span, bases third-person camera height on local camera/car terrain instead of upcoming route hills, reduces hill-driven near-plane jumps, and increases road/margin render clearance over coarse terrain to cut sky-road and ground-clipping artifacts.',
    '2026-07-08 08:27 EDT - Race playtest now clips WebGL road, shoulder, and margin polygons to the horizon line instead of letting straddling quads reach into the sky, lifts/depth-biases track mesh above terrain, and changes solid edge contact to a velocity reflection with yaw damping to reduce wall traps and infinite spins.',
    '2026-07-08 08:01 EDT - Race playtest top pause icon now exits the drive and returns directly to the Race Editor, while controller/start pause still opens the in-race pause menu.',
    '2026-07-08 01:32 EDT - Race WebGL Track now culls road, shoulder, and margin mesh quads that project entirely above the horizon so far track no longer appears in the sky, and reduces non-road terrain mesh density while keeping the road bands smooth.',
    '2026-07-08 01:23 EDT - Race WebGL Track now suppresses the old green ground prefill when the WebGL terrain renderer is active, lets painted terrain remove the default grass fill, applies sun-direction slope lighting to road and shoulder mesh quads as well as terrain, and culls terrain cells in camera space before elevation/projection work to improve playtest performance.',
    '2026-07-07 23:27 EDT - Race Editor coordinate handedness is now consistent across top-down authoring, minimap, road projection, wheel surface sampling, AI offsets, decals, and steering physics: when traveling south, right steering turns west; WebGL Track also stays in the depth-tested terrain mesh even without project ground art to avoid green fallback rectangles over hills.',
    '2026-07-07 23:00 EDT - Race playtest minimap now uses the same vertical orientation as the Race Editor top-down map, and the minimap car direction marker follows that same map handedness so an L-shaped route no longer appears upside down while racing.',
    '2026-07-07 22:45 EDT - Race Editor WebGL Track now renders road margins/boundaries inside the depth-tested mesh pass, removes car/tree shadow overlays, lifts road and shoulder cross-sections above raised painted terrain only when needed, and strengthens sun-direction terrain shading so hill faces read bright or dark without object shadows.',
    '2026-07-07 22:27 EDT - Race Editor WebGL Track now requests a real depth buffer, sends per-vertex camera depth into the mesh shader, depth-tests terrain/shoulder/road polygons so roads do not simply paint through nearer terrain, and tints terrain mesh cells from Settings > Sun direction so hills have visible light and shadow.',
    '2026-07-07 22:19 EDT - Race Editor WebGL Track now clips mesh polygons against the camera near plane before projection, pre-culls and depth-sorts visible terrain cells, avoids double-projecting culled terrain, extends custom skyboxes farther below the horizon, and strengthens the horizon haze blend.',
    '2026-07-07 21:56 EDT - Race Editor now defaults new tracks to the WebGL Track renderer, adds Settings > Sun for direction/brightness, centers the playtest pause icon in the same top position as Level Editor, culls fully offscreen WebGL mesh polygons, and extends the skybox with a light horizon haze to hide green horizon gaps.',
    '2026-07-07 21:33 EDT - Race Editor WebGL Track now projects a real world-space terrain grid with texture UVs anchored to meters, samples height-map elevation per grid corner, and draws road/shoulder strips as WebGL mesh geometry so the car drives over fixed terrain instead of a separately scrolling screen-space plane.',
    '2026-07-07 21:21 EDT - Race Editor Texture Scale now has a third WebGL Track renderer mode that draws project-art terrain, shoulders, and road surface into one WebGL buffer from the same projected Mode 7 road bands, reducing ground-versus-road scroll drift.',
    '2026-07-07 20:29 EDT - Race Editor WebGL ground projection now removes its independent depth tuning and uses the exact road projection exponent, so project-art terrain scrolls at the same speed as the Mode 7 road bands.',
    '2026-07-07 20:16 EDT - Race Editor WebGL ground now uses the same Mode 7 depth curve and lateral scale as the road renderer so terrain scrolls with the track, Texture Scale Angle no longer moves the horizon, and custom skybox art suppresses fallback mountain/cardinal geometry.',
    '2026-07-07 19:16 EDT - Race Editor WebGL ground projection now maps bottom screen rows to near ground and upper rows toward the horizon, fixing the backwards underwater-feeling plane movement.',
    '2026-07-07 19:10 EDT - Race Editor WebGL ground plane now reverses the longitudinal texture coordinate so driving forward pulls terrain toward the camera, and WebGL no longer applies the hidden software Rows setting to its render height.',
    '2026-07-07 19:06 EDT - Race Editor WebGL ground rendering now flips uploaded project art to match the editor/software orientation, and Texture Scale now hides software-only mip/row controls when WebGL Plane is selected while keeping texture scale, resolution, and camera angle visible.',
    '2026-07-07 18:50 EDT - Race Editor Texture Scale renderer toggle now handles pointer clicks inside the settings dialog, so pressing Renderer switches between Software and WebGL Plane before saving.',
    '2026-07-07 18:39 EDT - Race Editor Texture Scale now has a Renderer toggle for Software versus WebGL Plane ground rendering; the WebGL path uses a native WebGL textured horizontal plane with nearest filtering and falls back to the software renderer if WebGL is unavailable.',
    '2026-07-07 18:16 EDT - Race Editor render tuning now extends projected-ground Render up to 400%, supports Rows below 1x as vertical supersampling, and adds a saved Camera Angle slider that adjusts the playtest projection horizon in the live preview and while driving.',
    '2026-07-07 18:04 EDT - Race Editor Texture Scale now exposes live projected-ground scanline controls: Render adjusts internal ground-buffer width and Rows adjusts vertical sample reuse, with both controls applied to the preview and saved for playtest so terrain projection quality can be tuned in-game.',
    '2026-07-07 17:55 EDT - Race Editor projected ground now renders into a full-height ground buffer instead of stretching one sampled scanline across multiple rows, improving vertical resolution so project-art terrain pixels stay parallel to the ground projection instead of smearing toward the camera.',
    '2026-07-07 17:35 EDT - Race Editor terrain sampling now uses nearest-neighbor reads for projected ground art instead of bilinear blending, preserving crisp software-rendered pixels while keeping mip averaging available only for far-distance shimmer control.',
    '2026-07-07 17:27 EDT - Race Editor ground art now treats large project artwork as a cleaned 64px-chunk atlas instead of collapsing it into one 64px image, and the top-down editor draws cropped world-space art so changing the texture scale also changes the visible tile-map scale before playtesting.',
    '2026-07-07 17:18 EDT - Race Editor now automatically builds a 64px terrain-clean sampler for large/noisy project ground art, using block averaging, posterized colors, and cached clean mip levels so 512x512 artwork such as providenceGround can be used lazily without feeding raw high-frequency noise into the Mode 7 floor.',
    '2026-07-07 17:00 EDT - Race Editor Texture Scale now includes live Mipmap Start and Amount sliders beside the starting-line preview, removes the separate Mipmaps settings row, and defaults ground art to 0.25m/px with earlier stronger mip filtering for a more F-Zero-like stable horizon.',
    '2026-07-07 16:53 EDT - Race Editor Settings now includes Mipmaps controls for projected ground art, with separate Start and Amount sliders that tune when distance mip levels kick in and how aggressively they smooth far terrain shimmer.',
    '2026-07-07 16:44 EDT - Race texture scale now reaches 0.0001m/px, and race art textures build real mip levels so distant projected ground resolves to stable lower-detail samples instead of shimmering high-frequency noise.',
    '2026-07-07 16:33 EDT - Race projected ground art has been retuned back toward crisp pixel-art: output smoothing is off again, mip averaging is limited to far rows, and the scanline path no longer performs a second world projection for every pixel.',
    '2026-07-07 16:26 EDT - Race projected ground art now renders with a higher-resolution scanline buffer and footprint-aware texture averaging so painted terrain no longer aliases as harsh 5m-looking blocks while driving.',
    '2026-07-07 16:18 EDT - Race Editor Texture Scale now uses a logarithmic 0.001m/px to 10m/px slider and shows a clipped in-game starting-line preview inside the settings dialog so ground art scale can be tuned without entering Drive.',
    '2026-07-07 16:11 EDT - Race Editor Texture Scale now edits the ground-art ratio as meters per source pixel so painted terrain can be tested at much finer scales than the original 0.5m per 32px minimum.',
    '2026-07-07 15:57 EDT - Race Editor Settings now includes a Texture Scale dialog so project ground art can be tuned live, with large artwork scaling by source dimensions instead of being squeezed into one repeated tile.',
    '2026-07-07 15:48 EDT - Race Editor now lets the skybox extend below the projection horizon and starts painted terrain lower on screen, hiding far-distance stretched ground samples; the scanline renderer also uses coarser far rows and full-detail near rows instead of splitting large project art into 32px chunks.',
    '2026-07-07 15:41 EDT - Race Editor ground texture scale now uses source art dimensions: every 32x32 pixels maps to 2.5m, so large project artwork such as 1024px terrain spans 80m instead of being squeezed into one 2.5m tile.',
    '2026-07-07 15:38 EDT - Race Editor painted terrain now uses a Mode 7-style scanline ground-plane renderer: each horizontal screen row maps back onto the flat tilemap and draws a 1-row strip, removing the vertically stretched projected-buffer look near the horizon and near camera while keeping the terrain horizon-filled.',
    '2026-07-07 15:32 EDT - Race Editor projected ground art now uses a much higher-resolution terrain buffer and a gentler mip footprint so painted project-art ground stays clearer and less muddy while preserving the horizon-filling buffered renderer.',
    '2026-07-07 15:07 EDT - Race Editor painted project-art terrain now renders through a low-resolution smoothed ground buffer that fills from horizon to screen bottom, reuses per-frame texture samplers, samples the fixed 5m tilemap in screen space, and extends the dominant painted ground art into the distance instead of leaving a green horizon rectangle.',
    '2026-07-07 14:31 EDT - Race Editor project-art ground painting now projects explicit 5m tile-map cells instead of stretching art across road-relative bands, culls far painted cells, and uses distance-based texture detail so near tiles resemble the source art while far terrain falls back to cheaper mip-style color.',
    '2026-07-07 13:12 EDT - Race Editor project-art tile cells now render as a cached flat terrain tilemap under the track instead of shoulder textures, and race art loading now caches by art name before storage reads so large painted maps do not repeatedly reload the same artwork every frame.',
    '2026-07-07 12:55 EDT - Race Editor Tile painting now writes selected project artwork into fixed terrain tile-map cells instead of creating free-positioned decals, so painted art snaps to the grid, matches cell size, remains under the track, and can be painted/erased by swiping with rectangle or oval brush footprints.',
    '2026-07-07 12:38 EDT - Race Editor tile-box painting now supports swipe/drag strokes, saves rectangle versus oval tile stamp shape from the shared brush picker, spaces repeated stamps during a stroke, and renders tile-box ground art underneath the track in both top-down editing and Mode 7 playtest.',
    '2026-07-07 12:18 EDT - Race Editor Sprites now has a stable Sprite/Decal/Tile/Paint/Brush/Erase flow: Tile paints large horizontal ground-box artwork using the shared brush controls, decals and tiles erase independently, Settings > Margin can disable shoulders, and race edge collision can target road, margin, shoulder, or stay off by default.',
    '2026-07-07 11:53 EDT - Project Browser Save As now checks typed filenames against a cached folder name set instead of rebuilding the project index on every keystroke, browser cleanup now restores page touch/scroll interaction even if overlay teardown or focus restore fails, and global Saved status overlays auto-hide defensively.',
    '2026-07-07 11:34 EDT - Race Editor File Save, Save As, and Open now persist selected tracks as first-class race documents, including route nodes, segments, terrain tile maps, margins, shoulders, surface art, scenery definitions, sprites, and decals.',
    '2026-07-07 11:12 EDT - Race Editor Settings now has a Margin dialog for enabling/disabling the road-edge margin, setting margin width, picking margin texture art, and widening/narrowing the projected shoulder terrain.',
    '2026-07-07 10:46 EDT - Race projected texture scale is now 2.5m per full art tile, and road edges now draw a road-counting boundary seam that defaults to a white line, can use the Boundary tile-art slot for F-Zero-style edge art, and can be toggled solid per track segment.',
    '2026-07-07 10:21 EDT - Race projected terrain textures now use bilinear color sampling, denser projected cells, and a 5m world tile scale so 32x32 ground art reads higher resolution and avoids disco-light shimmer while driving.',
    '2026-07-07 09:25 EDT - Race terrain tile-art overrides now render as subdivided ground-projected texture cells using world x/z coordinates, instead of clipping one screen-space image over the road and making ground art look billboarded.',
    '2026-07-07 08:59 EDT - Race Editor Settings now opens modal sliders for AI racer count, weather selection/intensity, and terrain tile-art overrides; Skybox is renamed to a direct picker, Finish Return/Road Width are removed from Settings, skybox yaw scrolls continuously across north, Sprites can pick project-art decals, and race playtest projects selected tile/decal artwork onto the road, shoulders, and ground.',
    '2026-07-07 08:21 EDT - Race art skyboxes now build a dedicated cached render canvas once per selected artwork, avoiding repeated project-art storage reads and large per-frame source scaling during playtest.',
    '2026-07-07 00:03 EDT - Race fallback skybox cardinal markers now render only when the camera is facing that direction, so facing north shows N without also showing east or west.',
    '2026-07-06 22:56 EDT - Race weather now has authoring intensity, visible rain/snow/storm FX, gradual playtest buildup, effective wet/mud/slush/snow surface conversion for rendering and per-wheel handling, and Settings > Skybox now picks Pixel Editor artwork from the project browser for the parallax background.',
    '2026-07-06 22:11 EDT - Race playtest shoulders now stay level with the road over painted height terrain, and Race Editor Settings now includes a Skybox picker for cardinal parallax backgrounds that scroll north/east/south/west with camera yaw.',
    '2026-07-06 21:45 EDT - Race Editor portrait now uses a single-row hot menu with no dead lower row, removes the top-down editor description overlay, moves the scale bar to the upper-left, centers the top Play button with level-editor-style play chrome, and changes Add Sprite into a modal settings step with width/height sliders, collision choices, OK, and Cancel.',
    '2026-07-06 21:28 EDT - Race Editor portrait cleanup fixes Ground brush slider hit priority over map zoom, keeps brush-size changes from switching elevation paint back to ground paint, replaces the brush shape toggle with selectable square/circle previews, stabilizes Track hot menus as popup windows, corrects the portrait thumbstick knob visual, and expands clipped terrain-cell drawing so edge tiles do not pop while panning.',
    '2026-07-06 20:14 EDT - Race Editor Ground mode now caches normalized 5m terrain maps by revision, invalidates road sampling once per brush stroke, uses palette/elevation/brush-stamp caches, draws zoomed-out terrain with LOD instead of every cell, and replaces the Brush popup with slider controls for size, opacity, and hardness plus a live brush preview.',
    '2026-07-06 19:12 EDT - Race Editor Ground mode now uses finer 5m terrain cells with automatic migration from old 20m cells, vertical Tile/Raise/Lower/Brush popups, selectable raise/lower amounts, repeatable elevation strokes, and brush size/shape/falloff/opacity controls that blend terrain weights for mixed grass/snow/dirt painting.',
    '2026-07-06 18:28 EDT - Race Editor Ground mode now uses a map-pinned sparse tile grid instead of circular paint patches: painting fills individual terrain cells, Brush selects 1x1 through 7x7 tile areas, elevation raises/lowers tile heights with a black-to-white heightmap overlay, road rendering stays layered above terrain, and new/default/test races initialize with tile-map terrain data.',
    '2026-07-06 18:03 EDT - Race Editor sprite authoring now creates reusable sprite definitions from Settings > Add Sprite, opens sprite settings for real width, height, and collision behavior, changes Sprites into Select/Paint/Erase, removes the old debug rectangle around art billboards, keeps close billboards height-anchored, and removes the default starting-line tree/scenery from new races.',
    '2026-07-06 17:50 EDT - Race Editor Ground mode now paints by default, changes Tile and Brush into bottom hot-menu pickers, removes the confusing Paint row, stores new ground paint in world coordinates so terrain stays locked to the road while zooming/panning, and draws painted terrain patches under the road so shoulders and surrounding terrain are easier to read.',
    '2026-07-06 17:35 EDT - Race Editor placed scenery sprites now render the actual selected Pixel Editor artwork as vertical race billboards instead of falling back to procedural tree drawings, including flat frame pixel documents and tile-backed art.',
    '2026-07-06 17:21 EDT - Race Editor now moves Generate Race and built-in test track loads under File, replaces the top-level Generate menu with Ground, caps visible AI racers at 11 from Settings, lets Add Sprite pick Pixel Editor artwork from the project browser for vertical race billboards, and makes painted terrain tiles drive shoulder surface plus smoothed road elevation while the road draws on top.',
    '2026-07-06 16:44 EDT - Race Editor portrait Track now closes the bottom menu and returns to the map, while selected edges use Surface/Width/Edit drill-down hot menus and selected nodes show only node-focused edit actions without Edge/Node descriptive text.',
    '2026-07-06 13:52 EDT - Race physics now uses real-world stock performance targets for WRX, BRZ, and the 2023 Honda Civic Type R, replaces the old Civic Si test car, adds per-car drag/acceleration calibration, and tests runtime 0-60 plus quarter-mile ET/trap against target bands.',
    '2026-07-06 10:18 EDT - Race Editor now removes the Drive root menu, keeps diagnostics and AI checks out of visible menu drawers, and exposes playtesting through a single top Play/Pause control.',
    '2026-07-06 10:00 EDT - Race Editor menus now rename Race to Track, add a Generate root for Generate Race plus all built-in track loads, remove Ground/Elevation roots while keeping their tools under Track, and filter blank File rows.',
    '2026-07-06 09:02 EDT - Race third-person rendering now samples Mode 7 road geometry from the camera route projection, clips near-plane road and shoulder polygons before projection, removes visible pause-menu row boxes, and softens left-thumbstick steering without changing D-pad tuning.',
    '2026-07-06 08:32 EDT - Race playtest now removes the synthetic immediate road patch, pulls near-road visibility from the normal Mode 7 road-band renderer, confirms B shifts up and X shifts down, and restyles pause into a level-style text menu with Settings as the dedicated ABS/traction/transmission/telemetry submenu.',
    '2026-07-06 08:10 EDT - Race playtest now validates WeatherTech WRX acceleration/braking sanity, raises uphill camera clearance, suppresses far-off-route near-road rectangles, keeps center dashes from dropping at slice edges, swaps racing X/B shifting, corrects reverse steering, adds right-stick look, and replaces the flat race pause overlay with a controller-navigable Car Settings menu.',
    '2026-07-05 23:22 EDT - Race playtest now switches to fullscreen rendering when a physical gamepad is connected, reads left-thumbstick axes through the shared gamepad input API, guards off-road projection against black near-camera planes, and keeps rear breakaway alive longer before AWD/traction recovery can settle the car.',
    '2026-07-05 23:00 EDT - Race playtest now recenters released left-thumbstick steering more aggressively, hides the simulated handheld controls while a physical gamepad is connected, unifies near-road projection math to reduce straight-road bending, and adds yaw angular velocity plus stronger handbrake rear breakaway so high-speed drift can spin the car.',
    '2026-07-05 22:17 EDT - Race playtest camera FOV now uses normal game-camera ranges instead of telephoto zoom, left-thumbstick steering ramps and decays like a virtual steering wheel, handbrake drift has stronger rear lock/breakaway, hill grades apply gravity force, and the closest road patch renders with perspective near the camera.',
    '2026-07-05 19:16 EDT - Race playtest telemetry is now hidden unless enabled from pause or running a diagnostic, and high-speed steering now uses wheelbase-based bicycle-model yaw with grip-limited front tire angle so cars no longer rotate like they are turning on a dime.',
    '2026-07-05 17:02 EDT - Race playtest now has slower analog steering response, tighter high-speed steering authority, runtime ABS and Traction Control toggles in the pause menu, traction-control launch limiting, and sustained handbrake rear-slip behavior for controller-driven 180 attempts.',
    '2026-07-05 15:47 EDT - Race playtest rendering now uses the same physical road width for mesh edges, checker stripes, lane markers, and tire terrain classification; Mode 7 road bands reject non-contiguous route slices to prevent random horizontal streaks, and random race generation falls back to a clean route if repair attempts still self-intersect.',
    '2026-07-05 15:12 EDT - Race Editor File New now supports 1-6 lane road choices using real 3.6m lanes, defaults new races to a one-lane back-country road, hides dotted center lines on one-lane roads, and scales one-lane playtest rendering to fill first-person and half-fill third-person views with car size matched to the road.',
    '2026-07-05 13:26 EDT - Race playtest and editor road scale now use real per-car dimensions for WRX, BRZ, Civic, and starter cars; authored road widths are treated as physical meters, narrow one-lane roads can be 1.25-1.5 car widths, center dashes hide below 1.9 car widths, and projection/tests now check car-to-lane proportions.',
    '2026-07-05 12:28 EDT - Race playtest now prioritizes the controller left thumbstick for analog steering, moves road scale toward real lane/car proportions, strengthens per-wheel friction-circle telemetry for BRZ drift and mixed-surface yaw, keeps Mode 7 road bands visible when facing reverse or 90 degrees across the track, and changes normal race telemetry from timing rows to live G/slip/load/temp/suspension gauges.',
    '2026-07-05 10:02 EDT - Race Editor Drive now exposes diagnostic test sessions for skidpad, 0-60, 60-0, quarter mile, slalom, jump analysis, AI consistency laps, and ghost comparison; playtests now track live lateral G, tire temperature/load, suspension travel, jump landing data, ghost deltas, and up to 12 AI racers across Easy, Medium, Hard, and Expert difficulty.',
    '2026-07-05 09:18 EDT - Race playtest now samples each tire against its own road/shoulder/off-road surface, clears controller handbrake on A release, uses friction-circle limits for brake/steer/launch slip, projects the third-person car from the physical world pose, and sanitizes closest Mode 7 road quads to reduce missing bands and ground bleed-through.',
    '2026-07-05 08:36 EDT - Race playtest now has race-specific gamepad controls, starts both first- and third-person behind the checker stripe, keeps nearest Mode 7 quads visible with near-plane clipping, makes road shoulders visibly distinct, and adds rear tire breakaway so hard high-speed steering can oversteer instead of only scrubbing speed.',
    '2026-07-04 22:50 EDT - Race physics calibration now checks stock WRX/BRZ/Civic stats, verifies every exposed tuning row changes a physics/performance output, retunes loose-surface tire grip away from ice-like behavior, logs damage sources, gates side-panel damage on actual side contact, and tightens shoulder projection so roads feel less detached from the ground.',
    '2026-07-04 19:26 EDT - Race tuning now has Forza-style tabs for tires, gearing, alignment, antiroll bars, springs, damping, aero, brakes, differential, and stats; per-gear ratios, brake pressure, drivetrain-specific diffs, suspension travel, alignment, and computed performance stats now feed the race physics, while dirt/gravel grip is retuned away from ice-like braking.',
    '2026-07-04 17:14 EDT - Race playtest now routes mobile buttons, keyboard keys, gamepad triggers, and future pedal-style inputs through smoothed throttle/brake axes, preserving analog trigger pressure while giving digital Go/Brake ramp-in and release behavior that feeds tire-limited acceleration, braking, wheelspin, and brake-lock slip.',
    '2026-07-04 16:32 EDT - Race playtest rendering now reuses cached route samples with binary distance lookup across Mode 7 depth slices, improving Daytona-style dense route performance, and highway lane dashes now project as road-aligned quads instead of screen rectangles that looked like upright markers.',
    '2026-07-04 15:23 EDT - Race playtest now draws mile markers from one continuous Mode 7 marker pass, blocks automatic downshifts that would over-rev the engine, raises crest camera clipping safety, matches checker stripes to rendered road width, and tracks ordered checkpoints for lap/finish progression.',
    '2026-07-04 15:08 EDT - Race routes now round every meaningful node bend, including shallow turns under 90 degrees and semantic square/junction turns, while route samples smooth yaw/elevation through crests, bumps, and hard turns for fewer visual edges.',
    '2026-07-04 14:43 EDT - Race playtest rendering now uses denser Mode 7 depth slices, smoother continuous marker phase, auto-rounds sparse tight node corners with more render vertices, and adjusts camera horizon from uphill/downhill pitch cues.',
    '2026-07-04 14:12 EDT - Race playtest Mode 7 rendering now uses continuous screen-depth slices with unrounded distance phase, so road markers and surface motion move smoothly like a camera-space renderer instead of stepping through discrete route samples.',
    '2026-07-04 03:30 EDT - Race node-authored tracks now generate bounded bezier-style corner vertices from sparse map points, keeping lazy five-point routes visually readable without free-spline overshoot while preserving tight explicit square/junction corners.',
    '2026-07-04 03:27 EDT - Race playtest cleanup now clips all road/parallax drawing to the handheld screen, removes automated co-driver/turn instructions from playtest, fixes the minimap orientation marker, slows road color banding to avoid backward-motion reads, preserves sharper high-speed tire scrub, improves coasting, and changes playtest pause controls to one top return button plus a Start/gamepad pause overlay.',
    '2026-07-04 00:20 EDT - Race playtest rendering now samples a local route-order window around the car, draws parallax sky/terrain reference layers, projects shoulder terrain beside the road instead of filling to the screen edge, and nudges random route generation away from self-intersecting racing lines with normal two-lane default widths.',
    '2026-07-03 23:48 EDT - Race playtest stabilization now smooths mobile D-pad steering taps, suppresses crawling-speed skid, lets skids recover when controls settle, fixes automatic Go/Reverse behavior, restores WRX top-speed calibration, and tightens road near-plane projection over elevation changes.',
    '2026-07-03 23:13 EDT - Race playtest physics now uses tire-limited braking, per-wheel grip/slip inspection, physical brake lock and wheelspin audio triggers, and a first-pass gravity/rollover state so steering, skidding, braking, and damage have a stronger simulator basis.',
    '2026-07-03 22:45 EDT - Race playtest steering now uses a physical steering-rack model: cockpit wheel rotation, front tire drawing, and yaw physics all share the same front tire angle, while tire screech audio is gated by actual slip angle, scrub, wheelspin, or brake lock instead of steering input alone.',
    '2026-07-03 18:27 EDT - Race playtest high-speed steering now uses stronger tire-limited yaw damping, a separate velocity heading for momentum, and slip-angle speed scrub so full steering at highway speed carries the car outward and slows it instead of rotating cleanly into the opposite lane.',
    '2026-07-03 17:28 EDT - Race playtest now slows active steering turn-in by 8x for finer D-pad and analog control, lets automatic transmissions downshift while coasting or braking, supports brake-to-reverse near a stop, adds visible tire-traction pull from uneven tire grip, and adapts near-road clipping over elevation changes.',
    '2026-07-03 17:09 EDT - Race playtest road rendering now anchors visual route sampling, markers, cues, and start/finish stripes to the projected route distance while keeping car physics free-moving, keeps road cross-sections planar over painted ground elevation, and restores the Race authoring menu after Drive picker/playtest exits.',
    '2026-07-03 16:55 EDT - Race playtest rendering now removes the remaining distance-sine horizon wobble, rejects invalid projected road bands before drawing, generates node-backed random routes with square/angled/junction turns, and keeps Race Editor menus reachable after Generate.',
    '2026-07-03 16:34 EDT - Added NEXT_WEEK_PROMPT.md as a pause handoff for the RTG Studio editor UI consistency work, including the current desktop/portrait/landscape/gamepad layout goal, latest race-rendering work, and next audit targets.',
    '2026-07-03 16:31 EDT - Race playtest rendering now samples segment-authored elevation as one continuous profile, raises the camera above the road surface, removes elapsed-time horizon wobble, and expands random race generation into clean oval, road-course, sprint, mixed-rally, and severe-rally archetypes.',
    '2026-07-03 16:15 EDT - Shared portrait submenu sheets now expose bottom-sheet command metadata for touch, tap-release, and gesture scrolling, reinforcing the bottom-first portrait contract across Pixel, Level, MIDI, SFX, Cutscene, Race, Car, and Tile flows.',
    '2026-07-03 16:10 EDT - Shared desktop top-menu rendering now returns surface, role, and fit metadata alongside the rendered button list, keeping top menus inspectable as first-class desktop app chrome across every editor while preserving existing button behavior.',
    '2026-07-03 16:08 EDT - Shared desktop ribbons now clip long titles and subtitles through the same RTG Studio text helper used by context panels, keeping Pixel, Tile, Level, MIDI, SFX, Cutscene, Race, and Car desktop left ribbons from overflowing on long document or selection names.',
    '2026-07-03 16:02 EDT - Desktop context panels now filter their declared content roles through one shared inspector-role list, keeping Pixel, Tile, Level, MIDI, SFX, Cutscene, Race, Car, and Actor panels aligned as persistent inspectors instead of drifting into duplicate menu command surfaces.',
    '2026-07-03 15:58 EDT - Shared desktop dropdown click-away now treats both raw bounds and registered scroll-region objects as interactive drawer space, with all canvas editors covered so dropdown rows and scroll areas do not close prematurely while testing desktop menus.',
    '2026-07-03 15:54 EDT - Race playtest road rendering now depth-sorts projected road strips and draws all side terrain before road surfaces, preventing ground from clipping over the road when the camera faces north/south differently or a compact track like WeatherTech crosses near itself.',
    '2026-07-03 15:50 EDT - Pixel bone timeline hit handles now size from the resolved active viewport mode instead of raw device mobile detection, keeping touch-capable desktop sessions on desktop-sized editor controls while portrait and landscape keep larger touch targets.',
    '2026-07-03 15:48 EDT - Race playtest now defaults cars to automatic when available, samples the route in the camera-facing direction when driving backward, and makes first-person road scale visibly wider than third-person road scale.',
    '2026-07-03 15:47 EDT - Built-in Col de Turini and Ouninpohja rally routes now use dense authoring polylines instead of 2-3 km straight chunks: Turini has repeated tight hairpins with wet/snow/ice sections, and Ouninpohja has shorter high-speed gravel sweepers, crest bumps, and jump-marked sections.',
    '2026-07-03 15:36 EDT - Race Editor portrait now routes Race/Ground/Elevation mode changes through the bottom Menu sheet, closes the sheet before canvas editing, swaps the bottom hot menu between selected edge and selected node actions, and keeps the map thumbstick panning like a camera stick.',
    '2026-07-03 15:36 EDT - Desktop dropdown click-away logic now respects registered dropdown row and scroll regions across Pixel, Level, MIDI, SFX, Cutscene, and Race editors, so moving onto or pressing menu rows does not immediately close the drawer before commands can be tested.',
    '2026-07-03 15:18 EDT - Desktop pointer policy now enables shared right-click context-menu behavior for every registered editor, including Tile, MIDI, and SFX, instead of keeping an editor-specific allowlist.',
    '2026-07-03 15:14 EDT - Race Editor selected road edges now carry per-segment width, bumpiness, and snow condition data, with Daytona widened as the wide-track template and rally stages narrowed for one-lane-style routes.',
    '2026-07-03 15:03 EDT - Race playtest now has pre-race car selection with Tuning and Start buttons, per-wheel Tarmac/Rain/Dirt/Snow tire compounds, tire pressure and setup slider rows, and physics grip/wear that reacts to tire choice, road surface, and weather.',
    '2026-07-03 15:03 EDT - Shared desktop layout contracts now normalize desktop submenu/settings surfaces to top-dropdown and validate required/suppressed/presentation surfaces against the centralized EDITOR_SURFACES registry.',
    '2026-07-03 14:52 EDT - Race/Car data now includes 2022 Subaru BRZ and 2022 Honda Civic Si test cars, and race playtest transmission choice is now a runtime pause-menu setting instead of separate manual/automatic car entries.',
    '2026-07-03 14:38 EDT - Shared editor surface ids are now centralized in EDITOR_SURFACES, and the core desktop/landscape/gamepad surface contracts plus mode required/suppressed tables consume that map instead of repeating raw strings.',
    '2026-07-03 14:34 EDT - Shared menu placement and mode-contract defaults are now deeply frozen, while each editor still receives its own cloned placement/contract maps for runtime use.',
    '2026-07-03 14:33 EDT - Shared editor menu placements are now deep-cloned per editor, so future portrait/landscape/desktop/gamepad placement tweaks cannot leak across editors or mutate the shared placement defaults.',
    '2026-07-03 14:30 EDT - Shared menu validation now rejects accidental blank portrait bottom-menu roots unless the section is explicitly registered as a dynamic runtime panel, protecting mobile portrait menus from empty buttons while preserving Level Assets and editor Settings panels.',
    '2026-07-03 14:27 EDT - Pixel/Tile, Level, Actor, MIDI, SFX, Cutscene, and Race renderer paths no longer check right-overlay root drawers in landscape; concrete renderers now use only the shared left-origin root drawer while right drawers stay submenu-only.',
    '2026-07-03 14:24 EDT - Race playtest projection now starts road samples near the camera to keep the road from clipping at the bottom, unpainted race terrain defaults to green grass, and binary D-pad steering now moves about half as fast per frame instead of snapping immediately to full lock.',
    '2026-07-03 14:21 EDT - Shared landscape shell plans now always keep root menu drawers left-origin, coercing stale right-origin requests back to the compact left rail so the right side remains reserved for active submenus.',
    '2026-07-03 14:19 EDT - The editor UI contract no longer describes LeftRail as generic mobile navigation; it now explicitly separates desktop context/inspector use, landscape compact command rail use, and portrait bottom-first navigation.',
    '2026-07-03 14:16 EDT - UISpec now matches the shared desktop drawer owners for Pixel, Actor, MIDI, Cutscene, and Race: display toggles stay in View, duplicate/destructive edits stay in Edit, Cutscene export stays in File, and Race uses Race/Ground/Elevation/Sprites/Settings/Drive instead of stale Road/Surfaces/Weather rows.',
    '2026-07-03 14:13 EDT - UISpec now matches the Tile shared menu contract: Tile Art and Reset Override stay in Edit, while the Tiles drawer owns previous/next tile navigation only.',
    '2026-07-03 14:12 EDT - Race Editor portrait menus now include a Drive tab with Play/Test Drive, restoring a reachable mobile playtest button without crowding the standard four-button bottom rail.',
    '2026-07-03 14:10 EDT - Shared menu validation now explicitly requires portrait Settings placement to stay on the bottom sheet, closing the remaining placement-contract gap between root/submenu rows and settings rows.',
    '2026-07-03 14:08 EDT - Actor desktop DOM dropdown rows now render Edit role-group separators when shared dropdown metadata marks a group start, matching the canvas top-drawer grouping treatment.',
    '2026-07-03 14:06 EDT - Actor desktop DOM ribbon titles now ellipsize like the shared canvas desktop ribbon, keeping the DOM-based editor aligned with the RTG Studio left-ribbon chrome on narrow desktop panels.',
    '2026-07-03 14:02 EDT - Shared desktop context panels now clip title, context rows, and status text through the same RTG Studio label helper used by top-menu chrome, preventing long inspector strings from overflowing differently across editors.',
    '2026-07-03 13:58 EDT - Race Editor top-down map distance overlays now use explicit left/right segment label layout and an adaptive scale bar that picks honest real-world distances instead of relying on clamped pixel widths.',
    '2026-07-03 13:55 EDT - Desktop top-menu root helper coverage now rejects the old hand-built root hit object patterns for Pixel/Tile, Level, MIDI, SFX, and Cutscene so future editor changes stay on createDesktopRootMenuHit().',
    '2026-07-03 13:53 EDT - Actor desktop DOM top-menu root buttons now use applyDesktopRootMenuDataset(), exposing the same root id, command surface, pointer type, activation, and kind metadata as shared canvas top-menu root hits.',
    '2026-07-03 13:51 EDT - Cutscene desktop top-menu root buttons now use createDesktopRootMenuHit() with the existing desktop-root prefix, bringing its canvas root hit path onto the same shared helper as Pixel/Tile, Level, MIDI, SFX, and Race.',
    '2026-07-03 13:48 EDT - Pixel/Tile, Level, and MIDI desktop top-menu root hit targets now also use createDesktopRootMenuHit(), extending shared top-menu metadata normalization across the canvas editors.',
    '2026-07-03 13:44 EDT - SFX and Race desktop top-menu root hit targets now use the shared createDesktopRootMenuHit() helper, starting the same normalization for top-menu roots that dropdown rows already use.',
    '2026-07-03 13:39 EDT - Actor desktop dropdown DOM rows now use the shared applyDesktopDropdownCommandDataset() helper, so DOM and canvas editors share the same command surface, pointer type, release activation, source-root, and Edit role metadata path.',
    '2026-07-03 13:33 EDT - Pixel and Level desktop dropdown hit targets now use the shared createDesktopDropdownCommandHit() helper, removing local command metadata fallbacks and matching MIDI/SFX/Cutscene/Race/Car canvas dropdown behavior.',
    '2026-07-03 13:29 EDT - Shared menu validation now enforces mode interaction contracts for pointer type, gesture scrolling, touch command surfaces, row activation, and gamepad persistent surfaces across every editor.',
    '2026-07-03 13:26 EDT - Shared menu validation now rejects cross-section duplicate command ownership directly, so every editor validates one top/dropdown owner per command instead of relying on a separate audit.',
    '2026-07-03 13:23 EDT - Shared editor menu specs now enforce one command owner per action across every editor; Level Assets no longer duplicates tile/actor/powerup/structure commands and Actor Preview owns only Play Scene.',
    '2026-07-03 13:19 EDT - Actor shared menus now route the compact Tools-style controls through Preview, View owns only Fit View, and stale Actor Tools menu references were removed from the shared spec.',
    '2026-07-03 13:13 EDT - Race Editor top-down map now labels each visible road segment with its length and draws an adaptive corner scale bar, making route scale easier to judge while editing.',
    '2026-07-03 13:09 EDT - Actor shared menus now use one Settings drawer for actor settings, metadata, aggression, and loot rules; the old duplicate Actor section was removed and portrait now targets the same Settings root.',
    '2026-07-03 13:05 EDT - Race Editor portrait thumbstick now behaves like a held virtual thumbstick for map panning: dragging sets knob deflection, update frames pan continuously, and release stops movement.',
    '2026-07-03 13:03 EDT - Race Editor Race menu now exposes direct load rows for WeatherTech Raceway, Nurburgring Nordschleife, Col de Turini, Ouninpohja, and Daytona Tri-Oval, selecting or inserting the built-in template from the Race button.',
    '2026-07-03 12:57 EDT - Built-in Race Editor test tracks now carry clearer reference-basis metadata, modeled road widths, Daytona backstretch banking, and direct aliases for Nordschleife/Nurburgring/Daytona loading.',
    '2026-07-03 12:54 EDT - Pixel desktop Canvas no longer duplicates View display toggles; View owns Grid, Tile Preview, and Onion Skin while Canvas focuses on document/canvas operations.',
    '2026-07-03 12:50 EDT - Cutscene desktop Stage no longer duplicates Master Volume; Stage now owns scene length, fades, and snap/grid while Audio owns volume controls.',
    '2026-07-03 12:46 EDT - Cutscene desktop Audio no longer duplicates Add Music or Add SFX; Add owns new media insertion while Audio focuses on selected audio clip edits and master volume.',
    '2026-07-03 12:43 EDT - Cutscene desktop Timeline no longer duplicates View workspace and zoom commands; Timeline now owns playback/step rows while View owns canvas/split/timeline and zoom controls.',
    '2026-07-03 12:39 EDT - Cutscene desktop Settings no longer duplicates Stage scene/snap/master controls or View workspace switches; Stage and View remain the single owners for those rows.',
    '2026-07-03 12:35 EDT - Actor desktop States no longer duplicates Duplicate State or Delete State; those state edit actions stay in Edit while States focuses on Add State and the state list.',
    '2026-07-03 12:32 EDT - Tile desktop Tiles no longer duplicates Edit Tile Art or Reset Override; those target-edit/destructive commands stay in Edit while Tiles focuses on previous/next tile navigation.',
    '2026-07-03 12:30 EDT - MIDI desktop Settings no longer duplicates Grid Quantize or View Preview/Contrast commands; those controls stay in their owning drawers and tests now keep Settings clear of repeated workflow rows.',
    '2026-07-03 12:26 EDT - SFX desktop Settings no longer duplicates the View Loop command; Loop remains in View, and coverage now keeps the Settings drawer clear of repeated playback rows.',
    '2026-07-03 12:22 EDT - Race desktop Drive is now the single shared drawer owner for Test Drive; the Race authoring drawer stays focused on route and terrain-editing commands.',
    '2026-07-03 12:19 EDT - Race shared menu specs no longer keep stale Road/Surfaces/Scenery/Weather sections after the authoring model moved to Race/Ground/Elevation/Sprites/Settings, and validation now rejects unreachable sections.',
    '2026-07-03 12:13 EDT - Level desktop Playtest is now consolidated under the Playtest drawer; File stays document-focused and View stays zoom-focused instead of duplicating Start Playtest.',
    '2026-07-03 12:08 EDT - Shared menu validation now rejects File-scoped document actions in non-File drawers, preventing save/export/exit commands from reappearing in editor-specific desktop dropdowns.',
    '2026-07-03 12:04 EDT - Cutscene desktop no longer exposes a separate Export top-level drawer; MP4 export stays under File so save/export behavior has one desktop home.',
    '2026-07-03 11:59 EDT - Cutscene desktop left panel no longer duplicates Add drawer commands; Add stays in the top dropdown while the left panel focuses on document, selection, transport, and status context.',
    '2026-07-03 11:52 EDT - Race Editor desktop, landscape, and gamepad root menus now use the same authoring model as portrait: Race, Ground, Elevation, Sprites, Settings, and Drive instead of the older Road/Surfaces/Weather split.',
    '2026-07-03 11:48 EDT - Built-in Race Editor test tracks now include structured reference facts for length, surface, elevation, signature sections, snow transitions, and Daytona banking so the templates stay anchored to real-world notes.',
    '2026-07-03 11:45 EDT - Shared menu specs now centralize gamepad placement and render surface names, making the slide-out alias explicit while keeping renderer contracts on left-slide-out-drawer.',
    '2026-07-03 11:40 EDT - Pixel and Level gamepad menu-state helpers now pass a normalized Boolean gamepadConnected value into the shared resolver, matching the other editor shells.',
    '2026-07-03 11:37 EDT - Level layout bounds now uses its centralized getGamepadMenuState() helper instead of a bad-signature direct resolveGamepadMenuState() call, keeping gamepad slide-out rail reservation consistent during layout.',
    '2026-07-03 11:34 EDT - Pixel, Level, Actor, MIDI, SFX, and Cutscene now feed the shared viewport resolver from deviceIsMobile or isMobile, matching Race/Car so mobile, landscape, and gamepad mode selection is consistent across editors.',
    '2026-07-03 11:31 EDT - Pixel and Level runtime layout paths now use the canonical landscape-touch viewport mode instead of the stale landscape alias, tightening shared landscape rail and thumbstick behavior.',
    '2026-07-03 11:27 EDT - Race and Car gamepad menus now keep root and submenu state mutually exclusive, so Menu opens only the left root rail, selecting a root replaces it with the slide-out submenu, and B returns cleanly to the root rail.',
    '2026-07-03 11:23 EDT - Race data now ships five built-in real-world-inspired test tracks: WeatherTech Raceway Laguna Seca, Nurburgring Nordschleife, Col de Turini with asphalt-to-snow transition, Ouninpohja gravel, and Daytona Tri-Oval.',
    '2026-07-03 11:14 EDT - Level top playtest visibility and SFX imports no longer depend on raw mobile portrait/landscape helpers; remaining editor code outside uiSuite now routes mode decisions through shared viewport contracts.',
    '2026-07-03 11:11 EDT - Pixel and Tile mobile layout planning now falls back through the shared viewport-mode resolver instead of raw portrait/landscape helper checks, keeping standalone layout helpers aligned with the same desktop, portrait, landscape, and gamepad contract as the editor shell.',
    '2026-07-03 11:07 EDT - MIDI File drawer coverage now locks sticky Exit behavior to activeViewportMode and rejects raw portrait/landscape layout helper drift, protecting desktop File drawers on touch-capable devices.',
    '2026-07-03 11:01 EDT - Race playtest scale now uses real 10-foot highway dashes with 30-foot gaps, side terrain banding is tied to physical road distance instead of exaggerated visual travel, the visible steering wheel maps from full 540-degree lock at rest down to roughly 20 degrees at 100 mph, and the Race editor panel shows total road length in kilometers.',
    '2026-07-03 10:56 EDT - Level Editor landscape zoom and thumbstick rail setup now uses the concrete shared shell-plan visibility helper, then draws from the computed rail bounds, so its bottom zoom rail follows the same shell decision path as the other migrated editors.',
    '2026-07-03 10:54 EDT - The embedded Tile Editor inside Pixel Studio now gates landscape and gamepad rails, root drawers, right submenus, and bottom tool rails through the shared concrete shell-plan visibility helper instead of reading raw shell surfaces or generic mode visibility directly.',
    '2026-07-03 10:50 EDT - Cutscene, Level, and Actor landscape rendering now use the shared concrete shell-plan visibility helper for left root rails, root drawers, right submenus, and bottom tool rails, extending the SFX/MIDI/Race/Car migration and reducing another set of per-editor landscape/gamepad branches.',
    '2026-07-03 10:43 EDT - Race Editor and Car Editor landscape rendering now use the shared concrete shell-plan visibility helper for bottom rail, right submenu, and root drawer surfaces, matching the SFX and MIDI migration away from local gamepad/right-rail gates.',
    '2026-07-03 10:41 EDT - MIDI landscape now uses the shared concrete shell-plan visibility helper for right drawer, root drawer, and bottom rail decisions, matching the SFX plan-surface gate and reducing another local landscape/gamepad branch.',
    '2026-07-03 10:38 EDT - Shared render gating now has getEditorPlanSurfaceVisibility/canRenderEditorPlanSurface helpers, and SFX landscape uses the concrete shell plan visibility for right drawer, root drawer, and bottom rail decisions instead of rechecking local gamepad booleans.',
    '2026-07-03 10:33 EDT - Landscape touch shell plans now expose effectiveSurfaceVisibility in addition to the canonical mode surfaceVisibility, so editors can tell when a concrete landscape helper instance intentionally omitted the right submenu rail or moved the root drawer without misreading the generic landscape contract.',
    '2026-07-03 10:30 EDT - Race Editor default authoring data now starts with exactly one locked Start tile instead of a prebuilt loop, while existing route-editing and playtest paths keep their generated/seeded geometry fallbacks for drag, terrain, and runtime coverage.',
    '2026-07-03 10:24 EDT - UISpec and shared menu validation now lock in the Race Editor route-authoring contract: portrait uses File/Race/Ground/Elevation/Sprites/Settings, route type is inferred from endpoint connection, and explicit Circuit/Destination menu toggles are rejected from the shared Race menu spec.',
    '2026-07-03 10:18 EDT - Race Editor portrait now has File, Race, Ground, Elevation, Sprites, and Settings on the bottom menu; the portrait thumbstick pans the map, a zoom slider controls map scale, File exposes New/Save/Save As, and route type is inferred from snapping the final destination node to the locked starting tile.',
    '2026-07-03 09:57 EDT - Portrait editor action rails now use one shared STANDARD_EDITOR_ACTION_RAIL_PREFIX/getStandardEditorActionRailIds contract, so Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car all keep Menu, Undo, Redo, and one contextual action in the same bottom-rail order instead of copying per-editor arrays.',
    '2026-07-03 09:53 EDT - Race Editor portrait authoring now uses the standard bottom rail with the shared thumbstick plus Menu, Undo, Redo, and a contextual mode action, while a compact portrait panel exposes Race, Ground, and Elevation modes for node/edge editing, terrain painting, and height brushing.',
    '2026-07-03 08:58 EDT - Landscape touch shell surfaces now come from LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT, centralizing the fixed left compact command rail, left-origin root drawer, right submenu drawer, bottom tool/options role, suppressed desktop surfaces, and compact-rail action metadata used by shared landscape plans.',
    '2026-07-03 08:53 EDT - Desktop File drawer consistency now uses explicit DESKTOP_FILE_BASELINE_ACTION_IDS and DESKTOP_FILE_FOOTER_ACTION_ID constants, with shared menu validation and dropdown-plan tests enforcing the same New/Save/Open/Export/Import baseline and final Exit to Main Menu footer across every editor.',
    '2026-07-03 08:50 EDT - Desktop dropdown open/close state and slide-down timing are now centralized through DESKTOP_DROPDOWN_STATE_CONTRACT, so every editor has one shared source for openedAtMs preservation, start-closed behavior, click-away closed-root persistence, and drawer motion defaults.',
    '2026-07-03 08:48 EDT - Race playtest steering now uses an explicit controller-style steering profile: D-pad and keyboard steering behave as full left/right stick deflection with a much faster virtual-wheel response, analog sticks keep their own response curve, and high-speed damping stays in the tire-angle/yaw authority layer instead of making the wheel feel sluggish.',
    '2026-07-03 08:43 EDT - Desktop dropdown command rows are now centralized through DESKTOP_DROPDOWN_COMMAND_CONTRACT, so shared hit records and dropdown render-plan rows carry the same top-dropdown command surface, mouse pointer type, release activation, item kind, and desktop-dropdown membership metadata.',
    '2026-07-03 08:39 EDT - Desktop shell surfaces are now centralized through DESKTOP_SHELL_SURFACE_CONTRACT, so command surfaces, persistent top/left/work surfaces, suppressed mobile surfaces, left-panel role metadata, and desktopMobileRailsHidden all come from one shared desktop app-shell contract.',
    '2026-07-03 08:34 EDT - Gamepad slide-out behavior is now centralized through GAMEPAD_SLIDE_OUT_MENU_CONTRACT, so root rail surfaces, submenu surfaces, controls, row activation, source surfaces, and suppressed touch surfaces all come from one shared contract across editor layout plans and controller menu rows.',
    '2026-07-03 08:27 EDT - Landscape touch compact left-rail behavior is now fully constant-backed: shared plans, UISpec, the editor UI contract, and cross-editor tests use COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT and COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH for the fixed Menu/Undo/Redo/context action rail instead of repeating raw values.',
    '2026-07-03 08:22 EDT - Portrait editor root-menu sizing is now centralized through PORTRAIT_ROOT_MAX_ITEMS, with UISpec, the editor UI contract, shared menu validation, and cross-editor portrait tests all enforcing the same eight-item bottom-rail limit so new editors consolidate overflow into submenus instead of expanding mobile roots.',
    '2026-07-03 08:16 EDT - UISpec and the editor UI contract now explicitly document the desktop File/Edit separation: File stays on document actions, Edit owns history and clipboard actions, and Edit drawer role groups follow the shared history, clipboard, selection, duplicate, targetEdit, and destructive order across every editor.',
    '2026-07-03 08:13 EDT - Race playtest D-pad and keyboard steering now ramp the virtual wheel much faster toward full-stick lock while leaving high-speed damping in the tire/yaw authority layer, so held digital input behaves like a controller stick pushed fully left or right and released input recenters predictably.',
    '2026-07-03 08:09 EDT - Shared menu spec validation now rejects stale root label override keys unless they target a real root menu or runtime alias, keeping desktop, landscape, and gamepad menu labels tied to the canonical shared roots.',
    '2026-07-03 08:06 EDT - Shared menu spec validation now rejects Undo/Redo history commands in desktop File drawers as well as clipboard actions, keeping File document-focused and Edit responsible for history and clipboard workflows across every editor.',
    '2026-07-03 08:02 EDT - Shared menu spec validation now blocks desktop-only Edit and View roots from portrait bottom menus, keeping portrait roots focused on compact workflow categories while Undo/Redo stay on the bottom action rail.',
    '2026-07-03 07:58 EDT - Shared editor menu specs now enforce desktop Edit role-group order after Undo/Redo, and MIDI Edit now groups Copy/Cut/Paste before Select All so every desktop Edit drawer follows the same history, clipboard, selection, target, and destructive command flow.',
    '2026-07-03 07:54 EDT - MIDI, SFX, and Cutscene desktop dropdowns now consume empty shared drawer-region clicks before editor work-surface handling, matching Pixel/Tile and Level so fitted top-menu panels do not fall through to grid, waveform, or timeline controls.',
    '2026-07-03 07:51 EDT - Actor desktop dropdown rows now use the same pointer-down/pointer-up release activation helpers as the canvas editors, suppressing command activation after drag movement instead of relying on DOM onclick.',
    '2026-07-03 07:48 EDT - Pixel/Tile and Level desktop dropdowns now register the shared animated drawer region and consume empty drawer clicks as UI, preventing fitted top-menu panels from falling through to canvas/editor controls while keeping row commands on release activation.',
    '2026-07-03 07:41 EDT - Shared desktop dropdown chrome now exposes its animated scroll/drag region through drawSharedDesktopDropdown, and MIDI, SFX, Cutscene, and Race/Car register those regions through their existing menuScrollRegions models so drawer gesture geometry matches the drawn slide-down panel.',
    '2026-07-03 07:34 EDT - Shared desktop dropdown render plans now always expose a drag-safe menu region, even when the drawer contents fit without scrolling, so desktop menu taps and drag gestures use the same release/suppression behavior across editors.',
    '2026-07-03 07:30 EDT - Race playtest steering now treats D-pad and keyboard steering as a full virtual analog-stick target while removing an extra stacked high-speed steering cap, so the visible wheel still moves quickly and the car gets a stronger but speed-limited tire angle at highway speeds.',
    '2026-07-03 07:26 EDT - Shared editor menu validation now rejects clipboard actions in File drawers, enforcing the desktop IA rule that File stays document-focused and clipboard/history commands live in Edit.',
    '2026-07-03 07:24 EDT - Pixel desktop File menu metadata now drops stale copy-image and paste-image actions from the canonical shared spec, keeping File to the shared document baseline while Edit remains the single clipboard command area.',
    '2026-07-03 07:21 EDT - MIDI landscape drawing now uses the resolved viewport mode for landscape branching instead of raw width > height geometry, keeping touch landscape and desktop behavior tied to the shared editor mode contract.',
    '2026-07-03 07:19 EDT - Pixel, MIDI, and Actor gamepad slide-out renderers now consume the shared plan focused row fallback, matching Level, SFX, and Cutscene so every editor shows controller focus from the same gamepad menu contract.',
    '2026-07-03 07:15 EDT - Race playtest steering now keeps D-pad and analog input responsive like a fully deflected controller stick while using a separate speed-sensitive front-tire steering angle, giving the car stronger parking/low-speed lock and a still-damped but usable high-speed turn response.',
    '2026-07-03 07:11 EDT - Level, SFX, and Cutscene gamepad slide-out row renderers now fall back to the shared plan focused row, so the default submenu focus ring from the shared gamepad contract is visible in those editors.',
    '2026-07-03 07:07 EDT - Shared gamepad slide-out menu plans now default submenu focus to the first enabled row when no focused item is supplied, so every editor shows a visible controller focus ring as soon as a submenu opens.',
    '2026-07-03 07:02 EDT - Race and Car gamepad slide-out menus now track and forward focused row state into the shared button chrome, bringing their controller menu focus rendering in line with the other editors.',
    '2026-07-03 06:58 EDT - Level top playtest button visibility now accepts the resolved viewport mode from layout/draw paths, keeping desktop and landscape chrome decisions tied to the shared mode contract instead of recomputing portrait state from raw dimensions.',
    '2026-07-03 06:55 EDT - Pixel mobile layout planning now accepts the already-resolved viewport mode from the renderer, so portrait, landscape, and gamepad shell decisions follow the shared editor mode contract instead of re-inferring orientation from raw dimensions during live drawing.',
    '2026-07-03 06:52 EDT - Pixel panel routing now uses activeViewportMode for portrait-only File, Canvas, Layers, and Frames behavior, so touch-capable desktop sessions keep desktop panel controls instead of inheriting portrait subpanels or sticky mobile File exit chrome.',
    '2026-07-03 06:48 EDT - MIDI portrait layout, touch thumbstick placement, and bottom action rail rendering now use activeViewportMode === portrait instead of raw portrait geometry checks, preventing touch-capable desktop sessions from inheriting portrait rail/thumbstick layout.',
    '2026-07-03 06:45 EDT - Race playtest D-pad steering now snaps the virtual wheel to full left/right immediately like a fully held analog stick, while the physics layer keeps a higher speed-sensitive steering authority floor so high-speed steering feels responsive without removing damping.',
    '2026-07-03 06:41 EDT - Level File drawer sticky Exit behavior now uses activeViewportMode === landscape instead of recalculating landscape from raw dimensions, keeping File drawer layout tied to the resolved editor mode.',
    '2026-07-03 06:39 EDT - Level pointer thumbstick suppression now uses activeViewportMode === landscape instead of recomputing mobile landscape from raw canvas dimensions, keeping Level touch controls tied to the shared mode contract.',
    '2026-07-03 06:37 EDT - SFX portrait draw routing now uses the resolved isMobilePortrait flag from resolveSfxViewportMode(), removing a duplicate raw portrait-layout check from the main draw path.',
    '2026-07-03 06:35 EDT - Actor desktop dropdown actions now route through the canonical shared actor menu section ordering, preventing the DOM editor from drifting away from the same File/Edit/View/States spec used by the other editors.',
    '2026-07-03 06:30 EDT - Pixel mobile drawer and clone-tool instruction paths now use activeViewportMode/isTouchViewportMode instead of raw mobile detection, keeping desktop drawers and desktop clone prompts from drifting on touch-capable hardware.',
    '2026-07-03 06:27 EDT - MIDI note placement snapping now uses activeViewportMode instead of raw isMobileLayout(), so touch-capable desktop sessions keep desktop round-to-nearest grid behavior while portrait, landscape, and gamepad keep touch-friendly floor snapping.',
    '2026-07-03 06:22 EDT - Race playtest steering now treats held D-pad as full analog-stick deflection with a faster virtual wheel response, while high-speed damping remains in the tire/yaw authority layer so the wheel feels responsive without turning like an arcade car.',
    '2026-07-03 06:19 EDT - MIDI settings-click routing and note resize handle sizing now use activeViewportMode, preventing desktop sessions on touch devices from inheriting portrait workspace hit behavior or phone-sized note handles.',
    '2026-07-03 06:16 EDT - MIDI Settings panel stacking and instrument-picker modal sizing now use activeViewportMode for portrait versus desktop behavior, preventing touch-capable desktops from getting phone-shaped modals.',
    '2026-07-03 06:13 EDT - MIDI File drawer rendering now uses activeViewportMode for desktop versus touch drawer width, sticky Exit behavior, and row sizing, keeping desktop File as a desktop drawer on touch-capable machines.',
    '2026-07-03 06:10 EDT - MIDI Song selection menus, split/shift tools, and automation handles now size from activeViewportMode, keeping desktop Song editing overlays on desktop geometry even on touch-capable devices.',
    '2026-07-03 06:08 EDT - MIDI shared button and toggle primitives now derive desktop versus touch typography from activeViewportMode, preventing touch-capable desktop sessions from inheriting mobile button label sizing.',
    '2026-07-03 06:05 EDT - Pixel and Tile controller menu state now uses resolvePixelViewportMode() before calling the shared gamepad menu helper, keeping desktop, touch landscape, portrait, and controller slide-out behavior tied to one viewport contract.',
    '2026-07-03 06:03 EDT - Level Editor minimap, top playtest button, enemy info, and tooltip draw paths now use activeViewportMode for desktop versus touch behavior, matching the shared layout contract instead of raw device mobile state.',
    '2026-07-03 06:01 EDT - MIDI transport, instrument, and track-list panels now use activeViewportMode for desktop versus touch density, removing more raw mobile-state paths that could make desktop render like a mobile layout.',
    '2026-07-03 05:57 EDT - Race playtest D-pad/keyboard steering now snaps the virtual steering wheel toward full stick lock much faster, while keeping speed-based tire authority in physics so high-speed steering remains damped.',
    '2026-07-03 05:53 EDT - MIDI tab bar and top sequencer bar now use activeViewportMode for desktop versus touch sizing, reducing another raw mobile-state path that could make desktop render like mobile.',
    '2026-07-03 05:50 EDT - MIDI mixer rows now use activeViewportMode for desktop versus touch density, aligning the mixer with the recent grid and song-tab mode-resolution cleanup.',
    '2026-07-03 05:48 EDT - MIDI Song tab now derives touch versus desktop timeline sizing from activeViewportMode, matching the grid-control cleanup and preventing raw mobile state from changing desktop song-lane density.',
    '2026-07-03 05:44 EDT - MIDI grid controls now size desktop versus touch rows from activeViewportMode instead of raw isMobileLayout(), keeping touch-capable desktop sessions on desktop control density.',
    '2026-07-03 05:42 EDT - Pixel mobile toolbar portrait branching now uses the resolved activeViewportMode instead of re-deriving portrait from raw device mobile state, preventing touch-capable desktop sessions from inheriting portrait rail behavior.',
    '2026-07-03 05:38 EDT - Pixel File no longer duplicates Copy/Paste rows; clipboard commands now stay in the Edit drawer, and the all-editor File builder guard rejects history and common clipboard command drift.',
    '2026-07-03 05:35 EDT - Shared File menus now stop carrying Undo/Redo in their baseline or per-editor File configs; history commands remain in Edit drawers, and all-editor coverage now rejects File-history drift across Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car.',
    '2026-07-03 05:27 EDT - Race/Car desktop playtest HUD controls now use the same release-activation path as desktop drawer commands, preventing immediate pointer-down actions from changing screens before mouse release.',
    '2026-07-03 05:25 EDT - Race playtest steering now treats D-pad/keyboard and full analog stick as full virtual wheel input, while applying speed-sensitive steering authority in the physics layer so the wheel responds quickly without removing high-speed turn damping.',
    '2026-07-03 05:18 EDT - Race/Car File menu coverage now verifies both editors use the same shared File drawer ordering, keep unsupported scaffold actions disabled, and preserve Exit to Main Menu as the final shared footer row.',
    '2026-07-03 05:17 EDT - Broad editor UI coverage now requires Pixel/Tile, Level, Actor, MIDI, SFX, Cutscene, and Race/Car to keep viewport mode resolution centralized in one local helper per editor shell, preventing scattered direct resolveEditorViewportModeFlags calls from returning.',
    '2026-07-03 05:16 EDT - Level Editor now centralizes desktop, portrait, landscape, and gamepad mode resolution in resolveLevelViewportMode(), routing layout bounds, HUD mode, and gamepad slide-out state through the same resolved isMobileViewport contract.',
    '2026-07-03 05:15 EDT - Pixel and Tile mode resolution now flows through resolvePixelViewportMode() for main draw, Tile Picker, and zoom-to-fit sizing, reducing repeated raw resolver calls while preserving Tile-specific menu contracts.',
    '2026-07-03 05:14 EDT - Race Editor and Car Editor now centralize desktop, portrait, landscape, and gamepad mode resolution in resolveRaceViewportMode(), and gamepad slide-out state uses the resolved isMobileViewport flag instead of reconstructing mobile state separately.',
    '2026-07-03 05:13 EDT - SFX Editor now resolves viewport mode through a dedicated resolveSfxViewportMode() helper and feeds gamepad slide-out state from the resolved isMobileViewport flag, aligning SFX with the shared MIDI/Cutscene/Actor mode resolver pattern.',
    '2026-07-03 05:12 EDT - Pixel bone action drawer cleanup and Level panel navigation/tooltips now use activeViewportMode-aware desktop versus touch gates, preventing touch-capable desktop sessions from inheriting mobile drawer cleanup, mobile panel extras, or suppressing desktop hover tooltip behavior.',
    '2026-07-03 05:11 EDT - Level Editor drawer opening, File menu reset/close, touch thumbstick panning, haptics, precision zoom, and context ribbon drawing now use activeViewportMode/shared surface gates instead of raw isMobileLayout(), keeping touch-capable desktop sessions on desktop behavior while preserving portrait and landscape touch workflows.',
    '2026-07-03 05:10 EDT - MIDI pedal-board desktop overview now uses activeViewportMode === desktop instead of raw isMobileLayout(), so touch-capable desktop sessions keep the full inline pedal settings overview while portrait, landscape, embedded, and compact views keep their existing mobile-friendly panels.',
    '2026-07-03 05:09 EDT - Race D-pad and keyboard steering now treat held left/right as full analog stick deflection: the speed-limited steering target is applied immediately, the visible wheel catches up faster, and release-to-center remains quick so binary controls feel responsive without removing high-speed steering limits.',
    '2026-07-03 05:05 EDT - MIDI record mode now dispatches desktop versus touch layouts through resolveMidiViewportMode(), keeping touch-capable desktop sessions on the desktop shell and using resolved mobile-landscape mode for the Now Playing preview placement instead of raw isMobileLayout().',
    '2026-07-03 05:00 EDT - Pixel Editor drawer reset, file-menu close, palette return-to-canvas, eraser return-to-canvas, and desktop selection context-menu checks now use the resolved activeViewportMode touch-vs-desktop helper instead of raw isMobileLayout(), keeping touch-capable desktop sessions on desktop menu behavior.',
    '2026-07-03 04:56 EDT - Level Editor trigger, Tile Art/pixel, and MIDI overlay panels now size and position from activeViewportMode !== desktop instead of raw isMobileLayout(), so desktop sessions on touch-capable devices keep desktop-style panel placement while portrait/landscape touch modes keep touch-friendly placement.',
    '2026-07-03 04:51 EDT - Actor collision editing now gates its DOM thumbstick through the shared touch-thumbstick surface contract as well as pointer policy, preventing desktop or controller modes from inheriting mobile collision panning chrome while preserving touch workflows.',
    '2026-07-03 04:46 EDT - Race D-pad and keyboard steering now behave like full left/right stick deflection with speed-sensitive authority instead of near-zero high-speed input; analog steering keeps the same speed cap, yaw damping retains a safer high-speed floor, and Pixel/Tile zoom-to-fit now uses the shared resolved viewport mode so desktop fit sizing does not reserve mobile rails on touch-capable devices.',
    '2026-07-03 04:37 EDT - Race playtest pass widened first-person and third-person projected roads, strengthened braking, further damped high-speed steering and camera sweep, made route closure inference road-width aware, changed visible route labels to endpoint geometry, reduced the minimap player marker into a compact directional car glyph, and made pavement/dirt tire-slide SFX trigger earlier with a rougher dirt scrape profile.',
    '2026-07-03 04:29 EDT - MIDI destructive action buttons now use shared RTG Studio danger chrome and UI_SUITE typography instead of hard-coded red fills and Courier text, keeping pedal/track Delete and Remove actions visually aligned with the editor theme.',
    '2026-07-03 04:26 EDT - Race Editor and Car Editor gamepad landscape now hide the compact touch rail whenever the controller root or submenu slide-out is open, so controller menus replace the left rail instead of leaving Menu/Undo/Redo/Play or Generate hit targets active underneath.',
    '2026-07-03 04:24 EDT - Tile Editor gamepad mode now suppresses the touch landscape bottom tool rail and lets the controller slide-out replace the left compact rail while menus are open, matching the shared gamepad contract instead of layering touch landscape chrome underneath.',
    '2026-07-03 04:21 EDT - Tile Editor portrait now uses the shared bottom action rail inside PixelStudio: Menu opens the Tile controller menu, Undo/Redo use runtime history, and the primary Art action enters active tile art editing instead of drawing a one-off Back button in the mobile middle rail.',
    '2026-07-03 04:16 EDT - Race playtest now infers circuit versus point-to-point from connected route endpoints through one helper, starts from authored node geometry facing the first real route vector, widens the projected road again, strengthens braking, lowers tire-screech activation for pavement and dirt slides, damps high-speed steering further, and renders the minimap marker as a clearer car-shaped directional glyph with wheel marks.',
    '2026-07-03 04:14 EDT - Cutscene Editor now gates desktop dropdown item hits and desktop menu panel interception behind activeViewportMode === desktop, preventing stale desktop drawer bounds from stealing touch or gamepad input in portrait, landscape, or controller modes.',
    '2026-07-03 04:12 EDT - MIDI Editor tab, File, and Settings pointer routing now chooses desktop dropdown drawers from activeViewportMode === desktop instead of raw isMobileLayout(), preserving desktop app-style menus on touch-capable devices while leaving portrait/landscape tabs on the mobile rail flow.',
    '2026-07-03 04:09 EDT - Pixel and Tile mobile drawer opening plus palette-bar drag scrolling now use activeViewportMode instead of raw isMobileLayout(), keeping desktop panel/tab changes from opening mobile drawers or touch palette scroll paths on touch-capable desktop sessions.',
    '2026-07-03 04:08 EDT - Level Editor wheel scrolling, hover bounds, gamepad hint bars, landscape bottom zoom rail, and thumbstick cleanup now key off activeViewportMode/shared surface gates instead of raw isMobileLayout(), keeping desktop app chrome from inheriting mobile rail behavior on touch-capable devices.',
    '2026-07-03 04:04 EDT - Race playtest now keeps route wrapping tied to inferred connected endpoints during runtime, removes suspension-pull steering bias from free-driving tests, widens the projected road again, strengthens braking, damps high-speed binary steering further, keeps the compact Pause/Return/Main HUD instead of the older large overlay panel, and preserves pavement/dirt tire-screech material cues.',
    '2026-07-03 03:57 EDT - Pixel and Tile pointer handling now keeps mobile drawer interception and thumbstick move updates behind activeViewportMode/shared touch-thumbstick gates, preventing stale mobile drawer or joystick state from affecting desktop pointer behavior on touch-capable devices.',
    '2026-07-03 03:55 EDT - Level Editor pointer down/move/up now derive touch-only menu, drawer, thumbstick, zoom, long-press, and editor-area guards from activeViewportMode instead of raw isMobileLayout(), keeping desktop pointer behavior desktop even on touch-capable devices while preserving portrait, landscape, and gamepad touch-mode handling.',
    '2026-07-03 03:53 EDT - Cutscene Editor thumbstick timeline panning now checks the shared active touch-thumbstick surface before applying update-time pan, matching desktop thumbstick cleanup and preventing suppressed mobile controls from continuing to move the timeline.',
    '2026-07-03 03:51 EDT - MIDI Editor joystick panning now checks the shared active touch-thumbstick surface before applying update-time pan, matching its draw-time thumbstick reset path and preventing stale mobile landscape pan behavior from surviving into desktop or controller modes.',
    '2026-07-03 03:49 EDT - Pixel and Tile touch pan/zoom helpers now rely on the shared active surface contract before allowing thumbstick panning or mobile zoom chrome, so desktop mode clears stale touch controls even when the device reports mobile/touch capability.',
    '2026-07-03 03:47 EDT - Level Editor updateLayoutBounds now resolves the shared level viewport mode before assigning editor, drawer, thumbstick, zoom-slider, and playtest-button bounds, reducing raw isMobileLayout drift that could leave desktop or gamepad using stale mobile landscape geometry.',
    '2026-07-03 03:44 EDT - Race playtest now launch-locks the car and camera to the first route vector for the first frames, clears initial lateral/view drift, widens the rendered road scale again, further lowers high-speed yaw response, and uses the active playtest route type when drawing start/finish checker stripes.',
    '2026-07-03 03:37 EDT - Pixel, Race, and SFX desktop top-menu hover switching now explicitly requires the resolved desktop viewport mode before opening or switching slide-down drawers, closing another raw isMobileLayout gap in shared desktop menu behavior while leaving mobile portrait, landscape, and gamepad menu flow untouched.',
    '2026-07-03 03:33 EDT - MIDI, SFX, and Cutscene desktop pointer handling now uses activeViewportMode === desktop for dropdown click-away, dropdown hit detection, hover drawer switching, and SFX pointer-policy selection, reducing raw isMobileLayout drift in the remaining desktop menu paths while preserving mobile portrait/landscape behavior.',
    '2026-07-03 03:25 EDT - Race playtest now advances route progress from the car heading and speed instead of nearest-route snapping, keeps nearest-route projection as a secondary HUD cue, widens the rendered road again, strengthens braking, damps high-speed steering further, guards Race/Car desktop pointer behavior through activeViewportMode, and keeps the playtest minimap/top escape controls in place for quick Return/Main Menu exits.',
    '2026-07-03 03:19 EDT - Pixel and Level pointer handlers now use activeViewportMode === desktop for desktop dropdown close/release handling and Pixel desktop canvas pan policy, tying these high-traffic pointer paths to the same shared mode selected by the renderer instead of raw isMobileLayout() checks.',
    '2026-07-03 03:16 EDT - MIDI Editor now routes landscape grid/thumbstick mode checks, gamepad menu state, draw viewport resolution, and desktop grid pointer pan policy through resolveMidiViewportMode()/activeViewportMode instead of reconstructing desktop versus mobile state from raw isMobileLayout() checks.',
    '2026-07-03 03:14 EDT - Cutscene Editor now stores the current viewport size and routes gamepad state, layout computation, and pointer interaction policy through resolveCutsceneViewportMode(), keeping desktop mouse behavior and gamepad/touch chrome tied to the same mode used for rendering.',
    '2026-07-03 03:11 EDT - Actor Editor now centralizes viewport size and shared mode resolution through getViewportSize() and resolveActorViewportMode(), removing scattered direct window width/height checks from reset, render, collision, gamepad, sidebar, and rail-button layout decisions.',
    '2026-07-03 03:07 EDT - SFX Editor timeline pan updates now also honor canRenderEditorSurface(activeViewportMode, touch-thumbstick), preventing hidden or suppressed mobile thumbstick state from continuing to scroll the timeline after switching into desktop or gamepad modes.',
    '2026-07-03 03:05 EDT - SFX Editor thumbstick rendering is now guarded inside drawMobilePanJoystick() itself, so stale mobile portrait/landscape flags cannot draw touch thumbstick chrome when the shared mode surface contract suppresses touch-thumbstick.',
    '2026-07-03 02:59 EDT - Race playtest now starts directly on the first route node facing the inferred first segment, keeps the checker stripe ahead of the car, uses a clearer directional minimap car marker, strengthens braking, widens the default road scale without making lanes absurdly broad, and further damps high-speed steering while keeping full stopped steering lock.',
    '2026-07-03 02:57 EDT - SFX Editor controller hint bars now use canRenderEditorSurface(viewportMode.mode, gamepad-hint-bar) in both portrait and landscape paths, finishing the SFX mobile/gamepad chrome guard alongside its already-guarded rails and thumbstick surfaces.',
    '2026-07-03 02:54 EDT - Race Editor and Car Editor now gate portrait action rails, landscape bottom tool options, and controller hint bars through canRenderEditorSurface(), keeping their shared Race/Car shell aligned with the same mode surface contract used by Pixel, Level, Actor, MIDI, SFX, and Cutscene.',
    '2026-07-03 02:51 EDT - Actor Editor now stores the shared resolved viewport mode and gates its landscape bottom tool rail plus controller hint bar through canRenderEditorSurface(), so controller slide-out mode can suppress touch landscape chrome while desktop remains on the app-style top-menu shell.',
    '2026-07-03 02:48 EDT - Pixel Editor now stores the shared resolved viewport mode in its main draw path and gates portrait action rail rendering, mobile zoom rail hit targets, touch thumbstick rendering/capture, tile picker thumbstick chrome, and controller hint bars through canRenderEditorSurface(), reducing stale mobile chrome and hidden touch captures in desktop/gamepad modes.',
    '2026-07-03 02:44 EDT - Level Editor now stores the shared resolved viewport mode and gates its portrait action rail, landscape zoom/tool rail, touch thumbstick rendering/hit testing, and controller hint bar through canRenderEditorSurface(), bringing Level desktop/gamepad chrome closer to the same shared surface contract already used by MIDI, SFX, and Cutscene.',
    '2026-07-03 02:38 EDT - Race playtest now keeps the car fully free-moving while projecting its world position back onto the route only for HUD progress, co-driver cues, and finish detection; open tracks only finish at the endpoint instead of looping, the minimap car marker is larger and directional, braking is stronger, roads render wider, tire slide audio triggers earlier on pavement and dirt, and high-speed steering is damped further.',
    '2026-07-03 02:32 EDT - MIDI Editor now stores the shared resolved viewport mode and gates mobile bottom rails, touch thumbstick rendering/capture, and controller hint bars through canRenderEditorSurface(), keeping desktop and gamepad modes aligned with the shared editor surface contract.',
    '2026-07-03 02:28 EDT - Cutscene Editor now stores the shared resolved viewport mode and gates its non-desktop action rail plus controller hint bar through canRenderEditorSurface(), so gamepad slide-out mode suppresses touch bottom rail chrome instead of drawing the landscape rail underneath.',
    '2026-07-03 02:25 EDT - SFX Editor now stores the shared resolved viewport mode and gates its portrait bottom action rail, landscape bottom tool rail, and touch thumbstick rendering/hit testing through canRenderEditorSurface(), preventing desktop or controller modes from inheriting mobile chrome through local SFX booleans.',
    '2026-07-03 02:21 EDT - Race playtest now spawns slightly behind the start line while facing the first real route vector, keeps Pause/Return/Main HUD controls clickable across modes, widens the road projection again, strengthens braking, lowers tire-slide audio thresholds for pavement and dirt, and further reduces high-speed steering sensitivity while preserving full stopped steering lock.',
    '2026-07-03 02:16 EDT - Shared editor layout now exposes getEditorSurfaceVisibility() and canRenderEditorSurface() so renderers can block suppressed chrome such as desktop bottom rails, touch thumbsticks, landscape drawers, and gamepad slide-outs through one mode contract instead of local booleans.',
    '2026-07-03 02:14 EDT - Shared desktop mode contracts now use the same left-context-panel surface name as the desktop shell and renderer helpers, with validation rejecting older left-panel context surfaces so every editor targets the same persistent desktop inspector area.',
    '2026-07-03 02:11 EDT - Shared portrait menu contracts now keep settings with the same bottom-sheet command surface as other submenus, and the UI spec/contract docs reserve top portrait regions for persistent context or status instead of ordinary settings command menus.',
    '2026-07-03 02:05 EDT - Race playtest tuning now starts the car on the first route pose facing the inferred route direction, keeps the start checker stripe ahead of the player, widens the projected road, strengthens braking, further damps high-speed steering response, and enlarges the minimap car marker with a clearer heading arrow while preserving inferred loop versus point-to-point routing.',
    '2026-07-03 01:59 EDT - Shared desktop layout plans now expose a leftContextPanelContract across every editor, making the desktop left inspector explicitly contextual while keeping drawer commands in top dropdowns and allowing only contextual quick actions, status, transport, and summaries in the persistent left panel.',
    '2026-07-03 01:54 EDT - Race playtest tuning pass widened the drivable road scale again, starts farther behind the line based on road width, strengthened braking, further damped high-speed binary/analog steering, enlarged the directional minimap car marker, and added regression coverage for top playtest escape controls and minimap heading rendering.',
    '2026-07-03 01:51 EDT - Shared desktop dropdown rows now carry commandSurface, pointerType, rowActivation, and sourceRootId metadata for every drawer, with Actor DOM rows and the older Pixel/Level canvas hit paths preserving those shared desktop command semantics.',
    '2026-07-03 01:48 EDT - Pixel and Level desktop dropdown hit records now preserve the same shared Edit action role and role-group metadata as the newer canvas editors, so role-grouped Edit drawers keep consistent hit/debug metadata across all main canvas editors.',
    '2026-07-03 01:45 EDT - Shared desktop Edit drawers now mark role group boundaries in the dropdown render plan, canvas dropdowns draw subtle separators at those group starts, and Actor DOM dropdown rows expose matching role-group hooks without adding extra hit-target rows.',
    '2026-07-03 01:43 EDT - Desktop dropdown render plans now attach shared Edit action role metadata to Edit drawer rows and command hit targets, and Actor DOM dropdown rows expose matching sourceRootId/editActionRole/desktopActionRole datasets so canvas and DOM editors can render grouped Edit menus consistently.',
    '2026-07-03 01:40 EDT - Shared editor menu specs now assign semantic roles to every desktop Edit action across Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, Car, and Tile, and validation rejects new Edit commands that do not declare a shared role such as history, clipboard, selection, duplicate, destructive, or targetEdit.',
    '2026-07-03 01:36 EDT - Race playtest now starts farther behind a wider default road while preserving first-route heading, keeps top Pause/Return/Main controls available during playtest, strengthens braking, lowers tire-screech trigger thresholds, widens the projected road, and further damps high-speed steering for binary and analog inputs.',
    '2026-07-03 01:33 EDT - Gamepad slide-out plans now expose an explicit focusRingContract in addition to row-level focused/focusRing flags, documenting and testing that every editor shows visible focus rings on controller-focused root and submenu rows with A-button confirm activation.',
    '2026-07-03 01:31 EDT - Shared gamepad slide-out menu plans now annotate every root and submenu row with controller activation, surface, focused, and focusRing metadata, giving all editors a common source for visible focus rings and A-button row behavior.',
    '2026-07-03 01:28 EDT - Race playtest now starts from the first actual road vector, infers circuit versus point-to-point from connected endpoints, widens the rendered road, strengthens braking, damps high-speed steering while preserving full stopped lock, labels the top Main Menu escape control clearly, and makes the minimap car marker read as a directional car shape; shared editor work-surface metadata now lives in the canonical menu specs instead of a duplicate layout map.',
    '2026-07-03 01:17 EDT - Shared layout validation now checks every canonical editor has an explicit supported work-surface type, protecting desktop pointer behavior like wheel zoom, drag pan, and context-menu handling from silently falling back to canvas defaults.',
    '2026-07-03 01:14 EDT - Shared pointer policy now derives continuous pan and right-drag fallback pan from the canonical shared editor id list, and UISpec now names Tile Editor in the top-level standardization scope alongside the other editors.',
    '2026-07-03 01:12 EDT - Portrait/source model coverage now uses the canonical shared editor id list for landscape shell defaults and desktop shared-shell checks, so Race, Car, and Tile remain covered with the older editors in those cross-editor assertions.',
    '2026-07-03 01:10 EDT - Shared layout contract tests now consume the canonical shared editor id list and include Tile Editor in the desktop dropdown source coverage, keeping Tile in the same desktop top-menu/dropdown guardrails as the other editors.',
    '2026-07-03 01:08 EDT - Shared editor menu specs now expose one canonical all-editor id list and validate against it, so Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, Car, and Tile stay inside the same desktop/portrait/landscape/gamepad contract checks instead of depending on per-test editor lists.',
    '2026-07-03 01:04 EDT - Race playtest tuning pass: launch now starts farther behind the checker stripe while facing the first route direction, loop inference only treats actually connected endpoints as circuits, roads render wider, high-speed steering is more damped, braking is stronger, tire screech triggers earlier on pavement/dirt slides, and the minimap car marker now shows a stronger forward direction.',
    '2026-07-03 01:01 EDT - Tile Editor gamepad cancel/back behavior now matches the shared controller menu contract: B backs from submenu to root first, then closes the Tile slide-out drawer on the next cancel.',
    '2026-07-03 00:58 EDT - Tile Editor gamepad mode now uses the shared left slide-out menu plan: Menu opens root categories on the left, choosing a root replaces it with that submenu on the left, and the touch landscape right drawer is suppressed for controller use.',
    '2026-07-03 00:52 EDT - Race playtest now uses connected endpoint geometry as the source of truth for loop versus point-to-point routing, closes the default Studio Sprint route data, fixes forward launch direction math, uses compact Pause/Return/Main playtest HUD controls in the projected-road renderer, widens the road view, strengthens braking, and further damps high-speed steering.',
    '2026-07-03 00:45 EDT - Tile Editor mobile landscape now uses the shared compact left rail, left-origin root drawer, right submenu drawer, and bottom context rail instead of the old generic full-screen list/back-button layout.',
    '2026-07-03 00:42 EDT - Tile Editor render entry now resolves and retains the shared Tile viewport mode contract/spec mode contract before branching into desktop or mobile layout, so desktop, portrait, landscape, and gamepad decisions no longer depend on Tile-only local viewport checks.',
    '2026-07-03 00:39 EDT - UISpec now names Tile Editor as a first-class shared-shell editor with File/Edit/View/Tiles/Properties roots, and the Race Editor spec now documents inferred closed-loop versus point-to-point routing instead of stale manual circuit/destination menu rows.',
    '2026-07-03 00:37 EDT - Tile Editor is now part of the shared editor UI contract: its desktop shell uses tile-specific File/Edit/View/Tiles/Properties top menus and dropdown drawers instead of borrowing Pixel Editor drawing/layer roots, while shared layout and pointer-policy coverage now treats Tile as a first-class editor.',
    '2026-07-03 00:32 EDT - Race playtest now infers circuit versus point-to-point behavior from route closure, starts facing the first route direction, exposes Pause/Return/Main controls during playtest, uses a directional minimap car marker, widens the projected road, increases braking, damps high-speed steering, and plays pavement/dirt tire screech audio on traction loss.',
    '2026-07-03 00:16 EDT - Shared compact landscape rail actions now carry slot and surface metadata, locking Menu, Undo, Redo, and quick-action buttons to the fixed left rail instead of letting renderers treat them like scrollable menu drawer rows.',
    '2026-07-03 00:16 EDT - Shared editor menu validation now requires Exit to Main Menu to remain the final File command/footer in every editor, keeping desktop File drawers predictable across Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car.',
    '2026-07-03 00:11 EDT - Race playtest now has regression coverage that verifies the car spawns behind the starting line, faces the first route direction, and moves forward along that route heading on launch.',
    '2026-07-03 00:09 EDT - Desktop pointer-policy coverage now distinguishes right-click context-menu editors from audio editors that use right-click as a pan fallback, while keeping browser-menu suppression and desktop thumbstick hiding consistent across all editors.',
    '2026-07-03 00:06 EDT - Shared menu spec validation now directly enforces gamepad placement: roots stay on the left slide rail, submenus/settings use the left slide-out drawer, and command rows require confirm-button activation.',
    '2026-07-03 00:04 EDT - Shared menu spec validation now directly enforces landscape touch placement: root menus stay on the left rail, submenus/settings stay on the right drawer, and persistent tool/context space stays on the bottom rail.',
    '2026-07-03 00:02 EDT - Shared menu spec validation now directly rejects portrait root or submenu placements that drift away from bottom-rail and bottom-sheet, keeping portrait editors bottom-first across future changes.',
    '2026-07-03 00:00 EDT - Shared menu spec validation now rejects desktop Settings placements that point at the left panel, locking Settings commands to dropdown drawers while preserving left panels for persistent context.',
    '2026-07-02 23:58 EDT - Desktop settings placement now resolves to the same top dropdown drawer surface as other desktop commands, while the left panel remains a persistent context inspector instead of a settings command menu.',
    '2026-07-02 23:55 EDT - Race Editor and Car Editor File drawers now use the same shared editor File menu builder as the older editors, preserving the New/Save/Save As/Open/Export/Import baseline and Exit to Main Menu row with unsupported rows disabled.',
    '2026-07-02 23:53 EDT - Race playtest no longer snaps or auto-aligns the car back to the route while driving: the car now owns a free world position and heading, starts facing the race direction, and destination finishes return directly to the editor.',
    '2026-07-02 23:48 EDT - Level Editor desktop left inspector now includes compact Assets quick switches for Tiles, Actors, Powerups, and Structures, keeping frequent asset context reachable without replacing the shared top dropdown drawers.',
    '2026-07-02 23:44 EDT - Tile Editor desktop mode now uses the shared Pixel desktop app shell with horizontal top menus, dropdown drawers, left ribbon/context inspector, and a work-surface tile list instead of the old standalone picker layout.',
    '2026-07-02 23:40 EDT - Race playtest now uses fixed start and finish checker stripes for point-to-point races, a wider first/third-person road projection, world-path yaw for steering alignment, a sampled-route minimap, and an unlabeled top-down damage diagram with inward-facing suspension markers.',
    '2026-07-02 23:40 EDT - MIDI desktop grid controls now move track-level instrument, note/chord, and bars controls into the left Track Tools panel, leaving the desktop grid header focused on keyframes while preserving the mobile control strip.',
    '2026-07-02 23:30 EDT - Cutscene desktop left context panel now exposes Add quick actions, while Clips stays clip-specific and no longer duplicates Edit clipboard/delete commands at runtime.',
    '2026-07-02 23:27 EDT - Shared menu IA cleanup moved Pixel clipboard actions out of Select, split SFX View from Timeline transport, and removed duplicate Cutscene clipboard rows from Clips so common edit actions live in Edit.',
    '2026-07-02 23:24 EDT - Pixel desktop Draw, Select, Tools, Layers, Frames, and Rigging dropdowns now stay open after command release, so choosing tools such as Draw -> Oval no longer collapses the drawer while exploring tool palettes.',
    '2026-07-02 23:22 EDT - Race playtest scale now targets roughly one car per lane, uses short world-sized highway lane markers, and makes synthesized engine RPM/rev-limit audio more audible while preserving Car Editor engine profile overrides.',
    '2026-07-02 23:18 EDT - Shared editor mode contracts now expose a surfaceVisibility map across generic, desktop, landscape, and gamepad shell plans, making required/suppressed chrome queryable from one contract object.',
    '2026-07-02 23:14 EDT - Actor desktop DOM dropdown rows now expose the same command-surface, pointer-type, and release-activation metadata as the shared desktop menu contract.',
    '2026-07-02 23:10 EDT - Editor render entry points now retain both renderer mode contracts and menu spec mode contracts, so desktop/portrait/landscape/gamepad decisions can be audited against the same shared UI rules.',
    '2026-07-02 23:05 EDT - Shared editor menu specs now carry per-mode contracts that align root/submenu/settings placements with renderer presentation and interaction semantics across desktop, portrait, landscape, and gamepad.',
    '2026-07-02 23:02 EDT - Shared menu gesture handling now treats fitting drawers and action lists as drag-safe regions, so touch/landscape/gamepad menu drags can suppress accidental taps even when no scrolling is needed.',
    '2026-07-02 22:56 EDT - Race playtest now uses tighter car-to-lane scale, world-distance road markers that advance toward the car, live RPM-based engine rev audio, and Car Editor engine sound profile data/actions.',
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
    '2026-07-02 14:59 EDT - Race physics now uses 2022 Subaru WRX-style car data and drivetrain simulation: runtime manual 6MT and automatic SPT transmission modes, AWD, 271 hp, 258 lb-ft, realistic mass, redline/rev limiter, gear ratios, shift delays, rain/snow grip multipliers, day/night race metadata, roughly 5-6 second 0-60, and about 135 mph top speed.',
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
    date: '2026-07-11',
    time: '11:54 EDT',
    title: 'Race playtest uses deterministic 3D wheel contact physics',
    details: [
      'Added a focused RaceVehiclePhysics module with fixed substeps, body x/y/z velocity, yaw/pitch/roll angular state, sprung mass, and four wheel suspension/contact records.',
      'Each wheel now transforms its local attachment point into world space, samples the canonical race surface for elevation, normal, region, material, and friction, and feeds spring/damper compression plus tire slip/load data back into the playtest session.',
      'Spawn and route-center reset rebuild the 3D body state above the canonical surface, while the camera and tire effects anchor to the physical body/contact state.',
      'The car remains rendered as the existing 2D billboard/procedural sprite; the billboard does not define physics dimensions or collisions.',
      'Added deterministic tests for uphill/downhill following, pitch, roll, contact loss and landing, road/apron/shoulder friction boundaries, and identical-input replay.'
    ]
  },
  {
    date: '2026-07-11',
    time: '11:24 EDT',
    title: 'Race editor surface preview shares playtest geometry',
    details: [
      'Added race editor debug preview controls for canonical surface bands, seams, normals, elevation labels, wheel contacts, validation counters, and an optional 3D preview.',
      'The top-down race editor now derives road, margin, shoulder, and transition outlines from canonical cross-sections instead of treating editor stroke widths as the authoritative corridor.',
      'Editor preview bakes now share the same surface geometry revision as playtest world bakes and invalidate when terrain or surface geometry changes.',
      'Added unit coverage for shared preview/playtest revisions plus a browser regression that renders a synthetic ridge-crossing road from the canonical surface bake.'
    ]
  },
  {
    date: '2026-07-11',
    time: '10:57 EDT',
    title: 'Race material bands use one classifier',
    details: [
      'RaceSurfaceModel now exposes the shared lateral classifier for road, margin, shoulder, transition, and terrain with canonical material, friction, normal, and elevation outputs.',
      'Wheel surface/contact state now preserves margin and shoulder regions instead of flattening apron back to road or reclassifying shoulder independently.',
      'Shoulder meshes now use local adjacent terrain material/art and the same world-space UV scale convention used by terrain.',
      'Tire FX now treats apron as paved margin and shoulder/transition/terrain as loose-surface regions from the same canonical classification.',
      'Added tests covering all margin/shoulder enabled combinations plus apron wheel classification, shoulder terrain material, deck-level shoulder geometry, and transition start boundaries.'
    ]
  },
  {
    date: '2026-07-11',
    time: '10:48 EDT',
    title: 'Race terrain clips to the canonical corridor',
    details: [
      'Replaced whole-terrain-quad road-corridor skipping in the world bake with triangle splitting against the canonical transition-outer corridor.',
      'Terrain triangles that cross the corridor now calculate seam intersections, snap those intersections to RaceSurfaceModel transition vertices, and triangulate only the retained exterior polygons.',
      'WebGL terrain upload now accepts retained triangle polygons instead of assuming every terrain cell is a four-point quad.',
      'Added focused coverage for corridor-interior removal, non-degenerate retained triangles, seam vertices, and existing roadside seam behavior.'
    ]
  },
  {
    date: '2026-07-11',
    time: '10:40 EDT',
    title: 'Race surface model is canonical',
    details: [
      'Added src/racing/RaceSurfaceModel.js as the shared source for raw terrain samples, road-deck samples, cross-section boundaries, track-region samples, and world-surface projection.',
      'RaceEditor road corridor, stitched terrain, cross-section, wheel-surface, wheel-contact, decal, and scenery grounding queries now delegate through that model so rendering and physics use the same road/margin/shoulder/transition order.',
      'Reworked the roadbed builder to use a robust centerline terrain sample instead of the maximum terrain height across the full corridor, so one-sided hills no longer lift the whole road deck.',
      'Added a surface geometry revision key covering path, route type, road width, margin/shoulder modes and widths, transition width, route length, and terrain revision.',
      'Added focused unit coverage for canonical region order, cache key invalidation, one-sided hill deck support, and renderer-vs-wheel-contact elevation agreement.'
    ]
  },
  {
    date: '2026-07-11',
    time: '08:38 EDT',
    title: 'Race terrain holes are exposed and covered',
    details: [
      'Restored magenta as the default WebGL Track uncovered background so missing sky, terrain, or road geometry remains visible while testing.',
      'Expanded the Studio Sprint world terrain bake with wider route samples and raised the visible terrain budget so camera-visible chunks are not missing or dropped.',
      'Added route-sampled unit coverage that verifies Studio Sprint forward and reverse frames have baked visible chunks and no sampled terrain budget drops.'
    ]
  },
  {
    date: '2026-07-11',
    time: '07:42 EDT',
    title: 'Superseded race terrain diagnostic pass',
    details: [
      'This pass tried making the WebGL Track magenta underlay diagnostic-only, but that behavior was superseded by the 08:38 update so magenta remains the default uncovered-background sentinel.',
      'Updated baked terrain visibility to scan all visible cells before budget selection, preventing later road-adjacent terrain from being skipped just because earlier cells filled the budget.',
      'Added focused unit coverage for the visibility-budget scan that keeps later, better terrain cells eligible.'
    ]
  },
  {
    date: '2026-07-11',
    time: '01:06 EDT',
    title: 'Race magenta test now drives both directions',
    details: [
      'Expanded the Studio Sprint Playwright magenta diagnostic from five fixed frames into dense forward and backward route sampling.',
      'The test now fails on any visible magenta pixel anywhere on the rendered canvas, while preserving black-void and skybox diagnostics.',
      'Diagnostic screenshots are only carried back for failing frames so passing runs do not spend time moving hundreds of canvas images.'
    ]
  },
  {
    date: '2026-07-11',
    time: '00:56 EDT',
    title: 'Race terrain bake is static during playtest frames',
    details: [
      'Fixed Race WebGL Track prewarm so it bakes terrain with the same coarse chunk size used by the renderer, preventing playtest frames from falling back to dynamic terrain generation.',
      'Changed baked terrain visibility to reuse the original baked cell objects, so cached WebGL terrain vertices and UVs persist across frames instead of being attached to throwaway wrappers.',
      'Added a Studio Sprint shoulder-to-shoulder weave regression at 30 MPH with no damage, and kept the terrain+texture WebGL Track FPS benchmark above 45 FPS.'
    ]
  },
  {
    date: '2026-07-11',
    time: '00:20 EDT',
    title: 'Race magenta coverage is now a real frame test',
    details: [
      'Changed the Race Editor magenta diagnostic so the app canvas gets a magenta underlay before the skybox, while WebGL and Three world canvases clear transparent again.',
      'Added a Playwright Studio Sprint regression that renders deterministic race frames, scans the real canvas pixels for bright magenta, and fails with the worst frame label and screenshot artifact when terrain or road holes are visible.',
      'Removed the temporary source-level magenta failure from the unit suite so unit tests keep covering geometry/contact behavior and browser tests cover final rendered pixels.'
    ]
  },
  {
    date: '2026-07-11',
    time: '00:02 EDT',
    title: 'Superseded race magenta diagnostic step',
    details: [
      'Reverted the race playtest viewport-wide magenta sentinel so the handheld shell and playtest screen no longer hide what the renderer is doing.',
      'This was immediately refined by the 00:20 update: magenta now sits behind the skybox/world composite instead of being the WebGL or Three clear color.',
      'The old passing coverage assertion was replaced with a browser pixel diagnostic that fails only when rendered Studio Sprint frames actually expose magenta.'
    ]
  },
  {
    date: '2026-07-10',
    time: '23:51 EDT',
    title: 'Race shoulder-edge tests and magenta sentinel',
    details: [
      'Added Studio Sprint 30 MPH finish regressions for both shoulder edges, placing the outer wheel pair one meter inside the configured shoulder edge and asserting no panel, suspension, engine, transmission, rollover, or off-road damage.',
      'Race playtest fallback clears now use a magenta sentinel color so uncovered rendering gaps are obvious during testing.',
      'Added render coverage assertions for center, road-edge, and shoulder-edge driving frames so completed race frames must cover the magenta sentinel with sky, terrain, or WebGL output.'
    ]
  },
  {
    date: '2026-07-10',
    time: '23:30 EDT',
    title: 'Race edge-run and terrain cliff validation',
    details: [
      'Roadside terrain now stays at road deck height for the first 0.5m outside the visible road, margin, or shoulder edge before blending back into the painted heightmap over roughly 4m.',
      'The roadside mesh is split into a flat terrain join plus a sloped terrain transition so rendering matches the stitched contact height instead of creating a cliff at the road edge.',
      'Added Studio Sprint 30 MPH finish regressions for left-edge and right-edge driving where only one wheel pair remains on the road, with no suspension, panel, engine, transmission, or rollover damage.'
    ]
  },
  {
    date: '2026-07-10',
    time: '23:08 EDT',
    title: 'Race collision and Studio Sprint validation',
    details: [
      'Studio Sprint now normalizes away legacy hazards on load and ships with no hazards in the built-in race data, so a failed centered finish points at road/collision math instead of hidden obstacles.',
      'Hidden shoulder width now remains available to the collision system while the visual seam still joins terrain to the visible road or margin edge.',
      'Added regressions for 40 MPH centerline completion, curve projection precision, hidden shoulder collision, static baked terrain meshes during playtest rendering, and the 45 FPS WebGL Track terrain+texture benchmark.'
    ]
  },
  {
    date: '2026-07-10',
    time: '22:22 EDT',
    title: 'Race terrain seam and Studio Sprint no-damage test',
    details: [
      'Race terrain blend width now depends on visible shoulder state, keeping margin-off and hidden-shoulder terrain joins tight to the road instead of drawing a broad extra strip.',
      'The seam regression now verifies off, margin-only, visible-shoulder, and hidden states join terrain to the correct outer visible edge.',
      'Added a Studio Sprint centerline simulation that finishes the race at 30 MPH while asserting all wheel contact stays on road and the car takes no panel, engine, transmission, suspension, or rollover damage.'
    ]
  },
  {
    date: '2026-07-10',
    time: '19:00 EDT',
    title: 'Race stable road mesh sections',
    details: [
      'Race WebGL Track road, shoulder, boundary, marker, and paint meshes now share stable world-space route-distance sections instead of changing with camera-adaptive Mode 7 depth bands.',
      'Road cross-sections now compute one final deck height from terrain support at the center, edges, and shoulders before being marked as road-deck geometry, reducing road/terrain intersections.',
      'Regression coverage now verifies stable road section world vertices across camera movement and aligned section anchors for road, shoulder, and boundary geometry.'
    ]
  },
  {
    date: '2026-07-10',
    time: '13:23 EDT',
    title: 'Race road corridor stamping',
    details: [
      'Race road placement now uses a corridor-first roadbed: asphalt, margins, and shoulders share a smoothed centerline deck instead of lifting to the highest side-terrain sample.',
      'Terrain inside the road, margin, and shoulder corridor is stamped to the roadbed before blending back to the painted heightmap, reducing road/terrain intersections and floating shelves.',
      'Route projection sampling is tighter through curves, and regression coverage now checks that high painted edge terrain is stamped to the road corridor without forcing ugly road steps.'
    ]
  },
  {
    date: '2026-07-10',
    time: '11:52 EDT',
    title: 'Race road terrain smoothing and suspension contact',
    details: [
      'Race terrain now keeps a raw height sampler for diagnostics while normal rendering and physics use smoothed painted terrain heights instead of hard cell steps.',
      'Road deck elevation now comes from a shared road surface profile so road rendering, terrain stitching, and hill-grade force agree on the same height.',
      'Race playtest now samples per-wheel contact heights for suspension travel, pitch, roll, and bottom-out damage instead of relying only on centerline gravity.'
    ]
  },
  {
    date: '2026-07-10',
    time: '02:57 EDT',
    title: 'Race WebGL Track resolution performance fix',
    details: [
      'Race WebGL Track resolution now uses percentage semantics: 32 means 32% scale, 100 means native scale, and 400 means 4x instead of treating 32 as a literal 32x framebuffer.',
      'Race texture diagnostics now show the actual WebGL Track render-target size in the FPS/poly readout so oversized buffers are visible immediately.',
      'The Race Texture resolution slider now displays percent values directly, matching the corrected render-target behavior.'
    ]
  },
  {
    date: '2026-07-10',
    time: '02:24 EDT',
    title: 'Race Three render workload diagnostics',
    details: [
      'Race WebGL Track now defaults back to the Three.js heightmap renderer instead of requiring a debug opt-in.',
      'The race texture diagnostics add Track and Overlays switches, and Track Off now skips mode-7 slice generation, mesh building, terrain baking, decals, sprites, particles, weather, and marker overlays for a true render-disabled FPS baseline.',
      'Terrain and texture setup now runs only when those systems are enabled, reducing hidden CPU work when testing renderer performance.'
    ]
  },
  {
    date: '2026-07-10',
    time: '01:58 EDT',
    title: 'Race WebGL terrain default restored',
    details: [
      'Terrain On now uses the native WebGL Track terrain path by default; Three.js is available only through a dedicated debug toggle.',
      'Road, shoulder, margin, and paint meshes in the native WebGL path now resample stitched terrain before projection so the road rises and falls with the heightmap.',
      'This targets the 250 polygon / 5 draw / 20 FPS case where Three canvas rendering was still too expensive despite low geometry counts.'
    ]
  },
  {
    date: '2026-07-10',
    time: '01:40 EDT',
    title: 'Race Three draw-call reduction',
    details: [
      'Three.js race meshes now batch by texture and lift instead of color, so sun/terrain tinting no longer splits Studio Sprint into dozens of draw calls.',
      'Default Terrain On budget is lower again, keeping nearby road-corridor terrain prioritized while cutting background polygons.',
      'This specifically targets the 2k polygon / 27 draw / 15 FPS failure case reported in Studio Sprint.'
    ]
  },
  {
    date: '2026-07-10',
    time: '01:26 EDT',
    title: 'Race Three terrain and road performance',
    details: [
      'Three.js race terrain now uses a stronger elevation scale so painted hills read higher in the new renderer.',
      'Road, shoulder, margin, and paint vertices now sample the same stitched terrain height before their small visual lift, keeping the road on top of the heightmap.',
      'Successful Three.js frames now skip native WebGL Track setup, and Three materials are reused instead of recreated every frame.'
    ]
  },
  {
    date: '2026-07-09',
    time: '23:35 EDT',
    title: 'Race WebGL Track draw distance and terrain budget',
    details: [
      'Terrain Off is expected to show the native WebGL Track road and respond to Resolution; Terrain On is the Three.js heightmap scene when Three can render it.',
      'Studio Sprint and other circuit races now look farther ahead instead of being capped to roughly one lap of road distance.',
      'Three.js road, shoulder, margin, furniture, and paint layers now have explicit render ordering above terrain, with a lower normal terrain-cell budget to reduce unnecessary polygons.'
    ]
  },
  {
    date: '2026-07-09',
    time: '22:58 EDT',
    title: 'Race WebGL Track performance and FOV',
    details: [
      'Terrain Off now stays on the native WebGL Track fast path instead of building a Three.js scene every frame.',
      'Terrain On still uses the unified Three.js road-on-heightmap scene, but margins and boundaries now render above the road instead of disappearing under it.',
      'Three.js playtest FOV is narrowed to 48 degrees in third person and 58 degrees in first person so the race view feels less like flying down the track.'
    ]
  },
  {
    date: '2026-07-09',
    time: '22:36 EDT',
    title: 'Unified Three race road and terrain',
    details: [
      'Race WebGL Track now sends terrain, shoulders, roads, margins, lane paint, start/finish checkers, and quarter-mile posts through one Three.js world scene.',
      'Race terrain and road height now use the same meter scale as physics, with tiny explicit surface lifts so road geometry sits on top of the heightmap instead of floating in the sky.',
      'The old native WebGL terrain and mesh batches remain as fallback if the Three renderer cannot build the scene.'
    ]
  },
  {
    date: '2026-07-09',
    time: '22:08 EDT',
    title: 'Race Three.js terrain renderer',
    details: [
      'WebGL Track terrain now renders through a locally vendored Three.js world renderer.',
      'Race ground uses Three BufferGeometry, CanvasTexture, and camera projection so nearby project-art terrain stays attached to heightmap polygons.',
      'The custom native terrain shader remains fallback only; roads, markers, cars, sprites, tire FX, and HUD stay on their existing paths for this pass.'
    ]
  },
  {
    date: '2026-07-09',
    time: '21:31 EDT',
    title: 'Race world-space heightmap terrain',
    details: [
      'WebGL Track terrain now uses a dedicated world-space heightmap mesh shader instead of CPU-projected screen triangles.',
      'Terrain vertices, elevation, and UVs are sent as stable world mesh data; camera projection now happens in the terrain shader uniforms.',
      'Roads, shoulders, margins, markers, checkers, cars, sprites, and tire FX remain on the existing WebGL Track path for this pass.'
    ]
  },
  {
    date: '2026-07-09',
    time: '21:23 EDT',
    title: 'Race close terrain texture stability',
    details: [
      'WebGL Track still renders project-art terrain as real 3D heightmap mesh geometry.',
      'Mesh shaders now use high precision texture-coordinate interpolation so close terrain UVs do not quantize on mobile/WebGL hardware.',
      'Textured mesh UVs are normalized around tile-aligned local origins, keeping textures world-anchored while avoiding huge absolute UV values at tiny texture scales.'
    ]
  },
  {
    date: '2026-07-09',
    time: '21:08 EDT',
    title: 'Race WebGL terrain mesh restored',
    details: [
      'WebGL Track no longer replaces textured terrain geometry with the screen-space stable texture layer.',
      'Project-art ground in WebGL Track is back on the real 3D heightmap terrain mesh path so road, shoulders, and terrain share the same projected world.',
      'Added regression coverage that fails if WebGL Track skips textured terrain mesh polygons again.'
    ]
  },
  {
    date: '2026-07-09',
    time: '20:04 EDT',
    title: 'Race terrain LOD camera stability',
    details: [
      'Textured WebGL terrain subdivision now comes from road proximity and elevation variance instead of current camera distance.',
      'Close road-adjacent Studio Sprint terrain keeps compatible detail as the camera moves instead of dropping LOD mid-turn.',
      'Added a slow-camera Studio Sprint bend regression that verifies one baked terrain subquad keeps identical world vertices and decoded UVs across small camera/yaw changes.'
    ]
  },
  {
    date: '2026-07-09',
    time: '19:10 EDT',
    title: 'Race near-plane UV stability',
    details: [
      'Near-plane clipping now routes through a single world-space intersection helper for terrain, road, and WebGL mesh projection paths.',
      'Added a Studio Sprint bend regression that checks textured terrain UVs through raw, normal, and screen-clipped optimization paths.',
      'The regression also verifies the terrain source quad is not mutated while the camera projects or clips it near a tight turn.'
    ]
  },
  {
    date: '2026-07-09',
    time: '18:51 EDT',
    title: 'Race terrain UV clipping stability',
    details: [
      'WebGL terrain clipping now interpolates clipped screen-edge vertices with perspective-correct world coordinates instead of linearly warping near-camera polygons.',
      'Textured terrain UVs stay anchored to the same world-space polygon as the camera moves, including when a polygon is clipped by the visible screen area.',
      'Added focused Race Editor regression tests for fixed terrain UVs across camera movement and perspective-correct clipped terrain intersections.'
    ]
  },
  {
    date: '2026-07-09',
    time: '17:42 EDT',
    title: 'Race UVs, tire temperature, and Tire FX',
    details: [
      'Textured WebGL Track meshes now triangulate clipped polygons without generated centroid UVs, keeping texture coordinates fixed to world-space polygons near the camera.',
      'Per-wheel tire temperature now affects grip, with strong overheating/cold-tire penalties while normal ambient tires remain close to documented stock performance.',
      'Race Editor Settings now includes Tire FX with per-race project-art overrides for smoke, asphalt skids, dirt dust, grass dust, snow dust, and wet spray.'
    ]
  },
  {
    date: '2026-07-09',
    time: '17:17 EDT',
    title: 'Race startup camera stabilization removed',
    details: [
      'Race playtest startup no longer creates a launch projection hold or distance-based projection blend.',
      'The third-person chase camera now renders directly behind the live car pose from the first driving frame.',
      'Race editor regression tests now assert that no launch projection state is present during startup rendering.'
    ]
  },
  {
    date: '2026-07-09',
    time: '17:00 EDT',
    title: 'Race reset fade holds black',
    details: [
      'Reset-to-center edge collisions now fade all the way to black before moving the car back to the route center.',
      'The screen stays fully black for 250ms before fading back in.',
      'The car keeps its speed during the reset flow instead of stopping immediately when the fade begins.'
    ]
  },
  {
    date: '2026-07-09',
    time: '16:54 EDT',
    title: 'Race launch follow camera restored',
    details: [
      'Launch rendering now uses route-centered camera position but live car yaw, keeping the camera behind the car as it turns at startup.',
      'Yaw is no longer blended from the held launch yaw; only pitch/FOV/projection stay stabilized during the startup projection hold.',
      'Updated regression coverage so simulated joystick launch verifies both no lateral drift and live follow-camera yaw.'
    ]
  },
  {
    date: '2026-07-09',
    time: '16:42 EDT',
    title: 'Race launch render camera centered',
    details: [
      'Launch rendering now places the camera from the route centerline while the startup projection hold is active, instead of using live car lateral position.',
      'Fixed zero-coordinate fallback in the launch render camera path so tracks starting at x=0 do not fall back to an offset car position.',
      'Extended regression coverage to force a live car offset during simulated joystick launch and verify the rendered camera stays centered.'
    ]
  },
  {
    date: '2026-07-09',
    time: '16:35 EDT',
    title: 'Race startup D-pad camera hold',
    details: [
      'Simulated D-pad steering now keeps the launch camera view centered while the start projection is held or blending out.',
      'The steering wheel and vehicle physics still respond during the launch, but road-view offset does not sweep left/right until the launch projection finishes.',
      'Added regression coverage for simulated gamepad steering during the startup projection blend.'
    ]
  },
  {
    date: '2026-07-09',
    time: '16:15 EDT',
    title: 'Race launch strafe and reset fade',
    details: [
      'Held left-thumbstick input is now detected but ignored for steering while the car is staged behind the starting line at launch speed, keeping camera yaw, lateral offset, and road-view offset centered.',
      'Normal left-thumbstick steering resumes after launch release so physical gamepad steering still works during active driving.',
      'Reset-to-center edge collision now fades out first, recenters the car at the blackout midpoint, then fades back in instead of visibly snapping to the road center.'
    ]
  },
  {
    date: '2026-07-09',
    time: '16:05 EDT',
    title: 'Race look-around requires gamepad',
    details: [
      'Race look-around now ignores simulated/mobile control input and stale look angle unless a physical gamepad is connected.',
      'Right thumbstick remains the only look-around control path, and it still hides the third-person car while looking away.',
      'Added regression coverage for connected right-stick look-around and disconnected simulated-axis suppression.'
    ]
  },
  {
    date: '2026-07-09',
    time: '15:54 EDT',
    title: 'Race edge collision settings split out',
    details: [
      'Race margin settings now store margin and shoulder display separately as On, Hidden, or Off.',
      'Collision selection is now independent, with edge choices for road, margin, or shoulder and effects for physical collision or reset-to-center fade.',
      'Hidden margin and shoulder widths stay active for geometry and collision math while their visual strips are suppressed.'
    ]
  },
  {
    date: '2026-07-09',
    time: '10:51 EDT',
    title: 'Third-person race camera height',
    details: [
      'Raised the third-person race camera eye height while leaving first-person unchanged.',
      'Third-person car rendering now anchors vertically from a compensated road-contact projection so the car remains in the same chase-view band and stays visually grounded on the road.',
      'Added regression coverage for the higher third-person camera and the road-contact car anchor.'
    ]
  },
  {
    date: '2026-07-09',
    time: '09:15 EDT',
    title: 'Car Editor preview and live fields',
    details: [
      'Car Editor now draws a live layered vehicle preview using geometric fallback tires/body plus authored shell, tire, spoiler, and turn-frame project art when assigned.',
      'Removed placeholder Car Editor menu rows such as layer clipboard/delete, preview toggles, and unused tire/spoiler view controls while preserving the shared File/Edit/View desktop contract.',
      'Car Editor top-menu power, weight, grip, brake, final drive, differential, aero, spring, damping, and antiroll rows now update selected car data instead of acting as no-op status buttons.'
    ]
  },
  {
    date: '2026-07-09',
    time: '00:32 EDT',
    title: 'Race projection and stock car loading',
    details: [
      'Race playtest now uses stable car travel as the render origin in third-person instead of re-projecting the chase camera onto the route, so road decorations should stop shifting relative to the track.',
      'Quarter-mile/edge markers now render as projected apron/margin strips using the same road cross-section projection as the track.',
      'Car Editor File now exposes direct Load WRX, Load BRZ, and Load Civic actions backed by editable project-file car documents.',
      'Reverse steering physics now uses signed reverse speed in the yaw model, and tests cover the tire/steering path.'
    ]
  },
  {
    date: '2026-07-08',
    time: '11:59 EDT',
    title: 'Race texture dialog cleanup',
    details: [
      'Fixed the Race Texture Lighting, Terrain, and Textures diagnostic buttons so tapping them actually toggles the draft setting.',
      'Removed explanatory helper copy from the Texture Scale dialog and kept only the compact 32px scale readout.'
    ]
  },
  {
    date: '2026-07-08',
    time: '11:53 EDT',
    title: 'Race texture render diagnostics',
    details: [
      'Added Lighting, Terrain, and Textures toggles to Race Editor Settings > Texture Scale so WebGL Track performance can be isolated without changing race physics.',
      'WebGL Track now respects those toggles by skipping terrain mesh generation, flattening lighting, or rendering solid green terrain polygons instead of project-art texture sampling.',
      'The Texture Scale starting-line preview now prints its own FPS, render time, polygon, draw-call, and terrain-cell counters inside the preview window.'
    ]
  },
  {
    date: '2026-07-08',
    time: '11:45 EDT',
    title: 'Race WebGL playtest performance pass',
    details: [
      'Changed the Race WebGL Track context to stop preserving the drawing buffer, which avoids an expensive mobile GPU path while still compositing over the skybox.',
      'Reworked mesh uploads to reuse a growable Float32Array and GPU buffer instead of allocating a new typed array for every WebGL draw group.',
      'Removed the duplicate race weather draw during playtest and expanded the FPS diagnostics with mesh build, WebGL, overlay, buffer upload, and texture upload counters.'
    ]
  },
  {
    date: '2026-07-08',
    time: '11:37 EDT',
    title: 'Race playtest render timing',
    details: [
      'Added smoothed race playtest render-time milliseconds to the FPS diagnostics so slow frames can be separated from simulation cost.',
      'Disabled CPU sun/shadow tinting during WebGL Track playtest rendering to test whether lighting math is causing the 13-15 FPS Studio Sprint slowdown.',
      'Confirmed race physics remains in the update path; the draw path still performs projection, terrain, route, and scenery lookup work needed for rendering.'
    ]
  },
  {
    date: '2026-07-08',
    time: '11:31 EDT',
    title: 'Race playtest performance diagnostics',
    details: [
      'Cached painted race tile-map stats by revision so large tracks such as Studio Sprint do not rescan every painted terrain cell each frame.',
      'Skipped per-quad sun-shadow tint work for textured WebGL terrain while keeping plain geometry terrain lighting intact.',
      'Expanded the race playtest HUD diagnostics to show visible terrain cells versus terrain candidates under the FPS and polygon counters.'
    ]
  },
  {
    date: '2026-07-07',
    time: '08:21 EDT',
    title: 'Race art skybox performance',
    details: [
      'Added a dedicated skybox render cache so selected project artwork is resolved once and reused across playtest frames.',
      'Large skybox art is downsampled into a bounded render canvas before being drawn as the yaw-scrolling background.',
      'Added a regression test that draws the same art skybox twice and verifies the project art source is loaded only once.'
    ]
  },
  {
    date: '2026-07-07',
    time: '00:03 EDT',
    title: 'Race skybox cardinal visibility',
    details: [
      'Changed the fallback skybox compass layer so each N/E/S/W marker only draws inside a narrow forward-facing cone.',
      'Facing north now shows only N in the default skybox instead of wrapping E and W into the same view.',
      'Added a regression test that draws the fallback parallax background at north and east headings and checks only the facing marker is visible.'
    ]
  },
  {
    date: '2026-07-06',
    time: '22:56 EDT',
    title: 'Race weather handling and art skyboxes',
    details: [
      'Added wet-gravel, mud, and slush race surfaces plus tire-grip entries so weather can convert asphalt, dirt, gravel, and snow into physically distinct wet/snow-covered surfaces.',
      'Race weather now has an intensity setting and gradual playtest buildup; rain, storm, and snow visibly render precipitation while the same accumulated state changes road palettes and per-wheel grip.',
      'Changed Race Editor Settings > Skybox from preset cycling to a project art picker, then renders the selected Pixel Editor art as a yaw-scrolling parallax background.'
    ]
  },
  {
    date: '2026-07-06',
    time: '22:11 EDT',
    title: 'Race shoulders and skybox settings',
    details: [
      'Changed race road cross-section sampling so left and right shoulders inherit the road-center elevation, keeping painted height terrain from making jagged shoulder edges beside the road.',
      'Added the Race Editor Settings Skybox action and the first cardinal parallax renderer pass.',
      'Kept fallback skybox colors available for races without selected project artwork.'
    ]
  },
  {
    date: '2026-07-06',
    time: '16:44 EDT',
    title: 'Race Editor portrait Track hot menu cleanup',
    details: [
      'Changed the portrait Track root so tapping Track closes the bottom menu and returns to the top-down race editor instead of opening another drawer.',
      'Replaced selected-edge hot actions with Surface, Width, and Edit drill-downs; Surface exposes road surface and bumpiness, Width exposes road width choices, and Edit exposes insert/delete.',
      'Simplified selected-node portrait actions so only the node is highlighted and node editing lives behind Edit, without the old Add/Move buttons or Edge/Node descriptive footer text.'
    ]
  },
  {
    date: '2026-07-06',
    time: '13:52 EDT',
    title: 'Race stock performance calibration',
    details: [
      'Replaced the Honda Civic Si test car with a 2023 Honda Civic Type R and updated dimensions, power, torque, gearing, and default runtime transmission data.',
      'Added real-world stock performance target bands for WRX, BRZ, and Civic Type R so the simulator has explicit 0-60, quarter-mile, top-speed, lateral-g, and braking references.',
      'Added runtime stock acceleration tests that measure 0-60 mph, quarter-mile elapsed time, and trap speed from the actual Race Editor playtest simulation.'
    ]
  },
  {
    date: '2026-07-06',
    time: '10:18 EDT',
    title: 'Race Editor top Play control',
    details: [
      'Removed the Race Editor Drive root menu from desktop, portrait, landscape, and controller menu specs.',
      'Moved Race playtest entry to one top Play/Pause control instead of drawer or bottom menu buttons.',
      'Kept race diagnostics and AI validation actions callable from tests without exposing them as editor menu buttons.'
    ]
  },
  {
    date: '2026-07-06',
    time: '10:00 EDT',
    title: 'Race Editor Track and Generate menu cleanup',
    details: [
      'Renamed the Race Editor root menu from Race to Track across shared desktop, portrait, landscape, and controller menu specs.',
      'Added a Generate root menu containing Generate Race and all built-in track load actions.',
      'Removed Ground and Elevation as root menu buttons while keeping ground paint, surface, and elevation tools reachable from Track.',
      'Filtered Race Editor File menu rows so divider/separator entries no longer render as blank buttons.'
    ]
  },
  {
    date: '2026-07-06',
    time: '09:02 EDT',
    title: 'Race third-person renderer and thumbstick tuning pass',
    details: [
      'Third-person race rendering now derives its Mode 7 sampling anchor from the camera route projection so the nearest road bands follow the camera instead of the car position.',
      'Road and shoulder polygons now clip against the camera near plane before projection, reducing rotation-dependent camera clipping without drawing synthetic road patches.',
      'Race pause rows now render as plain text navigation with D-pad hints rather than visible editor-style row boxes.',
      'Left-thumbstick steering is softened at speed while the D-pad steering path remains unchanged.'
    ]
  },
  {
    date: '2026-07-06',
    time: '08:32 EDT',
    title: 'Race pause menu and near-road renderer cleanup',
    details: [
      'Confirmed race playtest gamepad shifting uses B for higher gear and X for lower gear, with coverage kept on the race-specific controller path.',
      'Removed the synthetic immediate camera road patch and moved near-road visibility back into the normal Mode 7 road-band renderer with closer near-plane sampling.',
      'Changed the race pause menu to a level-style text menu and moved ABS, traction control, transmission, and telemetry under a dedicated Settings row with Back at the bottom.',
      'Updated race renderer tests so closest road visibility is verified from real road bands rather than a fallback patch.'
    ]
  },
  {
    date: '2026-07-06',
    time: '08:10 EDT',
    title: 'Race camera, reverse, controls, and pause settings pass',
    details: [
      'Added WeatherTech WRX acceleration and braking sanity coverage so stock Subaru performance can be checked against the race physics after tuning changes.',
      'Raised uphill camera clearance and suppresses the immediate near-road patch when the camera is far off-route, reducing ground clipping and bottom rectangle artifacts while reversing off-road.',
      'Swapped racing gamepad X/B shifting, corrected reverse steering direction, and added right-thumbstick look with third-person car suppression while looking away.',
      'Rebuilt the race pause overlay into an in-game style menu with a Car Settings submenu for ABS, traction control, transmission, and telemetry using Up/Down/Left/Right/A/B navigation.'
    ]
  },
  {
    date: '2026-07-05',
    time: '23:22 EDT',
    title: 'Race physical controller fullscreen and traction pass',
    details: [
      'Physical gamepad playtest now bypasses the simulated handheld shell entirely and renders the race fullscreen while keeping HUD and pause UI visible.',
      'Race left-stick steering now reads axes through the shared getGamepadAxes input API so physical controllers keep steering after the simulated controls disappear.',
      'Off-road race projection now avoids black fallback fills and rejects huge near-camera ground planes that can appear after driving far off the route.',
      'Rear tire breakaway now persists longer, especially during handbrake or high-yaw events, so AWD and stability recovery cannot snap traction back immediately.'
    ]
  },
  {
    date: '2026-07-05',
    time: '23:00 EDT',
    title: 'Race gamepad steering, projection, and drift pass',
    details: [
      'Left thumbstick steering now uses a centered-stick release path with stronger decay and snap-to-zero thresholds so analog steering cannot feel stuck after release.',
      'Race playtest hides the simulated D-pad and G/R buttons when a physical gamepad is connected, while keeping the handheld shell, screen, HUD, and pause controls visible.',
      'Road projection now shares one depth-to-screen helper between normal road bands and the immediate near-camera patch, reducing the visual bend on straight roads.',
      'Drift physics now tracks yaw angular velocity, reduces rear grip harder under handbrake, and lets rear lock build sustained spin unless the player countersteers.'
    ]
  },
  {
    date: '2026-07-05',
    time: '22:17 EDT',
    summary: 'Retuned race camera projection, left-stick steering, drift, hill force, and near-road rendering.',
    details: [
      'Race projection now reports third-person FOV around 45-55 degrees and first-person around 63-70 degrees, replacing the previous telephoto-feeling camera.',
      'Left thumbstick input now writes steering intent, then ramps and decays steering target separately from D-pad nudging.',
      'Handbrake input now applies stronger rear-wheel lock and rear-grip collapse so high-speed BRZ handbrake pulls produce sustained breakaway.',
      'Road grade now contributes gravity force to acceleration, so steep uphill ramps can slow a car and roll it backward.',
      'The closest camera road patch now uses perspective projection and clipped near points instead of collapsing into a flat rectangle.'
    ]
  },
  {
    date: '2026-07-05',
    time: '19:16 EDT',
    summary: 'Hid normal race telemetry by default and corrected high-speed steering physics.',
    details: [
      'Race telemetry now stays hidden during normal playtests unless enabled from the pause menu, while explicit diagnostic runs can still show diagnostic timing and telemetry overlays.',
      'The race pause overlay now includes a Telemetry On/Off row alongside ABS, Traction Control, and Transmission.',
      'High-speed front tire angle is now limited by wheelbase and available lateral grip before it affects yaw, replacing the too-sharp rotation blend with a bicycle-model yaw rate.',
      'Focused tests now cover telemetry visibility, pause-menu telemetry toggling, and plausible 60 mph turning radius/lateral-G limits for WRX, BRZ, and Civic dimensions.'
    ]
  },
  {
    date: '2026-07-05',
    time: '17:02 EDT',
    summary: 'Retuned race steering and added runtime ABS/Traction Control controls.',
    details: [
      'Analog steering now turns in more slowly and uses a lower highway-speed authority cap, making full-stick controller input less jerky at speed.',
      'Race playtests now carry ABS and Traction Control state, default both on, and expose both toggles alongside transmission mode in the pause overlay.',
      'Traction Control now cuts excessive driven-wheel launch force unless disabled, while handbrake input bypasses the aids enough to sustain rear slip for spin-turn attempts.',
      'The top playtest HUD button now opens the pause overlay instead of immediately ending the drive, matching the handheld pause flow.'
    ]
  },
  {
    date: '2026-07-05',
    time: '09:18 EDT',
    summary: 'Tightened race controller handbrake, per-wheel tire physics, third-person projection, and near-road rendering.',
    details: [
      'Real gamepad A now behaves as a held handbrake and clears immediately when released instead of remaining latched after other buttons are idle.',
      'Race physics now classifies each wheel as road, shoulder, or off-road, then applies wheel-specific surface grip to acceleration, braking, lateral grip, wheelspin, brake lock, yaw pull, tire slip, and terrain resistance.',
      'High-load braking, steering, and launch now share tire friction through a simple friction-circle cap, so BRZ brake-and-turn and dirt launches can overload the driven/rear tires.',
      'Third-person playtest drawing now projects the visible car from the physical car world pose while the camera follows behind it, keeping rendered position closer to the physics state.',
      'Mode 7 road and shoulder quads now go through a sanitized projected-quad draw helper to reduce nearest-band clipping, inverted polygons, and green ground lines bleeding through the road.'
    ]
  },
  {
    date: '2026-07-05',
    time: '08:36 EDT',
    summary: 'Improved race playtest tire breakaway, gamepad bindings, near-road rendering, and HUD details.',
    details: [
      'Plugged-in gamepads now use race-specific A handbrake, X shift up, B shift down, Select/Menu camera toggle, Start pause, RT throttle, and LT brake/reverse bindings.',
      'High-speed hard steering now feeds a rear breakaway model so rear tires can lose grip, create audible slip, and make car yaw outrun velocity yaw instead of only reducing speed.',
      'Race playtests now spawn behind the start line in both camera views, and projected near-road points stay renderable instead of dropping the closest quad.',
      'Road shoulders now render as visible surface-aware bands, and the car health diagram uses a smaller engine block plus a longer horizontal transmission block.'
    ]
  },
  {
    date: '2026-07-04',
    time: '22:50 EDT',
    summary: 'Calibrated race physics stats, surfaces, damage contact, and shoulders.',
    details: [
      'Displayed tuning stats now stay near documented stock WRX, BRZ, and Civic targets instead of reporting the WRX as a 7-second car while playtest physics are faster.',
      'Every exposed pre-race tuning row is now covered by a test that proves it changes either performance stats, brake force, gearing, or setup physics modifiers.',
      'Dirt and gravel grip were raised for mixed-surface routes so tarmac and rain tires remain usable off pavement, while snow remains meaningfully slippery.',
      'Side hazards now require lateral contact before applying panel damage, damage logs record the source, and road shoulders project closer to the road edge with surface-aware colors.'
    ]
  },
  {
    date: '2026-07-03',
    time: '23:48 EDT',
    summary: 'Stabilized Race playtest steering, skid recovery, automatic reverse, and road projection.',
    details: [
      'Mobile and digital steering now nudges/rates steering demand so quick D-pad taps make small corrections instead of instantly requesting full lock.',
      'Low-speed lateral skid is suppressed, tire slip recovers faster after controls settle, and tire wear now follows actual modeled slip rather than raw steering input.',
      'Automatic Go now always drives toward forward motion, even when rolling backward, while Reverse still brakes first and then backs up near a stop.',
      'Coasting now decays to a stop without dragging down the WRX top-speed calibration, and road projection uses car height with a less aggressive near plane over hills and crests.'
    ]
  },
  {
    date: '2026-07-03',
    time: '23:13 EDT',
    summary: 'Corrected race playtest physics toward a tire-limited simulator model.',
    details: [
      'Replaced the arcade-strength brake force with mass/friction-limited braking that can approach lockup under normal digital controls and physically lock under handbrake or overload.',
      'Race playtest now computes per-wheel grip from tire compound, pressure, tire damage, suspension damage, surface, and weather, then stores wheel-level brake lock, wheelspin, lateral slip, and audible slip state.',
      'Steering yaw now runs through a tire-force-style model with front and rear slip angles, lateral acceleration, scrub, and speed loss instead of direct steering-to-yaw rotation.',
      'Added first-pass gravity, airborne, roll, pitch, and rollover state so crests and extreme lateral load can affect the car instead of only changing 2D road progress.'
    ]
  },
  {
    date: '2026-07-03',
    time: '15:03 EDT',
    summary: 'Added pre-race tire selection, setup tuning, and tire-based race physics.',
    details: [
      'Race playtest car selection now uses a Select/Tuning/Start flow instead of immediately starting when a car row is pressed.',
      'Pre-race tuning exposes per-wheel Tarmac, Rain, Dirt, and Snow tire compound selection plus slider-style controls for tire pressure, final drive, camber, sway bars, springs, ride height, bump/rebound, aero, and differential settings.',
      'Race physics now folds the selected tire compounds, per-wheel pressure, current road surface, weather, and tire wear into grip, braking, steering authority, and tire wear rate.',
      'Shared desktop layout contracts now emit top-dropdown for desktop submenu/settings surfaces and validate mode surfaces against the centralized EDITOR_SURFACES registry.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:52 EDT',
    summary: 'Added BRZ/Civic test cars and made transmission mode a runtime setting.',
    details: [
      'Default race projects now include the 2022 Subaru WRX, 2022 Subaru BRZ, and 2022 Honda Civic Si as selectable test cars.',
      'BRZ and Civic tuning data now include real-car-inspired drivetrain, power, torque, mass, rev range, gearing, final drive, tire, and engine-profile defaults.',
      'Manual versus automatic is now chosen during playtest from the pause menu; the active transmission profile changes shift behavior, gearing, launch RPM, shift delay, engine sound profile, and auto-shift state without needing duplicate car entries.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:38 EDT',
    title: 'Shared editor surface ids are centralized',
    summary: 'The core editor shell surface names now live in one immutable EDITOR_SURFACES map.',
    details: [
      'Added EDITOR_SURFACES to the shared layout module for desktop, portrait, landscape, gamepad, rail, drawer, and work-surface ids.',
      'Moved the core shell contracts and required/suppressed mode-surface tables to consume that map instead of repeated raw strings.',
      'Added coverage that the surface map is frozen and connected to the desktop, landscape, gamepad, required, and suppressed surface contracts.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:34 EDT',
    title: 'Shared menu defaults are immutable',
    summary: 'The canonical placement and mode-contract constants are now deeply frozen.',
    details: [
      'Wrapped shared placement, gamepad surface, and mode-contract defaults in a small deep-freeze helper.',
      'Editors still receive independent structured clones, so runtime editor state remains mutable without risking shared default drift.',
      'Added coverage that both top-level and nested mode entries are frozen.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:33 EDT',
    title: 'Editor menu placements no longer share mutable defaults',
    summary: 'Each editor now receives an independent copy of the shared portrait, landscape, desktop, and gamepad placement map.',
    details: [
      'Changed shared menu spec initialization to deep-clone EDITOR_MENU_PLACEMENTS per editor, matching the existing mode-contract cloning behavior.',
      'Added coverage that mutating one editor placement cannot affect another editor or the shared placement defaults.',
      'This protects the cross-editor layout contract while the individual editor shells continue moving onto shared mode rules.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:30 EDT',
    title: 'Blank portrait menu roots are now guarded',
    summary: 'Shared menu validation now rejects accidental empty bottom-menu panels unless they are explicit dynamic runtime panels.',
    details: [
      'Added a shared PORTRAIT_DYNAMIC_EMPTY_SECTION_IDS contract for the few intentional runtime-populated panels.',
      'Validation now catches new portrait roots that resolve to an empty section, preventing blank mobile bottom-menu buttons from returning across editors.',
      'Current intentional dynamic panels remain Level Assets plus MIDI, SFX, and Cutscene Settings.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:27 EDT',
    title: 'Landscape renderers dropped right-origin root fallbacks',
    summary: 'Concrete editor renderers now use only the left-origin root drawer path for landscape root menus.',
    details: [
      'Removed stale right-overlay root drawer checks from Pixel/Tile, Level, Actor, MIDI, SFX, Cutscene, and Race renderer paths.',
      'Kept the right drawer role focused on active submenus, matching the requested landscape left-root/right-submenu model.',
      'Updated renderer source-contract tests so right-overlay root fallback checks cannot return unnoticed.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:24 EDT',
    title: 'Race playtest projection and steering tuned',
    summary: 'Race playtest roads now reach the near viewport, default terrain stays green, and D-pad steering turns in more gradually.',
    details: [
      'Reduced the near road sample distance so the projected road polygon reaches the bottom of the playtest viewport instead of clipping early.',
      'Unpainted roadside terrain now falls back to the grass palette even when the road surface is asphalt.',
      'Digital steering keeps full-stick intent, but binary D-pad input is capped to roughly half the old per-frame wheel movement so it no longer snaps instantly to full left or right.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:21 EDT',
    title: 'Landscape root drawers are always left-origin',
    summary: 'The shared landscape helper now keeps main root menus on the compact left rail and reserves the right side for submenus.',
    details: [
      'Removed the shared helper path that allowed root menu drawers to opt back into the right overlay.',
      'Stale callers that pass rootDrawerOverlayOrigin: right are now coerced back to left-origin plans.',
      'Updated UISpec, the lower-level UI contract, and layout coverage to match the requested left-root/right-submenu landscape model.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:19 EDT',
    title: 'LeftRail contract no longer implies mobile root navigation',
    summary: 'The shared UI contract now separates desktop left inspectors, landscape compact command rails, and portrait bottom-first menus.',
    details: [
      'Removed the stale component responsibility that called LeftRail a shared vertical navigation slot on mobile.',
      'Documented that portrait root navigation remains bottom-first, while landscape uses the compact command rail token and desktop uses the left inspector token.',
      'Added layout coverage so the old mobile-left-rail wording cannot return unnoticed.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:16 EDT',
    title: 'Canonical menu spec caught up with shared drawer owners',
    summary: 'UISpec now matches the shared menu contract for Pixel, Actor, MIDI, Cutscene, and Race.',
    details: [
      'Pixel now documents View as owner of zoom/grid/tile preview/onion, Tools as owner of eraser/clone-style tools, Select as selection modes only, and Canvas as canvas document operations.',
      'Actor States, MIDI Edit, and Cutscene Clips/Stage/Audio now document the same command ownership as the shared desktop drawers.',
      'Race now documents Race/Ground/Elevation/Sprites/Settings/Drive instead of stale Road/Surfaces/Weather rows, preserving inferred circuit versus destination behavior.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:13 EDT',
    summary: 'Tile Editor spec now matches shared command ownership.',
    details: [
      'Updated UISpec so the Tile drawer owns previous/next navigation only.',
      'Kept Edit Tile Art and Reset Override documented under Edit, matching the shared Tile menu spec and desktop command ownership rules.',
      'Added coverage preventing the stale duplicated Tile drawer wording from returning.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:12 EDT',
    summary: 'Race mobile playtest is reachable from the portrait menu.',
    details: [
      'Race Editor portrait root menus now include Drive alongside File, Race, Ground, Elevation, Sprites, and Settings.',
      'The Drive portrait submenu exposes Play/Test Drive so mobile users can open the car picker and start playtesting from the Race editor.',
      'Updated UISpec and coverage while keeping the standard bottom rail at Menu, Undo, Redo, and the contextual authoring action.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:10 EDT',
    summary: 'Portrait Settings placement is now contract-checked.',
    details: [
      'Shared editor menu validation now rejects portrait Settings placements outside the bottom sheet.',
      'The all-editor portrait placement coverage now verifies root menus stay on the bottom rail while submenu and Settings commands stay in the bottom sheet.',
      'This protects the current portrait direction without changing the working portrait renderers.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:08 EDT',
    summary: 'Actor desktop dropdowns now show shared Edit group breaks.',
    details: [
      'Actor Editor desktop dropdown buttons already receive shared startsEditActionRoleGroup metadata from the dropdown render plan.',
      'Added DOM CSS for role-group-start rows so Actor Edit drawers show a subtle top separator like the shared canvas dropdown renderer.',
      'Updated desktop menu coverage to keep the DOM and canvas drawer grouping behavior aligned.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:06 EDT',
    summary: 'Actor desktop ribbon text now matches shared clipping.',
    details: [
      'Actor Editor desktop left-ribbon title and subtitle now use overflow hidden, text-overflow ellipsis, and nowrap styling.',
      'This aligns the DOM-based Actor desktop chrome with the canvas editors, whose shared desktop ribbons already draw bounded labels.',
      'Added coverage so Actor desktop ribbon text cannot regress to overflowing inside the persistent left column.'
    ]
  },
  {
    date: '2026-07-03',
    time: '14:02 EDT',
    summary: 'Desktop context panels now clip long text consistently.',
    details: [
      'The shared RTG Studio desktop context panel now clips long titles, context rows, and status lines with the same label helper used by menu chrome.',
      'This applies to Pixel, Level, MIDI, SFX, Cutscene, Race, and embedded Tile canvas panels through the shared drawSharedDesktopContextPanel path.',
      'Added focused coverage so long desktop inspector text ends with an ellipsis instead of overflowing the left panel.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:58 EDT',
    summary: 'Race map segment labels and scale bar are more accurate.',
    details: [
      'Race Editor top-down maps now compute segment length label positions through a dedicated layout helper with explicit left/right side metadata.',
      'Visible route segments show real distance labels such as 500 m or 1.05 km beside the road, and the labels avoid the corner scale bar when they would collide.',
      'The map scale bar now chooses a real-world distance that fits the current zoom instead of stretching tiny distances to a misleading minimum width.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:55 EDT',
    summary: 'Desktop root-hit coverage now rejects old local object patterns.',
    details: [
      'Added regression checks that Pixel/Tile, Level, MIDI, SFX, and Cutscene do not rebuild top-menu root hit records with local desktopRootId or hoverRootId object shapes.',
      'The shared coverage now requires canvas top-menu roots to stay on createDesktopRootMenuHit() while Actor DOM roots stay on applyDesktopRootMenuDataset().',
      'This locks in the shared desktop top-menu metadata migration so future editor layout work does not drift back to per-editor hit records.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:53 EDT',
    summary: 'Actor desktop top-menu roots now use shared DOM metadata.',
    details: [
      'Added applyDesktopRootMenuDataset() beside the desktop root-hit helper so DOM top-menu roots expose the same root id, command surface, pointer type, activation, and kind metadata.',
      'Actor desktop top-menu buttons now call applyDesktopRootMenuDataset(btn, entry) instead of hand-writing only data-root-id.',
      'Updated coverage so Actor DOM top-menu roots and canvas top-menu roots remain auditable through the shared desktop metadata helpers.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:51 EDT',
    summary: 'Cutscene desktop root hits now use the shared helper.',
    details: [
      'Extended createDesktopRootMenuHit() to support prefixed ids while preserving the actual desktopRootId/rootId metadata.',
      'Cutscene desktop top-menu root buttons now use createDesktopRootMenuHit(button, null, { idPrefix: "desktop-root:" }) instead of plain copied bounds.',
      'Updated coverage so Pixel/Tile, Level, MIDI, SFX, Cutscene, and Race canvas editors stay on the shared desktop root-hit helper path.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:48 EDT',
    summary: 'Pixel, Tile, Level, and MIDI desktop root hits now use the shared helper.',
    details: [
      'Pixel desktop chrome and the embedded Tile Editor desktop chrome now create top-menu root hit records through createDesktopRootMenuHit(), while preserving hover-root switching metadata.',
      'MIDI desktop top-menu file/settings/tab bounds now come from the shared root-hit helper instead of mutating desktopRootId onto local bounds.',
      'Level desktop top-menu buttons now pass shared root-hit metadata through addUIButton(), and coverage now keeps Pixel/Tile, Level, MIDI, SFX, and Race on the shared helper path.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:44 EDT',
    summary: 'SFX and Race desktop top-menu root hits now use a shared helper.',
    details: [
      'Added createDesktopRootMenuHit() so desktop top-menu root buttons get normalized root id, bounds, command surface, pointer type, and activation metadata from one shared path.',
      'SFX desktop top-menu registration now uses the helper while keeping its existing dropdown-open action and history bypass behavior.',
      'Race and Car editor desktop top-menu registration now uses the helper while keeping the existing open/close dropdown toggle behavior.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:39 EDT',
    summary: 'Actor desktop dropdown metadata now uses the shared DOM helper.',
    details: [
      'Added applyDesktopDropdownCommandDataset() beside the canvas desktop dropdown hit helper so DOM dropdown rows and canvas hit targets normalize the same command metadata.',
      'Actor desktop dropdown rows now call the shared helper instead of hand-writing command surface, pointer type, row activation, source-root, and Edit role dataset fields.',
      'Added coverage for the shared DOM dataset helper and updated Actor desktop dropdown tests to keep the helper path in place.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:33 EDT',
    summary: 'Pixel and Level desktop dropdown hits now use the shared helper.',
    details: [
      'Pixel desktop dropdown button registration now calls createDesktopDropdownCommandHit() instead of hand-copying command surface, pointer type, and row activation fields.',
      'Level desktop dropdown rows now use the same shared helper, preserving source-root metadata while removing local top-dropdown/mouse/release fallbacks.',
      'Updated renderer coverage so Pixel, Level, MIDI, SFX, Cutscene, Race, and Car all stay on the shared desktop dropdown hit metadata path.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:29 EDT',
    summary: 'Shared menu validation now locks mode interaction semantics.',
    details: [
      'validateEditorMenuSpec() now rejects pointer-type and gesture-scroll drift from the shared renderer mode contracts.',
      'Portrait and landscape command surfaces and row activation are validated as bottom-sheet/right-drawer tap-release flows.',
      'Desktop release activation and gamepad work-surface overlay persistence are now covered by validator regression tests.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:26 EDT',
    summary: 'Shared menu validation now enforces single command ownership.',
    details: [
      'Moved the duplicate shared action ownership check into validateEditorMenuSpec() so the normal spec validation path catches repeated command rows.',
      'Added validator coverage for cross-section duplicates such as a Level tile command appearing in both Tiles and Assets.',
      'Adjusted negative validation fixtures so File/Edit/stale-section tests remain focused while still surfacing duplicate-owner mistakes when relevant.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:23 EDT',
    summary: 'Shared menu specs now reject duplicate command ownership.',
    details: [
      'Added a cross-editor regression that fails when the same shared action appears in more than one section for an editor.',
      'Level Assets remains a compact portrait category, but its shared action list no longer repeats Tile Paint, Tile Art, Actor Mode, Powerups, or Structures rows.',
      'Actor Preview now owns only Play Scene in the shared dropdown spec; State Graph and Hitbox Zones stay with Visuals and Collision.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:19 EDT',
    summary: 'Actor menus now use Preview instead of the stale Tools root.',
    details: [
      'Actor portrait roots now show File, Settings, States, and Preview so the compact action group matches the shared menu spec.',
      'Desktop View now owns only Fit View instead of repeating State Graph, Hitbox Zones, and Play Scene rows.',
      'Removed stale Actor Tools shared-menu references and updated menu-spec and portrait-model coverage.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:13 EDT',
    summary: 'Race Editor map now shows segment distances and a scale bar.',
    details: [
      'Top-down race segments now draw compact distance labels such as 850 m or 1.05 km next to the road line.',
      'Added an adaptive lower-corner map scale bar that picks readable distances based on current race map zoom and fit scale.',
      'Added regression coverage for segment labels, distance formatting, and scale-bar labels.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:09 EDT',
    summary: 'Actor menus now use one Settings drawer.',
    details: [
      'Removed the duplicate Actor shared menu section that repeated Actor Settings, Metadata, Aggression, and Loot Rules.',
      'Kept those rows in the Settings drawer as their single owner across desktop, landscape, portrait, and gamepad menu specs.',
      'Updated Actor portrait menu IDs and tests so the Settings tab uses the same shared root instead of a separate actor alias.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:05 EDT',
    summary: 'Race Editor portrait thumbstick now continuously pans the map.',
    details: [
      'Changed the Race Editor thumbstick so pointer drag controls knob deflection instead of directly dragging the map once.',
      'Holding the stick away from center now pans the race map every update frame, more like the Pixel Editor virtual thumbstick.',
      'Added regression coverage that panning continues while held and stops after release.'
    ]
  },
  {
    date: '2026-07-03',
    time: '13:03 EDT',
    summary: 'Race Editor Race menu can load the built-in test tracks directly.',
    details: [
      'Added Race menu rows for WeatherTech Raceway Laguna Seca, Nurburgring Nordschleife, Col de Turini, Ouninpohja, and Daytona Tri-Oval.',
      'Selecting a built-in track now inserts it into older race projects if needed, or refreshes/selects the existing built-in template.',
      'Added runtime coverage that the Race menu lists the track loaders and that Col de Turini and Daytona load with their expected snow/banking metadata.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:57 EDT',
    summary: 'Tightened built-in real-world race test track metadata.',
    details: [
      'Added explicit reference-basis labels and modeled road widths to WeatherTech Raceway Laguna Seca, Nurburgring Nordschleife, Col de Turini, Ouninpohja, and Daytona Tri-Oval.',
      'Added Daytona backstretch banking metadata alongside the existing turn and tri-oval banking facts.',
      'Added direct race-template aliases for Nordschleife, Nurburgring, and Daytona so the editor/test helpers resolve those common names.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:54 EDT',
    summary: 'Pixel desktop Canvas no longer duplicates View display toggles.',
    details: [
      'Removed Grid and Tile Preview from the shared Pixel Canvas drawer, leaving those display controls in View.',
      'Removed duplicate Grid and Onion Skin rows from the Pixel runtime Canvas menu.',
      'Kept portrait canvas quick controls unchanged while desktop/controller drawer ownership is clarified.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:50 EDT',
    summary: 'Cutscene desktop Stage no longer duplicates Master Volume.',
    details: [
      'Removed Master Volume from the Cutscene Stage drawer.',
      'Kept Master Volume in Audio with selected clip volume, fade, and loop controls.',
      'Updated shared spec and source-model coverage so scene/snap controls and audio controls stay separated.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:46 EDT',
    summary: 'Cutscene desktop Audio no longer duplicates Add media commands.',
    details: [
      'Removed Add Music and Add SFX from the Cutscene Audio drawer.',
      'Kept music and SFX insertion in Add, while Audio keeps selected clip volume, fade, loop, and master volume.',
      'Updated shared spec and source-model coverage for the Add/Audio split.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:43 EDT',
    summary: 'Cutscene desktop Timeline no longer duplicates View commands.',
    details: [
      'Removed workspace mode and timeline zoom rows from the Cutscene Timeline drawer.',
      'Kept playback and Step Frame in Timeline, with workspace and zoom controls owned by View.',
      'Updated shared menu spec and source-model tests to keep the split stable.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:39 EDT',
    summary: 'Cutscene desktop Settings no longer duplicates Stage and View commands.',
    details: [
      'Removed repeated scene duration, snap, master volume, and workspace view rows from the Cutscene Settings drawer.',
      'Kept scene and snap controls in Stage, and workspace/zoom controls in View.',
      'Updated shared spec and source-level coverage so Cutscene Settings stays clear of repeated drawer commands.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:35 EDT',
    summary: 'Actor desktop States no longer duplicates Edit commands.',
    details: [
      'Removed Duplicate State and Delete State from the shared Actor States drawer.',
      'Kept those commands in Edit with Copy/Paste State so state editing has one desktop owner.',
      'Updated coverage so the DOM Actor controller menus continue filtering drawer rows through the shared menu spec.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:32 EDT',
    summary: 'Tile desktop Tiles no longer duplicates Edit commands.',
    details: [
      'Removed Edit Tile Art and Reset Tile Override from the Tile runtime Tiles drawer.',
      'Kept those commands in Edit, where target-edit and destructive tile actions belong.',
      'Updated shared menu spec and coverage so Tiles remains focused on previous/next tile navigation.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:30 EDT',
    summary: 'MIDI desktop Settings no longer duplicates Grid and View commands.',
    details: [
      'Removed duplicate Quantize, Preview, and Contrast rows from the MIDI shared Settings drawer and runtime desktop controller menu.',
      'Left Quantize in Grid and Preview/Contrast in View so desktop drawers have one owner for each command.',
      'Updated coverage so MIDI Settings stays clear of repeated workflow commands.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:26 EDT',
    summary: 'SFX desktop Settings no longer duplicates the View Loop command.',
    details: [
      'Removed the redundant Loop row from the SFX shared Settings drawer and runtime desktop controller menu.',
      'Kept Loop in View, where it controls playback/preview behavior.',
      'Updated menu coverage so the SFX Settings drawer stays clear of duplicate View commands.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:22 EDT',
    summary: 'Race Test Drive now lives only in the Drive drawer.',
    details: [
      'Removed Test Drive from the Race authoring drawer in the shared Race menu spec.',
      'Kept Test Drive available through the dedicated Drive drawer and existing bottom/context play actions.',
      'Added shared spec coverage so Race remains focused on route editing while Drive owns playtesting.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:19 EDT',
    summary: 'Race shared menu specs dropped stale unreachable sections.',
    details: [
      'Removed old Race Road, Surfaces, Scenery, and Weather sections now that the root model is Race, Ground, Elevation, Sprites, Settings, and Drive.',
      'Kept real terrain, edge, sprite, weather, and road-width commands reachable through the new authoring roots.',
      'Added shared validation that rejects sections not reachable from a root menu, portrait panel, or runtime alias.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:13 EDT',
    summary: 'Level desktop Playtest now has one top-menu home.',
    details: [
      'Removed Playtest from the shared Level File and View drawer specs so desktop File remains document-focused and View remains zoom-focused.',
      'Changed Level getLevelFileMenuItems() to exclude Playtest by default while preserving the explicit mobile drawer opt-in path.',
      'Updated desktop dropdown coverage so Playtest lives in the Level Playtest drawer instead of being duplicated in File and View.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:08 EDT',
    summary: 'Shared menu validation now keeps File actions out of non-File drawers.',
    details: [
      'Added a shared validator guard that rejects exact File-scoped actions such as Save, Export, Import, and Exit to Main Menu outside the File section.',
      'Added regression coverage using a Cutscene Settings drawer drift case so document actions stay in the desktop File dropdown.',
      'This protects the desktop app-style menu model as more editor-specific drawers are cleaned up.'
    ]
  },
  {
    date: '2026-07-03',
    time: '12:04 EDT',
    summary: 'Cutscene export is consolidated into the File drawer on desktop.',
    details: [
      'Removed the Cutscene top-level Export root from the shared desktop/controller menu spec.',
      'Kept MP4 export reachable through the File drawer, where the existing Export MP4 command already lives.',
      'Updated UISpec and shared menu coverage so Cutscene File owns export behavior and the standalone Export drawer stays absent.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:59 EDT',
    summary: 'Cutscene desktop left panel now stays contextual instead of duplicating Add commands.',
    details: [
      'Removed the Cutscene desktop Add shortcut block from the persistent left panel.',
      'The Add commands remain available through the desktop top Add dropdown, matching the shared desktop drawer model.',
      'Updated source coverage so the Cutscene left panel is limited to document, selection, transport, and status context.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:52 EDT',
    summary: 'Race Editor root menus now match the shared authoring modes across layouts.',
    details: [
      'Changed the Race Editor shared root list from Road/Surfaces/Scenery/Weather to Race/Ground/Elevation/Sprites/Settings.',
      'Kept desktop File, Edit, and View roots intact so desktop still behaves like an app menu bar while editor-specific drawers match portrait authoring modes.',
      'Updated UISpec and Race layout coverage so desktop, landscape, and gamepad roots stay aligned with the Race Editor portrait workflow.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:48 EDT',
    summary: 'Race Editor test tracks now carry structured real-world reference facts.',
    details: [
      'Added referenceFacts metadata to the built-in WeatherTech Raceway, Nurburgring Nordschleife, Col de Turini, Ouninpohja, and Daytona Tri-Oval templates.',
      'Captured per-track facts such as source length, surface type or sequence, elevation, signature sections, snow transition, and Daytona banking angles.',
      'Expanded race data coverage so these reference facts are tested alongside route length, surface, hazards, and circuit versus destination behavior.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:45 EDT',
    summary: 'Gamepad menu surface names are now centralized in the shared menu spec.',
    details: [
      'Added GAMEPAD_MENU_PLACEMENT_SURFACES and GAMEPAD_MENU_RENDER_SURFACES so placement aliases and renderer surfaces stop repeating hard-coded strings.',
      'Validation now checks gamepad root, submenu, settings, and command surfaces through those constants.',
      'Added coverage that every editor maps the slide-out placement alias to the explicit left-slide-out-drawer render surface.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:40 EDT',
    summary: 'Pixel and Level gamepad menu-state inputs now match the other editors.',
    details: [
      'Changed Pixel and Level getGamepadMenuState() to pass Boolean(this.game?.input?.isGamepadConnected?.()) into resolveGamepadMenuState().',
      'This aligns their shared gamepad slide-out decision inputs with Actor, SFX, Cutscene, Race, and Car.',
      'Added source coverage so those helpers keep normalized boolean controller state instead of passing the raw optional call result.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:37 EDT',
    summary: 'Level layout now uses the centralized gamepad menu-state helper.',
    details: [
      'Replaced a bad-signature direct resolveGamepadMenuState() call in Level layout bounds with this.getGamepadMenuState(width, height).',
      'This keeps gamepad slide-out rail reservation tied to the same active menu state used by Level draw and controller overlay paths.',
      "Added regression coverage that rejects the old resolveGamepadMenuState('level', ...) call shape."
    ]
  },
  {
    date: '2026-07-03',
    time: '11:34 EDT',
    summary: 'All older editor shells now share Race/Car mobile device detection.',
    details: [
      'Changed Pixel, Level, Actor, MIDI, SFX, and Cutscene isMobileLayout() helpers to accept game.deviceIsMobile or game.isMobile.',
      'This keeps the shared viewport resolver from classifying the same mobile device differently between editors.',
      'Added source coverage that rejects returning to game.isMobile-only detection in those editor shells.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:31 EDT',
    summary: 'Pixel and Level runtime landscape checks now use the shared landscape-touch mode.',
    details: [
      'Changed Level thumbstick suppression to check activeViewportMode === landscape-touch instead of the stale landscape alias.',
      'Changed Pixel mobile drawer landscape routing to use landscape-touch/gamepad only for live viewport state.',
      'Updated regression coverage so runtime editor code rejects the old activeViewportMode === landscape checks.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:27 EDT',
    summary: 'Race and Car gamepad menus now keep root and submenu state separate.',
    details: [
      'Changed the gamepad Menu action so it opens the left root rail without also marking a submenu open.',
      'Changed B/back from a gamepad submenu to return to the root rail with the submenu flag cleared.',
      'Updated Race/Car layout coverage so root and slide-out submenu states must remain mutually exclusive.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:23 EDT',
    summary: 'Race Editor now includes five real-world-inspired test tracks.',
    details: [
      'Added built-in race templates for WeatherTech Raceway Laguna Seca, Nurburgring Nordschleife, Col de Turini, Ouninpohja, and Daytona Tri-Oval.',
      'Modeled approximate route length, circuit versus destination behavior, surface transitions, elevation profiles, co-driver calls, and signature hazards such as the Corkscrew, Turini snowline, Ouninpohja jumps, and Daytona banking.',
      'Expanded race data coverage so the default race project exposes these tracks and their key length/surface/signature features.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:14 EDT',
    summary: 'Editor code no longer uses raw mobile orientation helpers outside uiSuite.',
    details: [
      'Changed the Level top playtest visibility helper to resolve mode through resolveEditorViewportModeFlags() instead of calling the raw portrait-layout helper.',
      'Removed the stale SFX raw portrait-layout helper import.',
      'Added coverage that Level and SFX editor sources reject raw portrait/landscape helper drift outside the shared uiSuite compatibility helpers.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:11 EDT',
    summary: 'Pixel mobile layout planning now uses the shared viewport resolver.',
    details: [
      'Changed buildPixelMobileEditorLayout() so its fallback mode calculation calls resolveEditorViewportModeFlags() instead of raw portrait/landscape helper checks.',
      'Dropped the raw mobile orientation helper imports from PixelStudio.',
      'Added coverage that the standalone Pixel/Tile layout helper accepts editorId/gamepad context and rejects raw orientation helper drift.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:07 EDT',
    summary: 'MIDI File drawer viewport-mode coverage now rejects raw mobile helper drift.',
    details: [
      'Tightened the MIDI File menu regression test so sticky Exit must come from activeViewportMode instead of a fresh mobile-landscape calculation.',
      'Added coverage that MidiComposerCore no longer imports or calls raw portrait/landscape layout helpers for this desktop-versus-touch File drawer path.',
      'This protects touch-capable desktop sessions from inheriting mobile File drawer behavior.'
    ]
  },
  {
    date: '2026-07-03',
    time: '11:01 EDT',
    summary: 'Race playtest road scale, ground motion, and steering wheel readout now use real-world references.',
    details: [
      'Changed Race playtest lane markers to a 10-foot white dash followed by a 30-foot gap so road speed has a recognizable highway reference.',
      'Changed side terrain banding to follow physical road distance instead of the exaggerated speed visual multiplier, leaving the highway markers to carry the speed cue.',
      'Changed the visible steering wheel to show full 540-degree lock at rest but only about 20 degrees at 100 mph, while keeping D-pad input as full virtual-stick deflection for tap modulation.',
      'Added a Race editor road-length readout in kilometers so route scale is visible while editing.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:41 EDT',
    summary: 'Level File drawer sticky Exit now follows activeViewportMode.',
    details: [
      'Changed the Level File drawer sticky-exit decision from a repeated isMobileLandscapeLayout() call to activeViewportMode === landscape.',
      'Portrait and landscape touch still keep Exit pinned, while desktop stays on the desktop drawer behavior.',
      'Extended the Level active-mode coverage to reject the old raw landscape helper in that drawer path.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:39 EDT',
    summary: 'Level touch thumbstick suppression now follows activeViewportMode.',
    details: [
      'Changed the Level pointer-down thumbstick guard from a fresh isMobileLandscapeLayout() check to activeViewportMode === landscape.',
      'This keeps the landscape drawer/thumbstick interaction tied to the same resolved mode used by the renderer.',
      'Updated shared editor coverage to reject the old raw mobile-landscape helper in that pointer path.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:37 EDT',
    summary: 'SFX portrait draw routing now uses the resolved viewport mode directly.',
    details: [
      'Changed the SFX main draw portrait branch from a repeated isMobilePortraitLayout() calculation to the resolved isMobilePortrait flag.',
      'This keeps SFX desktop, portrait, landscape, and gamepad decisions flowing through resolveSfxViewportMode().',
      'Updated the portrait menu model coverage so the duplicate raw portrait check cannot return in that draw branch.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:35 EDT',
    summary: 'Actor desktop dropdowns now follow the shared actor menu spec ordering.',
    details: [
      'Imported getEditorMenuSection() into ActorEditor and filtered local desktop actions through the canonical shared actor section action list.',
      'This keeps the DOM-based Actor editor aligned with the shared File/Edit/View/States drawer contracts used by the canvas editors.',
      'Added source coverage so Actor desktop menus cannot silently return to unbounded local action ordering.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:30 EDT',
    summary: 'Pixel drawer and clone-tool prompts now follow the resolved editor viewport mode.',
    details: [
      'Changed Pixel mobile drawer landscape branching to use activeViewportMode instead of re-checking raw mobile layout state.',
      'Changed clone-tool source/target guidance to use isTouchViewportMode() so desktop sessions keep desktop-style instructions.',
      'Added source coverage around the Pixel drawer and clone prompt paths to prevent raw mobile detection from returning there.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:27 EDT',
    summary: 'MIDI note snapping now follows activeViewportMode for desktop versus touch behavior.',
    details: [
      'Changed snapTick() and snapTickForTrack() to use activeViewportMode rather than raw isMobileLayout().',
      'Desktop MIDI grid placement now keeps round-to-nearest snapping even on touch-capable desktop hardware.',
      'Added source coverage so those snapping paths cannot drift back to raw mobile checks during the editor standardization work.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:22 EDT',
    summary: 'Race playtest steering now maps held D-pad input to full virtual stick lock faster, leaving speed-sensitive damping in tire/yaw authority instead of making the wheel itself sluggish.',
    details: [
      'Increased binary and analog virtual wheel response so tapping/holding the on-screen D-pad feels closer to pushing a controller stick fully left or right.',
      'Raised the high-speed steering authority floor modestly so the car responds at highway speed while still limiting tire angle through physics.',
      'Updated race steering tests to keep full-lock D-pad input separate from speed-damped tire authority.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:19 EDT',
    title: 'MIDI interaction viewport mode',
    details: [
      'Changed MIDI settings-click routing to use activeViewportMode === portrait for the portrait workspace exception.',
      'Changed MIDI note resize handle sizing to use activeViewportMode instead of raw device mobile state.',
      'Extended MIDI pointer/grid coverage to guard both interaction branches.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:16 EDT',
    title: 'MIDI modal orientation viewport mode',
    details: [
      'Changed MIDI Settings panel stacked layout detection to use activeViewportMode === portrait.',
      'Changed the MIDI instrument-picker modal to size from activeViewportMode instead of raw device mobile state.',
      'Extended MIDI settings/modal coverage to guard both orientation branches.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:13 EDT',
    title: 'MIDI File drawer viewport mode',
    details: [
      'Changed MIDI File drawer rendering to use activeViewportMode instead of raw device mobile state.',
      'This keeps desktop File drawer width, row sizing, and sticky Exit behavior tied to the shared desktop/touch mode contract.',
      'Extended MIDI File menu coverage to reject the old raw isMobileLayout branch in drawFilePanel.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:10 EDT',
    title: 'MIDI Song overlay viewport mode',
    details: [
      'Changed MIDI Song selection menu labels and button sizes to use activeViewportMode for portrait versus desktop/touch behavior.',
      'Changed MIDI Song split and shift tool hit targets to size from activeViewportMode instead of raw device mobile state.',
      'Changed MIDI Song automation markers/keyframes to use activeViewportMode and added focused coverage for the Song edit overlay cluster.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:08 EDT',
    title: 'MIDI button typography viewport mode',
    details: [
      'Changed MIDI drawButton typography sizing to use activeViewportMode instead of raw device mobile state.',
      'Changed MIDI drawToggle label sizing to use activeViewportMode so desktop sessions keep desktop-sized labels even on touch hardware.',
      'Added focused coverage for the MIDI shared button primitives.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:05 EDT',
    title: 'Pixel gamepad viewport mode',
    details: [
      'Changed Pixel and Tile gamepad menu state to resolve the current editor viewport mode before calling the shared gamepad menu helper.',
      'The shared helper now receives viewportMode.isMobileViewport instead of raw device mobile state, preventing desktop-capable sessions from inheriting touch landscape controller behavior.',
      'Extended Pixel gamepad mode coverage so this resolver path stays tied to resolvePixelViewportMode.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:03 EDT',
    title: 'Level draw path viewport cleanup',
    details: [
      'Changed the Level Editor minimap overlay sizing to use activeViewportMode for desktop versus touch layout.',
      'Changed the top playtest button and enemy-info overlay sizing to use the same resolved viewport mode as updateLayoutBounds.',
      'Changed Level tooltip rendering to keep hover/tooltips desktop-only through activeViewportMode and added focused coverage for these draw-path gates.'
    ]
  },
  {
    date: '2026-07-03',
    time: '06:01 EDT',
    title: 'MIDI desktop density cleanup',
    details: [
      'Changed MIDI transport bar sizing to use activeViewportMode instead of raw isMobileLayout.',
      'Changed MIDI instrument panel sizing to use activeViewportMode so desktop keeps desktop density on touch-capable devices.',
      'Changed MIDI track-list row sizing to use activeViewportMode and extended the all-editor menu model coverage for these helpers.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:57 EDT',
    title: 'Race D-pad steering response',
    details: [
      'Changed D-pad, keyboard, and touch-D-pad steering to drive the virtual wheel toward full lock much faster, matching the feel of a fully deflected controller stick.',
      'Kept analog stick input proportional and left speed-based steering authority in the physics layer so high-speed steering remains damped instead of twitchy.',
      'Tightened race playtest coverage so the first-frame D-pad response must be clearly responsive at launch and highway speed.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:53 EDT',
    title: 'MIDI tab and top bars',
    details: [
      'Changed MIDI tab bar sizing to use activeViewportMode instead of raw isMobileLayout.',
      'Changed the top sequencer bar row stacking and control sizing to use activeViewportMode.',
      'Extended MIDI desktop layout coverage so those helpers reject raw mobile sizing branches.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:50 EDT',
    title: 'MIDI mixer viewport mode',
    details: [
      'Changed MIDI mixer row sizing to use activeViewportMode for desktop versus touch density.',
      'This keeps mixer rows at desktop density on touch-capable desktop sessions.',
      'Extended MIDI instrument/mixer panel coverage to reject the old raw isMobileLayout branch in the mixer helper.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:48 EDT',
    title: 'MIDI song tab viewport mode',
    details: [
      'Changed MIDI Song tab timeline sizing to use activeViewportMode for desktop versus touch layout.',
      'Changed portrait detection in the Song tab to activeViewportMode === portrait instead of re-running raw mobile portrait checks.',
      'Expanded the MIDI desktop layout coverage so both grid controls and song tab mode setup reject raw isMobileLayout branching.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:44 EDT',
    title: 'MIDI grid control sizing',
    details: [
      'Changed MIDI grid controls to derive desktop versus touch sizing from activeViewportMode.',
      'This removes a raw isMobileLayout branch from the desktop grid controls path so touch-capable desktop sessions keep desktop row density.',
      'Updated the all-editor menu model coverage to reject the old raw mobile check in that helper.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:42 EDT',
    title: 'Pixel toolbar viewport mode',
    details: [
      'Changed Pixel mobile toolbar portrait branching to use activeViewportMode === portrait.',
      'Removed raw isMobileLayout/isMobilePortraitLayout checks from that helper so desktop sessions do not inherit portrait bottom-rail behavior.',
      'Added coverage around the Pixel toolbar helper inside the desktop/mobile chrome suppression tests.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:38 EDT',
    title: 'Pixel File clipboard cleanup',
    details: [
      'Removed duplicate Copy and Paste rows from the Pixel File menu extras.',
      'Kept Pixel clipboard commands in the Edit drawer alongside Undo, Redo, Cut, and Clear Selection.',
      'Expanded the all-editor File builder guard so File menus reject history and common clipboard command rows.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:35 EDT',
    title: 'File and Edit menu separation',
    details: [
      'Removed Undo and Redo from the shared File menu baseline so File drawers consistently start with New, Save, Save As, Open, Export, and Import.',
      'Cleaned stale File-history settings out of Pixel, Level, Actor, MIDI, SFX, and Cutscene file menu builders.',
      'Added all-editor coverage that rejects Undo/Redo history commands or disabled history placeholders inside File menu builders.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:27 EDT',
    title: 'Race desktop playtest controls',
    details: [
      'Audited desktop dropdown release handling across the canvas editors and found Race/Car playtest HUD buttons still firing on pointer down.',
      'Changed Race/Car desktop playtest Pause, Return, Main Menu, and End Drive HUD controls to use the shared pending release-hit path.',
      'Added coverage that desktop playtest HUD controls wait for release and cancel cleanly if the pointer moves off the button.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:25 EDT',
    title: 'Race steering input tuning',
    details: [
      'Changed race playtest steering so D-pad, keyboard, and full analog stick all request full virtual wheel deflection.',
      'Moved high-speed steering limits into the physics steering authority instead of capping the input target itself.',
      'Raised binary steering response so held D-pad feels like a fully deflected controller stick, while release-to-center and highway-speed damping remain covered by tests.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:18 EDT',
    title: 'Race and Car File menu contract',
    details: [
      'Strengthened Race/Car coverage so both editors must expose the same shared File drawer item order.',
      'The test now verifies unsupported scaffold rows stay disabled while New and Exit remain active.',
      'The shared Exit to Main Menu footer must stay the final File row for Race and Car.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:17 EDT',
    title: 'Viewport resolver contract coverage',
    details: [
      'Added broad editor menu-model coverage requiring each shared-shell editor to expose exactly one local viewport resolver helper.',
      'The coverage now rejects scattered direct resolveEditorViewportModeFlags calls outside those helpers across Pixel/Tile, Level, Actor, MIDI, SFX, Cutscene, and Race/Car.',
      'This locks in the recent desktop, portrait, landscape, and gamepad mode cleanup work as a shared editor-shell invariant.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:16 EDT',
    title: 'Level shared viewport resolver',
    details: [
      'Level Editor now uses resolveLevelViewportMode() for updateLayoutBounds() and HUD-mode resolution.',
      'Level gamepad slide-out state now consumes the helper-provided isMobileViewport flag instead of passing raw isMobileLayout() into resolveGamepadMenuState().',
      'Updated Level gamepad coverage to require the helper path and reject raw mobile-state handoff inside getGamepadMenuState().'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:15 EDT',
    title: 'Pixel shared viewport resolver',
    details: [
      'Pixel Studio now uses resolvePixelViewportMode() for the main Pixel draw path.',
      'Tile Picker rendering uses the same helper with editorId tile so Tile-specific menu contracts remain intact.',
      'Pixel zoom-to-fit now gets mobile, landscape, and desktop sizing flags through the helper instead of calling resolveEditorViewportModeFlags directly.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:14 EDT',
    title: 'Race and Car shared viewport resolver',
    details: [
      'Race Editor and Car Editor now route draw mode selection through resolveRaceViewportMode().',
      'Race/Car gamepad slide-out state now uses the resolved isMobileViewport flag from the same helper.',
      'Updated Race/Car gamepad coverage to require the helper path and reject the previous duplicate raw mobile-state handoff.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:13 EDT',
    title: 'SFX shared viewport resolver',
    details: [
      'SFX Editor now centralizes desktop, portrait, landscape, and gamepad mode resolution in resolveSfxViewportMode().',
      'The SFX gamepad slide-out state now uses the resolved isMobileViewport flag instead of directly reading isMobileLayout().',
      'Updated editor menu-model coverage to require the helper path and reject raw mobile state handoff for SFX gamepad menu planning.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:12 EDT',
    title: 'Pixel and Level desktop touch-mode cleanup',
    details: [
      'Pixel bone context actions now close mobile drawer state only in resolved touch viewport modes.',
      'Level gamepad panel navigation now includes mobile extras only outside desktop mode and keeps tooltip timing tied to activeViewportMode === desktop.',
      'Level UI button and hover tooltip handling now uses the resolved desktop mode instead of raw isMobileLayout().'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:11 EDT',
    title: 'Level editor touch mode guards',
    details: [
      'Level Editor update-time thumbstick cleanup and panning now use activeViewportMode plus the shared touch-thumbstick surface gate.',
      'Panel tab drawer opening, File menu close/reset, haptics, and precision zoom now treat desktop as desktop even on touch-capable devices.',
      'The mobile context ribbon now draws only in resolved touch modes with a bottom-action-rail surface, preserving portrait and landscape touch behavior without leaking into desktop.'
    ]
  },
  {
    date: '2026-07-03',
    time: '05:10 EDT',
    title: 'MIDI desktop pedal board mode guard',
    details: [
      'MIDI Editor pedal-board overview now uses activeViewportMode === desktop before drawing inline pedal settings.',
      'This keeps touch-capable desktop sessions on the desktop pedal overview while preserving the existing portrait, landscape, embedded, and compact pedal panels.',
      'Updated broad editor menu coverage to reject the older !isMobileLayout() desktop overview gate.'
    ]
  },
  {
    date: '2026-07-03',
    time: '03:19 EDT',
    title: 'Pixel and Level desktop pointer mode guard',
    details: [
      'Pixel Editor desktop dropdown close/release handling and desktop canvas pan policy now use activeViewportMode === desktop.',
      'Level Editor desktop dropdown close/release handling now uses activeViewportMode === desktop.',
      'Updated broad editor coverage so Pixel and Level pointer paths remain tied to the renderer-selected shared mode instead of raw isMobileLayout() checks.'
    ]
  },
  {
    date: '2026-07-03',
    time: '03:16 EDT',
    title: 'MIDI shared viewport mode helper',
    details: [
      'MIDI Editor now uses resolveMidiViewportMode() for landscape grid checks, touch thumbstick mode checks, draw viewport mode resolution, and gamepad menu state.',
      'Desktop grid pan policy now keys off activeViewportMode === desktop, matching the renderer-selected mode before enabling middle/right mouse drag pan.',
      'Updated broad editor coverage so MIDI gamepad, landscape touch, and desktop grid pointer behavior stay aligned with the shared editor mode contract.'
    ]
  },
  {
    date: '2026-07-03',
    time: '03:14 EDT',
    title: 'Cutscene shared viewport mode helper',
    details: [
      'Cutscene Editor now stores viewportWidth and viewportHeight during draw and resolves gamepad state through resolveCutsceneViewportMode().',
      'computeLayout() uses the same helper, and pointer handling now derives mode and mouse/touch policy from the active viewport mode instead of reconstructing desktop/mobile state separately.',
      'Expanded broad editor coverage so Cutscene gamepad, desktop pointer, and layout decisions stay aligned with the shared editor mode contract.'
    ]
  },
  {
    date: '2026-07-03',
    time: '03:11 EDT',
    title: 'Actor shared viewport mode helper',
    details: [
      'Actor Editor now routes reset, render, collision-tool, gamepad menu, sidebar, and rail button layout decisions through resolveActorViewportMode().',
      'Direct window.innerWidth/window.innerHeight reads are centralized in getViewportSize() so Actor follows the same shared desktop, portrait, landscape, and gamepad mode resolver as the canvas editors.',
      'Expanded broad editor coverage to guard the Actor shared viewport helper and prevent local portrait/mobile checks from returning in the DOM editor shell.'
    ]
  },
  {
    date: '2026-07-03',
    time: '03:07 EDT',
    title: 'SFX hidden thumbstick pan guard',
    details: [
      'SFX Editor applyMobilePanJoystick() now exits unless the shared active viewport mode allows the touch-thumbstick surface.',
      'This prevents hidden or stale mobile thumbstick state from continuing to pan the SFX timeline when desktop or controller modes suppress touch chrome.',
      'Expanded broad editor source coverage so both SFX thumbstick rendering and update paths remain tied to canRenderEditorSurface().'
    ]
  },
  {
    date: '2026-07-03',
    time: '03:05 EDT',
    title: 'SFX thumbstick surface guard',
    details: [
      'SFX Editor drawMobilePanJoystick() now checks canRenderEditorSurface(this.activeViewportMode, touch-thumbstick) before drawing or positioning the shared thumbstick.',
      'This makes the helper safe even if stale mobile portrait or landscape flags survive while desktop or gamepad modes have suppressed touch chrome.',
      'The change keeps SFX aligned with the shared editor surface contract used by Pixel, Level, MIDI, Cutscene, Race, and Actor.'
    ]
  },
  {
    date: '2026-07-03',
    time: '02:59 EDT',
    title: 'Race playtest start, steering, and HUD tuning',
    details: [
      'Race playtest now spawns on the first route node facing the first segment so the car starts in the proper race direction.',
      'The start checker stripe renders ahead of the player, and point-to-point versus circuit behavior still comes from endpoint closure instead of a manual race-type toggle.',
      'The minimap player marker is larger and more directional, top playtest controls stay available for Pause, Return, and Main Menu, braking is stronger, and high-speed steering is damped further while stopped steering keeps full lock.',
      'Default road scale is wider than before without pushing the lane/car proportions outside the regression guardrails.'
    ]
  },
  {
    date: '2026-07-03',
    time: '02:57 EDT',
    title: 'SFX gamepad hint surface guard',
    details: [
      'SFX Editor controller hint bars now use canRenderEditorSurface() in both portrait and landscape render paths.',
      'This finishes the SFX surface-visibility pass by aligning hint bars with its already-guarded bottom rails and touch thumbstick surfaces.',
      'Updated broad editor coverage so SFX cannot regress to raw gamepadConnected hint rendering.'
    ]
  },
  {
    date: '2026-07-03',
    time: '02:54 EDT',
    title: 'Race and Car shared surface guards',
    details: [
      'Race Editor and Car Editor now use canRenderEditorSurface() for portrait action rails, landscape bottom tool options, and controller hint bars.',
      'The shared Race/Car shell now follows the same mode surface contract as the older canvas and DOM editors.',
      'Updated Race and broad editor coverage so gamepad and desktop modes cannot regress to unconditional touch chrome.'
    ]
  },
  {
    date: '2026-07-03',
    time: '02:51 EDT',
    title: 'Actor Editor shared surface guards',
    details: [
      'Actor Editor now records the shared resolved viewport mode during DOM render.',
      'Landscape bottom tool rail rendering and sizing now use canRenderEditorSurface() so gamepad slide-out mode does not keep touch landscape chrome.',
      'Actor controller hint bars are now gated through the same shared surface visibility used by the canvas editors.',
      'Updated the broad editor menu coverage to assert the Actor shared-surface contract.'
    ]
  },
  {
    date: '2026-07-03',
    time: '02:48 EDT',
    title: 'Pixel Editor shared surface guards',
    details: [
      'Pixel Editor main draw now records the shared resolved viewport mode before branching into desktop, portrait, landscape, or gamepad UI.',
      'Portrait action rail rendering, mobile zoom rail hit targets, touch thumbstick rendering, and touch thumbstick pointer capture now use canRenderEditorSurface().',
      'Tile Picker thumbstick chrome and Pixel controller hint bars now follow the same shared surface visibility contract.',
      'Updated broad editor coverage so Pixel cannot regress to raw mobile/gamepad checks for these surfaces.'
    ]
  },
  {
    date: '2026-07-03',
    time: '02:44 EDT',
    title: 'Level Editor shared surface guards',
    details: [
      'Level Editor now stores the shared resolved viewport mode for renderer and pointer decisions.',
      'Portrait action rail, landscape zoom/tool rail, touch thumbstick rendering, thumbstick hit testing, and the controller hint bar are now gated through canRenderEditorSurface().',
      'Desktop and gamepad modes no longer inherit Level mobile chrome or stale touch hit targets through local mobile checks.',
      'Updated the broad editor menu model coverage to assert the Level shared-surface guard behavior.'
    ]
  },
  {
    date: '2026-07-03',
    time: '02:38 EDT',
    title: 'Race playtest projection and steering pass',
    details: [
      'Race playtest now keeps the car world position authoritative and projects it onto the authored route only for HUD progress, co-driver cues, minimap progress, and finish detection.',
      'Open tracks only finish when the car reaches the endpoint; circuits are inferred only when the start and end are actually connected.',
      'The minimap player marker is larger and reads as a directional car shape instead of a dot.',
      'Road scale, brake force, tire slide audio thresholds, and high-speed steering damping were retuned for a wider, less twitchy race feel.'
    ]
  },
  {
    date: '2026-07-03',
    time: '01:01 EDT',
    title: 'Tile Editor gamepad back behavior',
    details: [
      'Tile Editor gamepad menus now handle cancel/back with the same two-step flow as the shared controller contract.',
      'Pressing B from a Tile submenu returns to the Tile root categories instead of closing the whole drawer immediately.',
      'Pressing B again closes the Tile slide-out drawer and clears the local Tile gamepad focus state.',
      'Added coverage so the lightweight Tile picker cannot regress to generic mobile drawer close behavior in gamepad mode.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:58 EDT',
    title: 'Tile Editor gamepad slide-out menus',
    details: [
      'Tile Editor gamepad mode now builds a shared gamepad slide-out plan instead of falling through to the touch landscape right-submenu layout.',
      'The Tile picker Menu button opens root categories on the left, and choosing a root replaces that rail with the selected submenu on the same left slide-out surface.',
      'Tile gamepad submenu rows carry shared gamepad slide-out metadata while executing the existing Tile actions for File/Edit/View/Tiles/Properties.',
      'Added shared layout and PixelStudio coverage so Tile stays aligned with the controller menu contract used by the other editors.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:52 EDT',
    title: 'Race playtest direction and route inference',
    details: [
      'Race runtime behavior now infers loop versus point-to-point from connected route endpoints whenever playable geometry exists, instead of honoring stale manual race type flags.',
      'Closed the default Studio Sprint route data so its endpoints actually connect, while open-ended custom/generated routes finish back to the editor.',
      'Normalized generated-route and node-drag yaw math so the car starts behind the line facing the first route direction and moves forward consistently.',
      'Projected-road playtests now use the compact HUD path with Pause, Return, and Main controls; the minimap marker is a directional car shape instead of a dot.',
      'Widened the screen-space road projection, increased braking force, and further reduced binary steering sensitivity at high speed while preserving full steering lock when stopped.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:45 EDT',
    title: 'Tile Editor landscape shell',
    details: [
      'Tile Editor mobile landscape now renders a shared compact command rail with Menu, previous tile, next tile, and properties actions.',
      'Opening Menu now draws a left-origin root drawer and a right submenu drawer for Tile File/Edit/View/Tiles/Properties actions.',
      'Selected tile details moved into a shared bottom context rail with tile name, collision/property summary, and Back action.',
      'Added source coverage so the Tile landscape path stays on shared shell primitives instead of reverting to the standalone list layout.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:42 EDT',
    title: 'Tile Editor shared mode entry',
    details: [
      'Tile Editor now resolves viewport mode through the shared editor mode helper with editorId tile before rendering.',
      'The Tile render path retains both renderer modeContract and menu specModeContract, matching the shared entry-point rule used by the other editors.',
      'Desktop Tile rendering now clears stale touch thumbstick state through the shared desktop suppression behavior.',
      'Added coverage so Tile cannot drift back to local portrait/desktop checks while the landscape and gamepad menu work continues.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:39 EDT',
    title: 'Editor UI spec aligned with Tile and Race',
    details: [
      'Updated UISpec so Tile Editor is explicitly listed as a shared-shell editor with File, Edit, View, Tiles, and Properties desktop roots.',
      'Documented Tile Editor command ownership for tile navigation, art editing, property editing, collision toggles, and destructible toggles.',
      'Updated the Race Editor spec to describe inferred closed-loop versus point-to-point behavior from route endpoints instead of stale manual Circuit/Destination menu rows.',
      'Added spec coverage so Tile roots and the inferred Race route language stay locked to the shared menu contract.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:37 EDT',
    title: 'Tile Editor shared desktop shell',
    details: [
      'Promoted Tile Editor into the shared editor menu spec and UI contract so it participates in the same desktop, portrait, landscape, and gamepad layout rules as the other editors.',
      'Tile Editor desktop now builds its shell as Tile Editor, with top menu roots for File, Edit, View, Tiles, and Properties instead of reusing Pixel Editor draw/layer/frame roots.',
      'Added tile-specific dropdown commands for tile navigation, art editing, property editing, reset, collision toggles, and destructible toggles.',
      'Expanded shared layout, pointer-policy, and portrait/menu coverage so Tile Editor is included in all-editor UI regression checks.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:32 EDT',
    title: 'Race playtest route and traction pass',
    details: [
      'Race playtest now infers closed-loop versus point-to-point behavior from whether the route endpoints connect, instead of relying on a manual race type menu.',
      'Fixed launch orientation so playtests spawn behind the starting line facing the first route direction, with destination routes finishing back to the editor instead of wrapping.',
      'Added top playtest controls for Pause, Return, and Main, replaced the minimap dot with a directional car marker, widened the road projection, strengthened braking, and reduced high-speed steering sensitivity.',
      'Added tire screech audio hooks for pavement traction loss and rougher dirt/gravel/snow sliding.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:16 EDT',
    title: 'Landscape compact rail metadata',
    details: [
      'Added shared slot and surface metadata to compact landscape command rail actions.',
      'The Menu, Undo, Redo, and contextual quick-action rail now identifies itself as a fixed left-rail compact-landscape surface with tap-release activation and no gesture scrolling.',
      'Updated the editor UI contract and layout coverage so renderers keep the compact left rail separate from scrollable root drawers and right submenu drawers.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:16 EDT',
    title: 'Shared File exit footer guard',
    details: [
      'Added shared menu-spec validation so Exit to Main Menu must remain the final File command in every editor.',
      'Updated the desktop UI spec to document Exit as the File drawer footer after the shared New, Save, Save As, Open, Export, Import baseline.',
      'Extended cross-editor menu coverage so Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car all keep the same predictable File drawer exit placement.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:11 EDT',
    title: 'Race start direction guard',
    details: [
      'Added focused Race Editor coverage for non-straight starts so playtest spawn faces the first route direction instead of assuming a straight north-facing start.',
      'The guard verifies the car starts behind the starting line, matches the route yaw for both car and camera, and moves forward along that route heading when launching.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:09 EDT',
    title: 'Desktop pointer policy coverage',
    details: [
      'Tightened shared desktop pointer-policy tests across Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car.',
      'Explicitly separated editors that open right-click context menus from editors that use right-click as a pan fallback.',
      'Kept desktop browser-menu suppression, middle/right-drag panning, and hidden desktop thumbsticks covered in one shared policy test.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:06 EDT',
    title: 'Gamepad placement guard',
    details: [
      'Added direct shared menu spec validation for gamepad roots to stay on the left slide rail.',
      'Added direct validation for gamepad submenus and settings to use the left slide-out drawer.',
      'Added validation that gamepad command rows use the controller confirm-button activation model.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:04 EDT',
    title: 'Landscape placement guard',
    details: [
      'Added direct shared menu spec validation for landscape touch root menus to stay on the left rail.',
      'Added direct validation for landscape submenus and settings to stay on the right drawer.',
      'Added validation that landscape persistent context/tool space remains on the bottom rail.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:02 EDT',
    title: 'Portrait bottom placement guard',
    details: [
      'Added direct shared menu spec validation for portrait root menus to stay on the bottom rail.',
      'Added direct validation for portrait submenus to stay in bottom sheets.',
      'Covered the old top-tabs/top-sheet drift case with a focused regression test.'
    ]
  },
  {
    date: '2026-07-03',
    time: '00:00 EDT',
    title: 'Settings placement guard',
    details: [
      'Added shared menu spec validation that fails if desktop Settings placement is routed to the left panel.',
      'Covered the old left-panel settings placement with a focused regression test.',
      'Kept the desktop left panel role as persistent inspector context while enforcing dropdown drawers for settings commands.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:58 EDT',
    title: 'Desktop settings use dropdowns',
    details: [
      'Updated the shared desktop menu placement contract so Settings commands resolve to dropdown drawers instead of the left panel.',
      'Kept the desktop left panel contract as a persistent context inspector for active state summaries.',
      'Updated UISpec.md and layout tests so future editor work keeps desktop settings in the top-menu drawer model.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:55 EDT',
    title: 'Race/Car shared File drawer',
    details: [
      'Moved Race Editor and Car Editor File drawer rows onto the shared editor File menu builder.',
      'Kept the desktop baseline order New, Save, Save As, Open, Export, Import, with unavailable scaffold rows visible but disabled.',
      'Locked the Exit to Main Menu row into the same shared File drawer path used by the other editors.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:53 EDT',
    title: 'Race playtest free driving',
    details: [
      'Removed the neutral-steering yaw correction that was pulling the car back toward the route direction.',
      'Race playtest now keeps a free world-space car position for rendering and minimap display instead of snapping the camera back to route progress.',
      'Playtests still start facing the proper race direction, but destination finishes now exit back to the Race Editor instead of freezing at the finish line.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:48 EDT',
    title: 'Level desktop asset quick switches',
    details: [
      'Added a compact Assets block to the Level Editor desktop left inspector for Tiles, Actors, Powerups, and Structures.',
      'Each quick switch changes the active Level context and mode while preserving the shared top dropdown drawers as the primary command surface.',
      'Kept the desktop top-menu guard intact so hovering or opening drawers still does not mutate persistent context panels.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:44 EDT',
    title: 'Tile Editor desktop shell cleanup',
    details: [
      'Tile Editor desktop mode now uses the same shared Pixel desktop shell instead of a standalone picker screen.',
      'Added the horizontal top menu bar and shared dropdown drawer path so File/Edit/View-style desktop menus remain available while editing tile art and properties.',
      'Moved desktop Tile Editor context into a left ribbon/inspector showing selected tile, collision, slipperiness, conveyor, hazard, and destructible state.',
      'Kept the tile list inside a shared work-surface panel and left the mobile portrait/landscape picker flow intact.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:40 EDT',
    title: 'Race playtest start, finish, steering, minimap, and MIDI desktop controls',
    details: [
      'Race playtest now draws a fixed checker stripe in front of the player at launch and a finish checker stripe at the final node for point-to-point races.',
      'Widened the projected road for first-person and third-person playtest views, reduced high-speed steering lock/response, and aligned physics yaw to the same world path used by the renderer to prevent unexplained straight-road pull.',
      'Race minimap now draws the sampled world route, including generated and curved paths, with start/player/finish markers instead of relying only on editor node points.',
      'Cleaned the damage diagram by removing text labels and mirroring right-side suspension indicators inward.',
      'MIDI desktop moved instrument, note/chord, and bars controls into a compact left-panel Track Tools area so the grid header no longer carries mobile-style controls on desktop.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:30 EDT',
    title: 'Cutscene desktop contextual left panel',
    details: [
      'Added a compact Add area to the Cutscene desktop left context panel so Art, Actor, Text, Color Board, Music, SFX, Effect, and Pause are available without opening a top drawer.',
      'Updated Cutscene runtime Clips menu so clip-specific actions stay there while Copy, Cut, Paste, and Delete remain centralized in Edit.',
      'Added coverage that the Cutscene desktop left panel owns Add quick actions without merging dropdown command hits into the context panel.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:27 EDT',
    title: 'Desktop menu IA duplicate cleanup',
    details: [
      'Pixel shared Select menu now contains selection tools only; Copy, Cut, Paste, and Clear remain centralized under Edit.',
      'SFX View now contains display/navigation settings while Timeline owns transport commands, removing the duplicated Play/Stop/Start/End rows.',
      'Cutscene Clips now keeps clip-specific actions and leaves Copy/Cut/Paste/Delete in Edit.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:24 EDT',
    title: 'Pixel desktop tool drawers stay open',
    details: [
      'Pixel desktop dropdown rows now carry their source menu id so tool-palette commands can behave differently from File/Edit commands.',
      'Draw, Select, Tools, Layers, Frames, and Rigging dropdowns remain open after release activation, while File/Edit-style actions still close normally.',
      'Added menu model coverage for the keep-open rule and source menu metadata.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:22 EDT',
    title: 'Race scale and engine rev tuning',
    details: [
      'Narrowed default race road world width so a lane reads close to one car wide instead of the car/road scale feeling detached.',
      'Reduced third-person race car sprite scale and added regression coverage for the car-to-lane projection ratio.',
      'Changed highway lane markers to short world-sized dashes and made the synthesized engine rev sound respond more clearly to RPM, throttle, load, and rev limiter pulses.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:18 EDT',
    title: 'Shared mode surface visibility map',
    details: [
      'Added a surfaceVisibility map to shared editor mode contracts and specialized desktop, landscape, and gamepad shell helpers.',
      'Updated regression coverage so desktop, landscape touch, and gamepad plans expose the same required/suppressed surface visibility as the generic planner.',
      'Documented the surfaceVisibility contract in the editor UI shell contract so future renderers can query one mode object instead of scanning separate arrays.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:14 EDT',
    area: 'Desktop Editor UI',
    summary: 'Aligned Actor DOM dropdown row metadata with the shared desktop contract.',
    details: [
      'Actor desktop dropdown buttons now expose command surface, pointer type, and row activation datasets from activeSpecModeContract.',
      'This makes the DOM editor rows auditable against the same top-dropdown, mouse, release semantics used by the canvas desktop dropdown hit records.',
      'The editor UI contract now explicitly requires matching command metadata for canvas and DOM desktop dropdown rows.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:10 EDT',
    area: 'Shared Editor UI',
    summary: 'Threaded menu spec mode contracts into editor render paths.',
    details: [
      'resolveEditorViewportModeFlags now exposes specModeContract alongside modeContract so renderers can keep the shared menu-spec contract visible at mode-dispatch time.',
      'Pixel, Level, Actor, MIDI, SFX, Cutscene, Race, and Car top-level render paths now retain activeSpecModeContract before branching into desktop, portrait, landscape, or gamepad shells.',
      'Shared layout coverage now checks viewport flags and buildEditorMenuLayoutPlan expose the menu spec contract in addition to the renderer contract.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:05 EDT',
    area: 'Shared Editor UI',
    summary: 'Added spec-level mode contracts for every editor menu.',
    details: [
      'Each shared editor menu spec now exposes modeContracts for portrait, landscape touch, desktop, and gamepad.',
      'Menu spec validation now checks each mode contract against the spec placement root and submenu surfaces.',
      'New coverage compares spec contracts with renderer presentation and interaction contracts so desktop release menus, portrait bottom sheets, landscape right drawers, and gamepad confirm-button slide-outs stay aligned.'
    ]
  },
  {
    date: '2026-07-02',
    time: '23:02 EDT',
    area: 'Shared Editor UI',
    summary: 'Made fitting menu regions participate in tap-drag gesture handling.',
    details: [
      'The shared menu drag helper now recognizes registered menu regions with maxScroll 0, so a drag inside a fitting drawer can suppress accidental button activation while keeping scroll clamped.',
      'Race and Car action rows now register their shared menu gesture region even when the current row list fits without overflow.',
      'The editor UI contract now documents that menu gesture regions own tap-vs-drag behavior first and scrolling second.'
    ]
  },
  {
    date: '2026-07-02',
    time: '22:56 EDT',
    area: 'Race Playtest',
    summary: 'Retuned race scale, road markers, and engine rev feedback.',
    details: [
      'Default race lanes now project closer to one car width per lane, with the third-person car scaled larger against the road.',
      'Center lane dashes and yellow edge markers are now drawn from world-distance intervals so they move toward the camera as speed changes instead of sticking to screen rows.',
      'Race playtest now sends live RPM, throttle, redline, and load to a dedicated engine rev audio model, and Car Editor data/actions now carry an overrideable engine sound profile.'
    ]
  },
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
      'Default race projects now include a 2022 Subaru WRX with selectable 6MT and SPT transmission profiles, AWD, 271 hp, and 258 lb-ft tuning data.',
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
