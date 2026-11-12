import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';

const FOOD_NAME_MAX_LENGTH = 100;

// Lê um id numérico de rota (/foods/:id, /meals/:id). 400 se não for inteiro positivo.
export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Identificador inválido.');
  }
  return id;
}

function parseMacro(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${label} deve ser um número maior ou igual a zero.`);
  }
  return value;
}

// Valida o corpo de POST e PUT /foods. Só os campos abaixo são aproveitados;
// qualquer outro (inclusive userId) é ignorado.
function parseFoodBody(body: unknown) {
  const data = (body ?? {}) as Record<string, unknown>;

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name === '' || name.length > FOOD_NAME_MAX_LENGTH) {
    throw new HttpError(
      400,
      `Informe o nome do alimento (até ${FOOD_NAME_MAX_LENGTH} caracteres).`,
    );
  }

  return {
    name,
    caloriesPer100g: parseMacro(data.caloriesPer100g, 'Calorias por 100 g'),
    carbsPer100g: parseMacro(data.carbsPer100g, 'Carboidratos por 100 g'),
    proteinPer100g: parseMacro(data.proteinPer100g, 'Proteínas por 100 g'),
    fatPer100g: parseMacro(data.fatPer100g, 'Gorduras por 100 g'),
  };
}

// Busca um alimento que pertença ao usuário autenticado.
// Alimento de outro usuário responde 404, igual a um inexistente, para não
// revelar que aquele id existe.
async function findOwnFood(id: number, userId: number) {
  const food = await prisma.food.findFirst({ where: { id, userId } });
  if (!food) {
    throw new HttpError(404, 'Alimento não encontrado.');
  }
  return food;
}

// GET /foods?search=
// Sem busca: todos os alimentos do usuário (página Dieta).
// Com busca: até 10 sugestões (autocompletar do modal de refeição).
export async function listFoods(req: Request, res: Response) {
  const search = String(req.query.search ?? '').trim();

  const foods = await prisma.food.findMany({
    where: {
      userId: req.userId!,
      // No PostgreSQL o `contains` diferencia maiúsculas de minúsculas;
      // 'insensitive' mantém a busca como era no SQLite ("fei" acha "Feijão").
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    },
    take: search ? 10 : undefined,
    orderBy: { name: 'asc' },
  });

  return res.json(foods);
}

// POST /foods
export async function createFood(req: Request, res: Response) {
  const food = await prisma.food.create({
    data: { ...parseFoodBody(req.body), userId: req.userId! },
  });

  return res.status(201).json(food);
}

// PUT /foods/:id
// As refeições já registradas não mudam: cada item de refeição guarda os
// macros calculados no momento em que foi criado (tabela meal_foods).
export async function updateFood(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const data = parseFoodBody(req.body);
  await findOwnFood(id, req.userId!);

  const food = await prisma.food.update({ where: { id }, data });

  return res.json(food);
}

// DELETE /foods/:id
// Recusa (409) se o alimento aparece em alguma refeição: apagar removeria
// itens do histórico sem o usuário pedir. Ele pode apagar as refeições antes.
export async function deleteFood(req: Request, res: Response) {
  const id = parseId(req.params.id);
  await findOwnFood(id, req.userId!);

  const mealsCount = await prisma.mealFood.count({ where: { foodId: id } });
  if (mealsCount > 0) {
    return res.status(409).json({
      error:
        mealsCount === 1
          ? 'Este alimento é usado em 1 refeição. Apague essa refeição antes de apagar o alimento.'
          : `Este alimento é usado em ${mealsCount} refeições. Apague essas refeições antes de apagar o alimento.`,
      mealsCount,
    });
  }

  await prisma.food.delete({ where: { id } });

  return res.status(204).end();
}
