// Testes de integração da meta diária de calorias.
// Sobem o app Express numa porta livre e fazem requisições HTTP reais contra
// um banco de teste separado (nunca o banco de desenvolvimento).
//
// Rodar: npm test
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, type TestApp } from './helpers';

let ctx: TestApp;
let tokenA: string;
let tokenB: string;
let userAId: number;
let userBId: number;

before(async () => {
  ctx = await startTestApp();
  ({ tokenA, tokenB, userAId, userBId } = ctx);
});

after(async () => {
  await ctx?.close();
});

function request(method: string, token?: string, body?: unknown) {
  return ctx.request(method, '/calorie-goal', token, body);
}

test('sem token: GET e PUT respondem 401', async () => {
  assert.equal((await request('GET')).status, 401);
  assert.equal((await request('PUT', undefined, { caloriesGoal: 2000 })).status, 401);
});

test('token inválido responde 401', async () => {
  assert.equal((await request('GET', 'nao-e-um-jwt')).status, 401);
});

test('usuário sem meta recebe caloriesGoal null (sem valor fictício)', async () => {
  const res = await request('GET', tokenA);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.caloriesGoal, null);
  assert.deepEqual(body.limits, { min: 500, max: 10000 });
});

test('cadastra a meta e ela persiste na consulta seguinte', async () => {
  const put = await request('PUT', tokenA, { caloriesGoal: 2000 });
  assert.equal(put.status, 200);
  assert.equal((await put.json()).caloriesGoal, 2000);

  const get = await request('GET', tokenA);
  assert.equal((await get.json()).caloriesGoal, 2000);
});

test('entradas inválidas são rejeitadas com 400 e não alteram a meta', async () => {
  const invalid: unknown[] = [
    '2000', // string, não número
    1800.5, // decimal
    0,
    -100,
    499, // abaixo do mínimo
    10001, // acima do máximo
    null,
    true,
    [2000],
  ];

  for (const caloriesGoal of invalid) {
    const res = await request('PUT', tokenA, { caloriesGoal });
    assert.equal(res.status, 400, `deveria rejeitar ${JSON.stringify(caloriesGoal)}`);
  }

  // Corpo sem o campo
  assert.equal((await request('PUT', tokenA, {})).status, 400);

  const get = await request('GET', tokenA);
  assert.equal((await get.json()).caloriesGoal, 2000);
});

test('os limites 500 e 10000 são aceitos', async () => {
  assert.equal((await request('PUT', tokenA, { caloriesGoal: 500 })).status, 200);
  assert.equal((await request('PUT', tokenA, { caloriesGoal: 10000 })).status, 200);
});

test('isolamento: a meta de A não aparece para B, e userId no corpo é ignorado', async () => {
  // A tenta gravar "em nome de B" mandando userId no corpo.
  const put = await request('PUT', tokenA, { caloriesGoal: 2500, userId: userBId });
  assert.equal(put.status, 200);

  const getB = await request('GET', tokenB);
  assert.equal((await getB.json()).caloriesGoal, null);

  await request('PUT', tokenB, { caloriesGoal: 1500 });

  assert.equal((await (await request('GET', tokenA)).json()).caloriesGoal, 2500);
  assert.equal((await (await request('GET', tokenB)).json()).caloriesGoal, 1500);
});

test('atualizar mantém um único registro ativo e guarda o histórico', async () => {
  const { prisma } = ctx;

  await request('PUT', tokenA, { caloriesGoal: 2100 });
  await request('PUT', tokenA, { caloriesGoal: 2300 });
  // Repetir o mesmo valor não cria registro novo.
  await request('PUT', tokenA, { caloriesGoal: 2300 });

  const records = await prisma.healthData.findMany({ where: { userId: userAId } });
  const active = records.filter((r) => r.isActive);
  const closed = records.filter((r) => !r.isActive);

  assert.equal(active.length, 1);
  assert.equal(active[0].targetDietDaily, 2300);
  assert.equal(active[0].closedAt, null);
  assert.ok(closed.length >= 1);
  assert.ok(closed.every((r) => r.closedAt !== null));
  assert.equal(records.filter((r) => r.targetDietDaily === 2300).length, 1);
});
