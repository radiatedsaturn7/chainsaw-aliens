# Production vehicle rendering validation

The Fit 10 body and wheels are unchanged. The verification vehicle is the existing **Field Forgetmenot 2004 3D**, not a Studio export or a legacy WRX variant.

| Path | Material and environment |
| --- | --- |
| 3D Car Design | Authoring preview with automotive materials, its own probe, ACES output and exposure 1.08. |
| 3D Object Editor | Tagged documents now use authored material factors, bind normals and studio IBL. Untagged documents keep their editor shading. |
| Garage | Native body and wheels, the Fit 10 garage bay probe and the automotive highlight shoulder. The production model is composited over unchanged art; existing body and tire shadows remain. |
| Race intro and gameplay | Use the same WebGL world and vehicle instance builder. Intro changes camera and framing, not material. The selected time of day, resolved weather, and renderer capabilities now reach probe selection. |
| Replay | No separate replay-specific automotive renderer was found. Saved-input replay is not proof of a separate visual path. |

The Fit 10 keeps #124b9a, base roughness .285, a pigmented dielectric under clearcoat, and coat roughness .077. Albedo is sRGB; ORM and normal maps are linear data. Three r160 uses a cached, prefiltered CubeUV map with a roughness-dependent mip and samples it in world space. Its physical shader has separate base and clearcoat specular contributions; normal derivatives can increase effective roughness, so fewer rendered pixels also soften highlights.

The race renderer previously selected its probe from simulation fields that did not reliably hold the visible race conditions, and it multiplied reflections from an already dark probe by scene ambient again. Indirect specular and the indirect coat term now bypass that second multiplier, then still go through fog. Daylight at ambient 1 is unchanged by that separation. Native lamp emission stays independent. This patch does not enable global shadow maps, alter tire contact geometry, or retune wheels, glass, optics or suspension. Fit 10's wheel material is not the gold Fit 11 authoring variant.

For GLB coverage and remaining limitations, see [GLB model import materials](GLTF_MODEL_IMPORT_MATERIALS.md). Fit 10 is native; import losses did not cause its dull race appearance.

## Reproduce

Serve the project with the ordinary static development server. Open /tools/vehicle-validation/material-lab.html for the exact Fit 10, chrome/gloss/paint spheres, a curved sample, and roughness and metalness arrays. The contribution modes use the physical production shader. A 4× specular-only visualization gain is diagnostic, not an in-game multiplier. The linear-HDR view displays a logarithmic encoding relative to .18 linear gray. Hold camera, probe and exposure fixed when changing one material parameter. The orbit and heading are separate controls. The GPU button uses a warmed WebGL2 timer query when supported; CPU submission is not GPU frame time.

On the game URL, these choices are independent and optional:

- race3dResolution=display increases only the 3D render target toward actual pixel density, bounded to 1.5× extra density and about 0.92 MP unless the race is already authored higher.
- race3dFilter=linear filters the 3D blit only. It does not change material anisotropy or HUD sampling.
- race3dProbe=sky tests a world-aligned clear-day probe made from the race's authored panorama and an analytic HDR term. It samples the art once per cached setup, uses authored azimuth and offset, and matches the mean luminance of the clear-day probe. Missing art, night and bad weather retain the corresponding fallback profiles. This is not a live probe of nearby geometry or the default.

For before/after, start the same race in the same display mode with and without one selected option. Compare the intro orbit, chase camera, and a turn in motion. Check highlight shape and movement, not just brightness. Use the same camera at night and in rain to verify the resolved probe changes.

## Measurements and limits

A Chromium DPR-2 test at 960×540 CSS held the 1920×1080 outer canvas and 536×302 logical HUD viewport fixed. The legacy 3D target was 536×302; the bounded display target was 804×453. That's 2.25× the 3D raster pixels for that viewport, not 2.25× GPU time. Nominal RGBA8 color storage grew about 790 KiB, excluding depth, compositing and driver allocations. The shared 128×64 RGBA16F source is 64 KiB plus cached PMREM targets. No vehicle triangles or material textures were added to the WRX.

The exact Blue Hills track and sky rendered in the real game path in Chromium, including intro orbit, rain/night routing and a moving chase shot. The partial local asset set is not a full release build. Physical Android GPU timing, nearby reflection geometry, and broader environment validation are still required. These captures do not establish 60 FPS on target hardware.
