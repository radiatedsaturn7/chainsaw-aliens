import json, pathlib, html, sys
root=pathlib.Path('artifacts/p2loadtest')
s=json.loads(pathlib.Path(sys.argv[1]).read_text())
escape=html.escape
rows=''.join('<tr><td>{}</td><td>{}</td><td>{:.1f}</td><td>{:.1f}</td><td>{:.1f}</td><td>{:.1f}</td></tr>'.format(r['km']+1,r['frames'],r['updateMs']['p50'],r['updateMs']['p95'],r['updateMs']['p99'],r['renderPreparationMs']['p95']) for r in s['sections'])
route=(root/'route.svg').read_text().replace('width="1200" height="800"','width="100%" height="auto"')
status='Finish crossed' if s['complete'] else 'Incomplete run — not a verified lap'
body=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P2 endurance test</title><style>
body{{background:#111820;color:#e9eff7;font:17px/1.5 system-ui;max-width:1100px;margin:auto;padding:24px}}h1,h2{{line-height:1.2}}table{{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}}td,th{{padding:8px;text-align:right;border-bottom:1px solid #425060}}th{{background:#25313d}}.note{{background:#25313d;padding:16px;border-radius:8px}}svg{{max-height:600px}}li{{margin-bottom:8px}}</style>
<h1>p2loadtest — endurance results</h1><p><strong>{status}</strong> · {s['routeLengthM']/1000:.2f} km route · {s['aiCount']} AI cars plus player · {s['simulatedSeconds']/60:.1f} simulated minutes</p>
<p class="note">This is a Node CPU test of gameplay, physics and road-condition/tire-mark geometry preparation. It does not measure browser drawing, GPU performance, audio or phone FPS. The first five seconds are excluded from the timing table. Driver inputs use the normal vehicle simulation, without teleporting around the route.</p>
{route}<p>Grey: street. Brown: rally. Blue: bridge. Purple: tunnel. P1 skybox, textures and 21.6 m road width are retained.</p>
<h2>CPU time by kilometre</h2><table><thead><tr><th>km</th><th>Frames</th><th>Update median ms</th><th>Update p95 ms</th><th>Update p99 ms</th><th>Surface/marks p95 ms</th></tr></thead><tbody>{rows}</tbody></table>
<h2>Changes and evidence</h2><ul>
<li>Indexed nearest-road queries and cached route costs replace repeated scans and route searches. On P2, 2,000 matching queries took 602.7 ms before and 25.5 ms after on the local test device.</li>
<li>New dry road-condition cells share exact temperature history for matching profiles. Creating 1,000 cells after 1,200 weather updates took 724.8 ms before and 17.1 ms after, with the same simulation checksum. Wet weather retains the full calculation.</li>
<li>Surface visuals use nearby-cell lookup, cached heights and bounded refresh frequency. Tire-mark retirement updates affected buckets only.</li>
<li>Per-car collision-edge caches now retain 128 recently used areas. A regression test verifies identical wall classification after eviction. This additional cache limit was tested separately after the endurance run started.</li>
</ul><h2>Remaining work to investigate</h2><ul>
<li>AI physics remains a substantial CPU cost with 11 rivals. Profile the vehicle solver separately before changing its update frequency or fidelity.</li>
<li>AI look-ahead creates persistent condition cells; consider transient queries for untouched areas while preserving weather and contamination behavior.</li>
<li>Checkpoint capture and hashing can lag event production. Bound their memory cost without discarding data needed for worker synchronization or replay.</li>
<li>Run the same lap in a rendered browser on the target phone to measure actual frame pacing and GPU cost.</li></ul>
<p>Peak retained condition cells: {s['peakCells']:,}. Peak tire-mark segments: {s['peakTireMarks']:,}.</p>
<p>Raw summary: <a href="final-summary.json">final-summary.json</a>. Test run: <a href="https://github.com/radiatedsaturn7/chainsaw-aliens/actions/runs/39892042099">GitHub Actions</a>.</p></html>'''
(root/'report.html').write_text(body)
print(root/'report.html')
