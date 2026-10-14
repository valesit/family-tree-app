const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real TypeScript tree builders without a database or Next.js.
function loadModule(path) {
  const source = fs.readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod,
    exports: mod.exports,
    require: (name) => {
      if (name === '@prisma/client' || name === '@/types') return {};
      throw new Error('Unexpected dependency: ' + name);
    },
    console,
    Date,
    Set,
    Map,
  }, { filename: path });
  return mod.exports;
}

const { buildCollaborativeFamilyTree } = loadModule('lib/collaborative-tree.ts');
const { collectTreeNodeIds, flattenTree } = loadModule('lib/tree-utils.ts');

function person(id, firstName, lastName = 'Sithole') {
  return {
    id, firstName, lastName,
    gender: null, birthDate: null, deathDate: null, profileImage: null,
    isLiving: true, isVerified: true, occupation: null, maidenName: null,
  };
}
function parent(parentId, childId) {
  return { type: 'PARENT_CHILD', parentId, childId, spouse1Id: null, spouse2Id: null };
}
function spouse(a, b) {
  return { type: 'SPOUSE', spouse1Id: a, spouse2Id: b, parentId: null, childId: null,
    startDate: null, endDate: null, notes: null };
}

test('Richard and Mercy retain independent ancestry after adding grandparents', () => {
  const people = [
    person('richard', 'Richard'), person('mercy', 'Mercy'),
    person('grandpa', 'Grandpa'), person('greatgrandpa', 'Great Grandpa'),
    person('mercysParent', 'Mercys Parent'), person('child', 'Child'),
  ];
  const relationships = [
    spouse('richard', 'mercy'),
    parent('richard', 'child'),
    parent('mercy', 'child'),
    parent('grandpa', 'richard'),
    parent('greatgrandpa', 'grandpa'),
    parent('mercysParent', 'mercy'),
  ];
  const tree = buildCollaborativeFamilyTree('richard', people, relationships);
  assert.ok(tree);
  assert.equal(tree.children.length, 1, 'existing descendant remains');
  assert.equal(tree.children[0].id, 'child');
  assert.equal(tree.parents[0].id, 'grandpa');
  assert.equal(tree.parents[0].parents[0].id, 'greatgrandpa');
  assert.equal(tree.spouses[0].id, 'mercy');
  assert.equal(tree.spouses[0].parents[0].id, 'mercysParent');
  assert.deepEqual(
    [...collectTreeNodeIds(tree)].sort(),
    people.map((p) => p.id).sort(),
    'both ancestor branches must be included in tree member statistics'
  );
  const directory = flattenTree(tree);
  assert.equal(directory.length, people.length);
  assert.ok(directory.find((p) => p.id === 'mercy').parentNames.some((n) => n.includes('Mercys Parent')));
  assert.ok(directory.find((p) => p.id === 'richard').parentNames.some((n) => n.includes('Grandpa')));
});

test('a newly added parent never replaces the other spouse ancestry', () => {
  const people = [person('richard','Richard'), person('mercy','Mercy'),
    person('richardParent','Richards Father'),person('mercyParent','Mercys Father')];
  const initial = [spouse('richard','mercy'),parent('mercyParent','mercy')];
  const before = buildCollaborativeFamilyTree('richard', people, initial);
  assert.equal(before.spouses[0].parents[0].id,'mercyParent');
  const after = buildCollaborativeFamilyTree('richard', people, [
    ...initial,parent('richardParent','richard')
  ]);
  assert.equal(after.parents[0].id,'richardParent');
  assert.equal(after.spouses[0].parents[0].id,'mercyParent');
});

test('a represented ancestor is not duplicated as a floating parent card', () => {
  const people = [person('founder','Founder'),person('richard','Richard'),
    person('mercy','Mercy'),person('mercyParent','Mercys Father')];
  const tree = buildCollaborativeFamilyTree('founder', people, [
    parent('founder','richard'), spouse('richard','mercy'), parent('mercyParent','mercy')
  ]);
  assert.equal(tree.children[0].id,'richard');
  assert.equal(tree.children[0].parents,undefined,
    'the already displayed founder should not be repeated');
  assert.equal(tree.children[0].spouses[0].parents[0].id,'mercyParent');
});

test('accidental parent loops cannot recurse forever', () => {
  const people = [person('richard','Richard'),person('grandpa','Grandpa')];
  const tree = buildCollaborativeFamilyTree('richard',people,[
    parent('grandpa','richard'),parent('richard','grandpa')
  ]);
  assert.ok(tree);
  assert.ok(collectTreeNodeIds(tree).size <= 2);
});

test('signed-in additions publish directly without a pending verification queue', () => {
  const source = fs.readFileSync('app/api/persons/route.ts','utf8');
  assert.match(source,/isVerified:\\s*true/);
  assert.match(source,/verifiedById:\\s*user\\.id/);
  assert.doesNotMatch(source,/notifyVerifiedMembers\\(/);
  const edit = fs.readFileSync('app/api/persons/[id]/route.ts','utf8');
  assert.match(edit,/user\\.role === 'VIEWER'/);
  assert.doesNotMatch(edit,/Only the profile owner or a Family Admin can edit/);
});
