// Testes de integração de editar/apagar alimentos e apagar refeições.
//
// Rodar: npm test
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, type TestApp } from './helpers';

let ctx: TestApp;
let tokenA: string;
let tokenB: string;

const arroz = {
  name: 'Arroz',
  caloriesPer100g: 130,
  carbsPer100g: 28,
  proteinPer100g: 2.7,
  fatPer100g: 0.3,
};

before(async () => {
  ctx = await startTestApp();
  ({ tokenA, tokenB } = ctx);
});

after(async () => {
  await ctx?.close();
});

async function createFood(token: string, data: object = arroz) {
  const res = await ctx.request('POST', '/foods', token, data);
  assert.equal(res.status, 201);
  return (await res.json()) as { id: number; name: string };
}

async function createMeal(token: string, foodId: number, grams = 200) {
  const res = await ctx.request('POST', '/meals', token, {
    type: 'lunch',
    eatTime: '2026-11-11T15:30:00.000Z',
    description: 'almoço',
    items: [{ foodId, grams }],
  });
  assert.equal(res.status, 201);
  return (await res.json()) as { id: number };
}

async function listMeals(token: string) {
  const res = await ctx.request('GET', '/meals', token);
  return (await res.json()) as {
    id: number;
    totals: { calories: number; carbs: number };
  }[];
}

test('sem token: editar/apagar alimento e apagar refeição respondem 401', async () => {
  assert.equal((await ctx.request('PUT', '/foods/1', undefined, arroz)).status, 401);
  assert.equal((await ctx.request('DELETE', '/foods/1')).status, 401);
  assert.equal((await ctx.request('DELETE', '/meals/1')).status, 401);
});

test('POST /foods rejeita dados inválidos com 400', async () => {
  const invalid = [
    { ...arroz, name: '' },
    { ...arroz, name: '   ' },
    { ...arroz, name: 'x'.repeat(101) },
    { ...arroz, caloriesPer100g: -1 },
    { ...arroz, carbsPer100g: '28' },
    { ...arroz, fatPer100g: null },
    { name: 'Sem macros' },
  ];
  for (const body of invalid) {
    const res = await ctx.request('POST', '/foods', tokenA, body);
    assert.equal(res.status, 400, `deveria rejeitar ${JSON.stringify(body)}`);
  }
});

test('edita o próprio alimento', async () => {
  const food = await createFood(tokenA);

  const res = await ctx.request('PUT', `/foods/${food.id}`, tokenA, {
    ...arroz,
    name: '  Arroz integral  ',
    caloriesPer100g: 124,
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.name, 'Arroz integral'); // sem espaços nas pontas
  assert.equal(updated.caloriesPer100g, 124);

  const list = await (await ctx.request('GET', '/foods?search=integral', tokenA)).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, food.id);
});

test('PUT /foods/:id rejeita dados e ids inválidos', async () => {
  const food = await createFood(tokenA);

  assert.equal(
    (await ctx.request('PUT', `/foods/${food.id}`, tokenA, { ...arroz, name: '' })).status,
    400,
  );
  assert.equal(
    (await ctx.request('PUT', `/foods/${food.id}`, tokenA, { ...arroz, proteinPer100g: -3 })).status,
    400,
  );
  assert.equal((await ctx.request('PUT', '/foods/abc', tokenA, arroz)).status, 400);
  assert.equal((await ctx.request('PUT', '/foods/999999', tokenA, arroz)).status, 404);
});

test('isolamento: B não edita nem apaga alimento de A', async () => {
  const food = await createFood(tokenA, { ...arroz, name: 'Feijão de A' });

  const put = await ctx.request('PUT', `/foods/${food.id}`, tokenB, {
    ...arroz,
    name: 'invadido',
  });
  assert.equal(put.status, 404);
  assert.equal((await ctx.request('DELETE', `/foods/${food.id}`, tokenB)).status, 404);

  const stored = await ctx.prisma.food.findUnique({ where: { id: food.id } });
  assert.equal(stored?.name, 'Feijão de A');
});

