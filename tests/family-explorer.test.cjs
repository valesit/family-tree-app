const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const path = 'lib/family-explorer.ts';
const transpiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(transpiled, { module: mod, exports: mod.exports, Map, Set, Date, console }, { filename: path });

const { buildExplorerGraph, getExplorerContext, relationshipLabel } = mod.exports;
const person = (id, firstName, gender = null) => ({
  id, firstName, lastName: 'Sithole', gender, isLiving: true, birthDate: null,
  deathDate: null, profileImage: null,
});
const parent = (a, b, type = 'PARENT_CHILD') => ({
  id: a.id + '-' + b.id, type, parentId: a.id, childId: b.id, parent: a, child: b,
});
const spouse = (a, b) => ({
  id: a.id + '-' + b.id, type: 'SPOUSE', spouse1Id: a.id, spouse2Id: b.id, spouse1: a, spouse2: b,
});

test('Richard and Mercy each retain their own parents and grandparents', () => {
  const richard = person('richard','Richard');
  const mercy = person('mercy','Mercy');
  const richardFather = person('richard-father','Richards father','MALE');
  const richardGrandpa = person('richard-grandpa','Great Grandpa');
  const mercyMother = person('mercy-mother','Mercys mother','FEMALE');
  const child = person('child','Child');
  const graph = buildExplorerGraph(richard, [
    spouse(richard,mercy),parent(richard,child),parent(mercy,child),
    parent(richardFather,richard),parent(richardGrandpa,richardFather),
    parent(mercyMother,mercy),
  ]);
  assert.equal(graph.people.size, 6);
  const r = getExplorerContext(graph,richard.id);
  const m = getExplorerContext(graph,mercy.id);
  assert.equal(r.parents[0].person.id,richardFather.id);
  assert.equal(r.parentBranches[0].grandparents[0].person.id,richardGrandpa.id);
  assert.equal(m.parents[0].person.id,mercyMother.id);
  assert.equal(r.childGroups[0].coParents[0].id,mercy.id);
  assert.equal(m.childGroups[0].coParents[0].id,richard.id);
});

test('children from two partnerships stay in distinct co-parent groups', () => {
  const parentA = person('parentA','Parent A');
  const partner1 = person('partner1','Partner One');
  const partner2 = person('partner2','Partner Two');
  const first = person('first','First child');
  const second = person('second','Second child');
  const third = person('third','Third child');
  const g = buildExplorerGraph(parentA, [
    spouse(parentA,partner1),spouse(parentA,partner2),
    parent(parentA,first),parent(partner1,first),
    parent(parentA,second),parent(partner2,second),
    parent(parentA,third),
  ]);
  const focus = getExplorerContext(g,parentA.id);
  assert.equal(focus.childGroups.length,3);
  const byChild = new Map(focus.childGroups.flatMap((group) =>
    group.children.map((child) => [child.person.id, group.coParents.map((p) => p.id).join(',')]
  )));
  assert.equal(byChild.get(first.id),partner1.id);
  assert.equal(byChild.get(second.id),partner2.id);
  assert.equal(byChild.get(third.id),'');
});

test('connected root scope excludes unrelated family members', () => {
  const r = person('r','Root');
  const a = person('a','Child');
  const x = person('x','Other');
  const y = person('y','Unrelated');
  const graph = buildExplorerGraph(r,[parent(r,a),parent(x,y)]);
  assert.equal(graph.people.size,2);
  assert.equal(graph.relationships.length,1);
  assert.equal(graph.people.has(x.id),false);
});

test('cycles cannot cause endless traversal and parent references remain present', () => {
  const a = person('a','A');
  const b = person('b','B');
  const g = buildExplorerGraph(a,[parent(a,b),parent(b,a)]);
  assert.equal(g.people.size,2);
  assert.equal(getExplorerContext(g,'a').parents[0].person.id,'b');
});

test('adoptive and foster relationships retain their labels', () => {
  assert.equal(relationshipLabel('ADOPTED'),'Adoptive');
  assert.equal(relationshipLabel('FOSTER'),'Foster');
  assert.equal(relationshipLabel('PARENT_CHILD','FEMALE'),'Mother');
});
