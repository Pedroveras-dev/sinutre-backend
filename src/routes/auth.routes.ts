import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { me } from '../controllers/auth.me';

import {
  redirectToGithub,
  githubCallback,
} from '../controllers/auth.controller';

import { asyncHandler } from '../utils/http';

export const authRoutes = Router();

authRoutes.get('/github', asyncHandler(redirectToGithub));
authRoutes.get('/github/callback', asyncHandler(githubCallback));
authRoutes.get('/me', requireAuth, asyncHandler(me));
