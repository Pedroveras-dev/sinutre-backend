# sinutre-backend

Backend do **SiNutre — Sistema de Ingestão de Macronutrientes**.

Stack: **Node.js + TypeScript + Express + Prisma + PostgreSQL**, com login via
**GitHub OAuth** e sessão por **JWT**.

> Fork de [danilob/sinutre-backend](https://github.com/danilob/sinutre-backend)
> (projeto didático do professor), com a funcionalidade **meta diária de
> calorias por usuário** e a preparação para deploy.
>
> - Frontend deste sistema: <https://github.com/Pedroveras-dev/sinutre-frontend>
> - API publicada: _preencher após o deploy_
> - Site publicado: _preencher após o deploy_

## O que este fork acrescenta

| Mudança | Onde |
|---|---|
| Rotas `GET /calorie-goal` e `PUT /calorie-goal` | `src/routes/calorieGoal.routes.ts`, `src/controllers/calorieGoal.controller.ts` |
| Limites da meta (500–10000 kcal) | `src/constants/calorieGoal.ts` |
| Erros em rotas `async` não derrubam mais o servidor | `src/utils/http.ts` |
| Testes de integração | `tests/calorieGoal.test.ts` |
| PostgreSQL no lugar do SQLite + deploy | `prisma/`, `render.yaml` |

### Meta diária de calorias

A meta é **informada pelo usuário** (o sistema não calcula nem recomenda
valores) e fica em `HealthData.targetDietDaily`, modelo que já existia.

- **Identidade:** o usuário vem sempre do JWT (`req.userId`, preenchido pelo
  middleware `requireAuth`). Um `userId` enviado no corpo é ignorado, então
  ninguém lê ou altera a meta de outra pessoa.
- **Validação:** `caloriesGoal` precisa ser um número JSON **inteiro** entre
  **500 e 10000**. São limites de sanidade contra erro de digitação, não uma
  recomendação nutricional. Strings, decimais, negativos e `null` recebem `400`.
- **Registro ativo:** cada usuário tem no máximo um `HealthData` com
  `isActive = true`. Ao mudar a meta, na mesma transação o registro ativo é
  encerrado (`isActive = false`, `closedAt = agora`) e um novo é criado. Os
  antigos ficam como histórico. Salvar o mesmo valor não cria registro novo.
- **Sem meta:** `GET` devolve `caloriesGoal: null` — nenhum valor padrão é
  inventado.

| Rota | Auth | Corpo | Resposta |
|---|---|---|---|
| `GET /calorie-goal` | Bearer JWT | — | `{ "caloriesGoal": 2000 \| null, "updatedAt": "...", "limits": { "min": 500, "max": 10000 } }` |
| `PUT /calorie-goal` | Bearer JWT | `{ "caloriesGoal": 2000 }` | mesmo formato; `400` se inválido; `401` sem token |

### Demais rotas (já existiam)

| Rota | Descrição |
|---|---|
| `GET /health` | Verificação de saúde (`{"status":"ok"}`) |
| `GET /auth/github` → `GET /auth/github/callback` | Login OAuth; ao final redireciona para `FRONTEND_URL/?token=<jwt>` |
| `GET /auth/me` | Usuário autenticado |
| `GET /foods?search=` · `POST /foods` | Alimentos do usuário |
| `GET /meals` · `POST /meals` | Refeições do usuário, com totais de macros |

## Instalação e execução local

Requisitos: Node.js 20+ e um PostgreSQL.

```bash
npm install
cp .env.example .env            # preencha as variáveis (tabela abaixo)
docker compose up -d            # Postgres local (ou use um banco do Neon)
npx prisma migrate deploy       # cria as tabelas
npm run dev                     # http://localhost:3333
```

Banco sem Docker: crie um projeto gratuito em <https://neon.com> e cole a
connection string em `DATABASE_URL`.

### Variáveis de ambiente

| Variável | Para que serve | Exemplo local |
|---|---|---|
| `DATABASE_URL` | Conexão PostgreSQL | `postgresql://sinutre:sinutre@localhost:5432/sinutre?schema=public` |
| `TEST_DATABASE_URL` | Banco separado usado só pelos testes | `postgresql://sinutre:sinutre@localhost:5432/sinutre_test?schema=public` |
| `PORT` | Porta HTTP (a hospedagem define sozinha) | `3333` |
| `JWT_SECRET` | Assinatura dos tokens; valor aleatório longo | gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth App do GitHub | criados em <https://github.com/settings/developers> |
| `GITHUB_CALLBACK_URL` | Callback registrada no OAuth App | `http://localhost:3333/auth/github/callback` |
| `FRONTEND_URL` | Origem liberada no CORS e destino do redirect pós-login (sem `/` final) | `http://localhost:5173` |

OAuth App para desenvolvimento: *Homepage URL* `http://localhost:5173` e
*Authorization callback URL* `http://localhost:3333/auth/github/callback`.
O `.env` está no `.gitignore`; nunca versione segredos.

## Como testar

```bash
npm run build                                   # prisma generate + tsc
TEST_DATABASE_URL="postgresql://..." npm test   # apaga os dados do banco de teste!
```

Os testes sobem a API numa porta livre e verificam: `401` sem token ou com
token inválido, estado sem meta, cadastro e persistência, rejeição de
entradas inválidas, isolamento entre dois usuários e registro ativo único.

Teste manual (com um token obtido no login):

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3333/calorie-goal
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"caloriesGoal": 2000}' http://localhost:3333/calorie-goal
```

## Deploy (Render + Neon, gratuito)

**Por que PostgreSQL:** o plano gratuito do Render tem disco efêmero e não
permite disco persistente; um arquivo SQLite seria apagado a cada deploy,
reinício ou hibernação. O banco fica então no Neon (PostgreSQL gratuito, sem
prazo de expiração), fora do servidor da aplicação.

**Limitações do gratuito:** o backend hiberna após 15 min sem acesso e a
primeira requisição seguinte leva cerca de 1 minuto; o Neon gratuito tem 1 GB
por projeto e também suspende quando ocioso.

1. **Neon:** crie um projeto e copie a connection string **direta** (sem
   `-pooler`), com `sslmode=require`.
2. **Render:** *New → Blueprint*, escolha este repositório. O `render.yaml`
   define:
   - build: `npm ci --include=dev && npm run build` (gera o Prisma Client e compila)
   - start: `npx prisma migrate deploy && npm start` (aplica migrations pendentes e sobe a API)
   - health check: `/health`
3. Preencha no painel: `DATABASE_URL`, `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`
   (`https://SEU-BACKEND.onrender.com/auth/github/callback`) e `FRONTEND_URL`
   (URL do frontend na Vercel ou no Render, sem `/` final). O `JWT_SECRET` é gerado pelo Render.
4. **GitHub:** crie um OAuth App **de produção** com *Homepage URL* = URL do
   frontend e *Authorization callback URL* = o mesmo valor de
   `GITHUB_CALLBACK_URL`.
5. Confira `https://SEU-BACKEND.onrender.com/health`.

O HTTPS é fornecido pelo Render. O CORS aceita apenas a origem de
`FRONTEND_URL`.

## Limitações conhecidas (herdadas do projeto original)

- O JWT volta ao frontend na query string (`/?token=`) e fica no `localStorage`.
- `MealFood` tem chave `(mealId, foodId)`: o mesmo alimento não pode aparecer
  duas vezes na mesma refeição.
- Não há edição nem exclusão de alimentos e refeições.
