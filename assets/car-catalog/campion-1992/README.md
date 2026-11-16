# Campion 1992

Original logo-free 2994 grand tourer inspired by the standard 1992 US Subaru SVX AWD four-speed automatic. The optional Touring Package, sunroof and accessory rear spoiler are excluded. This is not a later front-drive SVX or a manual conversion.

The original Subaru of America brochure MSA8M9201 3118-280 is the selected period source. Its high-resolution specification page18 was visually inspected, and page19 distinguishes optional equipment. It prints 224lb-ft and3317cc; different values from service-manual reproductions were not mixed into this selection. The brochure's curb mass is converted from pounds and rounded. Ratios and unsupported simulation settings are explicitly estimated in import.json. Active torque-split AWD is approximated by the existing runtime with a front-biased setting and rear limited-slip behavior; it is not a reproduced factory control map.

The package preserves original body/dashboard generations and correction generations. The corrected body has eight directions, no accessory wing and split front-door glazing. The cockpit's vertical center vents and suede passenger band were corrected against the original brochure interior. Fitted live speed/RPM/gear and fuel displays are a 2994 retrofit; shared steering-wheel and tire layers animate during driving.

QA evidence and logs are in qa/. Desktop keyboard and handheld touch checks drive the production simulation with in-memory straight routes. The paged-picker smoke checks initial visible art, navigates to Campion on a later page, waits for its real exterior resources, opens its cockpit and drives. No saved race or runtime/world file is changed.

Base03c5a1b7b6de52025a75f428c5a0138b82d2426c has103 playable cars. Campion makes104 on this separate local branch, excluding three system templates. This is unrelated to integration with the old104-car branch, which remains untouched. Staging remains58c2ec08e9457b778a19f617fad3aded4e4fa0ee with tree7e1315cdc36f12c3be7b8250e39ca4c251595722.

Validation:36 focused checks and four initial browser checks passed. After fitting the wiper mounts, five focused checks and three final moving/picker browser checks passed; manifest passes cover1,862 documents and16 assets. The editor-preview cockpit screenshot records the initial wiper placement; final desktop/handheld and static-picker cockpit evidence shows the corrected fit. All eight exterior views were visually reviewed.
