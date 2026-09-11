const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { NextRequest } = require('next/server');

// Exercise the real route handlers with isolated storage and session adapters.
// These tests never connect to the application's database or Blob store.
function loadSource(path, adapters, extra = {}) {
  const source = ts.transpileModule(readFileSync(resolve(__dirname, '..', path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(source, {
    exports, File, Set, console: { error() {} },
    process: { env: { BLOB_READ_WRITE_TOKEN: 'isolated-test-store' } },
    require: (name) => name in adapters ? adapters[name] : require(name),
    ...extra,
  }, { filename: path });
  return exports;
}

function fixture(userId = 'owner', failActivity = false) {
  let state = {
    person: { id: 'person', userId: 'owner', addedById: 'creator', profileImageId: 'avatar', user: null },
    images: [
      { id: 'avatar', personId: 'person', url: 'https://test.invalid/avatar.jpg', isPrimary: true, caption: null },
      { id: 'old-avatar', personId: 'person', url: 'https://test.invalid/old.jpg', isPrimary: false, caption: null },
      { id: 'legacy', personId: 'person', url: 'https://test.invalid/legacy.jpg', isPrimary: false, caption: null },
    ],
    activities: [{ data: { personId: 'person', imageId: 'old-avatar', isProfile: true } }],
    accountImage: 'https://test.invalid/avatar.jpg',
  };
  let blobWrites = 0;
  const db = {
    person: {
      findUnique: async ({ where }) => where.id === state.person.id ? {
        ...state.person, images: state.images, profileImage: state.images.find((image) => image.id === state.person.profileImageId),
      } : null,
      update: async ({ data }) => Object.assign(state.person, data),
    },
    personImage: {
      findUnique: async ({ where }) => state.images.find((image) => image.id === where.id) || null,
      create: async ({ data }) => {
        const photo = { ...data, id: `photo-${state.images.length}`, uploadedAt: new Date().toISOString() };
        state.images.push(photo);
        return photo;
      },
      update: async ({ where, data }) => Object.assign(state.images.find((image) => image.id === where.id), data),
      updateMany: async ({ where, data }) => {
        state.images.filter((image) => image.personId === where.personId && image.id !== where.id.not)
          .forEach((image) => Object.assign(image, data));
      },
    },
    activity: {
      create: async ({ data }) => {
        if (failActivity) throw new Error('Activity write failed');
        state.activities.push(data);
      },
      findMany: async ({ where }) => state.activities.filter((activity) => where.AND.every((condition) => {
        const { path, equals } = condition.data;
        return activity.data[path[0]] === equals;
      })),
    },
    user: { update: async ({ data }) => { state.accountImage = data.image; } },
    $transaction: async (run) => {
      const before = structuredClone(state);
      try { return await run(db); } catch (error) { state = before; throw error; }
    },
  };
  const adapters = {
    '@/lib/db': { default: db },
    '@/lib/auth': { authOptions: {} },
    '@/lib/validators': {},
    'next-auth': { getServerSession: async () => userId ? { user: { id: userId } } : null },
    '@/lib/family-membership': {
      findPersonFamilyRoot: async () => 'root',
      isSystemAdmin: async (id) => id === 'system-admin',
      isFamilyAdmin: async (id, root) => id === 'family-admin' && root === 'root',
      getFamilyMembership: async () => null,
    },
    '@vercel/blob': { put: async () => ({ url: `https://test.invalid/upload-${++blobWrites}.jpg` }) },
  };
  adapters['@/lib/person-photos'] = loadSource('lib/person-photos.ts', adapters);
  const { POST } = loadSource('app/api/upload/route.ts', adapters);
  const { GET } = loadSource('app/api/persons/[id]/route.ts', adapters);
  return {
    state: () => state,
    blobWrites: () => blobWrites,
    get: () => GET(new NextRequest('https://test.invalid/api/persons/person'), { params: Promise.resolve({ id: 'person' }) }),
    upload: (fields = {}) => {
      const body = new FormData();
      body.set('personId', 'person');
      body.set('isProfile', 'false');
      body.set('image', new File(['image-fixture'], 'memory.jpg', { type: 'image/jpeg' }));
      for (const [key, value] of Object.entries(fields)) body.set(key, value);
      return POST(new NextRequest('https://test.invalid/api/upload', { method: 'POST', body }));
    },
  };
}

test('personal uploads survive a fresh read, with captions, without changing either avatar', async () => {
  const app = fixture();
  assert.equal((await (await app.get()).json()).data.images.length, 0);
  const response = await app.upload({ caption: '  Family picnic  ' });
  assert.equal(response.status, 200);
  const uploaded = (await response.json()).data;
  const person = (await (await app.get()).json()).data;
  assert.deepEqual(person.images.map((image) => image.id), [uploaded.id]);
  assert.equal(person.images[0].caption, 'Family picnic');
  assert.equal(person.canManagePhotos, true);
  assert.equal(person.profileImage.url, 'https://test.invalid/avatar.jpg');
  assert.equal(app.state().accountImage, 'https://test.invalid/avatar.jpg');

  // A subsequent avatar replacement must preserve the personal photo album.
  assert.equal((await app.upload({ isProfile: 'true' })).status, 200);
  const after = (await (await app.get()).json()).data;
  assert.deepEqual(after.images.map((image) => image.id), [uploaded.id]);
  assert.equal(after.profileImageId, 'avatar');
  assert.equal(app.state().images.length, 4);
  assert.equal(after.profileImage.url, app.state().accountImage);
  assert.notEqual(after.profileImage.url, 'https://test.invalid/avatar.jpg');
});

test('photo management follows the existing owner, creator and administrator permissions', async () => {
  for (const id of ['owner', 'creator', 'system-admin', 'family-admin']) {
    const app = fixture(id);
    assert.equal((await app.upload()).status, 200, id);
    assert.equal((await (await app.get()).json()).data.canManagePhotos, true, id);
  }
  for (const [id, status] of [[null, 401], ['unrelated-member', 403]]) {
    const app = fixture(id);
    assert.equal((await app.upload()).status, status);
    assert.equal((await (await app.get()).json()).data.canManagePhotos, false);
    assert.equal(app.blobWrites(), 0);
  }
});

test('invalid photos and captions fail before storage is written', async () => {
  for (const fields of [
    { image: 'not-a-file' },
    { image: new File([], 'empty.jpg', { type: 'image/jpeg' }) },
    { image: new File(['text'], 'notes.txt', { type: 'text/plain' }) },
    { image: new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }) },
    { caption: 'x'.repeat(281) },
    { personId: '' },
  ]) {
    const app = fixture();
    assert.equal((await app.upload(fields)).status, 400);
    assert.equal(app.blobWrites(), 0);
    assert.equal(app.state().images.length, 3);
  }
  const missing = fixture();
  assert.equal((await missing.upload({ personId: 'missing' })).status, 404);
});

test('a failed metadata write cannot leave a saved personal photo that is missing from the album', async () => {
  const app = fixture('owner', true);
  assert.equal((await app.upload()).status, 500);
  assert.equal(app.state().images.length, 3);
  assert.equal(app.state().person.profileImageId, 'avatar');
});

test('focus, reconnect and visibility refreshes retain the cached person backing an open photo form', async () => {
  const { initCache } = require('swr/_internal');
  const key = '/api/persons/person';
  const cache = new Map([[key, { data: { id: 'person' } }]]);
  const [, mutate] = initCache(cache);
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  let cleanup;
  const { FamilyDataLiveSync } = loadSource('components/shared/FamilyDataLiveSync.tsx', {
    react: { useEffect: (effect) => { cleanup = effect(); } },
    swr: { useSWRConfig: () => ({ mutate }) },
  }, { window, document });
  FamilyDataLiveSync();
  for (const [target, event] of [[window, 'focus'], [window, 'online'], [document, 'visibilitychange']]) {
    target.dispatchEvent(new Event(event));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(cache.get(key).data, { id: 'person' }, event);
  }
  cleanup();
});
