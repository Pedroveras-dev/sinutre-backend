import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { prisma } from '../prisma';
import { asyncHandler } from '../utils/http';

export const foodRouter = Router();

//foods/
foodRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '');
  const foods = await prisma.food.findMany({
    where: {
      userId: req.userId!,
      name: {
        contains: search,
        // No PostgreSQL o `contains` diferencia maiúsculas de minúsculas;
        // 'insensitive' mantém a busca como era no SQLite ("fei" acha "Feijão").
        mode: 'insensitive',
      }
    },
    take: 10,
    orderBy: {
      name: 'asc',
    },
  });

  return res.json(foods);
}));


foodRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const {
    name,
    caloriesPer100g,
    carbsPer100g,
    proteinPer100g,
    fatPer100g,
  } = req.body;

  const food = await prisma.food.create({
    data: {
      name,
      caloriesPer100g,
      carbsPer100g,
      proteinPer100g,
      fatPer100g,
      userId: req.userId!,
    },
  });

  return res.status(201).json(food);
}));
