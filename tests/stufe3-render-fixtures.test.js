'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
test('Stage 3 final renderer fixture factory runs without browser and covers counts, source failures and legacy',()=>{
 const script=`import ast,json,pathlib,sys
__file__=sys.argv[1]
tree=ast.parse(pathlib.Path(__file__).read_text())
f=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='fixtures')
exec(compile(ast.Module(body=[f],type_ignores=[]),__file__,'exec'))
print(json.dumps(fixtures()))`;
 const r=spawnSync('python3',['-c',script,path.join(__dirname,'../docs/render/stufe3.py')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const f=JSON.parse(r.stdout);
 assert.deepEqual(Object.keys(f).sort(),['empty','legacy','offline','partial','voll']);
 for(const key of ['users','usb','coral']){const find=v=>f[v].entities.find(e=>e.entity_id==='sensor.demo_dashboard_'+key),field=key==='users'?'users':'devices';assert.ok(Number.isInteger(Number(find('voll').state)));assert.equal(find('empty').state,'0');assert.deepEqual(find('empty').attributes[field],[]);assert.equal(find('offline').state,'unavailable');assert.equal(find('legacy'),undefined);assert.ok(find('partial').attributes.failed_sections.length);assert.ok(find('partial').attributes[field]===null||find('partial').attributes[field].length>0);assert.ok(f.voll.entities.some(e=>e.entity_id==='sensor.other_dashboard_'+key));}
 assert.equal(f.partial.entities.find(e=>e.entity_id==='sensor.demo_dashboard_users').attributes.users,null);
 assert.match(f.voll.entities.find(e=>e.entity_id==='sensor.demo_dashboard_users').attributes.users[0].description,/Long/);
});
