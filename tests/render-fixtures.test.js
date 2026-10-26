'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('Final renderer consumes source failures and actual legacy parity without starting a browser', () => {
  // Execute only the fixture factory: module imports/main would load the browser harness.
  const script = `import ast, copy, json, pathlib, shutil, subprocess, sys
__file__ = sys.argv[1]
tree = ast.parse(pathlib.Path(__file__).read_text())
factory = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'fixtures')
exec(compile(ast.Module(body=[factory], type_ignores=[]), __file__, 'exec'))
print(json.dumps(fixtures()))
`;
  const result = spawnSync('python3', ['-c', script, path.join(__dirname, '../docs/render/stufe2.py')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  const entity = (variant, suffix) => data[variant].entities.find(e => e.registry.unique_id === 'example-entry_' + suffix);
  assert.equal(entity('legacy', 'parity_running').attributes.state, undefined);
  assert.equal(entity('partial', 'dashboard_cpu').attributes.cores, null);
  assert.equal(entity('partial', 'dashboard_cpu').attributes.packages[0].power_w, 18);
  assert.equal(entity('partial', 'dashboard_hardware').attributes.hardware, null);
  assert.equal(entity('partial', 'dashboard_hardware').attributes.gpus[0].model, 'Example GPU');
  assert.equal(entity('partial', 'dashboard_storage').attributes.filesystems, null);
  assert.equal(entity('partial', 'dashboard_storage').attributes.pools[0].free_bytes, 3 * 1024**4);
  assert.equal(entity('partial', 'dashboard_interfaces').state, 'unavailable');
  assert.equal(entity('partial', 'dashboard_interfaces').attributes.interfaces, null);
});
