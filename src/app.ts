import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { authRoutes } from './routes/auth.routes';
import { mealsRoutes } from './routes/meals.routes';
import { foodRouter } from './routes/food.routes';
import { calorieGoalRoutes } from './routes/calorieGoal.routes';
import { profileRoutes } from './routes/profile.routes';
import { errorHandler } from './utils/http';

export const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());

// Raiz: quem abre o link da API no navegador vê o que ela é e onde está o
// site, em vez de "Cannot GET /".
app.get('/', (_req, res) => {
  res.json({
    name: 'SiNutre API',
    status: 'ok',
    frontend: env.frontendUrl,
    health: '/health',
    routes: ['/auth/github', '/meals', '/foods', '/calorie-goal', '/profile'],
    note: 'As rotas de dados exigem login (token Bearer).',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/meals', mealsRoutes);
app.use('/foods', foodRouter);
app.use('/calorie-goal', calorieGoalRoutes);
app.use('/profile', profileRoutes);

// Precisa ser o último middleware registrado.
app.use(errorHandler);
