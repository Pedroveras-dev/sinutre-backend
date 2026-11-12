// Preparação compartilhada pelos testes de integração: sobe o app Express
// numa porta livre, contra um banco de teste separado, com dois usuários.
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// As variáveis precisam existir ANTES de importar o app (src/config/env.ts
// lê process.env na importação). O dotenv não sobrescreve o que já existe.
//
// Os testes APAGAM os dados do banco que usam, então exigem um banco
// separado, informado em TEST_DATABASE_URL (nunca usam DATABASE_URL).
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'Defina TEST_DATABASE_URL com um banco PostgreSQL só para testes. ' +
      'Ex.: TEST_DATABASE_URL="postgresql://..." npm test',
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'segredo-apenas-para-testes';
process.env.GITHUB_CLIENT_ID = 'teste';
process.env.GITHUB_CLIENT_SECRET = 'teste';
process.env.GITHUB_CALLBACK_URL = 'http://localhost/callback';

export async function startTestApp() {
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });

  const { app } = await import('../src/app');
  const { prisma } = await import('../src/prisma');
  const jwt = (await import('jsonwebtoken')).default;

  // Banco limpo a cada execução (ordem respeita as chaves estrangeiras).
  await prisma.mealFood.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.food.deleteMany();
  await prisma.healthData.deleteMany();
  await prisma.weightLog.deleteMany();
  await prisma.user.deleteMany();

  const userA = await prisma.user.create({
    data: { githubId: 'a', githubLogin: 'usuario-a', name: 'Usuário A' },
  });
  const userB = await prisma.user.create({
    data: { githubId: 'b', githubLogin: 'usuario-b', name: 'Usuário B' },
  });

  const server: Server = app.listen(0);
  const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;

  // Faz uma requisição JSON; `token` undefined = sem autenticação.
  function request(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  return {
    prisma,
    request,
    userAId: userA.id,
    userBId: userB.id,
    tokenA: jwt.sign({ sub: userA.id }, process.env.JWT_SECRET!),
    tokenB: jwt.sign({ sub: userB.id }, process.env.JWT_SECRET!),
    async close() {
      server.close();
      await prisma.$disconnect();
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;
