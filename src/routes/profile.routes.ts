import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/http';
import { getProfile, updateProfile } from '../controllers/profile.controller';

export const profileRoutes = Router();

// Todas as rotas exigem autenticação: sem token válido, respondem 401.
profileRoutes.use(requireAuth);

profileRoutes.get('/', asyncHandler(getProfile));
profileRoutes.put('/', asyncHandler(updateProfile));
