import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  // Lida pelo Prisma direto de process.env; validada aqui para falhar cedo.
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3333),
  jwtSecret: required('JWT_SECRET'),
  // Origem do frontend, usada no CORS e no redirect após o login.
  // A barra final é removida: o navegador envia a origem sem ela, e o CORS
  // compara o texto exatamente.
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(
    /\/+$/,
    '',
  ),
  github: {
    clientId: required('GITHUB_CLIENT_ID'),
    clientSecret: required('GITHUB_CLIENT_SECRET'),
    callbackUrl: required('GITHUB_CALLBACK_URL'),
  },
};
