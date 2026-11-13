# Rally co-driver

Calls are generated during race preparation and race saves using the existing
virtual recce. Existing manually authored calls still override nearby automatic
calls. No bulk rewrite of saved campaign documents is necessary.

Timing uses forward speed, estimated speaking duration, and the recce corner-speed
reduction with live grip/brake condition. The window is bounded to 30–450 m;
long straights remain quiet until that window. Nearby features use `into` (<20 m
clear gap) or `and` (20–50 m), limited to three features / roughly 7.5 seconds of
speech, with a speed-dependent chaining horizon. These are game calibration
parameters, not measured universal rally constants. Distance is read once when
speech actually starts; icons retain their original distance until passed.

One utterance at a time prevents a backlog of already-passed turns. Road calls
preempt chatter. Pause, disable, reset and session disposal cancel owned speech;
interrupted upcoming calls can retry. Lap keys prevent repeated seam calls. The
finish call appears only on the final lap or point-to-point approach.

The recce reads curvature, smoothed road height, authored negative banking,
width changes, sustained surfaces, bumpiness, bridge/tunnel structure metadata,
and explicit junction flags. Only damaging/collidable inside-apex scenery produces
cut warnings; named trees/rocks add specific qualifiers. It does not infer junctions
or structures from scenery artwork or invent safe cuts/flat-out instructions.
Missing map metadata still needs an authored co-driver call in the race editor.
Crests/dips, tightening/opening, hairpins/square/acute turns remain geometry based.

Voice/Both also speaks the actual five-second start countdown (music still reaches
its cue at Go), and occasional impact or damage reactions. Collision impulse must
exceed 2500 N s; damage crosses 35% or 70% on the worst affected component. Reactions
expire, have cooldowns, and wait for a gap of at least ten seconds to the next note.
Voice remains browser speech synthesis; no commercial game recordings are used.
Device voice latency and pronunciation still need driving/listening evaluation.

## References

- [Smoothline stage notes, by Steve Glenney and Bernie Webb](https://nsscc.com.au/wp-content/uploads/2017/07/Smoothline-Sample-M10-Gravel.pdf): relative corner grades, linked notes, modifiers, and keeping information manageable.
- [EA SPORTS WRC accessibility settings](https://www.ea.com/able/resources/ea-sports-wrc): earlier/later co-driver timing and normal/simplified calls.
- [Hyundai WRC dictionary](https://www.hyundaimotorgroup.com/en/story/CONT0000000000079823): reconnaissance and co-driver notes.

No authoritative public description of WRC Generations' internal scheduling
algorithm was found. This implementation follows the conventions, not a claimed
replica of its proprietary timing logic.

Validation: `node --test tests/unit/raceCodriver.test.js tests/unit/raceRecce.test.js tests/unit/raceDrivingAssists.test.js tests/unit/racePaceNoteIcons.test.js tests/unit/raceMusicDrops.test.js tests/unit/raceIntro.test.js tests/unit/racePauseRestart.test.js tests/unit/raceTriggers.test.js tests/unit/raceDrivingGuideThree.test.js`.
