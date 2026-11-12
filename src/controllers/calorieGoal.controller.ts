import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import {
  CALORIE_GOAL_MAX,
  CALORIE_GOAL_MIN,
} from '../constants/calorieGoal';

// Valida o valor recebido no corpo da requisição.
// Aceita somente um número JSON inteiro dentro dos limites. Strings ("2000"),
// decimais (1800.5), null, NaN e afins são rejeitados com 400.
export function parseCalorieGoal(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new HttpError(
      400,
      'A meta deve ser um número inteiro de calorias (kcal).',
    );
  }

  if (value < CALORIE_GOAL_MIN || value > CALORIE_GOAL_MAX) {
    throw new HttpError(
      400,
      `A meta deve estar entre ${CALORIE_GOAL_MIN} e ${CALORIE_GOAL_MAX} kcal.`,
    );
  }

  return value;
}

// Formato único de resposta para GET e PUT.
// caloriesGoal = null significa "o usuário ainda não definiu uma meta".
function toResponse(
  record: { targetDietDaily: number; createdAt: Date } | null,
) {
  return {
    caloriesGoal: record?.targetDietDaily ?? null,
    updatedAt: record?.createdAt ?? null,
    limits: { min: CALORIE_GOAL_MIN, max: CALORIE_GOAL_MAX },
  };
}

// GET /calorie-goal
// Devolve a meta ativa do usuário autenticado (ou null se não houver).
export async function getCalorieGoal(req: Request, res: Response) {
  // O dono dos dados vem SEMPRE do JWT (req.userId), nunca do cliente.
  const userId = req.userId!;

  const active = await prisma.healthData.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(toResponse(active));
}

// PUT /calorie-goal   body: { "caloriesGoal": 2000 }
// Define ou atualiza a meta do usuário autenticado.
export async function updateCalorieGoal(req: Request, res: Response) {
  const userId = req.userId!;
  const caloriesGoal = parseCalorieGoal(req.body?.caloriesGoal);

  const saved = await prisma.$transaction(async (tx) => {
    const current = await tx.healthData.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // Mesmo valor: nada a fazer (não cria um registro de histórico repetido).
    if (current && current.targetDietDaily === caloriesGoal) {
      return current;
    }

    // Encerra TODOS os registros ativos do usuário (normalmente 0 ou 1).
    // Usar updateMany garante que, mesmo que um dia exista mais de um ativo,
    // a situação volte a ser "no máximo um" depois desta operação.
    await tx.healthData.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, closedAt: new Date() },
    });

    return tx.healthData.create({
      data: {
        userId,
        targetDietDaily: caloriesGoal,
        // Preserva o nível de atividade já cadastrado, se existir.
        levelActivity: current?.levelActivity ?? null,
      },
    });
  });

  return res.json(toResponse(saved));
}