test('apaga alimento que não está em nenhuma refeição', async () => {
  const food = await createFood(tokenA, { ...arroz, name: 'Temporário' });

  assert.equal((await ctx.request('DELETE', `/foods/${food.id}`, tokenA)).status, 204);
  assert.equal(await ctx.prisma.food.findUnique({ where: { id: food.id } }), null);
  assert.equal((await ctx.request('DELETE', `/foods/${food.id}`, tokenA)).status, 404);
});

test('alimento usado em refeição: 409 com a contagem; liberado após apagar a refeição', async () => {
  const food = await createFood(tokenA, { ...arroz, name: 'Em uso' });
  const meal1 = await createMeal(tokenA, food.id);
  const meal2 = await createMeal(tokenA, food.id);

  const blocked = await ctx.request('DELETE', `/foods/${food.id}`, tokenA);
  assert.equal(blocked.status, 409);
  const body = await blocked.json();
  assert.equal(body.mealsCount, 2);
  assert.match(body.error, /2 refeições/);
  assert.notEqual(await ctx.prisma.food.findUnique({ where: { id: food.id } }), null);

  assert.equal((await ctx.request('DELETE', `/meals/${meal1.id}`, tokenA)).status, 204);
  assert.equal((await ctx.request('DELETE', `/meals/${meal2.id}`, tokenA)).status, 204);
  assert.equal((await ctx.request('DELETE', `/foods/${food.id}`, tokenA)).status, 204);
});

test('apaga a própria refeição junto com os itens dela', async () => {
  const food = await createFood(tokenA, { ...arroz, name: 'Item' });
  const meal = await createMeal(tokenA, food.id);

  assert.equal((await ctx.request('DELETE', `/meals/${meal.id}`, tokenA)).status, 204);

  assert.equal(await ctx.prisma.meal.findUnique({ where: { id: meal.id } }), null);
  assert.equal(await ctx.prisma.mealFood.count({ where: { mealId: meal.id } }), 0);
  assert.ok(!(await listMeals(tokenA)).some((m) => m.id === meal.id));

  assert.equal((await ctx.request('DELETE', `/meals/${meal.id}`, tokenA)).status, 404);
  assert.equal((await ctx.request('DELETE', '/meals/abc', tokenA)).status, 400);
});

test('isolamento: B não apaga refeição de A', async () => {
  const food = await createFood(tokenA, { ...arroz, name: 'Privado' });
  const meal = await createMeal(tokenA, food.id);

  assert.equal((await ctx.request('DELETE', `/meals/${meal.id}`, tokenB)).status, 404);
  assert.notEqual(await ctx.prisma.meal.findUnique({ where: { id: meal.id } }), null);
});

test('editar um alimento não altera os totais de refeições já registradas', async () => {
  const food = await createFood(tokenA, { ...arroz, name: 'Histórico' });
  const meal = await createMeal(tokenA, food.id, 200); // 200 g -> 260 kcal

  await ctx.request('PUT', `/foods/${food.id}`, tokenA, {
    ...arroz,
    name: 'Histórico',
    caloriesPer100g: 500,
    carbsPer100g: 90,
  });

  const stored = (await listMeals(tokenA)).find((m) => m.id === meal.id)!;
  assert.equal(stored.totals.calories, 260);
  assert.equal(stored.totals.carbs, 56);

  // Uma refeição nova já usa os valores atualizados.
  const newer = await createMeal(tokenA, food.id, 100);
  const newerTotals = (await listMeals(tokenA)).find((m) => m.id === newer.id)!;
  assert.equal(newerTotals.totals.calories, 500);
});

test('GET /foods sem busca lista todos os alimentos, não só 10', async () => {
  for (let i = 1; i <= 12; i++) {
    await createFood(tokenB, { ...arroz, name: `Alimento ${String(i).padStart(2, '0')}` });
  }

  const all = await (await ctx.request('GET', '/foods', tokenB)).json();
  assert.equal(all.length, 12);

  // A busca (autocompletar do modal de refeição) continua limitada a 10.
  const searched = await (await ctx.request('GET', '/foods?search=alimento', tokenB)).json();
  assert.equal(searched.length, 10);
});
