const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('lib/family-brand.ts', 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const ref = { exports: {} };
vm.runInNewContext(transpiled, { module: ref, exports: ref.exports });
const { FAMILY_SITE_NAME, FAMILY_SITE_HERITAGE_COPY } = ref.exports;

test('Sithole remains the site name even when the family tree is rooted elsewhere', () => {
  assert.equal(FAMILY_SITE_NAME, 'Sithole');
  const navbar = fs.readFileSync('components/shared/navbar.tsx', 'utf8');
  const homepage = fs.readFileSync('app/page.tsx', 'utf8');
  const tree = fs.readFileSync('app/(main)/tree/page.tsx', 'utf8');
  const detail = fs.readFileSync('app/(main)/tree/[familyId]/page.tsx', 'utf8');

  assert.match(navbar, /\{FAMILY_SITE_NAME\}/);
  assert.match(homepage, /const familyName = FAMILY_SITE_NAME/);
  assert.match(tree, /\{FAMILY_SITE_NAME\}/);
  assert.match(tree, /familyName=\{FAMILY_SITE_NAME\}/);
  assert.match(detail, /const familyName = FAMILY_SITE_NAME/);
  assert.doesNotMatch(tree, /handleSaveFamilyName|handleStartEditFamilyName|Edit family name/);
});

test('heritage introduction recognizes all three surnames', () => {
  assert.match(FAMILY_SITE_HERITAGE_COPY, /Sithole, Mutseyami, Tekeshe and related families/);
  assert.match(FAMILY_SITE_HERITAGE_COPY, /future generations/);
  const homepage = fs.readFileSync('app/page.tsx', 'utf8');
  assert.match(homepage, /\{FAMILY_SITE_HERITAGE_COPY\}/);
});

test('tree root and relationship data remain independent from site branding', () => {
  const treeApi = fs.readFileSync('app/api/tree/route.ts', 'utf8');
  const familiesApi = fs.readFileSync('app/api/families/route.ts', 'utf8');
  assert.match(treeApi, /rootPersonId: rootId/);
  assert.match(familiesApi, /primaryFamilyId: primary\?\.id/);
});
