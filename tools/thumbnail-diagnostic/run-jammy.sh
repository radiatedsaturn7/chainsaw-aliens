#!/usr/bin/env bash
set -euo pipefail
DRIVER="$(realpath "$1")"
mkdir -p diagnostic-results
test -z "$(git status --porcelain=v1 --untracked-files=no)"
python3 "$DRIVER/verify-jammy.py" "$DRIVER/pins.json" "$VARIANT" "$DRIVER/car-thumbnail-cold-perf.private.spec.js" | tee diagnostic-results/input-receipt.json
node --version | tee diagnostic-results/node-version.txt
# Lockfile and local Playwright binary only, no npx package auto-resolution.
npm ci --no-audit --no-fund
./node_modules/.bin/playwright install --with-deps chromium
node --input-type=module <<'JS' | tee diagnostic-results/chromium-sandbox.txt
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chromium',chromiumSandbox:true});
try {
 const page=await browser.newPage();
 await page.goto('chrome://sandbox');
 const status=await page.locator('body').innerText();
 console.log(browser.version(),status);
 assert.match(status,/You are adequately sandboxed/i);
 await page.goto('data:text/html,<title>sandbox-ready</title>');
 assert.equal(await page.title(),'sandbox-ready');
} finally {await browser.close();}
JS
cat > playwright.thumbnail-jammy.config.js <<'JS'
import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
 ...base,
 outputDir:'./diagnostic-results/test-output',
 retries:0,
 use:{...base.use,channel:'chromium',trace:'off',launchOptions:{...base.use?.launchOptions,chromiumSandbox:true}}
});
JS
export THUMB_QA_VARIANT="$VARIANT"
case "$GROUP" in
 tutsan-desktop) TEST='Tutsan desktop keyboard static picker initial page, later page, cockpit and real input drive$' ;;
 tutsan-handheld) TEST='Tutsan handheld touch static picker initial page, later page, cockpit and real input drive$' ;;
 traversal-desktop) TEST='catalog complete first-to-last picker traversal and wrap desktop keyboard$' ;;
 traversal-handheld) TEST='catalog complete first-to-last picker traversal and wrap handheld touch$' ;;
 cold)
   cp "$DRIVER/car-thumbnail-cold-perf.private.spec.js" tests/playwright/car-thumbnail-cold-perf.private.spec.js
   SPEC=tests/playwright/car-thumbnail-cold-perf.private.spec.js
   TEST='^.*thumbnail cold'; COUNT=6
   ;;
 *) exit 2 ;;
esac
if [[ "$GROUP" != cold ]]; then
 test "$VARIANT" = B
 SPEC=tests/playwright/car-catalog.spec.js; COUNT=1
fi
PW=(./node_modules/.bin/playwright test --config=playwright.thumbnail-jammy.config.js "$SPEC" --grep "$TEST")
"${PW[@]}" --list | tee diagnostic-results/selected-tests.txt
grep -Eq "^Total: $COUNT tests? in 1 file$" diagnostic-results/selected-tests.txt
if [[ "$GROUP" == cold ]]; then
 repeats=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["repeats"])' "$DRIVER/pins.json")
 [[ "$repeats" =~ ^[1-5]$ ]]
else repeats=1; fi
PLAYWRIGHT_JSON_OUTPUT_FILE="$PWD/diagnostic-results/playwright.json" "${PW[@]}" --workers=1 --retries=0 --repeat-each="$repeats" --reporter=line,json
