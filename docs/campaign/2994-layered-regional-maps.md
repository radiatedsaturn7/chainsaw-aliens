# Layered regional campaign maps

Eleven tactical pixel-art plates, 88 individual transparent miniatures. The
palette follows the game's world map: deep navy and ice-blue, exposed rock,
and warm lights on ruined or rebuilding infrastructure. Rivers, frost,
wrecks and repair crews are environmental storytelling, not navigable icons.

Each miniature is anchored to a saved node by authored region identity, node ID
and exact race reference. The regional boss reference resolves the stable
stage, independent of travel order. Changing Background Art in the editor
does not remove the miniatures from an authored region. An ordinary node move in the map editor moves the miniature too.
Race order, authored links and ports, entrances, saves, and the world overview
do not change. A remapped race retains normal node, road and car behavior without picking up unrelated art.

Regional draw order:

1. Terrain-only backdrop. The existing editable map Background Art slot retains
   its reference; the matching PNG and native Art document agree pixel for pixel.
2. All miniature grounds and silhouettes, on a larger scale than the first
   layered maps. Actual painted bounds, not transparent padding, stay in frame.
3. Existing drivable road curves and entrance. No gameplay road pixels are
   baked into art.
4. Raised and underpass silhouettes re-rendered above the road only in their
   occluding areas, leaving the approach and pin readable.
5. Pins and selected car. They remain legible and use their original hit targets
   and travel geometry, even when landmark art overlaps a road.

The atlas is a small RGBA PNG per region (four columns of 192 × 160 cells). The
unused transparent margins isolate each sprite and prevent atlas bleed. Only
the current region's atlas is requested when needed. Ground contact is at
(96, 112). Runtime screen bounds determine final size and visual edge clamping.

## Regenerate

From the repository root, with Python and Pillow:

```sh
menu='data/server-storage/files/menus/Game Menu/document.json'
work=$(mktemp -d)
for zone in east central west; do
  python "tools/campaigns/draw_campaign_location_minis_${zone}.py" \
    --menu "$menu" --output "$work/$zone"
done
mkdir "$work/minis" "$work/terrain"
python tools/campaigns/draw_campaign_east_2994.py "$work/terrain"
python tools/campaigns/draw_campaign_pixel_central.py --output "$work/terrain"
python tools/campaigns/draw_campaign_pixel_west.py --output "$work/west-terrain"
for slug in moki-dugway oak-creek-canyon angeles-crest; do
  cp "$work/west-terrain/$slug.png" "$work/terrain/campaign-map-$slug.png"
done
python tools/campaigns/draw_campaign_east_hero_minis.py --output "$work/overrides"
cp -R "$work/east/"*/ "$work/west/"*/ "$work/minis/"
for dir in "$work/central/sprites/"*/; do
  slug=$(basename "$dir" | cut -c4-)
  cp -R "$dir" "$work/minis/$slug"
done
python tools/campaigns/pack_campaign_map_layers.py --minis "$work/minis" \
  --terrain "$work/terrain" --overrides "$work/overrides" \
  --output "$work/ready" --revision-ms "$(date +%s)000"
```

Review the generated files under `ready/` before copying to the repo. The
packer reads the current menu but does not rewrite it. The existing landmark
references are in [2994 attraction art](2994-attraction-art.md). For an
individual placement layer, adjust the region's slot in the packer's depth
lists and regenerate its checked-in layout.
