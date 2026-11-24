// Testes de integração de altura e peso (rota /profile).
// Rodar: npm test (exige TEST_DATABASE_URL, ver tests/helpers.ts)
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, type TestApp } from './helpers';

let ctx: TestApp;

before(async () => {
  ctx = await startTestApp();
});

after(async () => {
  await ctx?.close();
});

function request(method: string, token?: string, body?: unknown) {
  return ctx.request(method, '/profile', token, body);
}

test('sem token: GET e PUT respondem 401', async () => {
  assert.equal((await request('GET')).status, 401);
  assert.equal(
    (await request('PUT', undefined, { heightCm: 175, weightKg: 70 })).status,
    401,
  );
});

test('usuário sem dados recebe null (sem valor fictício)', async () => {
  const res = await request('GET', ctx.tokenA);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.heightCm, null);
  assert.equal(body.weightKg, null);
  assert.deepEqual(body.limits, {
    heightCm: { min: 50, max: 250 },
    weightKg: { min: 20, max: 400 },
  });
});

test('cadastra altura e peso e eles persistem', async () => {
  const put = await request('PUT', ctx.tokenA, { heightCm: 175, weightKg: 72.35 });
  assert.equal(put.status, 200);
  const saved = await put.json();
  assert.equal(saved.heightCm, 175);
  assert.equal(saved.weightKg, 72.4); // arredondado para 1 casa

  const get = await (await request('GET', ctx.tokenA)).json();
  assert.equal(get.heightCm, 175);
  assert.equal(get.weightKg, 72.4);
});

test('entradas inválidas respondem 400 e não alteram os dados', async () => {
  const invalid: unknown[] = [
    { heightCm: '175', weightKg: 70 }, // string
    { heightCm: 1.75, weightKg: 70 }, // altura em metros
    { heightCm: 251, weightKg: 70 },
    { heightCm: 175, weightKg: 19 },
    { heightCm: 175, weightKg: 401 },
    { heightCm: 175, weightKg: null },
    { heightCm: 175 }, // sem peso
    {},
  ];

  for (const body of invalid) {
    const res = await request('PUT', ctx.tokenA, body);
    assert.equal(res.status, 400, `deveria rejeitar ${JSON.stringify(body)}`);
    assert.ok((await res.json()).error);
  }

  const get = await (await request('GET', ctx.tokenA)).json();
  assert.equal(get.heightCm, 175);
  assert.equal(get.weightKg, 72.4);
});

test('alterar cria histórico; repetir os mesmos valores não duplica', async () => {
  await request('PUT', ctx.tokenA, { heightCm: 175, weightKg: 71 });
  await request('PUT', ctx.tokenA, { heightCm: 175, weightKg: 71 });

  const logs = await ctx.prisma.weightLog.findMany({
    where: { userId: ctx.userAId },
    orderBy: { id: 'asc' },
  });
  assert.deepEqual(
    logs.map((log) => log.weight),
    [72.4, 71],
  );

  const get = await (await request('GET', ctx.tokenA)).json();
  assert.equal(get.weightKg, 71);
});

test('um usuário não vê nem altera os dados de outro', async () => {
  const getB = await (await request('GET', ctx.tokenB)).json();
  assert.equal(getB.heightCm, null);

  await request('PUT', ctx.tokenB, { heightCm: 160, weightKg: 55 });

  const getA = await (await request('GET', ctx.tokenA)).json();
  assert.equal(getA.heightCm, 175);
  assert.equal(getA.weightKg, 71);
});
