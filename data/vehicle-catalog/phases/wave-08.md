# Local placeholder wave 08

Base: `171e58b6f04a76113ed1274617d0243c22ab32b9` (229 entries). Work branch: `local/660-wave08-20261117`. The 226-entry integration ref and 229-entry wave07 ref are preserved. No public branch, workflow, race, runtime or existing car/art file is changed.

Six additional existing backlog slots now have factory-backed engine/identity anchors and separate placeholder configurations:

| Alias | Production reference | Important distinction |
| --- | --- | --- |
| Brooklime 1994 | Japan Nissan Silvia K's Type S S14 SR20DET | 162kW/274Nm/1220kg factory reference; not US240SX or race S14 |
| Moschatel 1973 | Japan Nissan Skyline 2000GT-R KPGC110 S20 | Exact1973 example; not1971 KPGC10 or any later turbo/AWD Skyline |
| Fumitory 1983 | German Golf I GTI1.8 standard three-door4+E | 82kW/150Nm; not launch1.6, Pirelli or2015 Scabious |
| Sandwort 1988 | German Scirocco II GTX16V102kW reference | 1.8 16-valve low coupe; not US16V,129PS catalyst tune or8-valve GTI |
| Water Avens 1995 | German Corrado2.9VR6 | 140kW/245Nm; not US2.8SLC or G60 |
| Quaking Grass 2003 | European Golf IV R32 6MT4MOTION | 177kW/320Nm; not DSG, US2004 or250PS MkV |

The complete source URLs, original units, verified fields and explicit estimated fields are in `wave-08-research.json` and embedded in each car. The Nissan historical160PS rating has unspecified gross/net basis: it remains reference-only, with separately estimated installed140hp/115lb-ft. VW masses, exact gearing and unsourced fitments are estimates, not facts borrowed from a nearby trim. The Scirocco archive establishes the102kW GTX16V variant and1985–1989 period but does not resolve an exact1988 catalyst/engine code; neither is asserted. Some gearbox selections remain provisional pending trim-specific tables. The R32 uses generic fixed AWD rather than Haldex control, and a single final-drive approximation. Shared body/cockpit graphics and chassis approximations are explicitly incomplete phase2 representations.

The requested category mix was attempted, but exact T1 DeLuxe1963 and SP2 1976 anchors were not ready. They remain deferred rather than using another market/year. Safari remains deferred for its SD33/SD33T primary-source conflict. This six-car wave uses two official source collections and distinct engines, eras and FWD/RWD/AWD layouts, without adding badge-only derivatives or increasing the660-slot ledger.

Counts:235 implemented non-system manifest entries,3 system templates,24 shared placeholders. Keep210 previously reported finished and1 separately original-art-authored Echo pending independent acceptance reconciliation. This wave adds6 unit-tested configurations,0 drive-verified and0 finished original-art cars. These are manifest entry counts, not a claim that235 identities are exact660-slot matches; pre-existing starter-rwd ID collisions remain untouched. All six new IDs and candidate slots are unique.

## Validation and combined follow-on

Each of12 new scenarios exercises initial picker page, later-page art, cockpit, live RPM and keyboard or touch movement. They are imported once by `tests/playwright/car-catalog.spec.js`, which Vehicle Catalog already executes. The50 addition-specific cases across all waves and Echo remain discoverable. No workflow edit or separate helper discovery is necessary.

Local sandbox-preserving launch still fails before page creation with `No usable sandbox!`. No security changes or successful drive claims. Evidence: `/workspace/scratch/wave08-qa/` (units, manifest, discovery and browser logs). All479 pre-existing car/race documents compared byte-for-byte equal to the parent.

At the read-only hosted check during this wave, Echo Vehicle Catalog run44156890869 had completed successfully. Pilot run44158167346, job134304433167 `validate`, was still running step10 (the serialized nine-spec Playwright command); unit step8 and manifest step9 had passed. The active individual browser test is not observable: the supported job-log API returned404 BlobNotFound. Do not infer the exact failing/hanging test from duration or use those earlier heads to certify this local wave.

After the pending PRs land, compare future staging against the preserved integration and replay only the local follow-on changes, preserving all helper imports and manifest mappings. One combined staging-targeted follow-on PR can run the existing Vehicle Catalog workflow without modifying it. The workflow already loads all new units through `carCatalogImport.test.js` and all50 addition scenarios through `car-catalog.spec.js`.

Combined targeted command on a supported browser host:

```sh
node --test --test-concurrency=2 tests/unit/carCatalogImport.test.js tests/unit/placeholderIntake.test.js tests/unit/tutsanCatalog.test.js tests/unit/tutsanWheelCoverage.test.js tests/unit/catalogCameraSmoke.test.js
python tools/project_manifest.py --check --validate-assets
npx playwright test tests/playwright/car-catalog.spec.js --workers=1 --reporter=line
```

For release acceptance retain the existing workflow's complete unit/browser commands as well; the targeted command is not a substitute for its broader gates. No publication on this turn.

Read-only staging recheck: `aaab12b270d8a1bb60de30875301e79d5d203ed6` merged Echo#666 with parent `177ca2095399edf9adbf9a0fd6f29cafe2cc4fbe`. Its diff from the210-car baseline contains only the already-integrated Echo files/tests. This wave does not merge or modify staging. Echo acceptance can be reconciled separately from its hosted logs; this local wave adds no driving acceptance.

Scoped units:107 passed, zero failed/skipped.

Full manifest/assets validation passed: {"documents": 2235, "assets": 16}; Published project manifest includes every current document.
