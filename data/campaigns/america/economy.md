# Campaign economy

Races award scrap on successful completion, including Tower Hill's scripted ending.
Abandoned runs and unmet mechanical missions do not pay. Editor previews and debug
car overrides do not pay. Each run has an idempotent receipt saved with inventory;
reopening results or retrying a failed completion save cannot pay twice.

Repeat payout: 150 + 25 per route kilometre, rounded to 25 scrap. Main missions
add 150. Distance is bounded to 1–60 km for payouts. First clear doubles this
amount and awards a permanent part, without automatically installing it. Already
owned prizes salvage for 25% of their crafting price (minimum 50 scrap). Receipt
history is separate from progression cheat flags, so TRAVEL does not spend prizes.

Main mission prizes are listed in src/garage/CampaignEconomy.js. Tower Hill awards
snow tires before Mount Washington. Optional prizes are deterministic by race name
and conditions, and disclosed in race prep. Snow, dirt, wet, road, drift and drag
have distinct prize pools. Payouts do not depend on time spent waiting or driving
slowly. Existing profiles can earn their first economy reward by replaying events.

Starting scrap remains 500. Street crafting prices remain unchanged; sport prices
are 1.4x, race prices 1.8x and custom prices 1.5x the previous catalog, rounded to
25. Authored saved-item overrides remain authoritative. Service and repair costs
are unchanged: fuel/oil/coolant/battery cost at most 40 scrap in total; major damage
still costs more. Rewards and prices need live playtesting, especially repair
spending over several consecutive mountain runs.

The starting car is owned. Additional saved cars can be purchased through Garage
using their stock performance index: 1500 + PI² / 40, rounded to 100 scrap. Bought
cars remain owned, and each keeps its installed parts, tuning, setup slots and wear.
Cars are never sold or discarded by switching. Installed physical parts cannot be
shared simultaneously between cars. Catalog additions automatically join the shop.
Ownership, receipts, inventory and scrap belong to the active save slot.

Race prep shows distance, surface types, weather, scrap and the first-clear prize.
The existing route description remains available on the map. Main mission order,
car physics, race geometry and progression locks are unchanged by this economy.

## Opening sequence objectives and records

`src/garage/CampaignObjectives.js` defines optional care objectives and preparation
briefings for the first three main missions. No recoveries and no more than 15
percentage points of new damage to any component earns Tower Hill's 150 scrap
bonus. Washington and Laurel allow 10 points and award 250 scrap each. These are
gameplay targets, not claims about physically accurate wear or playtested medals.
Missing an objective never blocks completion, equipment prizes or regular scrap.
A missed bonus can be earned on a later clear; each bonus pays once per save slot.
Condition is compared with the start of the run, so existing damage is not charged
against the objective. Fuel consumption is not component damage.

The existing race preparation panel shows the goal, bonus and next-leg advice.
Results show the objective and personal best; garage Drive commentary identifies
the component with the most new damage, or reports recoveries / little damage.
It does not invent diagnoses about grip, driving technique or overheating.
Tower Hill retains its scripted fade and cutscenes without a results screen;
its timed exit can earn the objective but cannot set a full-course time record.

Best times are saved per race and car in the existing reward ledger, alongside
one-time objective awards. Builds and weather are not separate leaderboards.
Only completed runs without recovery and with measured condition qualify; current
debug car/environment overrides are excluded. These are local personal records,
not cheat-resistant competitive times. Abandoned and failed missions do not pay.
Bonus, inventory, currency and records share the existing atomic save transaction.

Automated opening-economy audit (actual saved race and RTG-001 documents):

| Mission | First clear | Repeat | Optional once | Test repair + service |
| --- | ---: | ---: | ---: | ---: |
| Tower Hill | 800 | 400 | 150 | 84 |
| Mount Washington | 1,200 | 600 | 250 | 84 |
| Laurel Highlands | 1,300 | 650 | 250 | 84 |

Repair scenario: fully depleted fuel/oil/coolant/battery and 10% damage to each
of the four dampers. Starting with 500, completing all three and paying that
repair bill after each leaves 3,548 scrap before bonuses. Awarded equipment can
be equipped without purchasing it. No base price reductions were justified by
this scenario, so service, repair, car and part prices remain unchanged.

This is not a human driving playthrough or a prediction of actual crash damage.
Next acceptance pass: drive all three on stock RTG-001, install the awarded snow
tires before Washington and suspension before Laurel; record repair bills and
objective outcomes, then repeat with a rough run and a different starter car.
No fixed time medals are imposed until representative completion times exist.

### Opening-sequence regression test

Run `npm run test:campaign-opening`. The test loads the three saved race documents
and RTG-001, starts a fresh profile with 500 scrap, and runs clean and rough outcome
scenarios through the actual race-result persistence path. It installs snow tires
before Washington and rally suspension before Laurel, checks Robtergeist's damage
feedback, pays Repair All, and reloads the save after each mission. It verifies
ordered world-map unlocks, duplicate-result protection, records, equipment retention,
and isolation from another new save slot. GitHub merge checks also run this test.

The outcomes deliberately inject wear and recoveries; this does not simulate laps
or establish driving difficulty. Clean: 10% damper damage, no recoveries, 4,198 scrap
remaining after three repairs. Rough: 20% damper damage plus a recovery each race,
no objective bonuses, 3,416 remaining. Both scenarios fully deplete service supplies
before repair. Lap times are fixture values, not measured performance targets.
