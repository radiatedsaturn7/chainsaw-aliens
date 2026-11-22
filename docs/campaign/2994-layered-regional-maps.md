# Layered regional campaign maps

Eleven terrain plates, 88 individual transparent miniatures. Each miniature is
anchored to the saved race node by its stable map reference, node ID and exact
race reference. An ordinary node move in the map editor moves the miniature too.
Race order, authored links and ports, entrances, saves, and the world overview
do not change. A map with a different art reference or a remapped race retains
normal node, road and car behavior without picking up unrelated art.

Regional draw order:

1. Terrain-only backdrop. The existing editable map Background Art slot retains
   its reference; the matching PNG and native Art document agree pixel for pixel.
2. Ground miniatures (riverbanks, tracks, shelves and selected bridge decks).
3. Existing drivable road curves and entrance. No road pixels are baked into art.
4. Raised silhouettes and covered/rock passages. Raised art sits back from the
   pin. Passages sit over their route anchor; the road continues below the roof.
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
mkdir "$work/minis"
cp -R "$work/east/"*/ "$work/west/"*/ "$work/minis/"
for dir in "$work/central/sprites/"*/; do
  slug=$(basename "$dir" | cut -c4-)
  cp -R "$dir" "$work/minis/$slug"
done
python tools/campaigns/pack_campaign_map_layers.py --minis "$work/minis" \
  --output "$work/ready" --revision-ms "$(date +%s)000"
```

Review the generated files under `ready/` before copying to the repo. The
packer reads the current menu but does not rewrite it. The existing landmark
references are in [2994 attraction art](2994-attraction-art.md). For an
individual placement layer, adjust the region's slot in the packer's depth
lists and regenerate its checked-in layout.
