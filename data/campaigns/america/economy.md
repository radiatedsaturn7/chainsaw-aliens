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
