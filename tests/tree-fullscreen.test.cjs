const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const treePage = fs.readFileSync('app/(main)/tree/page.tsx', 'utf8');
const treePanel = treePage.slice(
  treePage.indexOf('{/* Family tree — first in DOM'),
  treePage.indexOf('{/* Family overview — right on desktop')
);
const overviewPanel = treePage.slice(
  treePage.indexOf('{/* Family overview — right on desktop'),
  treePage.indexOf('{/* Expanded Tree View */')
);

test('tree and overview expand buttons have independent actions', () => {
  assert.match(treePage, /\[isTreeExpanded, setIsTreeExpanded\] = useState\(false\)/);
  assert.match(treePage, /\[isOverviewExpandedOpen, setIsOverviewExpandedOpen\] = useState\(false\)/);

  assert.match(treePanel, /setIsTreeExpanded\(\(expanded\) => !expanded\)/);
  assert.doesNotMatch(treePanel, /setIsOverviewExpandedOpen\(true\)/);
  assert.match(overviewPanel, /setIsOverviewExpandedOpen\(true\)/);
  assert.doesNotMatch(overviewPanel, /setIsTreeExpanded\(\(expanded\) => !expanded\)/);
  assert.match(treePage, /isOpen=\{isOverviewExpandedOpen\}/);
});

test('full-screen tree reuses the existing interactive canvas', () => {
  assert.equal((treePage.match(/<FamilyTree\s/g) || []).length, 1);
  assert.match(treePanel, /fixed inset-0 z-\[100\] h-\[100dvh\]/);
  assert.match(treePanel, /ref=\{treePanelRef\}/);
  assert.match(treePanel, /isTreeExpanded \? <Minimize2/);
  assert.match(treePanel, /Exit full-screen family tree/);
  assert.match(treePage, /if \(event\.key === 'Escape'\) setIsTreeExpanded\(false\)/);
});

test('existing profile and export dialogs remain accessible from the tree', () => {
  assert.match(treePage, /setIsTreeExpanded\(false\);\s*void openPersonModal\(node\.id\)/);
  assert.match(treePanel, /setIsTreeExpanded\(false\);\s*setIsExportOpen\(true\)/);
  assert.match(treePage, /<ExportTreeDialog/);
});
