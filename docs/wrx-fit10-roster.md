# Field Forgetmenot 2004 · Fit 10

The existing Field Forgetmenot 2004 car and save identity now use the
editor-built Fit 10 body and wheels. The visual meshes are fitted to the
same physical wheel centers; no car, tire, tuning or progression data
changed. The exported assembly is 14,840 triangles including all four
wheels. Fit 10 uses its own brake meshes rather than adding the previous
showcase rotor and caliper on top.

The previous hand-built artwork stays in the tree. Add `wrxLook=legacy`
to the game URL to compare; `wrxLook=showcase` still selects the showcase
pair. If the browser cannot load the Fit 10 pair it tries the previous
pair rather than mixing generations. `wrxLook=off` keeps its previous
effect.

The two gzip packs contain individual, native `rtg-model` JSON files.
To edit the raw mesh, import either decompressed file with **3D Object
Editor → File → Import**, then Save As to keep a personal working copy.
A complete Car Design Studio genome instead belongs in **3D Car
Design**. Saving an imported mesh does not automatically replace the
bundled roster artwork.
