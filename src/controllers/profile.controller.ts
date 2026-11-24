import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from '../constants/profile';

// Altura e peso ficam na tabela weight_logs (modelo WeightLog do diagrama).
// Cada alteração cria um registro novo, então o histórico é preservado; o
// registro mais recente é o perfil atual. A altura é gravada em centímetros
// e o peso em quilogramas.

// Aceita só número JSON finito dentro dos limites; arredonda para 1 casa
// decimal (ex.: 72.35 kg vira 72.4). Strings, null e afins geram 400.
function parseMeasure(
  value: unknown,
  label: string,
  unit: string,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, `Informe ${label} como número (${unit}).`);
  }
  if (value < min || value > max) {
    throw new HttpError(
      400,
      `${label[0].toUpperCase()}${label.slice(1)} deve estar entre ${min} e ${max} ${unit}.`,
    );
  }
  return Math.round(value * 10) / 10;
}

export function parseProfileBody(body: unknown) {
  const data = (body ?? {}) as Record<string, unknown>;
  return {
    heightCm: parseMeasure(data.heightCm, 'a altura', 'cm', HEIGHT_CM_MIN, HEIGHT_CM_MAX),
    weightKg: parseMeasure(data.weightKg, 'o peso', 'kg', WEIGHT_KG_MIN, WEIGHT_KG_MAX),
  };
}

// Formato único de resposta para GET e PUT.
// heightCm/weightKg = null: o usuário ainda não cadastrou seus dados.
function toResponse(
  record: { height: number; weight: number; createdAt: Date } | null,
) {
  return {
    heightCm: record?.height ?? null,
    weightKg: record?.weight ?? null,
    updatedAt: record?.createdAt ?? null,
    limits: {
      heightCm: { min: HEIGHT_CM_MIN, max: HEIGHT_CM_MAX },
      weightKg: { min: WEIGHT_KG_MIN, max: WEIGHT_KG_MAX },
    },
  };
}

function findLatest(userId: number) {
  return prisma.weightLog.findFirst({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

// GET /profile — altura e peso atuais do usuário autenticado.
export async function getProfile(req: Request, res: Response) {
  // O dono dos dados vem sempre do JWT (req.userId), nunca do cliente.
  return res.json(toResponse(await findLatest(req.userId!)));
}

// PUT /profile   body: { "heightCm": 175, "weightKg": 72.5 }
export async function updateProfile(req: Request, res: Response) {
  const userId = req.userId!;
  const { heightCm, weightKg } = parseProfileBody(req.body);

  const current = await findLatest(userId);

  // Mesmos valores: não cria um registro de histórico repetido.
  if (current && current.height === heightCm && current.weight === weightKg) {
    return res.json(toResponse(current));
  }

  const saved = await prisma.weightLog.create({
    data: { userId, height: heightCm, weight: weightKg },
  });

  return res.json(toResponse(saved));
}
