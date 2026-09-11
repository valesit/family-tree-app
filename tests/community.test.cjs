/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test harness loads the real route modules with isolated adapters. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function fixture(options = {}) {
  let state = { posts: [], photos: [], images: [], comments: [], listings: [], buckets: new Map() };
  let user = options.user || null;
  let seq = 0;
  const blobs = [], removedBlobs = [];
  const families = [{ id: 'family-a', rootPersonId: 'root-a', name: 'Family A' }, { id: 'family-b', rootPersonId: 'root-b', name: 'Family B' }];
  const row = data => ({ id: `item-${++seq}`, createdAt: new Date(), ...data });
  function matches(item, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') return value.some(v => matches(item, v));
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('in' in value) return value.in.includes(item[key]);
        if ('lt' in value) return item[key] < value.lt;
        if ('contains' in value) return String(item[key]).toLowerCase().includes(value.contains.toLowerCase());
      }
      return item[key] === value;
    });
  }
  function model(key) {
    return {
      create: async ({ data }) => { if (key === options.failCreate) throw new Error('Database unavailable'); const item = row(data); state[key].push(item); return item; },
      findUnique: async ({ where }) => {
        const item = state[key].find(item => matches(item, where));
        if (!item) return null;
        if (key === 'posts') return { ...item, images: state.images.filter(i => i.postId === item.id) };
        if (key === 'comments') return { ...item, post: state.posts.find(p => p.id === item.postId) };
        return item;
      },
      findMany: async ({ where, take = 100, skip = 0, orderBy }) => {
        let items = state[key].filter(item => matches(item, where));
        if (orderBy?.[0]?.createdAt === 'desc') items = [...items].reverse();
        return items.slice(skip, skip + take).map(item => key === 'posts' ? { ...item, images: state.images.filter(i => i.postId === item.id), _count: { comments: state.comments.filter(c => c.postId === item.id).length } } : item);
      },
      count: async ({ where }) => state[key].filter(item => matches(item, where)).length,
      update: async ({ where, data }) => Object.assign(state[key].find(item => matches(item, where)), data),
      deleteMany: async ({ where }) => { state[key] = state[key].filter(item => !matches(item, where)); },
      delete: async ({ where }) => {
        if (key === 'posts') { state.images = state.images.filter(i => i.postId !== where.id); state.comments = state.comments.filter(c => c.postId !== where.id); }
        state[key] = state[key].filter(item => !matches(item, where));
      },
    };
  }
  const db = {
    family: { findFirst: async ({ where }) => families.find(f => where.OR.some(v => matches(f, v))) || null },
    user: { findUnique: async () => user },
    familyMembership: { findUnique: async ({ where }) => user?.familyAdmin === where.userId_familyId.familyId ? { role: 'ADMIN' } : null },
    forumPost: model('posts'), galleryPhoto: model('photos'), forumImage: model('images'), forumComment: model('comments'), businessListing: model('listings'),
    communityRateLimit: {
      upsert: async ({ where, create }) => { const existing = state.buckets.get(where.id); const value = existing ? { ...existing, count: existing.count + 1 } : create; state.buckets.set(where.id, value); return value; },
      deleteMany: async () => {},
    },
    $transaction: async run => { const before = structuredClone(state); try { return await run(db); } catch (e) { state = before; throw e; } },
  };
  const cache = new Map();
  const adapters = {
    '@/lib/db': { default: db }, '@/lib/auth': { authOptions: {} },
    'next-auth': { getServerSession: async () => user ? { user } : null },
    '@vercel/blob': { put: async () => {
      if (options.failBlobAfter === blobs.length) throw new Error('Blob unavailable');
      const url = `https://store.invalid/forum/photo-${blobs.length}.png`; blobs.push(url); return { url };
    }, del: async urls => removedBlobs.push(...urls) },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const output = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    runInNewContext(output, { exports, File, Buffer, URL, console: { error() {} }, process: { env: { NEXTAUTH_SECRET: 'test-only-secret', BLOB_READ_WRITE_TOKEN: 'test-only-blob' } }, require: name => {
      if (name in adapters) return adapters[name];
      if (name.startsWith('@/lib/community')) return load(`${name.slice(2)}.ts`);
      return require(name);
    } });
    cache.set(file, exports); return exports;
  }
  const routes = { forum: load('app/api/forum/route.ts'), post: load('app/api/forum/[id]/route.ts'), comments: load('app/api/forum/[id]/comments/route.ts'), comment: load('app/api/forum/comments/[id]/route.ts'), businesses: load('app/api/businesses/route.ts'), business: load('app/api/businesses/[id]/route.ts') };
  const request = (path, method = 'GET', body, cookie, headers = {}) => new NextRequest(`https://family.test${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
  const post = (fields = {}, files = [], cookie, headers) => {
    const form = new FormData();
    Object.entries({ familyId: 'root-a', guestName: 'Guest Relative', content: 'A family update', ...fields }).forEach(([k, v]) => form.set(k, v));
    files.forEach(file => form.append('images', file));
    return routes.forum.POST(request('/api/forum', 'POST', form, cookie, headers));
  };
  return { state: () => state, as: value => { user = value; }, routes, request, post, blobs, removedBlobs };
}

const member = { id: 'member', name: 'Account Name', role: 'MEMBER' };
const photo = () => new File([Buffer.from('89504e470d0a1a0a00000000', 'hex')], 'family.png', { type: 'image/png' });
const listing = { familyId: 'root-a', kind: 'BUSINESS', name: 'Family Bakery', description: 'Fresh bread and cakes for every celebration.', location: 'Online', contactName: 'Owner Name', email: 'owner@example.test', phone: '', website: '', supportDetails: 'Order a cake or refer a friend.' };
const params = id => ({ params: Promise.resolve({ id }) });
const cookieFrom = response => response.headers.get('set-cookie').split(';')[0];

test('public readers see only their family posts; private ownership keys never leave the API', async () => {
  const app = fixture();
  await app.post(); await app.post({ familyId: 'root-b', content: 'Another family' });
  const res = await app.routes.forum.GET(app.request('/api/forum?familyId=root-a'));
  const { data } = await res.json();
  assert.equal(res.status, 200); assert.equal(data.total, 1); assert.equal(data.items[0].content, 'A family update');
  assert.equal(data.items[0].canDelete, false); assert.equal('guestKey' in data.items[0], false); assert.equal('authorId' in data.items[0], false);
  assert.match(res.headers.get('cache-control'), /private, no-store/);
});

test('guest posts require a name; signed-in names are taken from the account', async () => {
  const app = fixture();
  assert.equal((await app.post({ guestName: ' ' })).status, 400);
  assert.equal((await app.post({ content: '  ' })).status, 400);
  app.as(member);
  assert.equal((await app.post({ guestName: 'Pretend Name' })).status, 201);
  assert.equal(app.state().posts[0].authorName, 'Account Name'); assert.equal(app.state().posts[0].isGuest, false);
});

test('guest photo post is saved atomically into the correct family gallery category', async () => {
  const app = fixture();
  const result = await app.post({ content: '' }, [photo(), photo()]);
  assert.equal(result.status, 201);
  assert.equal(app.state().images.length, 2); assert.equal(app.state().photos.length, 2);
  assert.ok(app.state().photos.every(p => p.rootPersonId === 'root-a' && p.category === 'Posted Images' && p.uploadedById === null));
  assert.equal(app.state().images[0].url, app.state().photos[0].url);
  assert.match(result.headers.get('set-cookie'), /HttpOnly/); assert.match(result.headers.get('set-cookie'), /Secure/);
});

test('invalid, oversized, disguised and too-many attachments are rejected before Blob writes', async () => {
  const app = fixture();
  for (const files of [Array.from({ length: 5 }, photo), [new File(['bad'], 'x.svg', { type: 'image/svg+xml' })], [new File(['not a picture'], 'x.png', { type: 'image/png' })], [new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]]) {
    assert.equal((await app.post({}, files)).status, 400);
  }
  assert.equal(app.blobs.length, 0); assert.equal(app.state().posts.length, 0);
});

test('failed gallery transaction rolls back the post and removes uploaded blobs', async () => {
  const app = fixture({ failCreate: 'images' });
  assert.equal((await app.post({}, [photo()])).status, 500);
  assert.equal(app.state().posts.length, 0); assert.equal(app.state().photos.length, 0);
  assert.deepEqual(app.removedBlobs, app.blobs);
});

test('partial Blob failure cleans prior files and never publishes a post', async () => {
  const app = fixture({ failBlobAfter: 1 });
  assert.equal((await app.post({}, [photo(), photo()])).status, 500);
  assert.equal(app.state().posts.length, 0); assert.deepEqual(app.removedBlobs, app.blobs);
});

test('only the owning guest browser can remove a post; gallery copies and replies are removed together', async () => {
  const app = fixture();
  const response = await app.post({}, [photo()]);
  const cookie = cookieFrom(response); const id = app.state().posts[0].id;
  assert.equal((await app.routes.post.DELETE(app.request(`/api/forum/${id}`, 'DELETE'), params(id))).status, 403);
  assert.equal((await app.routes.post.DELETE(app.request(`/api/forum/${id}`, 'DELETE', null, 'family-forum-guest=' + '0'.repeat(64)), params(id))).status, 403);
  assert.equal((await app.routes.post.DELETE(app.request(`/api/forum/${id}`, 'DELETE', null, cookie), params(id))).status, 200);
  assert.equal(app.state().posts.length, 0); assert.equal(app.state().photos.length, 0); assert.deepEqual(app.removedBlobs, app.blobs);
});

test('family admins can moderate their family but not a different family', async () => {
  const app = fixture(); await app.post(); const id = app.state().posts[0].id;
  app.as({ ...member, familyAdmin: 'family-b' });
  assert.equal((await app.routes.post.DELETE(app.request(`/api/forum/${id}`, 'DELETE'), params(id))).status, 403);
  app.as({ ...member, familyAdmin: 'family-a' });
  assert.equal((await app.routes.post.DELETE(app.request(`/api/forum/${id}`, 'DELETE'), params(id))).status, 200);
});

test('public replies preserve account/guest attribution and owner-only deletion', async () => {
  const app = fixture(); await app.post(); const id = app.state().posts[0].id;
  assert.equal((await app.routes.comments.POST(app.request(`/api/forum/${id}/comments`, 'POST', { content: 'Hello', guestName: '' }), params(id))).status, 400);
  const response = await app.routes.comments.POST(app.request(`/api/forum/${id}/comments`, 'POST', { content: 'Hello', guestName: 'Guest Cousin' }), params(id));
  assert.equal(response.status, 201); const cookie = cookieFrom(response); const commentId = app.state().comments[0].id;
  const { data } = await (await app.routes.comments.GET(app.request(`/api/forum/${id}/comments`), params(id))).json();
  assert.equal(data.items[0].authorName, 'Guest Cousin'); assert.equal('guestKey' in data.items[0], false);
  assert.equal((await app.routes.comment.DELETE(app.request(`/api/forum/comments/${commentId}`, 'DELETE'), params(commentId))).status, 403);
  assert.equal((await app.routes.comment.DELETE(app.request(`/api/forum/comments/${commentId}`, 'DELETE', null, cookie), params(commentId))).status, 200);
});

test('directory is public; account is required to create either a business or a cause', async () => {
  const app = fixture();
  for (const kind of ['BUSINESS', 'CAUSE']) assert.equal((await app.routes.businesses.POST(app.request('/api/businesses', 'POST', { ...listing, kind }))).status, 401);
  app.as(member);
  for (const kind of ['BUSINESS', 'CAUSE']) assert.equal((await app.routes.businesses.POST(app.request('/api/businesses', 'POST', { ...listing, kind }))).status, 201);
  app.as(null);
  const { data } = await (await app.routes.businesses.GET(app.request('/api/businesses?familyId=root-a'))).json();
  assert.equal(data.total, 2); assert.ok(data.items.every(item => !item.canManage && !('ownerId' in item)));
  const filtered = await (await app.routes.businesses.GET(app.request('/api/businesses?familyId=root-a&kind=CAUSE&search=bakery'))).json();
  assert.equal(filtered.data.total, 1);
  assert.equal((await (await app.routes.businesses.GET(app.request('/api/businesses?familyId=root-b'))).json()).data.total, 0);
});

test('listing owner can edit/delete; others cannot take ownership or move a listing to another family', async () => {
  const app = fixture({ user: member }); await app.routes.businesses.POST(app.request('/api/businesses', 'POST', listing));
  const id = app.state().listings[0].id;
  app.as({ ...member, id: 'other' });
  assert.equal((await app.routes.business.PATCH(app.request(`/api/businesses/${id}`, 'PATCH', { ...listing, ownerId: 'other' }), params(id))).status, 403);
  assert.equal((await app.routes.business.DELETE(app.request(`/api/businesses/${id}`, 'DELETE'), params(id))).status, 403);
  app.as(member);
  assert.equal((await app.routes.business.PATCH(app.request(`/api/businesses/${id}`, 'PATCH', { ...listing, familyId: 'root-b' }), params(id))).status, 400);
  assert.equal((await app.routes.business.PATCH(app.request(`/api/businesses/${id}`, 'PATCH', { ...listing, name: 'New Bakery', ownerId: 'other' }), params(id))).status, 200);
  assert.equal(app.state().listings[0].ownerId, member.id); assert.equal(app.state().listings[0].name, 'New Bakery');
  assert.equal((await app.routes.business.DELETE(app.request(`/api/businesses/${id}`, 'DELETE'), params(id))).status, 200);
});

test('missing contact details and unsafe contact links are rejected', async () => {
  const app = fixture({ user: member });
  for (const change of [{ email: '' }, { website: 'javascript:alert(1)' }, { website: 'https://user:secret@example.com' }, { email: 'broken' }, { kind: 'OTHER' }]) {
    assert.equal((await app.routes.businesses.POST(app.request('/api/businesses', 'POST', { ...listing, ...change }))).status, 400);
  }
  assert.equal(app.state().listings.length, 0);
});

test('cross-site requests and invalid family references cannot write', async () => {
  const app = fixture();
  assert.equal((await app.post({}, [], null, { origin: 'https://other.test' })).status, 403);
  assert.equal((await app.post({ familyId: 'missing' })).status, 404); assert.equal(app.state().posts.length, 0);
});

test('database-backed posting limits apply across guest cookie changes', async () => {
  const app = fixture();
  for (let i = 0; i < 20; i++) assert.equal((await app.post()).status, 201);
  assert.equal((await app.post()).status, 429); assert.equal(app.state().posts.length, 20);
  assert.ok([...app.state().buckets.keys()].every(key => !key.includes('local')));
});
