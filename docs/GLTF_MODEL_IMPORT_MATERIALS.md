# Editable glTF / GLB material fidelity

The editor flattens scene meshes into editable native model documents. Compatible glTF metallic-roughness materials retain base color and UV0 image, scalar metallic and roughness factors, scalar clearcoat strength and roughness, index of refraction, emissive color and intensity, opacity, alpha mode/cutoff, and sidedness. The native vehicle pass and authored Object Editor preview use the shared physical material. Older native documents are untouched, including their binary pixel-cutout rules.

The importer also retains compatible UV0 base normal and occlusion/roughness/metalness maps. It packs source occlusion red, roughness green and metalness blue into the existing native ORM image, using neutral white for missing channels so authored scalars still apply. Separate maps are resampled to a shared size if needed. Authored mesh normals are transformed into model space; reflected node transforms preserve the source front-face orientation. The runtime evaluates tangent-space normal detail using its existing derivatives and UV0 convention.

Limits of this importer:

- It is not a general glTF round trip or complete extension renderer. The native schema has one UV per corner, no preserved sampler/wrap state, and no stored glTF tangent basis. Normal-map results can differ on meshes with custom tangents.
- Alternate UV sets, per-texture transforms such as `KHR_texture_transform`, unsupported compressed images, and non-matching texture orientations are not preserved. Auxiliary maps with one of these mismatches are skipped rather than silently combined as if compatible. The existing base-color import still uses the native UV0/simple sampling path.
- Clearcoat maps (including separate coat normals), emissive textures, transmission/volume, specular/anisotropy, sheen, iridescence, and other extension-specific shader behavior are not stored. The importer keeps the compatible core material where possible.
- Base colors are stored as 8-bit sRGB. Browser image extraction can resize to at most 1024 pixels per axis and uses the browser canvas decode path; it is not an HDR, original-precision, or lossless texture transfer.

The shipped Fit 10 WRX uses existing native documents, not this conversion path. This importer change does not change those body/wheel files or take new model geometry through staging.
