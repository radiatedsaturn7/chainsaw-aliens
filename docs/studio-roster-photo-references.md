# Photo references for the nine 3D roster studies

Fit the silhouette first, then the glass, optical outlines and panel
breaks. Compare front three-quarter, side profile and rear views, and
scale by the wheelbase where the photo permits. Match features in 3D, not
baked shadows or a single screen-space outline.

| Study | Variant and primary reference | What distinguishes it |
| --- | --- | --- |
| Linaria 2021 | [Porsche 911 GT3 (992.1), 2021 launch](https://newsroom.porsche.com/en_US/2021/products/porsche-911-gt3-world-premiere-livestream-23626.html) · [Porsche dimensions](https://newsroom.porsche.com/dam/jcr%3A15fa49de-7fc3-4770-a09d-1b8bf451ddbd/PAG-992-911GT3-PDK-EN.pdf) | Raised front fenders, swept clear headlight lenses above the nose, short rounded greenhouse, wing supported from above |
| Linum 1983 | [John Buffum competition car photos, SCCA rulebook covers](https://historicdb.fia.com/sites/default/files/regulations/1467811594/1984_pro_rally_rules.pdf) · [R44 builder's gallery](https://www.ihle-motorsport.de/en/fahrzeuge/audi-a1-r44/) | Long-wheelbase A1 rally shape, straight hood edge, continuous black strip through rectangular lamps and grille, squared arch flares |
| Ember Pod Prototype | [Tata TAMO Racemo Geneva debut specifications](https://www.tatamotors.com/wp-content/uploads/2025/06/7feb18-product-note-Racemo.pdf) · [Tata Motors photo](https://www.tatamotors.com/press-releases/racing-its-way-to-glory-tamos-racemo-bags-the-german-design-award-2018/) | Tiny mid-engine two-seater, cabin forward, short hood, dark connected fascia and strongly sculpted sides |
| 2018 Kestrel 660 | [Honda S660 Factbook](https://www.honda.co.jp/factbook/auto/S660/201503/) · [Honda MY18 dimensions](https://www.honda.co.jp/auto-archive/s660/2018/common/pdf/s660_spec_list_201804.pdf) | Narrow 3,395 × 1,475 mm kei footprint, short nose, dark lamp band, two rear deck shoulders, removable fabric roof |
| 2005 Flint Coupe | [Citroën UK product and technical brochure (mirror)](https://xr793.com/wp-content/uploads/2022/09/2006-Citroen-C4-Tech-Specs-UK.pdf) · [Citroën Australia launch materials (mirror)](https://www.australiancar.reviews/_pdfs/Citroen_C4-C4Coupe_Mk1Hatch-Mk1Coupe_PressKit_200504.pdf) | First-gen VTS coupe: glass bends at the tail, with tall hooked lamps outboard of both glazing planes |
| 2024 Caravan-9 | [Kia US 2024 Carnival LX specifications](https://www.kiamedia.com/us/en/models/carnival/2024/specifications) · [MY24 side profile and gallery](https://www.kiamedia.com/us/es/models/carnival/2024/gallery) | Pre-refresh LX: wide horizontal grille and optics, long sliding-door side, large rear-quarter glazing with a distinctive pillar applique, 2+2+3 layout |
| Dustjack V8 | [2011 Gen 2 Local Motors Rally Fighter, actual car photos](https://rmsothebys.com/auctions/ca15/lots/r0112-2011-local-motors-rally-fighter/) · [Local Motors brochure designer gallery](https://magnetry.com/project/rallyfighter) | Wide high-clearance coupe with large round main lamps flanking a dark mouth and scalloped bodywork above exposed suspension |
| Lark 1600 1990 | [1990 Mazda MX-5 Miata NA, actual car photos](https://www.audrainautomuseum.org/collecting-moving-forward-exhibition/1990-mazda-miata) · [1990 US Mazda brochure (mirror)](https://www.motorologist.com/wp-content/uploads/1990-Mazda-Miata-MX5-brochure.pdf) | NA 1.6: compact open roadster, thin front bumper mouth, closed pop-up lamp lids and low, short tail |
| Briar XT 2004 | [Subaru US 2004 Forester brochure (mirror)](https://xr793.com/wp-content/uploads/2020/02/2004-Subaru-Forester.pdf) | Pre-facelift SG 2.5XT, body-color bumpers, hood scoop, silver rectangular lamps, wide dark grille and upright hatch |

References are for looking and measuring only; no logos or OEM photo pixels
are included in the runtime assets. Production roster identifiers, physical
tuning, and wheel hardpoints are unchanged. A reference fit is not a claim
of exact factory tolerances, identical tires, or moving assemblies.

## Budget verification

This pass traces each folded wheel-arch hem from the actual tessellated
panel edge, seats the liners behind it, and fixes the mirrored skirt winding. It also refits the
C4-style Flint's hatch-edge lenses and plate recess, the Kestrel's
rear deck and split optical treatment, and the Caravan's shared
headlamp/grille band. The optional hatch-edge lamp control lives on the
split-hatch chart, not as a second lamp laid over the original bumper lens.
The C4 placement was checked against [photos of a 2005 C4 VTS](https://auctions.wbandsons.com/auction/lot/lot-113---2005-citroen-c4-vts/?lot=3198&sd=1).

## Second reference-angle pass

Match cameras to the features being fitted. For the C4 and S660, compare
a true rear view as well as rear three-quarter; do not draw conclusions
about the rear fascia from front or overhead views. The S660 rear was
checked using the [New Atlas road test](https://newatlas.com/honda-s660-review/40407/)
straight-rear and rear three-quarter photos. The recessed diffuser,
center running strip and framed targa rear glass remain editable.
The Caravan now has an independently adjustable windshield rake,
swept glazing sill and stepped lamp/grille trim. The C4 adds an
editable raised split-glass bridge, quarter-window taper and fuller
hatch-edge optics. The WRX retains its approved hood crown and paint;
its reshaped front lower intake and corner bypasses are editable.

The current gameplay exports include all four wheels: 13,042 (Linaria),
14,880 (Linum), 14,632 (Ember Pod), 14,588 (Kestrel), 14,978 (Flint),
14,875 (Caravan), 14,316 (Dustjack), 13,938 (Lark), 13,654 (Briar), and
14,822 (WRX). These are photo-guided approximations, not scan-accurate
models. Each roster export is reproduced by tests that check all four
stock hardpoints and the headlight, brake and reverse roles.

The Racemo's paired outlet is raised into a recessed, backed fascia
pocket. In Construction → Exhaust, **Raised fascia mount (0 = floor
mount)** travels on the actual bumper chart. If a placement intersects a
lamp, plate recess, or protected edge, that group keeps its floor mount
instead of cutting an invalid opening.

Raised round taillights are fitted in physical rear-view space rather
than as circles in a compressed UV chart. The **Round lens diameter**
and **Round lens raise on fascia** controls fit the housing; **Round
rear lamp with running-light ring** is an independent optical layout.

The **Swept rear bridge** controls add a backed, sculpted panel that
rises toward the rear lamps. The swage occupies a real cutout and
follows the existing fascia, stopping before adjacent lamps, exhaust,
or plate openings. With relief set to zero the original shell is kept.

### Front/rear wheel fitments
- [Honda S660 official specification](https://www.honda.co.jp/ownersmanual/webom/jpn/s660/2015/details/13697090-15246.html): 165/55R15 front, 195/45R16 rear.
- [Tata Motors Racemo product note](https://www.tatamotors.com/wp-content/uploads/2025/06/7feb18-product-note-Racemo.pdf): 205/50R17 front, 235/45R18 rear.

Studio reproduces the section widths and nominal rim diameters through the Wheels and Tires controls. Game roster exports retain the original physics rolling radius and mounted hub centers on both axles, so sidewall heights are the difference between those retained radii and the requested rims, not a physics retune. Zero rear offsets preserve a single shared wheel model. Both axle meshes count toward the same 15,000-triangle vehicle budget.

## Ten-car refinement pass

- Field Forgetmenot (WRX): matte lower-intake backing and warmer gold wheel faces. Same recessed optics and physical wheel mounts.
- Linaria (GT3): stronger hood and fender crowns, with a more curved canopy.
- Linum (Quattro): deeper lower intake with a crossbar, stronger angular arch shoulders, and more hood clearance over the wheel liners.
- Ember Pod (Racemo): recessed diffuser and corner reflectors below the sculpted bridge, retaining the raised center exhaust.
- Kestrel (S660): broader satin five-spoke wheel faces over dark barrels, lower rear deck buttresses, and rising side glazing.
- Flint (C4): fuller split-hatch bridge, more defined rear bumper and deeper plate pocket.
- Caravan (Carnival): crisper, swept door crease and lower bumper shoulder.
- Dustjack (Rally Fighter): fuller visible tire sidewalls; unchanged outer rolling radius.
- Lark (Miata): taller oval inlet, rounded lower nose transition, and a dark windshield frame.
- Briar (Forester): darker, more raked rear glazing with slimmer rear pillars.

All ten remain editable through their Studio genomes. The roster bundles do not modify car documents, suspension, or wheel mounting transforms.

### Follow-up matched-angle pass

| Vehicle | Main photo-fit change |
| --- | --- |
| Field Forgetmenot (WRX) | Lower, tighter pressed line along the doors; wider, more squared hood-scoop mouth. Hood crown and paint unchanged. |
| Linaria (GT3) | More distinct recessed oval projector bowls and deeper lower intake. |
| Linum (Quattro) | Low painted boxed rally wing with upright end frames and dark windshield trim. |
| Ember Pod (Racemo) | Wider, deeper diffuser and more distinct silver bridge below the raised twin exhaust. |
| Kestrel (S660) | Stronger rising door crease; correct rear orientation retained in the review. |
| Flint (C4) | Darker red and separate clear hatch-edge lens zones, checked from straight rear and rear three-quarter. |
| Caravan (Carnival) | Raised, thicker swept front lamp line and rounder bumper-to-quarter transitions. |
| Dustjack (Rally Fighter) | More rearward roof/pillar sweep and windshield rake, without changing the stock overall height. |
| Lark (Miata) | Crowned hood, softer nose profile and wider inset amber bumper markers. |
| Briar (Forester) | Two-tone rear lamps, wider plate pocket and stronger rear bumper molding. |

The guides are for visual comparison: these are still editable approximations. All four stock wheel mounts and the existing suspension are preserved.

### Multi-view photo fitting

Compare the wheel centers first, then the silhouette and panel break lines.
A paint or lens color correction does not count as a shape correction.
The study cars are inspired by the source bodies, not exact replicas, and
the sourced photos are references only, not distributed game art.

| Study | Additional references | What to check at the same angle |
| --- | --- | --- |
| WRX | [Subaru's period preview](https://www.subaru.ca/Content/7907/media/en-ca/download/SixStarReviewFall2003.pdf), [US 2004 side profile](https://www.builtforbackroads.com/listing/2004-subaru-sti-30), [low-mileage US rear gallery](https://www.autoblog.com/carbuying/2004-subaru-impreza-wrx-sti-for-sale) | Larger corner lenses with a narrow silver upper chamber, squarer plate pocket, flatter lower valance, stronger painted rocker profile. Do not change the hood crown. |
| GT3 | [Porsche 992.1 GT3 press gallery](https://newsroom.porsche.com/de_CH/produkte/bilder-videos/porsche-911-gt3-2021.html) | Roof sweep and rear glass in profile, running light across the rear. Remaining gaps include the organic fender-to-nose transition and width of the rear light treatment. |
| Quattro | [Ihle R44 history and images](https://www.ihle-motorsport.de/en/fahrzeuge/audi-a1-r44/), [FIA B-229](https://historicdb.fia.com/node/99611) | More upright rectangular lamps and stepped bumper. R44 went from A1 to A2 after July 1983; restored chassis photos don't date every wing or vent. Label the study R44-inspired. |
| Racemo | [Geneva show gallery](https://auta5p.eu/vystavy/zeneva_2017/gims_049.php), [Evo show photos](https://www.evo.co.uk/news/19034/tata-motors-tamo-racemo-in-pictures) | Short hood, high rear buttresses and rear fender silhouette. The thick two-tone side intake surround is still under-modeled. |
| S660 | [Honda 2015 S660 alpha gallery](https://global.honda/en/newsroom/news/2015/4150330eng-s660/image_download.html), [Honda fact book](https://www.honda.co.jp/factbook/auto/S660/201503/S660_201503.pdf) | Compare the hood, nose and light pockets from the front rather than against a rear reference. |
| C4 Coupé | [Exact-year VTS gallery](https://auctions.wbandsons.com/auction/lot/lot-113---2005-citroen-c4-vts/?lot=3198&sd=1), [factory brochure, Coupé pp. 3–5](https://autocatalogarchive.com/wp-content/uploads/2023/12/Citroen-C4-2006-ES.pdf) | Hood and bumper from the front, hatch bridge and optical separation from the rear. |
| Carnival | [US 2024 Carnival LX exterior gallery](https://www.sunsetchevrolet.com/used-Sumner-2024-Kia-Carnival-LX-KNDNB4H31R6406708) | Taller painted door sides, slimmer glass, wider rear quarter applique. |
| Rally Fighter | [2011 Rally Fighter listing and gallery](https://www.classic.com/veh/2011-local-motors-rally-fighter-tex113889-pz5X7MW/) | Lower daylight opening and rear quarter taper; the exposed off-road stance still needs better modeling around the bumper and suspension. |
| Miata | [Original 1990 red NA photo gallery](https://bringatrailer.com/listing/1990-mazda-mx-5-miata-122/), [Mazda 1990 brochure](https://www.motorologist.com/wp-content/uploads/1990-Mazda-Miata-MX5-brochure.pdf) | Soft rear bumper curvature and broad oval tail clusters, not a generic angular coupe tail. |
| Forester | [Subaru's 2004 XT preview](https://www.subaru.ca/Content/7907/media/en-ca/download/SixStarReviewFall2003.pdf), [US-spec 2.5XT gallery](https://www.carfindersdenver.com/pre-owned-cars/detail/2004-Subaru-Forester/1384386) | Compare taper of the quarter light and the transition from side glazing to the rear hatch surround. |

### Signature geometry pass

- The WRX uses a rounded painted rocker and lower door stamp, with tighter closed fender seams and fairer bumper transitions. The approved hood, wheels and lamp mounts are untouched.
- The GT3 uses optional **Raised inset lamp pods**. The outer ring and bowl sample the raised fender surface, and the lift returns to zero at the hood rails. The Quattro uses wider boxed arches and a stepped bumper.
- Both side intake styles are editable. Racemo uses the swept crescent carved into the door carrier; S660 uses separate diagonal and rear triangular recesses. The original duct profile remains the default.
- C4 gains a longer swept nose lens and softer wheel-arch returns. The Miata's rear lens footprint is elongated and its rear bumper and arches have rounder corners.
- The Carnival's nose is squarer with a more sculpted lower section. Rally Fighter's roof is lower and wider in the visual model, with stock wheel hardpoints and suspension.
- The Forester uses taller **Upright wrap** lenses cut into one surface, not supplemental strips over the glass. The real lenses still start higher than these.

The remaining gaps include GT3 fender-to-nose continuity, the Quattro's period-specific rear profile, and the Forester's continuous lens placement relative to its rear glass. Matched renders are a visual check, not a claim of exact likeness.

## Twenty editable studies

Open **Graphics → 3D Car Design → Menu → Roster studies**. The menu
contains the independently routed WRX plus nineteen studies from existing
3D roster entries. Selecting a study replaces only the editor's current
working design and can be undone. The ten earlier designs remain available.

| Added roster study | Reference | What it exercises |
| --- | --- | --- |
| Alder RS 1994 | [Audi RS2 Avant B4](https://www.audi-mediacenter.com/en/photos/detail/audi-avant-rs-2-b4-model-year-1994-37228) | Low long-roof wagon, period rectangular optics, rear light bridge |
| Ashbaron 1987 | [Buick Regal GNX](https://www.gm.com/heritage/collection/buick/1987-buick-regal-gnx) | Upright notchback, long hood and squared arches |
| Bee Clover 2017 | [Mercedes-AMG GT R brochure](https://www.autonewspress.com/wp-content/uploads/2017/08/Mercedes-AMG-GT-R-and-GT-Roadster-Brochure.pdf) | Cab-back GT, tall vertical-slat grille and rear wing |
| Bitter Dock 2018 | [Dodge Durango SRT](https://www.caranddriver.com/reviews/a15090514/2018-dodge-durango-srt-test-review/) | Tall three-row SUV, hood intake and broad lamp band |
| Bramble 2021 | [Toyota GR Yaris](https://www.toyota.co.uk/content/dam/toyota/nmsc/united-kingdom/brochure-archive/gr-yaris/gr-yaris-jan-21.pdf) | Short narrow-window hatch with wide rear quarters |
| Desert Clover 1969 | [Pontiac GTO Judge photo tour](https://silodrome.com/pontiac-gto-judge-car/) | Period muscle coupe, open quad lamps and split-style grille |
| Greater Celandine 2022 | [CT5-V Blackwing walkaround](https://www.consumerreports.org/cars/cadillac/ct5/2022/photos-and-video/) | Modern angular sedan, deep lower fascia and quad outlets |
| Mirabelle Clover 1966 | [Nissan Heritage Datsun 520](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/datsuntruck1300.html) | Short regular cab and a real recessed open pickup bed |
| Nettle Turbo 2017 | [Abarth 124 Spider](https://www.media.stellantis.com/uk-en/abarth/abarth-124-spider-2016-2019) | Open cockpit, long hood, rounded period-inspired fascia |
| Volt-Hound GT 2023 | [Kia EV6 GT](https://www.kiamedia.com/us/en/models/ev6/2023) | Long-wheelbase crossover, swept lights and compact fastback roof |

The roster exports are generated from the editable sources, not from an
image-to-3D service. Runtime packs preserve the stock visual wheel-center
measurements in the renderer's axes and physics rolling radius. They do not
edit the car documents, vehicle physics, or suspension setup. All four
wheel meshes count toward the 15,000-triangle limit. The previous nine
roster exports and the separately bound WRX remain available.
