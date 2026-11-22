# Regional attraction art: 2994

The eleven editable regional maps use the current Game Menu node coordinates.
The game still draws its own roads, bosses, entrances and world overview.
These are interpretive landmarks: recognizable silhouettes with broken
infrastructure, ice where appropriate, and the game's surviving amber and cyan
lighting. They are not satellite maps or predictions of real places.

See the [eastern reference notes](2994-east-references.md) and
[western reference notes](2994-west-references.md) for per-stop associations.
Boston's waterfront also references [Boston Public Works' bridge photography](https://search.boston.gov/sites/default/files/file/document_files/2018/10/25-preliminary-design-public-hearing-presentation.pdf).
Providence's skyline includes its [Industrial Trust Building](https://www.goprovidence.com/listing/industrial-trust-company-building/24228/).

| Central board | Physical reference and in-game inspiration |
| --- | --- |
| Ozarks | [Jerktail and Two Rivers](https://www.nps.gov/ozar/planyourvisit/hiking-in-the-ozarks.htm), [Alley Spring red mill and turbine](https://www.nps.gov/ozar/learn/nature/springs.htm), [Pig Trail switchbacks](https://www.arkansas.com/plan-your-trip/plan/trip-ideas-itineraries/fall-foliage-drives-and-destinations-across-arkansas). Dense hollows reference the levels' bracken and woodoats. |
| Data Center City | [Gateway infield course](https://www.gatewaykartplex.com/facility), [Alton bluffs](https://www.recreation.gov/gateways/13751), [Katy Trail](https://mostateparks.com/basic-page/trail-history-katy-trail), [St. Louis Arch and Old Courthouse](https://www.nps.gov/thingstodo/visit-the-old-courthouse.htm). The cobalt machine complex is game fiction inherited from the world map. |
| Route 66 | [Oklahoma pony trusses](https://www.travelok.com/listings/view.profile/id.26792), [Shamrock Art Deco and highway motels](https://thc.texas.gov/travel/historic-highways/route-66), [Palo Duro Lighthouse](https://tpwd.texas.gov/state-parks/palo-duro-canyon/trails-info), [Glenrio](https://home.nps.gov/places/glenrio-historic-district.htm), and [Hallett](https://www.hallettracing.net/track-information/). The Shamrock and Vega levels' pipeline shapes are part of the visual language. |
| Pikes Peak | [Garden of the Gods](https://parks.coloradosprings.gov/system/files/parks_recreation_and_cultural_services/parks/garden_of_the_gods_map_page_2_of_2.pdf), [Gold Camp rail tunnels](https://npgallery.nps.gov/pdfhost/docs/NRHP/Text/99000400.pdf), [Phantom Canyon mining corridor](https://muleapi.blm.gov/visit/gold-belt-back-country-byway), [Chimney Rock near Bayard](https://history.nebraska.gov/marker-monday-chimney-rock/). Red rock below snow-fenced alpine scenery. |

Run from the repository root with Pillow:

```
python tools/campaigns/draw_campaign_2994_attractions.py --output /tmp/regional-art
```

Install only the 33 explicitly listed art files. The contact sheet and receipt
are local QA artifacts. Do not rewrite the saved menu or stock car proofs.
