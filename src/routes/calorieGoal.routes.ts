import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/http';
import {
  getCalorieGoal,
  updateCalorieGoal,
} from '../controllers/calorieGoal.controller';

export const calorieGoalRoutes = Router();

// Todas as rotas exigem autenticação: sem token válido, respondem 401.
calorieGoalRoutes.use(requireAuth);

calorieGoalRoutes.get('/', asyncHandler(getCalorieGoal));
calorieGoalRoutes.put('/', asyncHandler(updateCalorieGoal));
