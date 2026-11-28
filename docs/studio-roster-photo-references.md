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

### Full-roster rollout, Skyline, Pontiac, Mercedes, and Lancia

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Moschatel 1973 | Nissan Skyline 2000GT-R KPGC110 hardtop. [Nissan archive](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/skyline_h_t_2000_kpgc110.html); [period brochure](https://www.nissan-global.com/EN/HERITAGE/GALLERY/ITEM/193.html). |
| Storksbill R 1987 | Nissan Skyline 2000GTS-R KHR31. [Nissan archive](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/skyline_2000gts-r.html); [original R31 brochure](https://www.nengun.com/oem/nissan/skyline-r31/skyline-gts-r-august-1987-brochure). |
| Hop Trefoil 1993 | Nissan Skyline GT-R BNR32 V-spec I. [V-spec gallery](https://commons.wikimedia.org/wiki/Category:Nissan_Skyline_GT-R_V-spec_(R32)); [contemporaneous Nissan road shell](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/skyline_gt-r_1992.html). |
| Common Mullein 1965 | US Pontiac GTO 389 four-barrel Hardtop. [Period Pontiac documents](https://www.gtoaa.org/1965-pontiac-gto). |
| Anemone 1986 | US Pontiac Fiero GT early fastback, V6 four-speed. [1986 GT dealer brochure](https://www.brochure-catalogue-voiture-neuve.fr/en/brochures/pontiac/fiero/pontiac-fiero-1984/ANG-1986-GT-US/); [period four-speed test](https://www.caranddriver.com/reviews/a70783877/1986-pontiac-fiero-gt-archive-test/). |
| Sunmallow 2006 | US Pontiac Solstice base 2.4. [Period base 2.4 test](https://www.motortrend.com/reviews/2006-pontiac-solstice-1). |
| Hempnettle 1955 | Mercedes-Benz 300 SL W198 I standard steel-bodied road car. [1955 trim gallery](https://rmsothebys.com/auctions/mu24/lots/r0044-1955-mercedesbenz-300-sl-gullwing). |
| Ribwort Plantain 2011 | Mercedes-Benz SLS AMG C197 standard German model. [Exact German-delivery example](https://www.classicdriver.com/de/car/mercedes-benz/sls-amg/2011/784653); [original brochure](https://cache4.pakwheels.com/system/brochures/651/original/Mercedes-AMG-SLS-2011-UK.pdf?1750244019). |
| Sea Aster 2012 | Japanese Mercedes-Benz C63 AMG Black Series Coupe. [Mercedes-Benz Japan release](https://www.mercedes-benz.jp/news/release/2011/20111003.pdf); [period profiles](https://openers.jp/en/car/13596). |
| Centaury 1983 | Lancia Rally 037, Monte-Carlo-winning 1983 competition fit. [WRC history](https://www.wrc.com/en/misc/lancia-rally-037); [period car photo](https://www.lanciarally037.com/montecarlo/rohrl-gazzetta.htm). |
| Sea Arrowgrass 1982 | Lancia Rally 037 Stradale. [Factory Heritage Hub](https://www.media.stellantis.com/it-it/heritage-hub-italy/press/fca-heritage-protagonista-alla-28esima-edizione-di-autopromotec). |
| Meadow Vetchling 1986 | Lancia Delta S4 Stradale road coupe. [1986 example](https://commons.wikimedia.org/wiki/File:1986_Lancia_Delta_S4_Stradale_LC26.jpg). |

The GTO uses four discrete stacked round front openings. The Fiero's
parked lids, and the two Mercedes' closed gullwing roof seams, do not
animate. The Solstice nose curvature, Skyline roof framing, and 037
road trim remain first-pass approximations. Cars using source-frame
normalization retain the original chassis and handling.

### Full-roster rollout, Z-cars, Alfa, Ford pickups, and MINI

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Harebell 1970 | US Datsun 240-Z S30 base two-seat manual. [Period US brochure](https://retrojdm.com/ScanView.asp?ScanID=12). |
| Trailing Tormentil 1994 | Japanese Nissan Fairlady Z CZ32 Version S Twin Turbo fixed-roof two-seater. [Nissan Z archive](https://global.nissannews.com/en/channels/nissanz?selectedTabId=nissanz-photo-galleries) (generation views); [Japanese fixed-roof specification](https://gazoo.com/catalog/maker/NISSAN/FAIRLADY_Z/198907/1501108/). |
| Foxglove Z 2003 | US Nissan 350Z Z33 base 6MT, including base seven-spoke wheels. [Nissan press kit](https://usa.nissannews.com/en-US/releases/2003-350z-press-kit?origin=channel-2730). |
| Common Comfrey 1965 | Alfa Romeo Giulia Sprint GTA road car. [Period homologation](https://historicdb.fia.com/sites/default/files/car_attachment/1606233601/homologation_form_number_1395_group_t.pdf); [1965 gallery](https://girardo.com/car/1965-alfa-romeo-giulia-sprint-gta-1/). |
| Cicada Turbo 2015 | US Alfa Romeo 4C base Coupe. [US factory brochure](https://www.alfaromeobr.com.br/assets/catalogos/Alfa-Romeo-4C-2015-USA.pdf). |
| Marsh Violet 2007 | Italian Alfa Romeo 8C Competizione production coupe. [Factory release](https://www.media.stellantis.com/em-en/alfa-romeo/press/alfa-romeo-at-the-77th-geneva-international-motor-show-2007); [multi-view gallery](https://www.ultimatecarpage.com/cg/2891/Alfa-Romeo-8C-Competizione.html). |
| Tufted Vetch 1956 | US Ford F-100 standard cab 110-inch wheelbase. [Ford archive](https://fordimages.com/products/0400-8397-jpg). |
| Brooklime 2003 | US Ford Ranger XL 2.3 regular cab 2WD. [Ford dealer catalogue](https://www.therangerstation.com/resources/pdf_documents/2003_ford_ranger_brochure.pdf). |
| Toadflax 1999 | US Ford SVT F-150 Lightning regular cab Flareside. [Factory period brochure](https://www.oldcarbrochures.org/United%20States/Ford%20Motor%20Company%20Trucks-Vans/1999-Trucks-and-Vans/1999-Ford-SVT-F-150-Lightning-Brochure/slides/1999_Ford_SVT_F-150_Lightning-02.html). |
| Corn Mint 2009 | UK MINI JCW R56 hatch. [Manufacturer press kit](https://www.press.bmwgroup.com/united-kingdom/article/detail/T0020030EN_GB/the-new-mini-john-cooper-works-press-kit?language=en_GB). |
| Water Mint 2012 | European MINI JCW GP R56. [Manufacturer archive](https://www.press.bmwgroup.com/deutschland/article/detail/T0131227DE/der-mini-john-cooper-works-gp?language=de). |
| Lesser Trefoil 2018 | Mexico MINI JCW Countryman ALL4 F60. [Manufacturer press kit](https://www.press.bmwgroup.com/mexico/article/detail/T0286274ES/el-nuevo-mini-john-cooper-works-countryman-llega-a-m%C3%A9xico-con-un-estilo-atl%C3%A9tico-m%C3%A1s-rabioso-y-m%C3%A1s-vers%C3%A1til?language=es). |

The Lightning's pair of exhaust tips exits on the passenger side ahead
of the rear axle. The MINI GP has a roof-mounted wing. Its signed beam
anchors are explicit in the exported studies; this does not alter the
studio's visible optical mesh. Remaining first-pass gaps include 350Z
lamp wrap, R56 lamp height, and F-100 bolt-on fender details.

### Full-roster rollout, Toyota, Citroën, Cadillac, and Suzuki

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Dittany 1967 | Japanese Toyota 2000GT MF10 early coupe. [Toyota Museum](https://toyota-automobile-museum.jp/en/archives/car-database/detail.html?id=113); [factory views](https://global.toyota/en/downloadable-assets/corporate-archives/toyota-museum/collection/2000gt.html). |
| Flax 1965 | Japanese Toyota Sports 800 UP15 launch model with removable top fitted. [Toyota Museum](https://toyota-automobile-museum.jp/archives/car-database/detail.html?id=55); [Toyota history](https://mag.toyota.co.uk/toyota-sports-800-history/). |
| Glasswing 1990 | Japanese Toyota Sera EXY10 base 5MT. [Original Toyota release](https://global.toyota/en/detail/7829393); [Toyota Sera history](https://mag.toyota.co.uk/history-of-the-toyota-sera/). |
| Chervil 1973 | European Citroën SM Injection 2.7. [Period European six-lamp gallery](https://citroenet.org.uk/passenger-cars/michelin/sm/sm-01.html); [1973 Injection reference](https://www.youtube.com/watch?v=YLaYMPBDx9I). |
| Camomile 1988 | French Citroën 2CV6 Spécial with roof closed. [Exact-year reference gallery](https://www.autobelle.it/en/price-observatory/citroen_2_cv6_special.xhtml); [same-trim archive photography](https://docs.les-renault-d-avant-guerre.com/4014_Vente_Andre_Trigano.pdf) (1985). |
| Balm 2006 | UK Citroën C6 base 2.7 HDi. [Factory period UK brochure](https://www.citroenet.org.uk/publicity-brochures/c6/c6gb/c6-gb-0806/c6-gb06-1.html); [period front and rear](https://www.autozine.co.uk/cache/text/pdf/gb_en/Autozine_Citroen_C6.pdf). |
| Hawthorn V 2005 | US Cadillac CTS-V LS6 6MT. [Cadillac specification sheet](https://xr793.com/wp-content/uploads/2021/11/2005-Cadillac-CTS-V-Spec-Sheet.pdf). |
| Sweet Violet 2016 | US Cadillac CTS-V LT4 automatic. [Cadillac gallery](https://media.cadillac.com/Pages/galleries/ME/EN/cadillac/passenger-cars/2016/2016-cadillac-cts-v.html). |
| Lesser Celandine 2022 | US Cadillac CT4-V Blackwing manual standard trim. [Factory trim guide](https://brochures.cadillac.com/2022/ct4-v-series/specs-trims/). |
| Agrimony 1988 | JDM Suzuki Escudo TA01W hardtop. [Suzuki factory library](https://www.suzuki.co.jp/suzuki_digital_library/1_auto/escudo.html). |
| Mossling 2019 | UK Suzuki Jimny SZ5 5MT. [UK specification and photos](https://www.thecarexpert.co.uk/suzuki-jimny-uk-prices-and-specs-announced/). |
| Bent Clover 2010 | US Suzuki SX4 Crossover, i-AWD 6MT. [US factory brochure](https://www.auto-brochures.com/makes/Suzuki/SX4/Suzuki_US%20SX4_2010.pdf). |

Stock game authority keeps the C6's 18-inch setup even though the base
UK brochure shows a 17-inch option. The Sports 800 has an inherited
2.100 m visual mount span and 2.000 m handling wheelbase; both are
unchanged, and the live rim-to-joint fit was verified. The Sera uses
transparent door-roof leaves and a painted spine, not animated doors.

### Full-roster rollout, Evolution, Jeep, Mégane, and BMW sedans

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| White Deadnettle 1995 | Japanese Mitsubishi Lancer Evolution III CE9A GSR. [Mitsubishi history](https://www.mitsubishi-motors.com/en/company/history/car/?carhub_generation=CC). |
| Hawkbit 1999 | Mitsubishi Lancer Evolution VI Group A, Mäkinen's Monte-Carlo winner, without sponsor graphics. [Mitsubishi event archive](https://www.mitsubishi-motors.com/en/brand/motorsports/wrc/1999/); [period action angle](https://dirtfish.com/rally/wrc/when-the-monte-was-decided-on-its-opening-stage/). |
| Cow Parsley 2008 | US Mitsubishi Lancer Evolution X GSR base manual. [Factory US brochure](https://dgv4.xr793.org/wp-content/uploads/2017/02/2008-Mitsubishi-Lancer-Evolution.pdf). |
| Caucasian Clover 2014 | US Jeep Grand Cherokee SRT 6.4. [Factory US specifications](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/specs/2014_JP_GrandCherokeeSRT_FA.pdf); [factory multi-angle gallery](https://www.media.stellantis.com/uk-en/jeep/press/2014-jeep-grand-cherokee-technological-evolution-of-the-species-press-pack) (regional variants differ). |
| Bogmyrtle 2018 | US Jeep Grand Cherokee Trackhawk. [Factory reveal brochure](https://www.jeep.com/assets/pdf/eBrochure%20-%20Jeep%20Grand%20Cherokee%20Trackhawk%20Reveal%20Brochure%20%282018%29.pdf). |
| Deergrass 2020 | US Jeep Gladiator Rubicon 3.6 manual crew cab with five-foot box. [Factory launch](https://www.media.stellantis.com/em-en/jeep/press/all-new-2020-jeep-gladiator-the-most-capable-jeep-truck-ever). |
| Bur Parsley 2008 | French Renault Mégane II R26.R two-seater. [Factory release](https://media.alpinecars.com/megane-r26r-nouveau-fer-de-lance-de-la-gamme-renault-sport-technologies/?lang=fra). |
| Bitter Vetch 2010 | German Renault Mégane III RS250 Sport coupe. [Period German photo reference](https://www.autobild.de/artikel/preise-renault-megane-r.s.-995087.html). |
| Greater Burnet 2018 | Belgian Renault Mégane IV RS280 Sport five-door. [Renault Belgium announcement](https://be.media.renaultgroup.com/nouvelle-megane-rs-la-sportive-agile-efficace-et-polyvalente-devoile-ses-tarifs/?lang=bel). |
| Goldilocks 1995 | European BMW M5 E34 3.8 late-facelift manual. [BMW Classic](https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-1525-1.bmw-m5-e34-340-hp.html); [1995 example](https://www.norclassics.com/en/product/bmw-m5-e34-3-8-last-edition-1995/). |
| Heath Speedwell 2009 | US BMW M5 E60 V10 manual. [BMW USA press kit](https://www.press.bmwgroup.com/usa/article/detail/T0018132EN_US/press-kit%3A-2009-bmw-m5?language=en_US). |
| Plum Clover 2008 | US BMW 550i E60 4.8 manual non-Sport. [BMW USA trim reference](https://www.press.bmwgroup.com/usa/article/detail/T0017751EN_US/the-2008-bmw-5-series?language=en_US); [same-generation shell](https://www.press.bmwgroup.com/global/photo/detail/P0033668/bmw-5-series-saloon-01/2007). |

The Group A Evo VI uses separate adjustable mudflaps. The Gladiator's
long wheelbase stays stock. BMW rear glass and rear optics, Mégane
factory light signatures, and Trackhawk fascia shaping are simplified.

### Full-roster rollout, Lexus, Saab, Chevrolets, BMW, and Volkswagen

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Mignonette 2011 | UK/EU Lexus LFA standard, not Nürburgring Package. [Lexus exterior archive](https://media.lexus.co.uk/images/lfa-exterior/). |
| Purple Vetch 2021 | Canadian Lexus LC 500 base on 20-inch wheels. [Lexus Canada](https://media.lexus.ca/en/releases/2020/2021-lexus-lc-luxury-driving-evolved.html). |
| Wild Clary 2015 | US Lexus RC F standard, not Carbon Package. [Lexus USA](https://pressroom.lexus.com/album/2015-2016-lexus-rc-f/). |
| Fumitory 1974 | US Saab Sonett III V4 4MT with later bumpers and cast wheels. [Lane Motor Museum](https://www.lanemotormuseum.org/collection/cars/item/saab-97/); [factory service manual](https://www.saab-teile.de/pdf/Saab%20Sonett%20III%20V4%20SM%20en.pdf). |
| Valerian Turbo 1992 | US Saab 900 Turbo 16V three-door manual on the directional three-spoke wheels. [Factory brochure](https://www.auto-brochures.com/makes/Saab/900/Saab_US%20900_1992.pdf); [factory owner's manual](https://www.vintagesaabmanuals.org/uploads/1/9/1/5/19154273/92saab900ownersmanual.pdf). |
| Blackberry Clover 2011 | US Saab 9-5 Turbo4 base manual, not Premium or Aero. [Factory brochure](https://www.auto-brochures.com/makes/Saab/Saab_US%202011.pdf). |
| Common Restharrow 1966 | Chevrolet Chevy II Nova SS 327 coupe. [Period brochure](https://over-drive-magazine.com/wp-content/uploads/2024/12/1966-Chevy-II-Brochure-1-12C.pdf). |
| Sneezewort 1965 | Chevrolet Corvair Monza 164 Sport Coupe. [Period catalog](https://www.corvair.org/chapters/southcoast/misc/CorvairCatalog.pdf). |
| Wood Vetch 1970 | Canadian Chevrolet Camaro Z28 350 without RS split bumpers. [Period trim distinction](https://macswebs.com/7073camaroworld/pdffiles/1970-chevrolet-camaro.pdf) (US edition). |
| Peach Clover 2009 | US BMW 128i E82 3.0 base coupe. [BMW standard specification](https://www.press.bmwgroup.com/usa/article/attachment/T0018120EN_US/42485); [stock exterior](https://commons.wikimedia.org/wiki/File:%2709_BMW_128i_Coupe_(Montreal).jpg). |
| Dew Clover 2012 | US BMW 328i F30 base sedan. [BMW US launch](https://www.press.bmwgroup.com/usa/article/detail/T0122576EN_US/introducing-the-all-new-6th-generation-bmw-3-series-sedan?language=en_US) (press imagery also shows other trims). |
| Fawn Clover 2011 | US BMW 740i F01 short-wheelbase base sedan. [BMW US launch](https://www.press.bmwgroup.com/usa/article/detail/T0076496EN_US/the-2011-bmw-740i-and-740li-sedans). |
| Blue Trefoil 2002 | German Volkswagen Lupo GTI 1.6 16V six-speed. [Volkswagen archive](https://www.volkswagen-newsroom.com/en/images/albums/lupo-gti-archive-2302). |
| Field Pennywort 2011 | German Volkswagen Scirocco III R 195 kW six-speed. [Volkswagen model history](https://www.volkswagen-newsroom.com/en/scirocco-3-20082017-19654). |
| Glasswort 181 1973 | Civilian European Volkswagen Type 181 1600 after the 1973 update. [Volkswagen model history](https://www.volkswagen-newsroom.com/en/type-181-courier-19691980-19669). |

The Corvair and Type 181 use explicit stock frame conversions, not
changes to handling. The 128i pins the exact stock wheel positions within
a one-millimeter export guard; the actual asymmetry is under one micron.
Lexus light signatures and the LFA exhaust height, Corvair cooling vents,
BMW rear glass and lens shapes, and the Type 181 folded top remain stylized.

### Full-roster rollout, Alfa Romeo, Fiat, Volvo, and Lotus

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Marsh Woundwort 1968 | Original Alfa Romeo 33 Stradale production coupe, not the Tipo racer or revival. [Alfa Romeo history](https://www.media.stellantis.com/em-en/heritage-hub-italy/press/alfa-romeo-celebrates-the-50th-birthday-of-the-legendary-33-stradale); [original cars, multiple angles](https://commons.wikimedia.org/wiki/Category:Alfa_Romeo_33_Stradale). |
| Horseshoe Vetch 1992 | UK-market Alfa Romeo 155 Q4 road sedan, pre-widebody. [Period brochure archive](https://www.archives-catalogues-automobiles.fr/shop/en/italian-brands/12974-AL559014-01.html). |
| Field Gentian 2017 | US Alfa Romeo Giulia Quadrifoglio 2.9 RWD eight-speed. [US period brochure](https://autocatalogarchive.com/wp-content/uploads/2017/06/Alfa-Romeo-Giulia-2017-USA.pdf). |
| Broadleaf Dock 2011 | French Alfa Romeo Giulietta Quadrifoglio Verde 1750 TBi six-speed. [Alfa Romeo France](https://www.media.stellantis.com/fr-fr/alfa-romeo/press/alfa-giulietta-quadrifoglio-verde). |
| Strawberry Clover 1965 | Alfa Romeo Giulia TZ2 competition coupe, not TZ1. [Alfa Romeo Heritage](https://www.heritagehubitaly.com/it-it/heritage/storie/alfa-romeo-giulia-tz-tz2). |
| Hairy Tare 1969 | Italian Fiat Dino 2400 Bertone coupe, not Spider or 2.0. [Fiat Heritage](https://dev-heritagehubitaly-com.aem.stellantis.com/en-uk/heritage/stories/fiat-dino-2400-coupe); [1969 exterior](https://commons.wikimedia.org/wiki/File:1969_Fiat_Dino_2400.jpg). |
| Bistort 1986 | Continental European Volvo 480 ES launch model, five-speed, solid roof. [Volvo launch packet](https://www.volvoclub.org.uk/press/pdf/480ES-PressRelease.pdf); [Volvo archive](https://www.volvocars.com/intl/media/press-releases/3913CEEFE92AC367/). |
| Haresfoot Clover 1997 | Canadian Volvo 850R sedan five-speed manual, not US automatic or wagon. [Canadian period brochures](https://www.geocities.ws/ozbrick850/brochures.html); [period 850R brochure](https://www.matthewsvolvosite.com/volvo-850-r-brochure/). |
| Stitchwort 1965 | US Volvo PV544 Sports Sedan type 11244, manual B18D. [Volvo heritage](https://www.volvocars.com/us/cars/legacy-models/pv544/); [same B18 body in period brochure](https://viaretro.com/wp-content/uploads/2021/07/PV544BrochureDecember1961.pdf). |
| Mulberry Clover 2008 | US Volvo XC90 3.2 FWD base, not Sport or V8. [Volvo USA model-year specs](https://www.volvocars.com/us/media/press-releases/1503728965E53363/). |
| Sloe Clover 2010 | US Volvo XC60 T6 AWD non-R-Design. [Volvo USA introduction](https://www.volvocars.com/us/media/press-releases/9DF97C0DFED0B8A2/); [US brochure](https://www.volvoclub.org.uk/pdf/xc60/Volvo-2010-XC60-brochure-USA.pdf). |
| Raspberry Clover 2008 | US Volvo S80 V8 AWD passive chassis. [Volvo USA model-year overview](https://www.volvocars.com/us/media/press-releases/3512721DDE6F3F30/). |
| Red Trefoil 2000 | Road Lotus 340R 177 bhp, open wheel-forward body. [Lotus history](https://www.lotuscars.com/en/lotus-story/road-cars/340r). |
| Purple Trefoil 2009 | UK road-going supercharged Lotus 2-Eleven SVA, not GT4. [Lotus period brochure](https://www.allcarcentral.com/lotus_pdf/Lotus_2_Eleven_2009.pdf). |
| Snow Clover 2011 | Early UK Lotus Evora S 2+2 six-speed, not 400 or later fascia. [Same-generation Lotus brochure](https://www.lotusdriversguide.com/Downloads/Brochures/Evora-Brochure-ENG%202012.pdf); [period Evora S photography](https://www.asphalte.ch/news/2011/08/road-test-lotus-evora-s/2/). |

The Lotus 340R uses a separate narrow tub and four individual cycle guards.
The Volvo lamp tower-to-fascia junction and fixed pop-up shapes are
simplified, along with the TZ2's inset optics and Giulietta's rear hatch.

### Full-roster rollout, Celica, Renault, Ford, Volvo, and Miata

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Stone Parsley 1994 | UK Toyota Celica GT-Four ST205 road launch model. [Toyota UK gallery](https://media.toyota.co.uk/images/celica-gt-four-exterior-1994-1999/); [launch packet](https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/Celica-Gen6-GT-Four-UK-launch-pack.pdf). |
| Melilot 1993 | Toyota Celica ST185 Group A RAC Rally winner, Kankkunen and Grist. [Period race gallery](https://www.pro-rally.co.uk/gallery/1993-network-q-rac-rally/); [same car, multiple angles](https://commons.wikimedia.org/wiki/Category:Toyota_Celica_GT-Four_ST185_(1993_Wales_Rally_GB,_No.1)). |
| Rockrose 1994 | Rod Millen Toyota Celica AWD Unlimited Pikes Peak prototype. [Toyota history](https://mag.toyota.co.uk/toyota-people-motorsport-legend-rod-millen/); [period footage](https://www.youtube.com/watch?v=-vZJXWL5yBM). |
| Sorrel 133 2008 | UK Renaultsport Twingo 133 standard Sport chassis, not Cup or 2011 facelift. [2008 UK brochure](https://autocatalogarchive.com/wp-content/uploads/2021/06/Renault-Twingo-Sport-133-2008-UK.pdf). |
| Lesser Stitchwort 2013 | French Renault Clio R.S. 200 EDC Sport, not Cup or Trophy. [Renault France](https://media.alpinecars.com/nouvelle-renault-clio-rs-200-edc-tarifs-et-equipements/?lang=fra). |
| Thimble Clover 2014 | German Renault Twingo Expression SCe 70, five doors and rear engine, no Energy package. [German factory price/equipment guide](https://el.semen.de/scenic/Preisliste_Twingo_2014.pdf). |
| Broadleaf Clover 1971 | US Ford Mustang Mach 1 429 CJ-R regular package, dual Ram Induction, standard axle. [Ford references](https://fordimages.com/pages/1971-ford-mustang-factory-reference); [1971 Ford brochure](https://ponynsnake.com/wp-content/uploads/2023/07/access-1971_Ford_Mustang_brochure_AR_96_212010_7046.pdf). |
| Mouseear Hawkweed 1986 | US Ford Mustang SVO standard 2.3 turbo five-speed, no Competition Prep. [Ford USA brochure](https://www.auto-brochures.com/makes/Ford/Mustang/Ford_US%20Mustang_1986.pdf). |
| Holly 1988 | US Ford Thunderbird Turbo Coupe 2.3 intercooled manual, not later SC. [Ford USA brochure](https://www.auto-brochures.com/makes/Ford/Thunderbird/Ford_US%20Thunderbird_1988.pdf). |
| Juneberry Clover 2007 | US Volvo S40 2.4i base five-speed, not T5. [Volvo USA](https://www.volvocars.com/us/media/press-releases/2EB70A881C28E85B/). |
| Snowdrop T5 2008 | US Volvo C30 T5 Version 1.0 6MT, no Custom Build options. [Volvo USA](https://www.volvocars.com/us/media/press-releases/30866183D4E5D637/). |
| Wood Sorrel 2013 | US Volvo C30 Polestar Limited Edition production hatch, not AWD concept. [Volvo USA](https://www.volvocars.com/us/media/press-releases/BAC5EB4A3B6F3CB1/). |
| Mouse-ear 2005 | US Mazda Mazdaspeed MX-5 turbo NB 6MT, standard roof trim. [Mazda USA](https://news.mazdausa.com/vehicles?item=129); [2005 car gallery](https://bringatrailer.com/listing/2005-mazda-mx-5-miata-4/). |
| Red Campion 2013 | US Mazda MX-5 Sport NC3, vinyl soft top, 5MT. [Mazda USA press kit](https://news.mazdausa.com/vehicles-2013-mx-5-miata). |
| White Campion 2016 | US Mazda MX-5 Sport ND, cloth soft top and 6MT, not Club, GT or RF. [Mazda USA press kit](https://news.mazdausa.com/vehicles-2016-mx-5). |

Clio road-trim reference specifies 18-inch wheels; stock game 17-inch
tire and wheel mounts remain unchanged. Competition Celica sponsor and
trademark graphics are omitted; this is not an event-day replication.
SVO wing spacing and C30 glass-to-tail transition remain approximations.

### Full-roster rollout, Lancia, Hyundai, Subaru, Kia, and Mercedes-Benz

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Blackcurrant Clover 1998 | Italian Lancia Y LS 1.2 16V, not the Geneva accessory car. [Lancia Italy](https://www.media.stellantis.com/it-it/lancia/press/motor-show-di-bologna-1998-lancia-y). |
| Privet Clover 2003 | Lancia Thesis Executive 3.2 V6 unarmored Italian model. [Lancia trim and engine](https://www.media.stellantis.com/em-en/lancia/press/new-engines-for-the-lancia-thesis); [Lancia body overview](https://www.media.stellantis.com/em-en/lancia/press/lancia-thesis-a-car-that-embodies-the-italian-art-of-living). |
| Redcurrant Clover 1999 | Italian Lancia Lybra 2.0 20V base sedan manual, not wagon. [Lancia Italy](https://www.media.stellantis.com/it-it/lancia/press/lancia-lybra-4). |
| Fleabane 2012 | US Hyundai Veloster base 1.6 GDI six-speed, standard 17-inch wheels. [Factory US brochure](https://www.auto-brochures.com/makes/Hyundai/Veloster/Hyundai_US%20Veloster_2012.pdf). |
| Harebell 2019 | US Hyundai Veloster N base 250 hp on 18-inch wheels, not Performance Package. [Hyundai US launch](https://www.hyundai-n.com/en/brand/press/hyundai-introduces-2019-veloster-n-first-u.s.-market-n-brand-high-performance-model-20191024); [US brochure](https://www.auto-brochures.com/makes/Hyundai/Veloster/Hyundai_US%20Veloster_2019-N.pdf). |
| Basil Thyme 2020 | German Hyundai i30 N Performance original five-door body, pre-facelift manual. [Hyundai Germany trim guide](https://www.hyundai.news/newsroom/dam/de/Pressemappen/i30_N/20200130/Hyundai_i30_N_2020_2_Ausstattung_1.pdf). |
| Briar Trail 2024 | US Subaru Forester Wilderness 2.5 CVT, not Base or 2025. [Subaru Wilderness brochure](https://www.subaru.com/content/dam/subaru/downloads/pdf/brochures/2024/2024_Forester_Wilderness_Brochure_050824.pdf). |
| Calamint 2003 | US Subaru Baja launch 2.5 naturally aspirated five-speed, open bed, non-turbo. [Factory brochure](https://www.motorologist.com/wp-content/uploads/2003-Subaru-Baja-brochure.pdf). |
| Campion 1992 | US Subaru SVX standard AWD, no optional Touring sunroof or spoiler. [Original US brochure](https://importarchive.com/brochure/subarusvx1992_02). |
| Zinnia 16 2010 | US Kia Soul 1.6 base five-speed. [Kia America launch](https://www.kiamedia.com/us/en/media/pressreleases/3610/all-new-2010-kia-soul). |
| Amber Trefoil 2013 | US Kia Sportage base 2.4 FWD six-speed. [Kia trim and specifications](https://www.kiamedia.com/us/en/models/sportage/2013/specifications). |
| Thornbill GT 2018 | US Kia Stinger GT 3.3 turbo RWD, not GT1/GT2. [Kia trim pricing](https://www.kiamedia.com/us/en/models/stinger/2018/pricing); [vehicle overview](https://www.kiamedia.com/us/en/media/pressreleases/12966/2018-kia-stinger-overview). |
| Myrtle Clover 2005 | US Mercedes-Benz SLK350 R171 six-speed hardtop raised. [US factory brochure](https://www.brochure-catalogue-voiture-neuve.fr/en/brochures/mercedes-benz/classe-slk/mercedes-benz-classe-slk-2005/ANG-2005-US/). |
| Wood Dock 2012 | German Mercedes-Benz SLK55 AMG R172 hardtop raised. [German factory price and model guide](https://www.mbslk.de/files/artikel/Preisliste_SLK-Klasse_120120.pdf). |
| Hackberry Clover 2008 | US Mercedes-Benz SL550 R230 7AT, hardtop raised and non-AMG trim. [US factory brochure](https://www.auto-brochures.com/makes/Mercedes_Benz/SL-Class/Mercedes%20Benz_US%20SL-Class_2008.pdf). |

Velosters have their own right-side rear door seam and hidden pull and
do not change two- or four-door designs. The SVX has separate side
glazing panes on its side surface. Hinges and roof animations are not
implemented. Lancia rear lamp shapes and Kia hatch and lamp joins remain
approximations.

### Full-roster rollout, Canadian Lexus, Audi, Dodge SRT, Porsche, and Subaru

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Bearberry Clover 2005 | Canadian Lexus ES 330 base, 16-inch wheels and no Luxury/Appearance/AVS package. [Lexus Canada gallery](https://media.lexus.ca/en/albums/2005/2005-lexus-es-330.html). |
| Bilberry Clover 2005 | Canadian Lexus SC 430 standard 4.3 V8, roof closed, not Pebble Beach. [Lexus Canada gallery](https://media.lexus.ca/en/albums/2005/2005-lexus-sc-430.html). |
| Cloudberry Clover 2005 | Canadian Lexus GX 470 standard 4.7 VVT-i, eight seats. [Lexus Canada exact specs](https://media.lexus.ca/content/dam/media-lexus/general/unassigned/20145/specs_2005_GX470.pdf). |
| Hoary Willowherb 2001 | UK Audi RS4 B5 Avant 2.7 manual, RHD, standard wheels and left-side paired outlets. [Factory English brochure](https://www.brochure-catalogue-voiture-neuve.fr/de/brochures/audi/a4/audi-a4-1998/B5-2-ANG-03-2000-RS4-AVANT-QUATTRO/). |
| Cinquefoil 2004 | US Audi S4 B6 sedan 4.2 V8 6MT, not Avant or Tiptronic. [Audi of America specifications](https://www.audiworld.com/model/s4/04/s4sedan.pdf); [US six-speed example](https://www.pcarmarket.com/results/26k-mile-2004-audi-s4-sedan-6-speed). |
| Golden Saxifrage 2003 | Continental European Audi RS6 C5 standard 4.2 biturbo sedan, not Avant or Plus. [Period release/specification](https://www.motorline.cc/autowelt/2002/Audi-RS6-Neuvorstellung-Technische-Daten-Limousine-111711.html); [sedan angles](https://commons.wikimedia.org/wiki/Category:Audi_RS6_C5_sedans). |
| Greater Knapweed 2008 | US Dodge Viper SRT10 ACR road setup, standard audio, not Hardcore. [ACR factory specifications](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/specs/2008ViperSRT10ACRSpecs110107.pdf). |
| Hoary Plantain 2015 | Canadian Dodge Challenger Hellcat 707 hp 6MT on standard tires. [Dodge Canada press kit](https://www.fcapresskit.ca/2015/Contents/Press-Releases/PDFs/Dodge/Challenger_SRT/CN_2015_DG_Challenger_SRT_HS.pdf). |
| Starry Clover 2018 | Canadian Dodge Challenger Demon at the standard 91-octane specification with one left driver seat. [Dodge Canada press kit](https://www.fcapresskit.ca/2018/data/dodge_challenger.html). |
| Cow Clover 1957 | European Porsche 356A 1600 Speedster standard 60 PS, low seats and open roof. [Porsche Classic](https://www.porsche.com/usa/accessoriesandservice/classic/models/356/356-a/). |
| Sandspurry Six 1970 | European Porsche 914/6 road targa, not competition GT. [Porsche Classic](https://www.porsche.com/de-AT/accessoriesandservice/classic/models/914/914-6/); [factory parts catalogue](https://porschecarshistory.com/wp-content/old/manuals/E/E_914_KATALOG.pdf). |
| Sea Lavender GTS 1993 | European Porsche 928 GTS 5MT. [Period German catalogue](https://www.archives-catalogues-automobiles.fr/shop/fr/porsche/316-PO284009-02.html). |
| Persian Clover 1990 | Early Japanese Subaru Legacy RS BC5A, standard trim 5MT, not RS-RA. [Subaru Japan](https://ucar.subaru.jp/php/catalog/grade.php?cat_id=4501037); [period homologation and reference views](https://historicdb.fia.com/sites/default/files/car_attachment/1589842012/homologation_form_number_5422_group_a.pdf). |
| Wineberry Clover 2008 | US Subaru Tribeca Base five-seater without rails, third row or moonroof. [Subaru factory release](https://www.subaru.co.jp/en/news/archives/press/2007/07_04_03e_02.pdf); [US brochure](https://xr793.com/wp-content/uploads/2017/03/2008-Subaru-Tribeca.pdf). |
| Starflower 20 2024 | US Subaru Impreza Base no moonroof, standard wheels. [Subaru trim chart and photos](https://www.subaru.com/services/vehicles/pdf/trimComparison/2024/IMP); [US brochure](https://www.subaru.com/content/dam/subaru/downloads/pdf/brochures/2024/MY24_Impreza_Brochure.pdf). |

The SC roof seal and 914 parked covers are static. The Demon intake
appearance does not change engine operation. The GX uses an eight-seat
layout; its rear door remains static. The 928 rear glass and Subaru rear
optical hook remain simplified.

### Full-roster rollout, Lexus, Audi, Dodge utility, Le Mans, and Pikes Peak

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Magnolia 40 1990 | UK June Lexus LS 400 launch RHD with coils and 4AT. [Lexus UK launch kit](https://media.lexus.co.uk/wp-content/uploads/sites/3/pdf/LS400-Gen1-UK-launch-pack-1990.pdf); [gallery](https://media.lexus.co.uk/vehicles/ls-400-archive-1990/). |
| Meadow Saffron 2014 | US Lexus IS 350 F Sport RWD 8AT. [Lexus gallery](https://pressroom.lexus.com/album/2014-2015-lexus-is-250-350-f-sport-third-3rd-generation/). |
| Lingonberry Clover 2005 | Canadian Lexus RX 330 standard AWD with coils. [Lexus Canada specifications](https://media.lexus.ca/content/dam/media-lexus/general/unassigned/20145/05LexusRX330_E_specs.pdf). |
| Meadow Sage 2011 | UK Audi RS5 B8 coupe 4.2 FSI standard 19-inch wheels. [UK factory brochure](https://xr793.com/wp-content/uploads/2022/10/2011-Audi-RS-5-Coupe-UK.pdf). |
| Field Madder 2013 | Dutch Audi RS7 C7 Sportback 560 PS, four seats. [Audi Dutch launch](https://nieuws.audi.nl/de-nieuwe-audi-rs-7-sportback/). |
| Field Pansy 2009 | Continental European Audi RS6 C6 V10 sedan, not Avant/Plus. [Audi factory history and gallery](https://www.audi.com/en/media-releases/20-years-four-generations-audi-rs-6-superior-performance-with-an-everyday-look-14768). |
| Masterwort 2008 | US Dodge Sprinter 2500 cargo 144-inch wheelbase high roof, single rear wheels, two seats. [Dodge factory specifications](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/specs/2008DodgeSprinterSpecifications.pdf). |
| Pearlwort 1999 | US Dodge Dakota base regular cab, short box, 2.5 manual RWD. [Factory brochure](https://xr793.com/wp-content/uploads/2018/09/1999-Dodge-Dakota.pdf). |
| Osier 2005 | US Dodge Dakota SLT Quad Cab short box 4.7 4WD, representative trim. [Factory brochure](https://xr793.com/wp-content/uploads/2016/11/2005-Dodge-Dakota.pdf). |
| Alchemilla 1988 | Ari Vatanen Peugeot 405 T16 Pikes Peak winner, not Dakar. [Peugeot period history and footage](https://www.media.stellantis.com/uk-en/peugeot/press/the-peugeot-405-t16-the-predecessor-of-the-new-508-peugeot-sport-engineered-and-the-greatest-embodiment-of-the-1990-s-sports-saloon). |
| Orpine 2013 | Sébastien Loeb Peugeot 208 T16 Unlimited hill climb, not T16 R5. [Peugeot 2013 event photos and release](https://www.media.stellantis.com/es-es/peugeot/press/sebastien-loeb-y-el-peugeot-208-t16-pikes-peak-listos-para-la-salida). |
| Moschatel 2018 | Romain Dumas Volkswagen I.D. R Pikes Peak record car, not 2019 low-drag revision. [Volkswagen period photo book](https://www.volkswagen-newsroom.com/en/publications/more/mission-maximum-180/download). |
| Sanicle 1970 | Porsche 917 KH Salzburg #23, chassis 917-023 short-tail winner. [Porsche race archive](https://newsroom.porsche.com/pdf/d53ba335-cc90-49e4-a5e6-039887e19979?print=). |
| Houndstongue 1982 | Porsche 956 LH #1 Ickx/Bell overall winner. [Porsche period account](https://newsroom.porsche.com/christophorus/en/2022/402/laptime.html); [exact period photography](https://www.racingsportscars.com/photo/1982/Le_Mans-1982-06-20-001.jpg). |
| Butterbur 1991 | Mazda 787B #55 chassis 787B-002 overall winner. [Mazda archive](https://www2.mazda.com/en/100th/cars/detail_012_787b.html). |

Competition paint color blocking is recreated without sponsor graphics.
The Lexus IS guide is a separate passive optical element. Sprinter
cargo rear transitions and the race prototypes' airflow surfaces and
light internals remain simplified. Sampled steering clearance at nominal
height is not a full suspension-travel test.

### Full-roster rollout, Aston Martin, European compacts, minivans, Mercedes, and Jaguar

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Herb Bennet 1964 | UK Aston Martin DB5 standard saloon 4.0 ZF manual, not Vantage. [Aston Martin archive](https://media.astonmartin.com/db5/?lang=eng); [1964 example](https://rmsothebys.com/auctions/az13/lots/r173-1964-aston-martin-db5/). |
| Common Figwort 1960 | Original Aston Martin DB4 GT Zagato twin-plug 3.7, not continuation. [Aston Martin archive](https://media.astonmartin.com/db4-gt-zagato/?lang=eng). |
| Bur Medick 1967 | Original Aston Martin DBS 4.0 six-cylinder ZF manual, not Vantage or V8. [Aston Martin history](https://www.astonmartin.com/en/models/past-models/dbs). |
| Creek Clover 2009 | German Renault Modus Avantage 1.2 short-body manual facelift. [Renault Germany](https://presse.renault.de/modus-jetzt-mit-esp-in-serie/?lang=deu); [facelift rear](https://commons.wikimedia.org/wiki/File:Renault_Modus_Facelift_20090808_rear.JPG). |
| Hill Trefoil 2009 | German Renault Laguna Grandtour Emotion 2.0 petrol estate, standard steering. [Renault Germany](https://presse.renault.de/fuhrend-bei-qualitat-umweltschutz-und-sicherheit-in-der-mittelklasse/?lang=deu); [period Emotion](https://www.autobild.de/artikel/renault-laguna-emotion-915705.html). |
| Poplar Clover 2009 | UK Citroën C3 Picasso VT 1.4 VTi 95 base. [UK factory brochure](https://xr793.com/wp-content/uploads/2022/09/2009-Citroen-C3-Picasso-UK.pdf). |
| Lungwort 2005 | US Honda Odyssey EX eight seats, solid roof and rails, no VCM package. [Honda press kit](https://hondanews.com/en-US/releases/release-6f58edbf0f0b1cb5f5713f004c34c39d-2005-honda-odyssey-press-kit). |
| Selfheal 2005 | US Dodge Grand Caravan SE long-wheelbase, removable cloth benches. [US factory brochure](https://www.auto-brochures.com/makes/Dodge/Grand%20Caravan/Dodge_US%20GrandCaravan_2005.pdf). |
| Laurel Clover 2006 | US Mazda MPV LX-SV seven seats, no GFX package. [Mazda USA](https://news.mazdausa.com/vehicles-2006-Mazda-MPV). |
| White Clover 2004 | Early-2004 German Mercedes-Benz C32 AMG W203 5AT sedan. [Mercedes archive](https://media.mercedes-benz.com/article/3c077846-2100-4fbd-ba93-b1c15e9d33dd). |
| Sea Campion 2006 | Early-2006 German Mercedes-Benz E55 AMG S211 estate, not E63. [Mercedes archive](https://media.mercedes-benz.com/en/article/80c034f7-82c7-4232-8530-f6176b63405c); [estate photos](https://commons.wikimedia.org/wiki/Category:Mercedes-Benz_S211_E_55_AMG). |
| Tayberry Clover 2011 | US Mercedes-Benz E350 BlueTEC W212 Luxury sedan, not Sport. [US factory brochure](https://www.auto-brochures.com/makes/Mercedes_Benz/E-Class/Mercedes%20Benz_US%20E-Class_2011.pdf). |
| Blackthorn 1986 | US Jaguar XJ6 Series III base 4.2 with closed sunroof, not Vanden Plas. [Original brochure](https://jaguarrules.ru/wp-content/uploads/2019/03/Jaguar-small-range-brochure-1986.pdf). |
| Spotted Medick 1961 | UK Jaguar E-Type Series I 3.8 OTS, original car reference. [Jaguar Heritage 77 RW](https://www.jaguarheritage.com/vehicle-collection/1961-jaguar-e-type-series-1-3-8-litre-77-rw/). |
| Kidney Vetch 1966 | Jaguar XJ13 original prototype, not a replica. [Jaguar Heritage](https://www.jaguarheritage.com/vehicle-collection/1966-jaguar-xj13/). |

The Astons and E-Type share native cross-laced wheels. The Odyssey has
a genuine separate middle jumper, and the Caravan has two-place middle
bench and three-place rear bench. Minivan hatch ends remain simplified;
Mercedes lamp envelopes and classic wing-to-glass transitions are not
yet photo-exact.

### Full-roster rollout, modern Aston Martin, Škoda, Plymouth, Nissan, and Jaguar

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Water Forgetmenot 2008 | UK Aston Martin DBS 5.9 V12 manual coupe, 2+0. [Aston Martin archive](https://media.astonmartin.com/dbs2/?lang=eng). |
| Marsh Bedstraw 2017 | UK Aston Martin DB11 original V12 608 PS, not V8 or AMR. [Aston Martin launch archive](https://www.astonmartin.com/en/our-world/news/2017/2/28/aston-martin-db11-the-latest-in-an-illustrious-bloodline). |
| Suckling Clover 2019 | Original Aston Martin DBS Superleggera coupe, not Volante or Ultimate. [Aston Martin launch](https://www.astonmartin.com/en-gb/our-world/news/2018/6/26/introducing-the-new-dbs-superleggera-two-illustrious-names-one-magnificent-super-gt). |
| Winterberry Clover 2015 | European Škoda Fabia Combi Active 1.0 MPI 75, standard 14-inch. [Škoda launch kit](https://www.skoda-storyboard.com/en/press-kits/new-skoda-fabia-combi-simply-fabulous-press-kit/). |
| Elderberry Clover 2015 | European Škoda Superb Combi Active 1.4 TSI 125, normal suspension. [Škoda launch kit](https://cdn.skoda-storyboard.com/2016/05/150629-The-new-%C5%A0KODA-Superb-Combi-Press-Kit.pdf). |
| Bayberry Clover 2017 | European facelift Škoda Rapid Spaceback Active 1.0 TSI 95 five-door. [Škoda press kit](https://cdn.skoda-storyboard.com/2017/05/SKODA_RAPID_SPACEBACK_Press_Kit_EN_with_TD.pdf). |
| Bithynian Vetch 1958 | US Plymouth Fury Dual Fury V-800 318 three-speed, not Golden Commando. [Original brochure](https://over-drive-magazine.com/document/1958-plymouth-fury-foldout-brochure/). |
| Bush Vetch 1968 | US Plymouth Barracuda Formula S 340 four-speed fastback, not later E-body. [Original brochure](https://over-drive-magazine.com/document/1968-plymouth-barracuda-brochure/). |
| Toothwort 1970 | Petty Plymouth Superbird #43 Carolina 500 winner, non-graphic event tribute. [NASCAR race record](https://www.nascar.com/news-media/2022/07/02/cataloging-all-200-of-richard-pettys-nascar-wins-one-by-one/); [Plymouth period ad](https://autohistorypreservationsociety.org/wp-content/uploads/1970-03-MOTOR-TREND.pdf). |
| Heartsease 1991 | Bathurst 1991 Tooheys 1000 winning Nissan Skyline R32 GT-R, Richards/Skaife. [Nissan Australia retrospective](https://australia.nissannews.com/en-AU/releases/making-a-monster-how-the-nissan-gt-rs-godzilla-legend-was-cemented-at-mount-panorama). |
| Slender Tare 1995 | Nissan NISMO GT-R LM BCNR33 road homologation one-off, not race car. [Nissan exact car archive](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/181_nismo_gt-r_lm_road_car.html). |
| Hellebore RS 2015 | US Nissan Juke NISMO RS front-drive six-speed manual, not AWD CVT. [Nissan US press kit](https://usa.nissannews.com/en-US/releases/us-2015-nissan-juke-nismo-press-kit). |
| Curled Dock 2015 | UK Jaguar XE S 3.0 launch rear-drive 8AT. [Jaguar period press kit](https://media.jlr.com/archive-jaguar/en-gb/news/2015/04/press-kit-new-jaguar-xe). |
| Red Bartsia 2015 | UK Jaguar XFR-S X250 rear-drive saloon, not Sportbrake. [UK period brochure](https://xr793.com/wp-content/uploads/2022/10/2015-Jaguar-XF-UK.pdf). |
| White Stonecrop 2012 | UK Jaguar XKR-S 5.0 supercharged automatic coupe, not convertible or GT. [Jaguar launch](https://media.jlr.com/jaguar/en-gb/news/2011/02/jaguar-launch-xkr-s-and-celebrate-50-years-e-type-geneva). |

Race vehicles omit their sponsor graphics. Fury fins, Superbird extended
nose, DB11 roof rails and Juke split lamps are editable shapes. Škoda
clear notches do not alter active lamp assignments. Rear optical contours,
Jaguar hatch/door transitions, Juke body wrap, and some aero construction
remain approximations.

### Full-roster rollout, Aston Martin, Toyota, historic cars, Nissan, and Bentley

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Spiny Restharrow 2001 | UK original Aston Martin V12 Vanquish 5.935 ASM, not S. [Aston Martin archive](https://media.astonmartin.com/v12-vanquish/?lang=eng). |
| Yellow Vetchling 2013 | UK Aston Martin V12 Vantage S launch coupe AM28, 7-speed Sportshift III. [Aston Martin archive](https://www.astonmartin.com/en/models/past-models/v12-vantage-s). |
| Yellow Vetchling 2016 | Original production Aston Martin Vulcan 7.0, not AMR Pro. [Aston Martin archive](https://media.astonmartin.com/vulcan/?lang=eng). |
| Marjoram 2003 | US Toyota Camry LE 2.4 four-speed automatic, not SE or V6. [Factory US brochure](https://www.auto-brochures.com/makes/Toyota/Camry/Toyota_US%20Camry_2003.pdf). |
| Tutsan 2003 | US Toyota ECHO base four-door sedan 5MT. [Factory US brochure](https://www.auto-brochures.com/makes/Toyota/Echo/Toyota_US%20Echo_2003.pdf). |
| Strawberry Trefoil 2012 | US Toyota Yaris L three-door liftback 5MT. [Toyota press kit](https://pressroom.toyota.com/presskit/toyota-yaris-2012/); [three-door exterior](https://commons.wikimedia.org/wiki/File:2012_Toyota_Yaris_3-door_--_2012_NYIAS.JPG). |
| Alsike Clover 1930 | Bentley 4½ Litre supercharged Vanden Plas road tourer GH6951 four-seater. [Exact car record](https://www.vintagebentleys.org/carpages/gh6951.php). |
| Fenugreek 1939 | Mercedes-Benz W154 Grand Prix two-stage M163, not streamliner or W165. [Mercedes archive](https://media.mercedes-benz.com/en/article/f9a48175-8964-490e-9909-9f35cbea8a6f). |
| Slender Birdsfoot 1953 | Works Jaguar C-type Le Mans triple-Weber and disc brakes, not continuation. [Jaguar Heritage images](https://media.jlr.com/archive-jaguar/en-us/image-packs/photo-credit-cjdhtjaguar-c-type-heritage-images). |
| 2024 Sentinel Sedan | US Nissan Sentra S CVT. [Nissan USA press kit](https://usa.nissannews.com/en-US/releases/2024-nissan-sentra-press-kit). |
| Bighead Clover 2012 | US Nissan Versa 1.6 S N17 sedan 5MT, not carryover hatch. [Nissan USA press kit](https://usa.nissannews.com/en-US/releases/us-2012-nissan-versa-press-kit). |
| Coast Clover 2008 | US Federal Nissan Altima Coupe 2.5 S 6MT with 16-inch covered steel wheels. [Nissan USA press kit](https://usa.nissannews.com/en-US/releases/2008-altima-coupe-press-kit). |
| Dog Violet 2016 | UK original Bentley Bentayga W12 five-seater, not Speed or V8. [Bentley history](https://www.bentleymotors.com/en/about-bentley/history-and-heritage/bentayga.html). |
| Pale Clover 2017 | Bentley Continental Supersports second-generation W12 steel-roof coupe. [Bentley marque archive](https://www.bentleymotors.com/uk/en/about-bentley/history-and-heritage/continental.html). |
| Sulphur Clover 2021 | Bentley Flying Spur third-generation V8 five-seat standard trim. [Period Bentley brochure](https://cdn.dealereprocess.org/cdn/brochures/bentley/2021-flyingspur.pdf). |

The W154 is open-wheel with independently sized rear tires. Small
functional gameplay lamps are intentionally nonhistorical. Vulcan rear
blades are native separate red elements; ECHO instruments moved to
center without moving steering or the driver. Vintage sheet metal,
Flying Spur brightwork, and Nissan lamp contours remain simplified.

### Full-roster rollout, Lamborghini, Honda, Chevrolet pickups, and Maserati

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Arrowleaf Clover 1972 | European Lamborghini Jarama S/GTS 365 CV 5MT, not modified. [Lamborghini archive](https://www.lamborghini.com/en-en/history/jarama). |
| Buffalo Clover 2011 | European Lamborghini Gallardo LP 570-4 Superleggera coupé e-gear. [Lamborghini archive](https://www.lamborghini.com/en-en/history/gallardo-lp-570-4-superleggera). |
| Dwarf Clover 2008 | European Lamborghini Reventón 650 CV closed coupé, not roadster. [Lamborghini archive](https://www.lamborghini.com/en-en/history/few-off/reventon); [exact model photos](https://rmsothebys.com/auctions/mu22/lots/r0001-2008-lamborghini-reventon-coupe/). |
| Marestail 2003 | US Honda Accord DX four-door 2.4 5MT. [Honda sedan features](https://hondanews.com/en-US/releases/release-e9f432bd4dd807d4c1fc34004c34c6eb-2003-honda-accord-sedan-features). |
| Redbud V6 2007 | US Honda Accord EX-L V6 coupé six-speed manual, non-navigation. [Honda specifications](https://hondanews.com/en-US/honda-automobiles/releases/release-15abafe6d87b2a69ba8d7d004c34bfbd-2007-honda-accord-coupe-specifications). |
| Hollyleaf Clover 2006 | US Honda Civic DX four-door R18 five-speed, steel rims with covers. [Honda sedan specifications](https://hondanews.com/en-US/releases/release-591334b5ff2cd7fdfabb17004c34c1b5-2006-honda-civic-sedan-and-civic-hybrid-specifications). |
| Common Toadflax 1972 | US Chevrolet K10 Custom short Fleetside, 250 inline-six. [GM factory truck packet](https://news.chevrolet.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet-trucks/1972-Chevrolet-Truck.pdf). |
| Coralberry Clover 2004 | Canada Chevrolet Colorado Z85 Base regular cab 2WD 2.8 manual. [Canadian brochure archive](https://storm.oldcarmanualproject.com/chevroletcolorado2004.htm). |
| Feverfew 2005 | US cladded Chevrolet Avalanche 1500 LS 2WD with closed cargo cover and six seats. [GM factory packet](https://www.gm.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/2005-Chevrolet-Avalanche.pdf). |
| Heal-all 1994 | Japanese Honda Prelude Si BA8 non-VTEC 2WS, F22B 5MT. [1994 Japan model listing](https://toyota.jp/ucar/catalog/brand-HONDA/car-PRELUDE/199409/2003150/). |
| Iris 22 2001 | US Honda Prelude base manual, not Type SH. [Honda body description](https://hondanews.com/en-US/releases/release-e261b4b649cb8d11273122004c34c876-honda-prelude-body). |
| Clover Sport 2007 | US Honda Fit Sport first-generation 5MT, not Base or automatic. [Honda body description](https://hondanews.com/en-US/releases/2007-honda-fit-body). |
| Field Bindweed 1997 | Italian Maserati Ghibli Cup AM336 2.0 330 CV, not ordinary Ghibli. [Maserati archive](https://www.maserati.com/ca/en/brand/maserati-classic-cars/biturbo-and-derivates/ghibli-cup). |
| Hedge Bindweed 2004 | European Maserati MC12 Stradale with closed hardtop, not GT1. [Maserati archive](https://www.maserati.com/tr/tr/brand/maserati-classic-cars/specials/mc12). |
| Hedge Woundwort 1953 | Closed Maserati A6GCS/53 Pinin Farina Berlinetta, not roadster. [Maserati archive](https://www.maserati.com/ca/en/brand/maserati-classic-cars/post-war-racing-cars/a6gcs); [Berlinetta example](https://commons.wikimedia.org/wiki/Category:1953_Maserati_A6GCS/53_Berlinetta_Pininfarina_s/n_2056). |

The Jarama lens brows and Reventón chevron internals are separate native
options. The Avalanche has physically backed cover leaves, without animated
Midgate. Fit optical sweep, Prelude glass transitions, and Maserati
window surrounds are still simplified.

### Full-roster rollout, Italian road cars, Mitsubishi, and Chevrolet

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Egyptian Clover 1986 | European civilian carbureted Lamborghini LM002 launch V12, 5MT. [Lamborghini archive](https://www.lamborghini.com/en-en/news/lamborghini-lm002-turns-40-first-super-suv); [exact 1986 photo set](https://supercarnostalgia.com/blog/one-to-buy-13000km-omani-delivered-1986-lamborghini-lm002). |
| Seaside Clover 2014 | European Lamborghini Huracán LP610-4 launch coupé, not later derivative or roadster. [2014 multi-angle launch gallery](https://www.ultimatecarpage.com/cg/5744/Lamborghini-Huracan-LP610-4.html). |
| Sea Bindweed 2010 | European Maserati GranTurismo S Automatic 4.7 ZF, not MC Shift. [Maserati launch](https://www.media.stellantis.com/uk-en/maserati/press/maserati-granturismo-s-automatic-unveiled-at-the-geneva-auto-show-1); [multi-angle photographs](https://www.caricos.com/cars/m/maserati/2010_maserati_granturismo_s_automatic/). |
| Crimson Clover 1988 | US Mitsubishi Starion ESI-R intercooled widebody 2.6 five-speed. [Period brochure](https://xr793.com/wp-content/uploads/2024/02/1988-Mitsubishi-Starion.pdf); [period-equivalent gallery](https://www.premierauctiongroup.com/inventory-item/14668/1988-mitsubishi-starion-esi-r-coupe). |
| Ivy Speedwell 1992 | Japanese Mitsubishi Galant VR-4 E84A seventh-generation 6A12 4AT. [Japanese period catalogue](https://www.en.japanclassic.ru/booklets/161-mitsubishi-galant-1992-vii.html). |
| Marsh Cinquefoil 1998 | Japanese Mitsubishi FTO GP Version R late pre-emissions-change manual. [Japanese model gallery](https://www.carsensor.net/catalog/mitsubishi/fto/F001/M003G007/). |
| Barberry Clover 2012 | US Chevrolet Impala LS civilian base 3.6 FWD with buckets, not police. [Factory brochure](https://s3.amazonaws.com/cdn.autoipacket.com/brochures/chevrolet/2012/2012-chevrolet-impala.pdf); [same-body views](https://www.consumerreports.org/cars/chevrolet/impala/2012/photos-and-video/). |
| Goldenrod 1996 | US Chevrolet Caprice Classic LT1 wagon, eight seats without woodgrain. [GM information kit](https://www.gm.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/1996-Chevrolet-Impala.pdf); [wagon photo set](https://www.autoevolution.com/news/this-1996-chevrolet-caprice-classic-station-wagon-looks-ready-for-spring-break-roadtrips-265916.html). |
| Henbit 2005 | US Chevrolet Malibu base 2.2 Ecotec sedan, not Classic or Maxx. [Exterior angles](https://www.consumerreports.org/cars/chevrolet/malibu/2005/photos-and-video/). |
| Slender Speedwell 1997 | Japanese Mitsubishi GTO Twin Turbo MR fixed-roof Z15A manual. [Japanese specifications](https://gazoo.com/catalog/maker/MITSUBISHI/GTO/199010/4007994/); [model photo gallery](https://www.j-spec.com.au/featured/1997-Mitsubishi-GTO-Twin_Turbo_MR-15512.html). |
| White Melilot 1997 | Japanese Mitsubishi Pajero Evolution E-V55W homologation 5MT. [Factory history](https://www.mitsubishi-motors.com/en/company/history/car/index.html); [actual homologation packet](https://historicdb.fia.com/sites/default/files/car_attachment/1601085301/homologation_form_number_1094_group_t1.pdf). |
| Burnet 2005 | Barcelona–Dakar Mitsubishi Pajero/Montero Evolution MPR11, Peterhansel/Cottret. [Mitsubishi Dakar archive](https://www.mitsubishi-motors.com/en/brand/motorsports/dakar/2005/index.html); [period car gallery](https://commons.wikimedia.org/wiki/Category:Mitsubishi_Pajero_Evolution_of_St%C3%A9phane_Peterhansel_in_2005). |
| Sainfoin 1939 | Maserati 8CTF 1939 competition build, no particular Indy setup claimed. [Maserati period history](https://www.maserati.com/gb/en/news/maserati-8ctf-indianapolis-1939). |
| Water Figwort 1961 | Maserati Tipo 61 Birdcage family two-seat sports racer. [Maserati archive](https://www.maserati.com/global/en/brand/maserati-classic-cars/post-war-racing-cars/birdcage-tipo-60-tipo-61); [period variants and photos](https://www.media.stellantis.com/em-en/maserati/press/maserati-tipo-61-the-60th-anniversary-of-its-triumph-at-the-nurburgring). |
| Western Clover 2017 | UK Maserati Levante S petrol original 19-inch configuration, not later GTS/Trofeo. [Maserati UK](https://www.maserati.com/gb/en/news/levante-s-available-in-the-uk); [period brochure](https://cdn.dealereprocess.org/cdn/brochures/maserati/2017-levante.pdf). |

The front intake and seated marker controls are reusable and opt-in.
The Caprice has a physical aft-facing third row. The FTO's recessed hood
optics use the six independent gameplay roles. The Huracán and Galant
front shapes and the race Pajero wheel arches remain approximations.

### Follow-up fit corrections, existing roster slots

- **Selfheal 2005 (Grand Caravan SE):** Refitted against the [2005 Dodge brochure](https://www.auto-brochures.com/makes/Dodge/Grand%20Caravan/Dodge_US%20GrandCaravan_2005.pdf#page=6), [SE side profile](https://www.groovecar.com/research/2005/dodge/grand-caravan/se-4dr-extended-mini-van/) and [straight rear photos of an SE survivor](https://www.victorymotorsofcolorado.com/inventory/2005-dodge-grand-caravan-se/330858?photos=1) (optional rails excluded). The roof extends farther aft and the four working rear light functions now sit in vertical corner towers. The lower hatch and molding still differ from the reference.
- **Hellebore RS 2015 (Juke NISMO RS):** Refitted against Nissan's exact [front three-quarter](https://usa.nissannews.com/en-US/photos/2015-nissan-juke-nismo-rs-13), [side](https://usa.nissannews.com/en-US/photos/2015-nissan-juke-nismo-rs-10) and [head-on](https://usa.nissannews.com/en-US/photos/2015-nissan-juke-nismo-rs-17) photos. Two formed hood marker pockets, a swept grille opening and a lower recessed fascia improve profile and lamp seating. The outboard bumper still reads more upright than the real body. These two edits do not increase the roster count.

### Full-roster rollout, Toyota, Suzuki, Chevrolet, Volkswagen, and Mazda

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Hoary Cinquefoil 1992 | Japanese Toyota Supra 2.0 GT GA70 narrow body, fixed roof 5MT. [Toyota Japan model catalogue](https://toyota.jp/ucar/catalog/brand-TOYOTA/car-SUPRA/199108/1000943/); [front](https://gazoo.com/catalog/car_img/10101007/10101007_199108.jpg), [rear](https://gazoo.com/catalog/car_img/10101007/10101007_199108bk.jpg). |
| Starwort 2005 | US Toyota MR2 Spyder standard five-speed manual, no optional LSD. [Toyota family archive](https://pressroom.toyota.com/album/2000-2005-toyota-mr2-third-3rd-generation/); [exact 2005 base exterior](https://www.carsrememberwhen.com/inventory/2005-toyota-mr2-spyder-base/786646?photos=1). |
| Woodruff 1991 | US Toyota Previa Deluxe 2.4 RWD five-speed, seven seats. [Toyota archive](https://pressroom.toyota.com/album/1991-1997-toyota-previa-first-1st-generation/); [1991 brochure](https://importarchive.com/brochure/toyotaprevia1991_01). |
| Hazel S 2011 | US Suzuki Kizashi S FWD 6MT, standard full covers, not Sport/AWD. [US factory brochure](https://www.auto-brochures.com/makes/Suzuki/Kizashi/Suzuki_US%20Kizashi_2011.pdf); [matching body styling](https://commons.wikimedia.org/wiki/File:2011_Suzuki_Kizashi_S_AWD_left_front.jpg) (AWD reference, not wheel authority). |
| Wispwing 660 1993 | January 1993 Japanese Suzuki Cara E-PG6SS with fixed gullwing doors shut. [Suzuki Japan](https://www.suzuki.co.jp/suzuki_digital_library/pdf/1_auto/cara/61.pdf); [exact 1993 photo gallery](https://www.allcollectorcars.com/for-sale/1993-Suzuki-Cara-/2666155/). |
| Copperhead SC 2006 | US Chevrolet Cobalt SS Supercharged coupe 5MT without G85 package. [Factory packet](https://news.chevrolet.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/2006-Chevrolet-Cobalt.pdf); [model angles](https://commons.wikimedia.org/wiki/Category:Chevrolet_Cobalt_SS_coupe). |
| Golden Trefoil 2012 | US Chevrolet Cruze LS 1.8 6MT, 16-inch covered steel wheels, not Eco/RS. [2012 model gallery](https://www.thecarconnection.com/photos/chevrolet_cruze_2012). |
| Prairie Trefoil 2012 | US Chevrolet Sonic LS five-door 1.8 5MT, not sedan. [Original brochure](https://s3.amazonaws.com/cdn.autoipacket.com/brochures/chevrolet/2012/2012-chevrolet-sonic.pdf). |
| Redwood Clover 2012 | US VW Golf Mk6 TDI four-door diesel 6MT, standard 17-inch alloys. [Original order guide](https://volkswagenorderguides.com/wp-content/uploads/2023/10/2012_Volkswagen_Golf_Order_Guide.pdf). |
| Scabious 2015 | US VW GTI S Mk7 three-door 6MT, no Power Package. [Factory brochure](https://cdn.dealereprocess.org/cdn/brochures/volkswagen/2015-golfgti.pdf); [US gallery](https://www.caricos.com/cars/v/vw/2015_volkswagen_golf_gti_us/). |
| Trailglass 2024 | US VW Tiguan S front-drive seven-seat original 17-inch twin-five wheel design. [US factory ordering guide](https://volkswagenorderguides.com/wp-content/uploads/2023/10/2024_Volkswagen_Tiguan_Order_Guide.pdf). |
| Small Toadflax 1990 | Japanese Mazda Savanna RX-7 GT-X FC3S fixed roof 5MT, not Infini. [Period Japanese model catalogue](https://www.goo-net.com/catalog/MAZDA/SAVANNA_RX7/). |
| Rotarypetal 2011 | US Mazda RX-8 Sport six-speed, not R3. [US factory brochure](https://portal.mazdausa.com/m176/MusaWeb/musa2/pdf/brochures/2011/2011_rx8_brochure.pdf). |

The Suzuki Carry study is withheld: the original game model's 2.10 m
wheel mount span differs from its 1.855 m wheelbase and did not align in a
live drive. The experimental Mazda Furai is withheld for nose/canopy
fidelity despite passing runtime checks. Neither counts as a conversion.

### Full-roster rollout, Dodge, Honda utilities, Infiniti/Acura, and Mercedes utilities

| In-game 3D car | Exact visual target and reference |
| --- | --- |
| Cornsalad 2005 | US Dodge Neon SE naturally aspirated four-door 5MT, not SXT/SRT4. [Factory specifications](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/specs/2005NeonSpecs.pdf); [US brochure](https://xr793.com/wp-content/uploads/2016/11/2005-Dodge-Neon.pdf). |
| Firethorn Turbo 2005 | US Dodge SRT-4 standard four-door turbo manual, not ACR. [US factory brochure](https://www.auto-brochures.com/makes/Dodge/Neon/Dodge_US%20Neon_2005-SRT4.pdf); [period trim angles](https://www.groovecar.com/research/2005/dodge/neon-srt-4/4dr-turbo-sedan/). |
| Arrowleaf GT 2013 | US Dodge Dart GT 2.4 Multiair 6MT, not SXT. [Dodge launch](https://www.prnewswire.com/news-releases/new-2013-dodge-dart-gt-model-to-debut-at-north-american-international-auto-show-186012022.html); [manufacturer views](https://www.caricos.com/cars/d/dodge/2013_dodge_dart_gt/). |
| Meadow Trefoil 2002 | US Honda CR-V EX Real Time 4WD 2.4 five-speed, not LX/automatic. [Honda introduction and gallery](https://hondanews.com/en-US/releases/release-c9b5bc245f997c654b7dcf004c34c80a-2002-honda-cr-v-introduction). |
| Pink Trefoil 2003 | US Honda Pilot LX VTM-4 eight seats, styled steel wheels. [Honda specifications](https://hondanews.com/en-US/releases/release-1fb14ca9294ff6735e8e81004c34c71e-2003-honda-pilot-specifications); [period body angles](https://www.consumerreports.org/cars/honda/pilot/2003/photos-and-video/). |
| Island Clover 2006 | US Honda Ridgeline RT, first-generation VTM-4 five-speed automatic. [Honda launch equipment](https://hondanews.com/en-US/honda-automobiles/releases/release-6b5f4c2fc8de8c77c9c6fc004c34c28f-2006-honda-ridgeline-overview). |
| Corn Gromwell 2003 | US Infiniti G35 Sport Coupe rear-drive six-speed, not later Rev-Up. [Period multi-angle test](https://www.caranddriver.com/photos/g34585710/tested-2003-infiniti-g35-coupe-gallery/). |
| Elm Clover 2003 | US Infiniti M45 Y34 base 4.5 V8, no optional packages. [Original brochure](https://www.centuryu.com/uploads/1/4/4/6/144698822/2003_m45.pdf); [period exterior gallery](https://www.carsinvasion.com/infiniti/2003-m45/). |
| Broadleaf Trefoil 2004 | US Acura TSX 2.4 six-speed without navigation, 17-inch standard seven spokes. [Acura launch](https://acuranews.com/en-US/releases/release-a5f8332c8f3611c3080cca004c34c61b-2004-acura-tsx-introduction). |
| Boysenberry Clover 2010 | US Mercedes-Benz W463 G550 naturally aspirated five-door, not G55. [Factory brochure](https://www.auto-brochures.com/makes/Mercedes_Benz/G-Class/Mercedes%20Benz_US%20G-Class_2010.pdf). |
| Cedar Clover 2010 | US Mercedes-Benz GLK350 X204 RWD standard, not 4MATIC/AMG. [Factory US brochure](https://autocatalogarchive.com/wp-content/uploads/2017/08/Mercedes-GLK-2010-USA.pdf); [RWD exterior views](https://www.jdpower.com/cars/2010/mercedes-benz/glk-class/utility-4d-glk350-2wd/exterior-photos). |
| Dogwood Clover 2008 | US Mercedes-Benz R350 W251 long-wheelbase 2WD standard six-seat layout. [Factory SUV range brochure](https://w124performance.com/docs/mb/brochures/2008_brochures/2008_SUV-lineup.pdf). |

The Senna, 720S, and Agera design experiments are withheld from this
release. Their roof and upper bumper-to-fender transitions do not match
closely enough even with a prototype two-stage headlight/duct opening.

### Full-roster rollout: Hyundai, compact Ford, minivans and Buick

- Flathead Clover 2012 and Stream Clover 2012: US Hyundai Elantra GLS 1.8 six-speed sedan and Elantra Touring GLS 2.0 five-speed wagon, both with standard covered steel wheels. [Factory brochure](https://www.auto-brochures.com/makes/Hyundai/Elantra/Hyundai_US%20Elantra_2012.pdf), [sedan front/side/rear](https://origin-www-k8s-preview.thecarconnection.com/photos/hyundai_elantra_2012), [Touring angles](https://www.carsdirect.com/hyundai/elantra-touring/2012/pictures).
- Field Scabious 2022: US Hyundai Elantra N six-speed manual, not N Line. [Factory specifications](https://www.hyundainews.com/releases/3367), [manual production test and multiple angles](https://www.motortrend.com/reviews/2022-hyundai-elantra-n-6mt-first-test-review).
- Groundsel 2002: US Ford Focus SE four-door SOHC 5MT, standard 15-inch wheels. [Factory brochure](https://www.motorologist.com/wp-content/uploads/2002-Ford-Focus-brochure.pdf), [front/side/rear exact body](https://veh-markets.com/cars/ford-c/294106-2002-ford-se.html).
- Aster 170 2003: US Ford Focus SVT ZX3 6MT, standard five-spoke wheels, not EAP. [Factory SVT supplement](https://www.fordservicecontent.com/Ford_Content/catalog/owner_guides/03focsv1e.pdf), [front/side/rear exact three-door](https://bringatrailer.com/listing/2003-ford-focus-21/).
- Milkwort 1999: US Ford Escort LX four-door SOHC 5MT, stock-covered 14-inch wheels. [US factory brochure archive](https://www.auto-brochures.com/ford), [stock four-door period front/side/rear](https://www.purplewave.com/auction/180110/item/AX9037/1999-Ford-Escort-Passenger_Vehicles-Passenger_Vehicle-Missouri).
- Ash Clover 2004: US Toyota Sienna CE 7-seat. [US factory brochure](https://www.ms-auto.co.jp/wp-content/catalog/sienna/Sienna_2004.pdf), [CE front/side/rear](https://www.liveauctionworld.com/2004-Toyota-Sienna-CE-7-Passenger_i48120948).
- Brook Clover 2012: US Kia Sedona LX 7-seat, base wheel covers. [Factory trim equipment](https://www.kiamedia.com/us/en/models/sedona/2012/features), [LX front quarter](https://www.727-car.com/inventory/2012-kia-sedona-lx/956092), [LX side/rear](https://bid.cars/en/lot/1-48155614).
- Hoary Mullein 1970: US Buick GSX 350 hp, standard 455 V8 four-speed, not Stage 1. [Exact four-speed with build sheet](https://classiccars.com/listings/view/1057453/1970-buick-gsx-455-cuin-4speed-69-gsx-build-sheeet-year-1970-for-sale-in-milford-city-connecticut-06450), [other GSX angles](https://www.mecum.com/lots/1184296/1970-buick-gsx/).
- Running Clover 2002: US Buick LeSabre Custom standard trim. [Factory brochure](https://brochureshub.com/wp-content/uploads/2020/04/Buick_US-LeSabre_2002.pdf), [exterior views](https://www.edmunds.com/buick/lesabre/2002/pictures/).
- Spindle Clover 2011: US Buick Regal 2.4 CXL, not Turbo. [Factory brochure](https://www.auto-brochures.com/makes/Buick/Regal/Buick_US%20Regal_2011.pdf), [CXL exterior views](https://www.victorymotorsofcolorado.com/inventory/2011-buick-regal-cxl/507282).

These are first-pass models. The 2005 Nissan Quest remains held for its distinctive side-window kink and hatch, and Opel Mokka, Opel Adam and Vauxhall Grandland X for lamps and greenhouse transitions. No stock tuning or wheel frame changes. Real photos were used as references, not distributed with the game.

### Full-roster rollout: American family vehicles and utilities

- Aspen Clover 2012: US Ford Fusion S 2.5 FWD 6MT, factory painted 16-inch five spokes. [US Ford brochure](https://cdn.dealereprocess.org/cdn/brochures/ford/2012-fusion.pdf), [S model exterior angles](https://www.cars.com/research/ford-fusion-2012/).
- Woad 2010: US Ford Flex SE 101A FWD V6 6AT, body-color roof and seven seats. [US Ford brochure with SE](https://cdn.dealereprocess.org/cdn/brochures/ford/2010-flex.pdf), [exact SE from front, side and rear](https://www.groovecar.com/research/2010/ford/flex/se-4dr-crossover/).
- Alder Clover 2005: US Toyota Sequoia SR5 standard RWD 4.7 eight-seater. [Factory specs and photos](https://www.ms-auto.co.jp/wp-content/catalog/sequoia/sequoia_2005.pdf), [SR5 exterior views](https://bid.cars/en/lot/1-78090724/2005-Toyota-Sequoia-5TDZT34A85S250691). Authoring width 1.84912 m per brochure, inherited pinned wheel span is wider; localized flare and stock axle binding mean final max render width is not a metrology claim. No stock wheel positions or data changed.
- Birch Clover 2004: US Toyota Highlander base FWD 2.4 five-seater. [US base equipment](https://www.edmunds.com/toyota/highlander/2004/st-100339428/features-specs/), [exact FWD exterior](https://bid.cars/en/lot/0-38893797/2004-Toyota-Highlander-JTEGD21A240093711).
- Stonepod 2006: US Honda Element EX 2WD 5MT, dark molded cladding, not EX-P. [Honda factory specifications](https://hondanews.com/en-US/releases/release-8493873629d176ff002ee9004c34c10f-2006-honda-element-specifications), [EX front, side and rear shared body](https://www.victorymotorsofcolorado.com/inventory/2006-honda-element-ex/147083). Split hatch stamping is static.
- Sweetbriar 1966: US Oldsmobile Toronado base, 425-cu-in V8 three-speed, pillarless hardtop. [Factory brochure](https://over-drive-magazine.com/wp-content/uploads/2025/09/1966-Toronado-Intro-MI-1-16C.pdf), [red 1966 exact-era exterior views](https://www.mecum.com/lots/KD22-524968/1966-oldsmobile-toronado/). Operating headlights are modeled recessed in the deployed position; the closed covers are not animated.
- Avens 1995: US Oldsmobile Ciera Series I 2.2 3AT four-door. [Factory brochure](https://www.outrightolds.com/PDFBrochure/1995OldsmobileCiera.pdf), [period four-door photos](https://www.curbsideclassic.com/blog/cc-cohort/89-96-oldsmobile-ciera-once-common-now-uncommon-gms-fwd-a-bodies-40-years-later/).
- Marionberry Clover 2004: US Oldsmobile Alero GLS 3.4 4AT coupe. [Exact GLS coupe spec](https://www.cars.com/research/oldsmobile-alero-2004/specs/110024/), [owner handbook profile](https://www.manualslib.com/manual/232145/Oldsmobile-2004-Alero.html), [rear coupe photo](https://auctions.speedstowingauction.com/2004-Oldsmobile-Alero_i59423349).

The 2012 Ford Edge SE comparison remains held for rear roof and quarter-glass shape. No real-world logos or reference photos included. Toronado and Flex preserve signed old raw pins through explicit native-frame normalization, not a physics edit.

### Full-roster rollout: compact and period body studies

- Boxelder 2005: first-generation US Scion xB 1.5 5MT, no Release Series. [Toyota OEM front, side and rear photos](https://pressroom.toyota.com/album/2004-2005-scion-xb/), [factory brochure](https://xr793.com/wp-content/uploads/2022/01/2005-Scion-xB.pdf). Native tall flat roof and upright glass; stamped side and rear window frame thickness is still simplified.
- Alpine Trefoil 2010: Germany BMW X1 E84 sDrive18i 2.0 6MT, standard base equipment. [German factory technical data](https://www.press.bmwgroup.com/deutschland/article/detail/T0082662DE/technische-daten-bmw-x1-gueltig-ab-09/2010), [steel-wheel factory table](https://www.press.bmwgroup.com/italy/article/attachment/T0076919IT/112424), [German contemporary road test and exterior views](https://de.motor1.com/reviews/161199/bmw-x1-sdrive18i-im-test-harter-einstieg/). Use shared-body angles, not wheel or rack options shown on other trims.
- Dark Mullein 1968: US Pontiac Firebird Sprint OHC six, four-barrel and optional four-speed. [Pontiac sales manual](https://firstgenfirebird.org/1968-info/sales_manual/selling/m-3-2/), [Sprint trim gallery](https://www.frankmanmotors.com/inventory/used-1968-pontiac-firebird-sprint-2d-coupe-0000223378l600723/). No hood bulge or later performance styling.
- Jostaberry Clover 2006: US Pontiac G6 GT 3.5 four-speed fixed-roof coupe, no GTP or convertible equipment. [GM G6 catalog](https://www.auto-brochures.com/makes/Pontiac/G6/Pontiac_US%20G6_2006.pdf), [GT coupe exterior angles](https://www.liveauctionworld.com/2006-PONTIAC-G6-GT-RED-2-DOOR-AUTOMATIC-240-000KM-WITH-CAR-PROOF-REGISTRATION-KEY-AND-FOB_i28806380).
- Pennycress 2001: US Saturn SL1 1.9 SOHC 5MT sedan. [Factory S-Series brochure](https://saturnarchive.com/brochures/2001-Saturn-S-Series-Prestige.pdf), [period sedan angle gallery](https://www.cars.com/research/saturn-sl-2001/). Factory trim specifications were used to separate covered wheels and base equipment from SL2 variants in gallery sets.

BMW X3 and X5 remain held for more distinctive glazing/rear shoulders and fascia layout. The Scion tC and Toyota Matrix XRS remain held for roof profile and fascia/rear contour. Stage only the five listed editable designs; photo sources are not distributed with the game.

The already-counted Field Scabious 2022 (Elantra N) received a roof/greenhouse refit. The revised windshield foot sits farther aft, roof-edge corners turn in toward the glass, and the B pillars lean along their own control. The comparison used the same production cameras and credited [front-left](https://commons.wikimedia.org/wiki/File:2022_Hyundai_Elantra_N_in_Fiery_Red,_Front_Left,_04-18-2022.jpg) and [rear-right](https://commons.wikimedia.org/wiki/File:2022_Hyundai_Elantra_N_in_Fiery_Red,_Rear_Right,_04-18-2022.jpg) photographs of the 2022 N by Elise240SX plus [US six-speed factory specifications](https://www.hyundainews.com/releases/3367); perspective-matched landmarks are not metrology. The lower rear pillar still differs. Existing stock 2D first-person overlay, camera placement and handling are untouched. The current race renderer hides the 3D player shell in first-person; any future rendered 3D cockpit needs its own camera bounds and instrument/seat fit.

### Full-roster rollout: French period sedans, compact Punto and Japanese utilities

- Bugloss 1967: French Renault 8 Gordini 1300 R1135, rear drive, 5MT, four round lamps and off-center unbranded stripes. [Renault museum](https://theoriginals.renault.com/en/r8-gordini), [exact 1967 multiple angles](https://www.artcurial.com/en/sales/4224/lots/166-a).
- Salsify 1975: US Peugeot 504 A90 Diesel, 4MT with American quad round lamps, bumpers, and static closed metal sunroof. [US model publications](https://archives-catalogues-automobiles.fr/index.php/2016/06/30/catalogues-peugeot-504-speciaux/), [1975 US factory catalog with multiple angles](https://www.autopaper.com/1975-peugeot-504-sedan-station-wagon-and-diesel-sales-brochure.php).
- Loosestrife 1988: French Peugeot 405 Mi16 Phase 1, 1.9 5MT and early 14-inch wheels. [Original catalog](https://www.archives-catalogues-automobiles.fr/shop/fr/marques-francaises/1114-PE458001-01.html), [Phase 1 front/side/rear photos](https://www.carandclassic.com/car/C1718545).
- Asphodel 1994: Japan Nissan Rasheen Type II E-RFNB14 5MT, upright side, offset carrier with exterior tire cover. [Exact Nissan Heritage vehicle](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/Rasheen_Type_II.html), [RB14 front, side and rear views](https://www.carswp.com/nissan-rasheen-rb14-1994-2000-photos-118808).
- Angelica 1999: US Isuzu VehiCROSS base 3.5 AWD with 16-inch wheels, not Ironman or later 18-inch version. [Period Isuzu brochure](https://importarchive.com/brochure/isuzuvehicross1999_06), [stock series exterior views](https://veh-markets.com/cars/isuzu-c/419722-1999-isuzu-vehicross.html). Separate molded spare blister forms a closed panel embedded into hatch; it is not a visible tire or spare road-wheel instance.
- Saffron 135 2010: UK Fiat Punto Evo Sporting 1.4 MultiAir Turbo 135 5MT three-door. [Fiat UK trim launch](https://www.media.stellantis.com/uk-en/fiat/press/fiat-punto-evo-prices-announced), [Fiat UK brochure pp. 32–33](https://autocatalogarchive.com/wp-content/uploads/2016/08/Fiat-Punto-2010-UK.pdf), [period exact Sporting photographs](https://www.autoexpress.co.uk/car-reviews/39506/fiat-punto-evo-sporting). Rear lamp tower geometry improved; full chrome front divider and precise lamp corners remain approximations.

Hold the 2005 Touareg (front and rear shoulder contours), 2012 Panda 4x4 (roof and front lamp fit), and 2013 Fiat 500L (double lamp layout and upper surfaces) for follow-up instead of publishing generic studies. Original signed frames are preserved; no tuning edits. References are linked, not bundled.

- Persimmon Clover 2012: US Hyundai Genesis sedan 3.8 GDI RWD eight-speed; standard 17-inch wheels, no R-Spec. [Factory US brochure](https://www.auto-brochures.com/makes/Hyundai/Genesis/Hyundai_US%20Genesis_2012.pdf), [production front, side and rear](https://www.carsdirect.com/hyundai/genesis-sedan/2012/pictures).
- Rain Clover 2012: US Hyundai Equus Signature 5.0 GDI RWD eight-speed, not Ultimate, true standard staggered 19-inch wheels and horizontal split-spine grille. [Factory US brochure](https://www.auto-brochures.com/makes/Hyundai/Equus/Hyundai_US%20Equus_2012.pdf), [exact Signature multi-angle vehicle](https://www.classic.com/veh/2012-hyundai-equus-signature-kmhgh4jh7cu056190-pe2Ajl4).

The US Optima LX remains held: the cheek-to-headlamp wrap and shoulder/glass profile need a closer fit. Genesis and Equus rear lens contours remain simplified first-pass shapes.

### Full-roster rollout: GMC compact trucks and period Fiats

- Orange Hawkweed 1991: original US GMC Syclone regular cab turbo AWD; dark low cladding, factory one-piece fabric cover and two seats, no words/logos. [Factory 1991 brochure](https://sportmachines.com/wp-content/uploads/1991/01/Syclone-Brochure.pdf), [front/side/rear and covered-bed stock photos](https://bringatrailer.com/listing/1991-gmc-syclone-50/).
- Fragrant Agrimony 1992: US GMC Typhoon three-door 4.3 turbo AWD, not four-door. [Factory 1992 GMC brochure](https://www.auto-brochures.com/makes/GMC/Jimmy/GMC_US%20Jimmy_1992.pdf), [original two-tone front, profile and rear photos](https://www.mecum.com/lots/366521/).
- Madder 1969: original Italian Fiat 128 1116cc two-door standard berlina. [FIA original series form](https://historicdb.fia.com/sites/default/files/car_attachment/1601059801/homologation_form_number_5304_group_1.pdf), [early production-year multiview photos](https://www.autobelle.it/en/archive/1969_Fiat_128_first_series_saloon_63224.xhtml). No later grille or 1290cc/rally body.
- Navelwort 1978: Fiat 131 Abarth Rally Group 4, Alén and Kivimäki 1000 Lakes model; unbranded white body, rally wheel flares, auxiliary lights and mudflaps. [Period homologation photos](https://historicdb.fia.com/car/fiat-abarth-131-rally), [event winners and year verification](https://sectorallyfinland.fi/wp-content/uploads/2021/09/20210903_RallyGuide2_RallyFinland_only_text-1.pdf), [Fiat period works restoration](https://www.stellantisheritage.com/it-it/heritage/storie/restauro-fiat-131-abarth-rally). Not a decal or livery recreation.

Hold the Fiat 126: original wheel mesh anchors were authored at 2.100 m wheelbase but unchanged chassis and period donor specify 1.840 m. The Ram crew-cab prototype is held for wrong roof/windscreen proportions despite the measured bed correction. No original physics chassis or geometry limits altered by these four releases.

### Full-roster rollout: classic upright bodies and Ford utilities

- Spruce Clover 2012: US Ford Expedition XL standard wheelbase 4×2 5.4 six-speed. Factory plain five-seat reference, no EL or service package. [Factory US brochure](https://cdn.dealereprocess.org/cdn/brochures/ford/2012-expedition.pdf), [front, side and rear photos](https://www.carsdirect.com/ford/expedition/2012/pictures/exterior), [exact US RWD standard equipment](https://www.edmunds.com/ford/expedition/2012/suv/st-101403354/features-specs/).
- Yew Clover 2012: US Ford Explorer base FWD 3.5 six-speed, covered 17-inch wheels, seven seats. [Factory US brochure](https://cdn.dealereprocess.org/cdn/brochures/ford/2012-explorer.pdf), [base FWD multiple angles](https://rickebrosinc.com/vdp/24089733/Used-2012-Ford-Explorer-FWD-4dr-Base-for-sale-in-York-PA-17406).
- Black Medick 1982: US federal Volkswagen Pickup LX 1.7 gasoline four-speed, empty open bed. [Exact 1.7 LX exterior](https://smclassiccars.com/volkswagen/520445-1982-volkswagen-pickup.html), [shared LX rear and bed photographs, diesel excluded as powertrain](https://bringatrailer.com/listing/1982-volkswagen-rabbit-pickup-4/).
- Vetch 1978: Canadian Volkswagen Type 2 late-bay seven-person solid-roof passenger van, 1970cc AFC gasoline flat-four four-speed. [Canadian manufacturer literature archive](https://www.thesamba.com/vw/archives/lit/type2_2.php), [same seven-seat passenger body front/side/rear gallery](https://davidsclassiccars.com/volkswagen/65654-1978-volkswagen-7-passenger-van.html). No sunroof copied. New near-upright shared front chart, actual two high front amber turn apertures above separate beams, and true three seating rows. The native nose still projects more than the factory face; glass framing is simplified.
- Speedwell 1968: French Renault 4 Export 747cc four-speed. [Renault documented period type chronology](https://cdn.group.renault.com/ren/master/renault-classic/tools-and-services/Renault4T1.pdf.asset.pdf/379ae4ac61.pdf), [exact-year factory brochure with multiple views](https://www.brochure-catalogue-voiture-neuve.fr/brochures/renault/4/renault-4-1961/FRA-1968/), [museum example](https://commons.wikimedia.org/wiki/File:RENAULT_4_EXPORT_1968_FRANCE.JPG).

Hold Veracruz and Barchetta for front/body-shape mismatch, Wind and Tesla Roadster for optical/deck/cabin fit, and both Accents plus Rio5 for greenhouse and lamp contours. No reference art included, no altered stock positions or specs.

### Full-roster rollout: utility shape families, muscle cars and period coupes

- Bellflower 2006: US Mazda5 Sport 2.3L 5MT, CR family with upper slit grille, upright tail lamp towers, six seats, solid roof. [Mazda US press kit](https://news.mazdausa.com/vehicles-2006-Mazda5), [exact Sport manual front, side and rear](https://carsandbids.com/auctions/3gnWOOWo/2006-mazda5-sport).
- Mountain Trefoil 2012: US Mazda5 Sport 2.5L 6MT, CW family with broad lower intake, molded side sculpt, low horizontal taillights and no top equipment. [Factory technical changes](https://news.mazdausa.com/download/2012-Mazda5-Specifications.pdf), [period exact US Sport photos](https://www.motortrend.com/reviews/2012-mazda5-sport).
- Hawberry Clover 2004: US Oldsmobile Bravada base 4.2 RWD standard 17-inch wheels, not SmartTrak or Final 500. [GM factory brochure](https://www.outrightolds.com/PDFBrochure/2004OldsmobileBravada.pdf), [US period front/side/rear views](https://www.cars.com/research/oldsmobile-bravada-2004/). Narrow split grille and tall upper body, blade spacing approximated.
- Bithynian Vetch 1970: US AMC Rebel The Machine 390 4MT. [Factory catalog](https://over-drive-magazine.com/wp-content/uploads/2026/04/1970-AMC-Full-LIne-Deluxe-Brochure-1-48C.pdf), [front](https://commons.wikimedia.org/wiki/File:1970_AMC_Rebel_%22The_Machine%22_muscle_car_in_RWB_at_2021_Pennsylvania_show_3of8.jpg) and [rear](https://commons.wikimedia.org/wiki/File:1970_AMC_Rebel_%22The_Machine%22_muscle_car_in_RWB_at_2021_Pennsylvania_show_4of8.jpg) matched Frost White bodies. No branded reflective wrap or copied exterior image.
- Hairy Tare 1971: US AMC Javelin AMX 401 4MT without optional Go-package paint. [Factory period catalog](https://xr793.com/wp-content/uploads/2019/02/1971-AMC-Full-Line-Prestige.pdf), [401 front oblique photo with optional paint not copied](https://commons.wikimedia.org/wiki/File:1971_AMC_Javelin_AMX_401_in_Mustard_Yellow_at_2015_AMO_show_1of7.jpg), [rear-three-quarter reference](https://barrettjacksoncdn.azureedge.net/staging/Content/Pages/InventoryDetails/187411.html).
- White Mullein 1970: US Dodge Challenger R/T standard 383 Magnum 3MT, not Hemi or T/A. [Period Dodge documentation](https://www.e-bodies.org/resources/plymouth_cuda_dodge_challenger_brochure_sale_ads/), [383 body multi-angle gallery](https://www.icollector.com/NO-RESERVE-1970-DODGE-CHALLENGER-RT-383_i55856106). Stock raw -Z frame archived and normalized by existing basis, not moved.

- Spotted Medick 1981: US Volkswagen Scirocco S Mk1 1.7 fuel-injected five-speed, four period round lamps and Mk1 lower front. [Factory US brochure spread](https://eightiescars.files.wordpress.com/2021/12/1981_volkswagen_scirocco_brochure_pages.png), [exact S front](https://smclassiccars.com/uploads/postfotos/1981-volkswagen-scirocco-034s034-mk1-in-mars-red-super-rare-10.jpg), [original side photo](https://davidsclassiccars.com/images/full/1981-vw-scirocco-s-original-paint-ca-car-6.jpg).
- Sandwort 1988: German Volkswagen Scirocco Mk2 GTX 16V 102 kW standard gearbox calibration; rectangular four lamps, longer hatch and raised spoiler and 14-inch recessed wheel design, no US trim mix. [Original German brochure photograph](https://www.lov2xlr8.no/brochures/others6/88sc/bilder/7.jpg), [Mk2 side angle](https://assets.autoweek.nl/m/m1fygo6biixd_800.jpg). Wheel recess spacing and upper side rim remain approximate.
- Marshmallow 1983 (US Tercel SR5 three-door) remains held: exact front/glass and US trim image geometry still needed. No OEM images bundled or drawn over, no handling changes.

### Full-roster rollout: European classics and practical transport

- Moss Clover 2003: UK Fiat Ulysse Dynamic 2.0 16V five-speed, standard-length seven-seat RHD with no roof accessories. [UK Fiat launch](https://www.media.stellantis.com/uk-en/fiat/press/new-fiat-ulysse), [period UK front, side and rear](https://www.newcarnet.co.uk/buying-guides-content/2015/12/2/fiat-ulysse-2003-2006). Raw signed facing frame normalized explicitly; no modification to steering or axle specifications.
- Water Trefoil 2012: German Renault Kangoo Authentique 1.6 16V 105 five-speed standard five-seat wagon. [German period Renault trim sheet](https://media1.autohaus.de/fm/3576/Renault-Kangoo-Preise_1112.pdf), [German manufacturer introduction](https://presse.renault.de/vielseitig-familienfreundlich-und-vorbildlich-sparsam/?lang=deu), [period multiple angles](https://www.autouncle.de/de/gebrauchtwagen/Renault/Kangoo/y-2012). Only the passenger-side sliding-door geometry and handle are present, not mirrored onto the driver side.
- Cairn 1974: European BMW 2002 turbo standard road four-speed and steel wheels. [BMW Classic archive](https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-45-1.bmw-2002-turbo.html), [exact period-year exterior gallery](https://www.classicdriver.com/en/car/bmw/2002/1974/1089543). Unbranded front lip, pronounced arch extensions and separate round headlights.
- Rosebay Willowherb 1988: European BMW M5 E28 M88/3 non-catalyst late-production manual, excludes US S38. [BMW period European archive photos](https://www.bmwgroup-classic.com/en/models/bmw-classics/product-description-page.ad-1570-1.bmw-m5-sedan-e28.html), [closely matched European M88/3 front, side and rear reference](https://museumofeveryth.ing/cars/bmw-m5-e28-1987/).
- Water Dock 1986: UK BMW M635CSi E24 five-speed M88/3, right-hand drive; not US M6. [BMW M development gallery](https://www.bmw-m.com/en/topics/magazine-article-pool/bmw-m635csi-top-model-of-the-e24-series.html), [exact UK vehicle exterior series](https://www.carandclassic.com/car/C2224599). Right seat, wheel and pedals verified; shark-nose pitch and lamp edges still stylized.
- Lesser Knapweed 1984: German Audi Sport quattro B2 short-wheelbase road homologation 5MT. [Matched road front three-quarter](https://cdn.rmsothebys.com/6/3/d/9/7/9/63d979b772da17fc6d29c433fc8132792727860f.webp), [same car other exterior angle](https://cdn.rmsothebys.com/6/f/0/7/3/e/6f073eef7dc32272ae98d7b080413f7362945c9d.webp), [road profile](https://www.supercars.net/blog/wp-content/uploads/2020/10/1984-Audi-Sport-Quattro-003-1440.jpg). Rectangular light recesses; upper hood slits and flare volume not exact. The pre-E2 rally tribute and BMW M1 remain held, not relabeled as this road study.

The US smart fortwo remains unchanged because the stock body anchors are 2.100 m apart while the chassis and exact reference are 1.8669 m, with an additional signed-side disagreement. Do not relax fit or change handling. Forte Koup, Kona N and Amanti prototype geometries were not accepted and no front-runner runtime change was bundled. Reference imagery is linked, not embedded.

### Full-roster rollout: Japanese heritage body shapes

- Pearlwort 1987: Japan Nissan Be-1 BK10 standard solid roof, three-speed automatic, RHD, not the fabric-top option. [Exact Nissan Heritage specification and image](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/Be_1_standardroof.html), [same-family rear angle](https://www.logi-net.com/stock-detail-jpc/bKdEBDzEyjCc01). Rear cluster uses a simplified round housing, not the full factory graphic.
- Damson Clover 1970: Japan Nissan Laurel 2000GX KPC30 two-door pillarless hardtop four-speed with restrained roof contrast and authentic period fender-top mirrors. [Exact Nissan archival body and trim](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/laurel_hardtop_2000gx.html). No sedan B-pillar nor later variant styling.
- Greengage Clover 1982: Japan Nissan Cedric Turbo Brougham K430 four-door pillarless hardtop, wire-look wheels, rectangular lenses and upright grille. [Exact Nissan archival car](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/cedric_4door_htturbo_brough.html), [documented profile and rear historian gallery](https://ateupwithmotor.com/model-histories/japanese-four-door-hardtops/4/). Raw −Z anchors archived as-is, explicitly canonicalized at native export. The RHD cockpit stays distinct from LHD.

The new optional fender mirror mounts follow the actual upper body surface. Old door mounting remains unchanged when off. Hold Corolla SR-5, Pao, S-Cargo, Doblò, Scénic, Multipla, Alpine, S800 and E89 Z4 for specific incorrect original proportions or optics rather than ship generic placeholders. Isolated fabric and individual-seat prototypes are not bundled. No original art/physics edits.

### Full-roster rollout: classic European touring shapes

- Twayblade 1984: continental European Mercedes-Benz S123 300 TD Turbodiesel, 123.193 LHD, post-September 1981 automatic and covered standard 14-inch wheels, not US. [Factory introduction and data](https://vdh.mercedesclubs.de/index.php/w-123/einfuehrungsschriften/2214-300-td-turbo-diesel-123-193-200-t-123-282), [same-year European vehicle multiview photos](https://www.pcarmarket.com/results/1984-mercedes-benz-300td). Tall wagon, broad chrome and vertical-slat panel, long glass; period tail contours remain stylized.
- Wild Carrot 1990: production UK Vauxhall Lotus Carlton 3.6 turbo 6MT, not prototype or Carlton GSi. [Vauxhall heritage](https://www.media.stellantis.com/uk-en/vauxhall/press/vauxhall-lotus-carlton), [Lotus historical gallery](https://www.lotuscars.com/en-GB/lotus-story/road-cars/omega). RHD, recognizable dark green, low recessed duct and taper, with simpler lamp detail than the original.

Both use unchanged named raw −Z stock datums canonicalized by the existing frame option. The Soarer, Maxima, Taurus, Accord Crosstour, three Audi studies (A4/RS4/A3) and three Kia studies (Cadenza/Picanto/Sorento) remain held for visual fit. No shared generator changes or embedded factory imagery in this batch.

### Full-roster rollout: Renault 5 Turbo, Fiat Coupé and Buick Enclave

- Larkspur 1981: Renault 5 Turbo Group 4 Monte Carlo winner, earlier Ragnotti/Andrié car, not Maxi or a road Turbo 2. [Factory competition history and photos](https://www.renault.rs/CountriesData/Serbia/images/RenaultIkone/renault-editorial-discover-r5-mook-en.pdf), [factory-backed matching recreation](https://media.alpinecars.com/four-renault-crews-for-the-2016-rallye-monte-carlo-historique/?lang=fra), [other real angles](https://photo-voiture.motorlegend.com/rallye-monte-carlo-historique-2016/photo-renault-5-turbo-1980/19035%2C103991.html). Wide rear track, front-only rally cabin, rear cooling aperture and separate auxiliaries; no sponsor graphics.
- Chokeberry Clover 1999: Italian Fiat Coupé 20V Turbo Plus six-speed, not earlier or standard non-Plus. [Bologna factory introduction](https://www.media.stellantis.com/it-it/fiat/press/motor-show-di-bologna-1999-coup-eacute-fiat), [Frankfurt pearl-white source](https://www.media.stellantis.com/em-en/fiat/press/fiat-at-the-58th-frankfurt-international-motor-show). Independent hood lens apertures and four round rear recesses; outer lens contours are still approximations.
- Huckleberry Clover 2008: US Buick Enclave CX FWD seven-seat, not CXL or AWD. [Exact US 2008 Buick brochure](https://www.motorologist.com/wp-content/uploads/2008-BUICK-Enclave-Brochure.pdf), [period exterior angles](https://www.edmunds.com/buick/enclave/2008/pictures/). Factory examples with option wheels constrain sheet metal only; standard CX equipment is preserved.

The R5's stock authored rear track is 0.130 m wider than its front track. The design input ceiling was extended to 0.131 m for this model, without altering road binding tolerances, authored defaults or vehicle physics. Hold Avantime, Acura sedan and utility drafts, and the 850CSi/Z3 M/650i family for shape and optical fit. Reference images are not distributed.

### Full-roster rollout: Fiat family proportions

- Yates Clover 2009: UK Fiat Qubo Active 1.4 8v, standard five-seat passenger car, not Fiorino cargo van. [UK Fiat launch](https://www.media.stellantis.com/uk-en/fiat/press/fiat-qubo-stylish-family-motoring-made-simple-press-pack), black bumpers/mirrors, covered 15-inch wheels, two sliding-door details and upright tail-light towers. Hatch and hood curves are simplified.
- Reed Clover 2003: UK Fiat Stilo MultiWagon Dynamic 1.8 16V 5MT, factory fixed roof and 16-inch wheels. [Exact factory UK launch](https://www.media.stellantis.com/uk-en/fiat/press/fiat-stilo-multi-wagon), upright, largely separate rear cargo side panes and no copied option roof.
- Lush Clover 2005: UK Fiat Croma Dynamic 2.2 16V petrol manual, not diesel or automatic. [Exact UK launch](https://www.media.stellantis.com/uk-en/fiat/press/new-fiat-croma-in-uk), taller curved roof and rounded rear hatch distinguish it from the Stilo.

The Tipo, Idea, Espace and all contemporary Acura/Infiniti/Lexus studies from this batch remain held for distinctive front, glazing or rear fit. No shared software or stock dynamics changes.

### Full-roster rollout: North American sedans

- [Original 2001 Oldsmobile Aurora brochure](https://www.outrightolds.com/PDFBrochure/2001OldsmobileAurora.pdf), [exact 3.5 photo angles](https://www.edmunds.com/oldsmobile/aurora/2001/pictures/), [rear of exact 3.5](https://www.virtualparking.net/post/3446/2001-oldsmobile-aurora). Removed the upper grille entirely because the original brochure explicitly describes its absence. Wider swept optical cuts, domed backlight, stand-alone wrap rear clusters, dual lower outlets. Native deck shoulder and lens sweep remain more abrupt/shorter than exact body.
- Chrysler [official 2012 US sedan specifications](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/specs/2012_CH_200_Specs.pdf), [2012 brochure with standard LX 17-inch steel wheel cover](https://www.auto-brochures.com/makes/Chrysler/200/Chrysler_US%20200_2012.pdf), [actual 2012 LX photo gallery](https://www.crainhyundailittlerock.com/used-Little%2BRock-2012-Chrysler-200-LX-1C3CCBAB3CN105062). Chrome horizontal bar opening, swept lamp envelopes, covered steel wheel material rather than alloys. Native chrome perimeter and lamps do not reproduce the actual upper aperture/lenses precisely.

The DTS remains held: its headlight/grille and rear proportions depart too far from the photographed car. No vehicle dynamics or shared editor changes.
