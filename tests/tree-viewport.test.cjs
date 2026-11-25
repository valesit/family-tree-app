const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('components/tree/tree-viewport.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports, Math }, {
  filename: 'components/tree/tree-viewport.ts',
});
const { chooseTreeFocusId, fitWholeTree, preferredTreeView, zoomTreeAt } = moduleRef.exports;

test('focuses Richard and Mercy’s main family rather than the technical Sibanda root', () => {
  const tree = {
    id: 'tedious',
    firstName: 'Tedious',
    children: [{
      id: 'mercy',
      firstName: 'Mercy',
      spouses: [{ id: 'richard', firstName: 'Richard' }],
      children: ['v', 's', 'd', 't', 's2', 'm'].map((id) => ({ id, children: [] })),
    }],
  };
  assert.equal(chooseTreeFocusId(tree), 'mercy');
});

test('keeps the full-tree fit available without overscaling a small family', () => {
  const wide = fitWholeTree({ width: 1100, height: 700, contentWidth: 2500, contentHeight: 900 });
  assert.ok(wide.scale < 0.5);
  const small = fitWholeTree({ width: 1100, height: 700, contentWidth: 600, contentHeight: 450 });
  assert.equal(small.scale, 1);
});

test('starts a wide tree with readable cards and centers the main family', () => {
  const viewport = { width: 1100, height: 700, contentWidth: 2500, contentHeight: 900 };
  const focus = { x: 1400, y: 370, width: 232, height: 126 };
  const readable = preferredTreeView(viewport, focus);
  assert.equal(readable.scale, 0.94);
  const screenX = readable.x + (focus.x + focus.width / 2) * readable.scale;
  assert.ok(Math.abs(screenX - viewport.width / 2) <= 1);
  const fitted = fitWholeTree(viewport);
  assert.ok(readable.scale > fitted.scale);
});

test('starts mobile with readable cards while retaining panning', () => {
  const viewport = { width: 390, height: 650, contentWidth: 2200, contentHeight: 1100 };
  const readable = preferredTreeView(viewport, { x: 1200, y: 400, width: 232, height: 126 });
  assert.equal(readable.scale, 0.82);
  assert.ok(readable.x < 0);
});

test('keeps small families fitted with no unnecessary zoom', () => {
  const viewport = { width: 1100, height: 700, contentWidth: 450, contentHeight: 380 };
  const fitted = fitWholeTree(viewport);
  const readable = preferredTreeView(viewport, { x: 90, y: 80, width: 232, height: 126 });
  assert.equal(readable.scale, fitted.scale);
  assert.equal(readable.x, fitted.x);
  assert.equal(readable.y, fitted.y);
});

test('zoom preserves the selected cursor or center point', () => {
  const previous = { x: -90, y: -20, scale: 0.82 };
  const cursor = { x: 450, y: 270 };
  const updated = zoomTreeAt(previous, 1.1, cursor);
  const beforeX = (cursor.x - previous.x) / previous.scale;
  const beforeY = (cursor.y - previous.y) / previous.scale;
  const afterX = (cursor.x - updated.x) / updated.scale;
  const afterY = (cursor.y - updated.y) / updated.scale;
  assert.ok(Math.abs(beforeX - afterX) < 0.000001);
  assert.ok(Math.abs(beforeY - afterY) < 0.000001);
});

test('ancestor labels and spouse links remain explicit and editable', () => {
  const treeCardSource = fs.readFileSync('components/tree/TreeNode.tsx', 'utf8');
  assert.match(treeCardSource, /ancestors/);
  assert.match(treeCardSource, /Spouses/);
  assert.match(treeCardSource, /onAddParent=/);
  assert.match(treeCardSource, /data-lineage-person=/);
});

test('missing card measurement does not shrink an initial tree to fit-all size', () => {
  const viewport = { width: 1100, height: 700, contentWidth: 2500, contentHeight: 900 };
  const readable = preferredTreeView(viewport, null);
  const fitted = fitWholeTree(viewport);
  assert.equal(readable.scale, 0.94);
  assert.ok(readable.scale > fitted.scale);
  assert.ok(Number.isFinite(readable.x) && Number.isFinite(readable.y));
});
