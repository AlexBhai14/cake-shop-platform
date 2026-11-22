import { api, createFixture, Fixture, loginAdmin, registerCustomer, removeFixture, Session } from './helpers';

describe('Catalogue: admin manages cakes, customers browse', () => {
  let admin: Session;
  let customer: Session;
  let f: Fixture;

  beforeAll(async () => {
    admin = await loginAdmin();
    customer = await registerCustomer('catalog');
    f = await createFixture(admin, 'catalog');
  });

  afterAll(async () => {
    await removeFixture(admin, f);
  });

  it('a new cake shows up in the public list and can be found by search', async () => {
    const res = await api().get('/api/cakes').query({ search: f.cakeName });
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { id: string }) => c.id)).toContain(f.cakeId);
  });

  it('shows variants with prices as exact decimal strings', async () => {
    const res = await api().get(`/api/cakes/${f.cakeId}`);
    expect(res.status).toBe(200);
    const prices = res.body.variants.map((v: { price: string }) => Number(v.price)).sort();
    expect(prices).toEqual([549, 599]);
    expect(typeof res.body.variants[0].price).toBe('string'); // never a floating point number
  });

  it('filters by eggless and by price', async () => {
    const eggless = await api().get('/api/cakes').query({ search: f.cakeName, eggless: 'true' });
    expect(eggless.body.items).toHaveLength(1); // the cake has an eggless variant
    const cheap = await api().get('/api/cakes').query({ search: f.cakeName, maxPrice: 500 });
    expect(cheap.body.items).toHaveLength(0);
    const ok = await api().get('/api/cakes').query({ search: f.cakeName, minPrice: 500, maxPrice: 560 });
    expect(ok.body.items).toHaveLength(1); // it has a variant between 500 and 560
    const none = await api().get('/api/cakes').query({ search: f.cakeName, minPrice: 700 });
    expect(none.body.items).toHaveLength(0);
  });

  it('exposes the current price of one variant (used by cart and order)', async () => {
    const res = await api().get(`/api/variants/${f.egglessVariantId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cakeId: f.cakeId, eggless: true, available: true });
    expect(Number(res.body.price)).toBe(599);
  });

  it('refuses invalid input: no variants, bad price, unknown category', async () => {
    const base = { name: 'Invalid cake', description: 'something', categoryId: f.categoryId };
    expect((await api().post('/api/cakes').set(admin.auth).send({ ...base, variants: [] })).status).toBe(400);
    expect((await api().post('/api/cakes').set(admin.auth).send({ ...base, variants: [{ flavour: 'X', weightGrams: 500, eggless: false, price: 10.999 }] })).status).toBe(400);
    expect((await api().post('/api/cakes').set(admin.auth).send({ ...base, categoryId: '11111111-1111-1111-1111-111111111111', variants: [{ flavour: 'X', weightGrams: 500, eggless: false, price: 10 }] })).status).toBe(404);
  });

  it('refuses a duplicate cake name (409)', async () => {
    const res = await api().post('/api/cakes').set(admin.auth).send({
      name: f.cakeName, description: 'duplicate', categoryId: f.categoryId,
      variants: [{ flavour: 'X', weightGrams: 500, eggless: false, price: 10 }],
    });
    expect(res.status).toBe(409);
  });

  it('a price change is visible at once and a stopped variant disappears from the shop', async () => {
    expect((await api().patch(`/api/variants/${f.regularVariantId}`).set(admin.auth).send({ price: 579.5 })).status).toBe(200);
    expect(Number((await api().get(`/api/variants/${f.regularVariantId}`)).body.price)).toBe(579.5);

    expect((await api().patch(`/api/variants/${f.regularVariantId}`).set(admin.auth).send({ isActive: false })).status).toBe(200);
    const detail = await api().get(`/api/cakes/${f.cakeId}`);
    expect(detail.body.variants).toHaveLength(1);
    expect((await api().get(`/api/variants/${f.regularVariantId}`)).body.available).toBe(false);
    await api().patch(`/api/variants/${f.regularVariantId}`).set(admin.auth).send({ isActive: true, price: 549 });
  });

  it('deactivating a cake hides it from customers but not from the admin', async () => {
    expect((await api().patch(`/api/cakes/${f.cakeId}`).set(admin.auth).send({ isActive: false })).status).toBe(200);
    expect((await api().get(`/api/cakes/${f.cakeId}`)).status).toBe(404);
    const list = await api().get('/api/cakes').query({ search: f.cakeName });
    expect(list.body.items).toHaveLength(0);
    const adminList = await api().get('/api/cakes/admin/all').set(admin.auth).query({ limit: 100 });
    expect(adminList.body.items.some((c: { id: string; isActive: boolean }) => c.id === f.cakeId && !c.isActive)).toBe(true);
    expect((await api().get('/api/variants/' + f.egglessVariantId)).body.available).toBe(false);
  });

  it('a customer cannot create or change anything', async () => {
    expect((await api().post('/api/categories').set(customer.auth).send({ name: 'Nope' })).status).toBe(403);
    expect((await api().patch(`/api/cakes/${f.cakeId}`).set(customer.auth).send({ isActive: true })).status).toBe(403);
  });
});
