import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/http';
import {
  createFood,
  deleteFood,
  listFoods,
  updateFood,
} from '../controllers/foods.controller';

export const foodRouter = Router();

// Todas as rotas de alimentos exigem autenticação.
foodRouter.use(requireAuth);

foodRouter.get('/', asyncHandler(listFoods));
foodRouter.post('/', asyncHandler(createFood));
foodRouter.put('/:id', asyncHandler(updateFood));
foodRouter.delete('/:id', asyncHandler(deleteFood));
