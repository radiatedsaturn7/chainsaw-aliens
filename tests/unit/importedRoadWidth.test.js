import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('import widths reject implausible legacy parkway tags without narrowing surveyed roads or circuits',()=>{
 const output=execFileSync('python',['-c',`
import ast, math, json
source=ast.parse(open('tools/campaigns/import_side_races.py').read())
function=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='mapped_road_width')
exec(compile(ast.Module(body=[function],type_ignores=[]),'width-test','exec'))
cases=[
 {'source':'massgis_import_v0.1_20071009','width':'15.2','lanes':'2'},
 {'source':'massgis_import_v0.1_20071009','width':'15.2','lanes':'1'},
 {'source':'survey','width':'15.2','lanes':'2'},
 {'highway':'raceway','width':'15.2','lanes':'2','source':'massgis_import_old'},
 {'highway':'motorway','width':'15.2','lanes':'2','source':'massgis_import_old'},
 {'width':'broken','lanes':'2'},
 {'source':'massgis_import_v0.1_20071009','width':'8','lanes':'2'}]
print(json.dumps([mapped_road_width(c) for c in cases]))
`],{encoding:'utf8'});
 assert.deepEqual(JSON.parse(output),[7,3.8000000000000003,15.2,15.2,15.2,7,8]);
});
