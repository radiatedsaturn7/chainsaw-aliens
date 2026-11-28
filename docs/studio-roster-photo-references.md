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

### Full-roster rollout, first expansion

| In-game 3D car | Exact visual target and primary reference |
| --- | --- |
| Sunstriker GT 1994 | 1994 US Supra Turbo, A80. [Toyota's A80 photo gallery](https://pressroom.toyota.com/album/1993-1998-toyota-supra-fourth-4th-generation/) |
| Stormline 2002 | R34 GT-R V-Spec II Nür. [Exact vehicle auction photos](https://rmsothebys.com/auctions/lf22/lots/r0005-2002-nissan-skyline-gtr-vspec-ii-nur/) |
| Purple Vetch 1999 | Road Evo VI GSR, not a Group A rally car. [GSR reference gallery](https://www.squadralupo.com/inventories/1999-mitsubishi-lancer-evolution-vi-gsr/) |
| Bogbean 2020 | Ferrari Roma coupe. [Ferrari brochure](https://www.ferrari.com/content/dam/ferrari-fcom/old/pdf/cs_reveal_ferrari_roma_gbr_.pdf) |
| Spearleaf Clover 1988 | Countach LP5000 Quattrovalvole. [QV multi-angle photos](https://www.ultimatecarpage.com/cg/3924/Lamborghini-Countach-LP5000-QV.html) |
| Rampion 1987 | E30 M3 Group A, Ravaglia archive car, not a street M3. [BMW Motorsport photo](https://www.press.bmwgroup.com/usa/photo/detail/P90093400) |
| Sea Holly 2024 | Mustang Dark Horse, Tremec, standard aero. [Ford technical specs](https://media.ford.com/content/dam/fordmedia/North%20America/US/2022/09/14/2024-mustang-technical-specifications.pdf) |
| Lobelia 2005 | C6 Corvette base LS2 manual coupe, not Z06. [GM Heritage Corvette reference](https://www.gm.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/2005-Chevrolet-Corvette.pdf) |
| Thornapple ACR 2016 | Standard-aero Viper ACR, not Extreme Aero. [Dodge technical specs](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/attachments/2016_Dodge_Viper_Specs8p8494relih5em1i7jbcj7sinc.pdf) |
| Gorse 2015 | Short-wheelbase Defender 90 2.2 TDCi station wagon. [2015 Land Rover Defender 90](https://www.autoexpress.co.uk/land-rover/defender/92627/land-rover-defender-90-2015-review-pictures) |
| Least Clover 1979 | Short-wheelbase United States Land Cruiser FJ40 hardtop. [1979 FJ40 restoration reference photos](https://www.legacyoverland.com/1979-toyota-land-cruiser-fj40) |
| Biting Stonecrop 2012 | Two-door US Wrangler JK Rubicon. [2012 Wrangler media kit](https://www.fcapresskit.ca/2012/data/jp_wrangler-unltd.html) |

These remain reference studies. The Japanese cars need sharper lamp and wing
geometry; the Countach has an open rear side duct but simplified trim.
The Corvette has four separate rear lamp cavities; its reverse/indicator
layout is approximate. The standard-aero Viper lacks a dedicated rocker
exhaust, and the Mustang light signature is simplified. The utility cars
have distinct roof finishes, spare tires and bumpers, but their seals,
exterior hinges and fine fascia detailing are not complete.

### Full-roster rollout, second expansion

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Adderstongue 1992 | NA1 NSX Type R, with its black roof and fixed headlamps closed. [Honda archive](https://global.honda/jp/news/1992/4921126/image_download.html) |
| Rotorveil 1993 | US base FD Mazda RX-7, no R1 rear wing. [Period US brochure](https://www.auto-brochures.com/makes/Mazda/RX-7/Mazda_US%20RX-7_1993.pdf) |
| Greater Stitchwort 2001 | US Integra Type R, with separate four front lamp cavities, not the Japanese rectangular fascia. [Acura Integra media archive](https://hondanews.com/en-US/channels/integra) |
| Meadowrue 2003 | European facelift E39 M5. [Multi-view European car](https://www.themarket.co.uk/listings/bmw/m5-e39/1c6dc0cc-e7e5-4974-bbbb-803ae0af222d) |
| Wood Speedwell 1990 | W201 190 E 2.5-16 Evo II road car. [Mercedes-Benz archive](https://media.mercedes-benz.com/en/article/4e61dcd8-fd75-47ca-830c-056734a165c2) |
| Vipers Bugloss 1980 | First Renault 5 Turbo road homologation car. [1980 production car archive](https://www.artcurial.com/ventes/M1076/lots/646-a) |
| Rose Clover 1969 | Camaro SS 350 coupe; split grille, full chrome bumper. [GM Heritage archive](https://www.gm.com/heritage/archive/vehicle-information-kits) |
| Spring Vetch 1970 | Closed-hood Chevelle SS 454 LS5. [GM Heritage archive](https://www.gm.com/heritage/archive/vehicle-information-kits) |
| Buckshorn Plantain 2002 | Firebird Trans Am WS6. Closed painted pop-ups are static; the functional beam is assigned to the lower lamp bank. [GM Heritage archive](https://www.gm.com/heritage/archive/vehicle-information-kits) |
| CT-86 | In-game proportions/handling with the final W30 Toyota MR2 Roadster 1.8 as visual inspiration, not a new vehicle or a physics conversion. [Toyota UK exterior gallery](https://media.toyota.co.uk/images/mr2-roadster-special-collections-red-2004-2006/) |
| Periwinkle 1998 | British Rover Mini Cooper 1.3i MPi on 12-inch wheels. [Original example](https://www.manorparkclassics.com/auction/lot/lot-138---1998-rover-mini-cooper-13i/?lot=1762&sd=1) |
| Chickweed 1200 1963 | European VW Beetle 1200 Export, solid roof. [Period-spec car gallery](https://www.automobile-lopp.de/Blog/1071/vw-kaefer-1200-export-1963/) |
| Sundew 660 1991 | Suzuki Cappuccino EA11R with the targa closed. [Suzuki digital archive](https://www.suzuki.co.jp/suzuki_digital_library/1_auto/cappuccino.html) |

The Beetle in particular needs a taller, longer dome and better separated
fenders. The CT-86 uses the original wider track and game wheelbase; it is
a visual study, not a dimensional replica. All studies keep functional front,
brake, reverse, running, left and right signal geometry; the closed Countach
headlamp covers, like those on the WS6, do not animate.

### Full-roster rollout, rally trio

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Fenfire 1800 1986 | Ford RS200 road homologation coupe. [Period road car, matched front-quarter, side and rear](https://rmsothebys.com/auctions/ny15/lots/r117-1986-ford-rs200/); [FIA record](https://historicdb.fia.com/range/rs). |
| Storksbill 1977 | Lancia Stratos HF Group 4 in its 1977 Monte Carlo setup. [Period front and lamps](https://www.redbull.com/es-es/motor-rally-wrc-montecarlo-sandro-munari-rey-montana-lancia); [period driving angle](https://www.gettyimages.be/detail/nieuwsfotos/italian-driver-sandro-munari-is-seen-in-his-lancia-nieuwsfotos/597677652). |
| Gromwell 1985 | Lancia Delta S4 Group B, 1985 RAC winner. [Same chassis, restored, multiple angles](https://rmsothebys.com/auctions/lf19/lots/r0037-1985-lancia-delta-s4-rally/); [1985 period action](https://www.gettyimages.ie/detail/news-photo/henri-toivonen-from-finland-and-co-driver-navigator-neil-news-photo/2154291646). |

The Stratos auxiliary rack turns on and off with the main headlights;
the closed pop-up covers do not animate. The RS200's headlamp envelope,
cab glass and side cooling intakes remain the least accurate details.

### Full-roster rollout, endurance trio

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Black Medick 1993 | Jaguar XJ220 road car, silver. [Original 1993 car gallery](https://rmsothebys.com/auctions/el20/lots/r0124-1993-jaguar-xj220/). |
| Bugle 1966 | Ford GT40 Mk II, Daytona #98, white with blue stripes, not the later Le Mans setup. [Period images](https://www.library.revsinstitute.org/daytona-24-hour-continental/250901); [Shelby's P/1015 history](https://shelby-american-collection.squarespace.com/gt40s/1966-gt40-p1015). |
| Soapwort 1995 | McLaren F1 GTR #59, Le Mans 1995. [ACO history](https://assets.lemans.org/explorer/pdf/musee/2023/grande-exposition-dossier-de-presse.pdf); [McLaren gallery](https://cars.mclaren.com/us_en/le-mans30). |

The GT40's inset optics and hood stripes share the same surface. The
F1 has editable center seating, instruments and cockpit eye position.
The competition livery is logo-free and simplified; the F1 roof intake
and compound curvature on all three need further refinement.

### Full-roster rollout, wagons and pickups

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Quince Clover 2010 | Volvo V70 3.2 FWD, US. [Unmodified car, multiple angles](https://carsandbids.com/auctions/rxbbPMQW/2010-volvo-v70-32). |
| Great Dock 2014 | Cadillac CTS-V Wagon, six-speed manual. [Exact variant gallery](https://bringatrailer.com/listing/2014-cadillac-cts-v-wagon-50/). |
| Yellow Loosestrife 2008 | 2008 Dodge Magnum SRT8 facelift. [Factory gallery](https://media.stellantisnorthamerica.com/image-gallery.do?imageGalleryId=166&method=view&mid=); [matched trim](https://www.mecum.com/lots/SC0516-240313/2008-dodge-magnum-srt-8/). |
| Buckwheat 2.4 1997 | Tacoma 2.4 2WD regular cab. [Toyota period product source](https://xr793.com/wp-content/uploads/2025/12/1997-Toyota-Tacoma-Product-Source.pdf); [regular-cab photos](https://www.edmunds.com/toyota/tacoma/1997/regular-cab/) (same generation, trim not confirmed). |
| Gorse Clover 2005 | Tundra base 4x2 regular cab. [Exact trim specifications](https://www.edmunds.com/toyota/tundra/2005/regular-cab/st-100414632/features-specs); [Toyota period data and dimensions](https://media.toyota.ca/content/dam/media-toyota/general/specifications/pagesfrom05tundra_e.pdf) (Canadian-market source). |
| Little Clover 2010 | Frontier XE King Cab 2.5 RWD. [Factory US press kit](https://usa.nissannews.com/en-US/releases/2010-nissan-frontier-press-kit); [XE exterior](https://cdn.jdpower.com/Models/640x480/2010-Nissan-Frontier-XE.jpg). |

Painted pickup cab frames and inset window seals are distinct native surfaces.
The Frontier's grille cheeks and King Cab door shutline need refinement.
The CTS-V needs a deeper, more tapered hood-to-lamp transition.

### Full-roster rollout, MR2, Porsche, and US sedan trims

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Glimmer 1986 | US Toyota MR2 AW11 naturally aspirated 5MT, solid roof and early bumpers. [Factory brochure](https://importarchive.com/brochure/toyotamr21986_01). |
| Glowmoth SC 1988 | US Toyota MR2 Supercharged AW11 5MT with closed T-bar and raised engine-deck louvers. [Original trim gallery](https://bringatrailer.com/listing/1988-toyota-mr2-supercharged-14/). |
| Scarlet Pimpernel 1995 | UK Toyota MR2 GT SW20 naturally aspirated 5MT with single glazed sunroof. [Toyota UK revision press kit](https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/MR2-Gen2-new-engine.pdf); [UK car gallery](https://www.carandclassic.com/car/C1738137). |
| Harebell RS 1973 | Porsche 911 Carrera RS 2.7 M471 Sport. [Porsche Museum](https://newsroom.porsche.com/en/press-kits/Porsche-Museum/Porsche-911-Carrera-RS-2.7.html); [M471 gallery](https://www.elferspot.com/en/car/porsche-911-carrera-rs-1973-4815469/). |
| Heatherbell S 1987 | Porsche 959 Sport road car. [Factory line drawings](https://files.porsche.com/f/332100/9d047328aa/kat010-e-959-88-katalog.pdf); [Sport-specific hardware gallery](https://backoffice.rmsothebys.com/auctions/mi25/lots/r0090-1988-porsche-959-sport/) (1988 example). |
| Sainfoin 1985 | Porsche 944 Turbo, European launch model. [Porsche Classic](https://www.porsche.com/germany/accessoriesandservice/classic/models/944/944-turbo/); [period launch brochure](https://porschecarshistory.com/wp-content/old/brochures5/11/1985%20944%20Turbo.pdf). |
| Ironwood V8 2004 | US Mercury Marauder, distinct black grille, exhaust, and staggered wheel treatment. [Period Mercury brochure](https://www.auto-brochures.com/makes/Mercury/Marauder/Mercury_US%20Marauder_2004.pdf); [trim gallery](https://journal.classiccars.com/2024/07/08/PICK-OF-THE-DAY-2004-MERCURY-MARAUDER-2/). |
| Skullcap 2001 | US Mercury Grand Marquis GS, upright chrome grille and covered wheels. [Factory brochure](https://xr793.com/wp-content/uploads/2023/02/2001-Mercury-Grand-Marquis.pdf); [exact GS trim specifications](https://www.edmunds.com/mercury/grand-marquis/2001/sedan/st-100001496/features-specs/). |
| Snowberry Clover 2005 | US Lincoln LS V8 Sport, not the optional LSE body kit. [Factory brochure](https://xr793.com/wp-content/uploads/2016/10/2005-Lincoln-LS.pdf); [vehicle gallery](https://bringatrailer.com/listing/2005-lincoln-ls/). |

The MR2s use model-specific roof panels and engine decks; the SW20 still
needs its rear buttresses and side opening refined. The 959's wing is
simplified and the 944's parked covers remain static. The Grand Marquis
wheel-cover ornament and greenhouse need a closer fit.

### Full-roster rollout, two Clio variants

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Graceful Clover 2000 | German-market 2000 Renault Clio II Renault Sport 172 Phase I. [2000 build, matched exterior gallery](https://auctions.wbandsons.com/auction/lot/lot-103---2000-renault-clio-172/?lot=2532&sd=1) (UK RHD). |
| Vesper V6 2003 | German-market 2003 Renault Clio V6 Phase II 255. [Silver 2003 Phase II exterior](https://collectingcars.com/for-sale/2003-renault-clio-v6-phase-2-3) (UK RHD); [matched period exterior](https://www.iconicauctioneers.com/2003-renault-clio-v6-recc32164-6-tatton-0624). |

The V6 has wider shoulders and independent recessed rear-quarter intakes.
The 172's rear roof and the V6's fascia transitions still need attention.
The Clio Williams study is not registered: its old model is authored
nose-toward-negative-Z with an identity body binding. Its frame needs
separate verification before releasing the new visual.

### Full-roster rollout, Nissan Silvia family

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Brooklime 1994 | JDM Nissan Silvia K’s Type S, S14. [Nissan Heritage](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/silvia_ks_s14.html); [matched original angle](https://rhdspecialties.com/products/1994-nissan-silvia-s14-ks-5). |
| Birdsfoot Trefoil 1995 | US Nissan 240SX base S14, solid rear deck and covered steel wheels. [Period US brochure](https://importarchive.com/brochure/nissan240sx1995_01); [Nissan base wheel specification](https://parts.nissanusa.com/v-1995-nissan-240sx--base--2-4l-l4-gas/suspension--wheels). |
| Yellow Archangel 1992 | JDM Nissan Silvia K’s Club Selection PS13. [Nissan Heritage body chronology](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/silvia_ks.html) (early outer-shell example, not Club Selection). |

The JDM S14 still needs a closer lamp-wrap and bumper fit. The base 240SX
uses a distinct fascia, wheel and unwinged deck, not just a recolor.

### Full-roster rollout, BMW M3 generations

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Red Clover 1997 | German BMW M3 E36 3.2 coupe. [BMW history](https://www.bmw-m.com/en/topics/magazine-article-pool/bmw-m3-e36-portraet.html); [original German 1997 example](https://benzin.fr/index.php/de/auctions/show/m3-e36-32-1997-67ec0f1c44afd). |
| Bellheather 2005 | European BMW M3 E46 standard coupe, six-speed. [BMW history](https://www.bmw-m.com/en/topics/magazine-article-pool/bmw-m3-e46-portraet.html); [standard 2005 manual gallery](https://www.pistonheads.com/buy/auction/20107817). |
| Wall Speedwell 2008 | US BMW M3 E92 coupe standard six-speed. [BMW USA technical data](https://www.press.bmwgroup.com/usa/article/attachment/T0017997EN_US/35557); [trim gallery](https://bringatrailer.com/listing/2008-bmw-m3-coupe-69/) (optional wheels differ). |

The newer two use true recessed fender gills; lamp contours, greenhouse
curvature, and gill finish remain simplified.

### Full-roster rollout, Corvette and French hot hatch fits

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Creeping Buttercup 1953 | Chevrolet Corvette 2934, Polo White and Sportsman Red. [GM Heritage](https://www.gm.com/heritage/collection/chevrolet/1953-chevrolet-corvette). |
| Common Birdsfoot 1960 | Chevrolet Corvette C1 with raised soft top, 283 four-barrel 230 hp. [GM Heritage](https://www.gm.com/heritage/collection/chevrolet/1960-chevrolet-corvette); [1960 coachwork gallery](https://macswebs.com/corvetteworld/c1/1960.html). |
| Ball Clover 1967 | Chevrolet Corvette Sting Ray C2 427/390 hp Sport Coupe, not Tri-Power. [Factory information kit](https://news.chevrolet.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/1967-Chevrolet-Corvette.pdf); [matched trim gallery](https://www.sportscarmarket.com/profile/1967-chevrolet-corvette-427-390-coupe-2). |
| Thistle 190 1990 | French Peugeot 205 GTI 1.9 non-catalyst. [Matched 1990 trim](https://www.classic.com/a/aguttes-collector-cars-la-vente-dautomne-2025-anOqBgp/lots/1990-peugeot-205-gti-19-WkBexon). |
| Pennyroyal 1994 | French Peugeot 106 Rallye S1 1.3. [1994 French Series 1 gallery](https://www.carandclassic.com/fr/voiture/C2002856). |
| Goldentuft 1993 | First-series French Renault Clio Williams. [Renault collection](https://theoriginals.renault.com/clio-williams). |

The first two Corvettes use distinct matte whitewall bands. The C2 closed
covers are static and the working headlight signal is on a lower lamp pair.
The 205 wheel cutouts and side strips, 106 lamp outlines, and Williams
roof/glazing need more reference fitting. For the Williams, an explicit
stock-frame half-turn now normalizes its legacy rear-facing visual anchors
to the unchanged chassis. No source car or handling values are edited.

### Full-roster rollout, Subaru, Lotus, Eclipse, and Golf

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Copperleaf 22 1998 | JDM Subaru Impreza 22B-STI road coupe. [Subaru launch](https://www.subaru.co.jp/news/archives/98_1_3/3_16_1.html); [factory archive image](https://www.subaru.co.jp/license/pdf/licensing-opportunities-260415.pdf). |
| Knapweed 1995 | Colin McRae and Derek Ringer's Subaru Impreza 555 Group A four-door, 1995 RAC winner. [Period event gallery](https://www.pro-rally.co.uk/gallery/1995-network-q-rac-rally/); [period action photo](https://www.gettyimages.dk/detail/news-photo/colin-mcrae-derek-ringer-subaru-impreza-during-the-rac-news-photo/2201295985). |
| Heath Bedstraw 2019 | US Subaru STI S209. [Factory studio front and rear angles](https://www.subaru.co.jp/press/file/uploads/news-en/en2019_0115_01.pdf); [Subaru release](https://www.subaru.co.jp/press/news-en/2019_01_15_6739/). |
| Marsh Arrowgrass 2002 | UK Lotus Esprit V8 5MT. [Period brochure](https://lotusesprit.com.au/carspecs/V8USA.pdf); [UK example](https://www.carandclassic.com/us/car/C1472493). |
| Marsh Gentian 2012 | UK Lotus Exige S V6 6MT. [Factory parts catalog](https://www.espritengineering.co.uk/wp-content/uploads/2018/11/Service_Parts_List_12MY_Exige.pdf); [period UK multi-view gallery](https://www.seloc.org/articles/galleries/exige-s-2012/). |
| Wood Forgetmenot 2023 | UK Lotus Emira V6 First Edition 6MT. [Exact UK variant](https://www.tomhartleyjnr.com/car/stock/2023/lotus/emira-v6-first-edition/lotus-emira-v6-first-edition/); [2023 factory paint specification](https://www.lotus-cars.jp/our-cars/current-range/emira/pdf/Emira_v6_first_edition_price_2023.3.10.pdf). |
| Bur Medick 1995 | US Mitsubishi Eclipse RS 420A FWD 5MT. [Period trim brochure](https://manuals.plus/m/0d45779f1ce48cfa4209b5f2ec33d7d73b986d42fae1b0bf6f5650e843623c1d.pdf). |
| Nightcoil GT 1995 | US Mitsubishi Eclipse GSX AWD 5MT. [Period trim brochure](https://manuals.plus/m/0d45779f1ce48cfa4209b5f2ec33d7d73b986d42fae1b0bf6f5650e843623c1d.pdf); [trim photo](https://classiccardb.com/uploads/postfotos/1995-mitsubishi-eclipse-gsx-2.jpg). |
| Bluebell GT 2006 | US Mitsubishi Eclipse GT V6, six-speed manual. [Exact road test](https://www.auto123.com/en/news/2006-mitsubishi-eclipse-gt-v6-road-test/28472/?page=3); [GT exterior](https://veh-markets.com/uploads/postfotos/2006-mitsubishi-gt-1.jpg). |
| Fumitory 1983 | German VW Golf GTI Mk1 1.8 three-door. [Volkswagen archive](https://www.volkswagen-newsroom.com/en/images/albums/golf-gti-1st-generation-1976-1983-7155). |
| Quaking Grass 2003 | European VW Golf R32 Mk4 three-door 6MT. [Period factory brochure](https://xr793.com/wp-content/uploads/2022/12/2003-VW-Golf-R32-UK.pdf). |
| Marsh Mallow R 2010 | German VW Golf R Mk6 three-door 6MT. [Volkswagen archive](https://www.volkswagen-newsroom.com/en/images/detail/volkswagen-golf-r-12251). |

The 22B's preserved raw anchors sit under a half-turned source joint;
the normalized pack reproduces those chassis-space coordinates without
rewriting the stock binding. The Lotus cockpits are right-hand drive in
the editable model; existing production camera settings are untouched.
The S209's sharp canards and the 4G Eclipse's rear shoulder are simplified.

### Full-roster rollout, Celica, Lamborghini, Mustang, and Audi

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Heath Violet 1974 | US Toyota Celica GT first-generation RA21 hardtop. [US brochure](https://importarchive.com/brochure/toyotacelica1974_01); [period body comparison](https://ateupwithmotor.com/model-histories/toyota-celica-first-gen/view-all/). |
| Red Deadnettle 1992 | Japanese Toyota Celica GT-Four RC ST185 homologation model. [Toyota archive](https://media.toyota.co.uk/toyota-celica-gt-four-st185/); [FIA homologation record](https://rallybodykits.com/pdf/fia-homologation-papers-toyota-celica-2000gt-four-rc-st185-group-a-number-5451.pdf). |
| Moonpetal GT 2000 | US Toyota Celica GT-S 6MT. [Toyota factory gallery](https://pressroom.toyota.com/album/2000-2002-toyota-celica-seventh-7th-generation/); [period test gallery](https://www.caranddriver.com/photos/g69122829/2000-toyota-celica-gt-s-archive-test-gallery/). |
| Berseem Clover 1967 | Lamborghini Miura P400 original. [Lamborghini history](https://www.lamborghini.com/en-en/history/miura); [1967 archive](https://preview.thenewsmarket.com/Previews/lamb/DocumentAssets/499357.pdf). |
| Cup Clover 1997 | Lamborghini Diablo SV with parked original pop-ups. [Trim gallery](https://www.amarisupercars.com/stock/details/1997-lamborghini-diablo-sv/1241814); [rear engine-side intakes](https://lemacc.com/client/1997-lamborghini-diablo-sv). |
| Longstalk Clover 2012 | European Lamborghini Aventador LP700-4 launch coupe. [Launch archive](https://preview.thenewsmarket.com/Previews/lamb/DocumentAssets/266952.pdf); [2012 exterior](https://carsandbids.com/auctions/rGeAadM2/2012-lamborghini-aventador-lp700-4-coupe). |
| Pygmy Clover 1965 | US Ford Mustang GT hardtop. [Period Ford ad](https://www.usmodernist.org/AR/AR-1965-05.pdf); [GT trim details](https://www.hagerty.com/valuation-tools/ford/mustang/1965/1965-ford-mustang-gt). |
| Hop Clover 1969 | US Ford Mustang Boss 302 SportsRoof. [Original matching trim](https://davidsclassiccars.com/ford/183816-1969-boss-302-calypso-coral-numbers-matching.html). |
| Ironbloom GT 2005 | US Ford Mustang GT Coupe Deluxe manual, 130A. [Period Ford ordering guide](https://themustangsource.com/timeline/05/05/OrderGuide-ORIGINAL.pdf). |
| Alkanet 2015 | UK Audi S1 quattro three-door 6MT. [UK factory brochure](https://xr793.com/wp-content/uploads/2022/10/2015-Audi-A1-S1-UK.pdf). |
| Great Willowherb 2006 | German Audi RS4 B7 sedan 6MT. [Dated exact generation photo](https://commons.wikimedia.org/wiki/File:Audi_RS4_2006_Avus_vl.jpg). |
| Clary Sage 2010 | UK Audi TT RS 8J coupe, six-speed. [Period Audi catalogue](https://xr793.com/wp-content/uploads/2023/04/2010-Audi-TT-RS-AUS.pdf) (other right-hand-drive market). |

The Celica RC and 1965/1969 Mustangs opt into source-frame normalization
without modifying their car documents, tuning or original bindings. The
Miura's fine lamp lashes, GT-S lamp outline, Aventador Y signature, and
Boss side stripes remain simplified or omitted.

### Full-roster rollout, Honda, Mazda rotary, Volvo wagons, and Dodge

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Cinder Si 1991 | US Honda CRX Si non-VTEC 5MT. [Honda US period brochure](https://www.auto-brochures.com/makes/Honda/Honda_US%20Model%20Range_1991.pdf); [factory metal sunroof assembly](https://www.hondapartsnow.com/parts-list/1991-honda-crx--2dr_si-ka_5mt/interior_bumper/sliding_roof.html). |
| Honeysuckle 22 2009 | US Honda S2000 AP2 base 6MT with closed soft top, not CR. [Honda US brochure](https://automobiles.honda.com/images/2009/s2000/downloads/2009-s2000-brochure.pdf). |
| Hedge Bedstraw 2005 | JDM Honda NSX Type R NA2. [Honda factory exterior archive](https://www.honda.co.jp/auto-archive/nsx/2005/type/r-ext/). |
| Common Agrimony 1972 | Mazda Cosmo Sport Series II L10B. [1972 reference gallery](https://www.christies.com/en/lot/lot-6612298); [period vehicle museum views](https://commons.wikimedia.org/wiki/Category:Mazda_Cosmo_Sport_(L10B)). |
| Ground Ivy 1973 | US Mazda RX-3 Coupe, 12A. [Mazda heritage gallery](https://mazdamediapacks.com/en/heritage/gallery/mazda-rx-3.html); [US 1973 12A visual reference](https://smclassiccars.com/mazda/254129-mazda-rx3-1973.html). |
| Musk Mallow 1985 | US Mazda RX-7 GSL-SE FB, 13B. [Period Mazda model guide](https://www.cheavens.com/Mazda/NewsLetters/Mazda_Today_1984_Fall.pdf); [exact manual variant gallery](https://bringatrailer.com/listing/1985-mazda-rx-7-90/). |
| Heather 1993 | UK Volvo 240 SE estate. [UK estate reference](https://ridedrivestore.co.uk/classics/volvo240estate). |
| Larch Turbo 1995 | US Volvo 850 T-5R SportsWagon. [US trim reference gallery](https://bringatrailer.com/listing/1995-volvo-850-t5-r-4/). |
| Sea Lavender 2015 | UK Volvo V60 Polestar T6 estate. [Volvo factory UK press kit](https://www.volvocars.com/uk/media/press-releases/A57B7EDF11FA5DBC/). |
| Hairy Clover 1970 | US Dodge Coronet Super Bee Six Pack Hardtop. [Dodge period brochure](https://www.automontage.ch/content/dam/amag-generic-automontage/archiv/prospekte/1970_Coronet.pdf.coredownload.inline.pdf); [trim gallery](https://trombinoscar.com/dodge/dg7024.html). |
| Ragwort 1970 | US Dodge Charger R/T 440 Magnum Hardtop. [Matched trim gallery](https://www.thewestcoastclassics.com/1970-dodge-charger-rt-440-375hp-v8-2-dr-hardtop-c-1254.htm). |
| Meadow Buttercup 2012 | Canadian Dodge Challenger SRT8 392. [Canadian Dodge factory media](https://www.fcapresskit.ca/2012/data/srt_challenger.html). |

The CRX uses a sealed painted metal sunroof; the S2000's fabric roof
is closed. UK Volvo wagons use right-hand cabin geometry. The RX-7's
parked covers remain static, and the Charger's dark recessed lamps
approximate the concealed face without animated covers. The Cosmo roof,
NA2 lamp wrap, and V60 rear light towers remain simplified.
