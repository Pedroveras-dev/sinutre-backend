import { Router } from 'express';
import { createMeal, meals } from '../controllers/meals.controller';
import { requireAuth } from '../middlewares/auth.middleware';

import { asyncHandler } from '../utils/http';

export const mealsRoutes = Router();

mealsRoutes.post('/', requireAuth, asyncHandler(createMeal));
mealsRoutes.get('/', requireAuth, asyncHandler(meals));
