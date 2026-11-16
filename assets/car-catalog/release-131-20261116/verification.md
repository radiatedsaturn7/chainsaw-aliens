# Isolated 131-car staging release

Roster source: `783304870f87c25488e8103d855321303a8df8c9` (tree `f6dc1c47ed078c2fbf8e9f80e7efcdca1b9552f9`), 131 playable cars and three system templates. The older separate eleven unpublished cars and unfinished Hedgenettle are excluded.

Integrated staging: `192dba46b2f80d2fe71a589ecdd450f3f1894e33`. The unmodified merge tree is `bc29e2ed45349d9d34c8a381895973b6014f0ca6`. Staging race, lighting, road-texture and barrier changes are preserved.

## Silverleaf test expectation correction

The raw-document round-trip assertion fails both on former staging `f51518946685c18a895e73309c939a5a54e75d84` and on live staging. Serialization adds 252 absent properties across exterior gauge widgets, exclusively `opacity`, `damageArtTint`, `fuelIconAngle`, `fuelIconOffsetX`, `fuelIconOffsetY`, `fuelIconScale` and `highBeamArtRef`. No authored value changes. The existing `withLegacyGaugeDefaults` test helper produces an expected car exactly equal to the actual serialized car.

The last successful hosted Vehicle Catalog run was [43678162784](https://github.com/radiatedsaturn7/chainsaw-aliens/actions/runs/43678162784), job 132702766137, PR head `179aec863bcc348aec6a5967688c5e54828a4df9`, tested merge `51c359bb` into `ef6034818a76458b4314cca07afa226a2cdc0082`. It passed Silverleaf and all 683 configured units on Ubuntu 24.04.5, Node 22.23.4 and npm 10.9.9. Current local reproduction uses Debian 13.6 x86_64, Node 22.23.5; the historical car input also passes under this same local runtime. The car document changed in `2006055a` (exterior gauge synchronization), while the raw fixture assertion remained unchanged. This isolates the stale expectation from the OS difference.

The correction applies the existing explicit legacy-default helper to the expected side only. Actual serialization, runtime, authored car data, calibration and physics remain untouched. Full-car deep equality remains mandatory. The helper's existing regression test checks authored values, input immutability, changed placement, changed physics and unexpected fields.

Complete local logs, exact assertion/stack/input/diff, hosted job log and final-tree results are preserved outside the repository in `/workspace/release-131-qa/`. No hosted CI dispatch or merge is part of this release preparation.
