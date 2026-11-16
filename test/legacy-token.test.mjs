// The old browser-storage key 'jobapp:githubToken' is a second copy of the GitHub token. It only feeds the one-time
// copy into the app's own connection slot ('jobapp:connection'); it is removed once the connection in effect holds a
// token, is kept when none does, and is never written. Runs the app's real initializeJobConnection() from
// src/app.jsx against a fake localStorage. Only made-up tokens appear here; nothing prints a stored value.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';

const SRC = process.env.JOB_APP_SRC || new URL('../src/app.jsx', import.meta.url);
const text = fs.readFileSync(SRC, 'utf8');
const start = text.indexOf('function initializeJobConnection(){');
const end = text.indexOf('\ninitializeJobConnection();', start);
assert.ok(start > 0 && end > start, 'initializeJobConnection() was not found in src/app.jsx');
const fnSource = text.slice(start, end);

class SettingsError extends Error { constructor(code) { super(code); this.code = code; } }
function run({ store = {}, shared = null, demo = false, dropWrites = false } = {}) {
  const map = new Map(Object.entries(store)), writes = [];
  const localStorage = {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { writes.push(k); if (!dropWrites) map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
  const HubSettingsContract = { object: raw => JSON.parse(raw || '{}'), SettingsError };
  // the shared hub connection wins over the app's own slot when one is present, as the settings standard resolves it
  const HubSettingsRuntime = { resolve: (app, local) => ({ config: shared ? { ...shared } : { ...local } }) };
  const build = new Function('DEMO', 'localStorage', 'HubSettingsContract', 'HubSettingsRuntime',
    `let jobConnection={};${fnSource};initializeJobConnection();return ()=>jobConnection;`);
  const connection = build(demo, localStorage, HubSettingsContract, HubSettingsRuntime)();
  return { connection, map, writes };
}
const OLD = 'jobapp:githubToken', SLOT = 'jobapp:connection';

test('an old token key is copied into the app slot once, then removed', () => {
  const { connection, map } = run({ store: { 'jobapp:githubRepo': 'o/Data', [OLD]: 'ghp_TEST' } });
  assert.equal(connection.token, 'ghp_TEST');
  assert.equal(JSON.parse(map.get(SLOT)).token, 'ghp_TEST');
  assert.equal(map.has(OLD), false);
});

test('an old token key left beside an already migrated slot is removed', () => {
  const { map } = run({ store: { [SLOT]: JSON.stringify({ owner: 'o', repo: 'Data', token: 'ghp_TEST' }), [OLD]: 'ghp_OLD' } });
  assert.equal(map.has(OLD), false);
  assert.equal(JSON.parse(map.get(SLOT)).token, 'ghp_TEST', 'the app slot is not touched');
});

test('with a shared hub connection present the old key is removed and the shared token is the one used', () => {
  const { connection, map } = run({ shared: { owner: 'o', repo: 'Data', token: 'ghp_SHARED' }, store: { [SLOT]: JSON.stringify({ owner: 'o', repo: 'Data', token: '' }), [OLD]: 'ghp_OLD' } });
  assert.equal(connection.token, 'ghp_SHARED');
  assert.equal(map.has(OLD), false);
});

test('with no token in effect the old key is left alone and never used', () => {
  const { connection, map } = run({ store: { [SLOT]: JSON.stringify({ owner: 'o', repo: 'Data', token: '' }), [OLD]: 'ghp_OLD' } });
  assert.equal(connection.token, '', 'the page does not fall back to the old copy: Settings asks to connect');
  assert.equal(map.get(OLD), 'ghp_OLD');
});

test('a copy that cannot be read back keeps the old key', () => {
  const { map } = run({ store: { [OLD]: 'ghp_TEST' }, dropWrites: true });
  assert.equal(map.get(OLD), 'ghp_TEST');
});

test('the old key is never written, and the demo page touches nothing', () => {
  const normal = run({ store: { [OLD]: 'ghp_TEST' } });
  assert.equal(normal.writes.includes(OLD), false);
  const demo = run({ store: { [OLD]: 'ghp_TEST' }, demo: true });
  assert.deepEqual(demo.writes, []);
  assert.equal(demo.map.get(OLD), 'ghp_TEST');
});
