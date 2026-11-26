const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path) {
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const holder = { exports: {} };
  vm.runInNewContext(compiled, { module: holder, exports: holder.exports, Map, Set });
  return holder.exports;
}

const { shouldCollapseSpouseAncestors, collectAncestorGenerations } =
  load('components/tree/spouse-ancestry.ts');
const { chooseTreeFocusId } = load('components/tree/tree-viewport.ts');

const person = (id, firstName, lastName, parents = [], children = [], spouses = []) => ({
  id, name: firstName + ' ' + lastName, firstName, lastName, parents, children, spouses,
});

test('root-derived primary couple preserves Richard and Mercy while collapsing Davison’s ancestors', () => {
  const grandPa = person('grandpa','Grandpa','Sithole');
  const greatPa = person('greatpa','Great Pa','Sithole');
  const tedious = person('tedious','Tedious','Sibanda');
  const mercy = person('mercy','Mercy','Sithole',[tedious]);
  const mrRuzive = person('mr','Mr','Ruzive');
  const davison = person('davison','Davison','Ruzive',[mrRuzive]);
  const tambudzayi = person('tambudzayi','Tambudzayi','Ruzive',[],[],[davison]);
  const richardChildren = [tambudzayi, ...Array.from({ length: 5 }, (_, i) =>
    person('child' + i, 'Child' + i, 'Sithole'))];
  const richard = person('richard','Richard','Sithole',[grandPa],richardChildren,[mercy]);
  grandPa.children = [richard];
  greatPa.children = [grandPa];

  const principalCouple = chooseTreeFocusId(greatPa);
  assert.equal(principalCouple,'richard');
  assert.equal(shouldCollapseSpouseAncestors(mercy,'richard',principalCouple,'primary'),false,
    'Mercy is part of the primary ancestral couple');
  assert.equal(shouldCollapseSpouseAncestors(richard,'richard',principalCouple,'primary'),false);
  assert.equal(shouldCollapseSpouseAncestors(davison,'tambudzayi',principalCouple,'primary'),true,
    'Davison is a married-in spouse of a descendant');
  assert.equal(shouldCollapseSpouseAncestors(davison,'tambudzayi',principalCouple,'all'),false,
    'All Connections exposes Davison’s parents without deleting their links');
  assert.equal(shouldCollapseSpouseAncestors(tambudzayi,'tambudzayi',principalCouple,'primary'),false,
    'A direct-line descendant keeps ancestry even after a surname change');
});

test('ancestry explorer preserves both parents and extended grandparents', () => {
  const dad = person('father','Father','Ruzive',[person('grandfather','Grandpa','Ruzive')]);
  const mom = person('mother','Mother','Ruzive',[person('grandmother','Grandma','Ruzive')]);
  const child = person('davison','Davison','Ruzive',[dad,mom]);
  const generations = collectAncestorGenerations(child);
  assert.deepEqual(Array.from(generations[0].people.map(p=>p.id)),['grandfather','grandmother']);
  assert.equal(generations[0].depth,2);
  assert.deepEqual(Array.from(generations[1].people.map(p=>p.id)),['father','mother']);
  assert.equal(generations[1].depth,1);
  assert.equal(shouldCollapseSpouseAncestors(person('other','Other','Ruzive'),
    'sithole','richard','primary'),false,'No recorded ancestors means no button');
});

test('accidental cycles in ancestor links cannot hang the explorer', () => {
  const a = person('a','A','Ruzive');
  const b = person('b','B','Ruzive');
  a.parents = [b];
  b.parents = [a];
  const groups = collectAncestorGenerations(a);
  assert.equal(groups.length,1);
  assert.equal(groups[0].people[0].id,'b');
});

test('tree view exposes both modes with an explicit return to the primary tree', () => {
  const page = fs.readFileSync('app/(main)/tree/page.tsx','utf8');
  const tree = fs.readFileSync('components/tree/TreeNode.tsx','utf8');
  const family = fs.readFileSync('components/tree/FamilyTree.tsx','utf8');
  const panel = fs.readFileSync('components/tree/SpouseAncestryPanel.tsx','utf8');
  assert.match(page, /useState<AncestryDisplayMode>\('primary'\)/);
  assert.match(page, /Back to Primary Tree|onBack=\{backToPrimaryTree\}/);
  assert.match(page, /Primary Family/);
  assert.match(page, /All Connections/);
  assert.match(page, /setSelectedSpouseAncestry\(null\)/);
  assert.match(page, /lg:w-\[min\(34%,28rem\)\]/);
  assert.match(page, /lg:hidden/);
  assert.match(panel, /Back to Primary Tree/);
  assert.match(panel, /Show all connections on tree/);
  assert.match(panel, /collectAncestorGenerations\(person\)/);
  assert.match(tree, /shouldCollapseSpouseAncestors\(person, node\.id, primaryCoupleId, ancestryMode\)/);
  assert.match(tree, /onOpenSpouseAncestry\?\.\(person\)/);
  assert.match(family, /onOpenSpouseAncestry=\{onOpenSpouseAncestry\}/);
  assert.match(family, /primaryCoupleId=\{chooseTreeFocusId\(data\)\}/);
});
