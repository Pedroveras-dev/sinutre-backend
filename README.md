# sinutre-backend

Backend do **SiNutre — Sistema de Ingestão de Macronutrientes**.

Stack: **Node.js + TypeScript + Express + Prisma + PostgreSQL**, com login via
**GitHub OAuth** e sessão por **JWT**.

> Fork de [danilob/sinutre-backend](https://github.com/danilob/sinutre-backend)
> (projeto didático do professor), desenvolvido como projeto final da disciplina.
>
> - Frontend deste sistema: <https://github.com/Pedroveras-dev/sinutre-frontend>
> - API publicada (Railway): <https://sinutre-backend-production-37ce0f19.up.railway.app> (verificação: [`/health`](https://sinutre-backend-production-37ce0f19.up.railway.app/health))
> - Site publicado (Vercel): <https://sinutre-frontend-alpha.vercel.app>
>
> A lista de funcionalidades por item do enunciado está no README do frontend.

## O que este fork acrescenta

| Mudança | Onde |
|---|---|
| Rotas `GET /calorie-goal` e `PUT /calorie-goal` | `src/routes/calorieGoal.routes.ts`, `src/controllers/calorieGoal.controller.ts` |
| Limites da meta (500–10000 kcal) | `src/constants/calorieGoal.ts` |
| Erros em rotas `async` não derrubam mais o servidor | `src/utils/http.ts` |
| Rotas `GET /profile` e `PUT /profile` (altura e peso) | `src/routes/profile.routes.ts`, `src/controllers/profile.controller.ts`, `src/constants/profile.ts` |
| Testes de integração (26) | `tests/*.test.ts` |
| PostgreSQL no lugar do SQLite + deploy no Railway | `prisma/`, `package.json` |
| Editar e apagar alimentos; apagar refeições | `src/controllers/foods.controller.ts`, `src/controllers/meals.controller.ts` |
| Validação do tipo e dos itens da refeição (antes, item sem quantidade dava `500`) | `src/controllers/meals.controller.ts` |

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

### Altura e peso

Ficam no modelo `WeightLog` (tabela `weight_logs`), que já existia no
diagrama e não era usado. Altura em **centímetros**, peso em **quilogramas**.

- Cada alteração cria um registro novo; o mais recente é o atual. Salvar os
  mesmos valores não cria registro repetido.
- **Validação:** números JSON com altura entre **50 e 250 cm** e peso entre
  **20 e 400 kg** (limites contra erro de digitação, como `1.75` em metros).
  Os valores são arredondados para 1 casa decimal. Fora disso: `400`.
- O IMC e a faixa são calculados no frontend a partir destes dados.

| Rota | Auth | Corpo | Resposta |
|---|---|---|---|
| `GET /profile` | Bearer JWT | — | `{ "heightCm": 175 \| null, "weightKg": 72.5 \| null, "updatedAt": "...", "limits": {...} }` |
| `PUT /profile` | Bearer JWT | `{ "heightCm": 175, "weightKg": 72.5 }` | mesmo formato; `400` se inválido; `401` sem token |

### Editar e apagar alimentos e refeições

O original só tinha cadastro e listagem. Este fork acrescenta:

| Rota | Comportamento |
|---|---|
| `PUT /foods/:id` | Atualiza um alimento do usuário autenticado |
| `DELETE /foods/:id` | Apaga o alimento; `409` com `mealsCount` se ele for usado em refeições |
| `DELETE /meals/:id` | Apaga a refeição e seus itens, em uma transação |

- **Dono:** alimento ou refeição de outro usuário responde `404`, igual a um
  id inexistente.
- **Validação:** `POST` e `PUT /foods` exigem nome (até 100 caracteres) e os
  quatro macros como números ≥ 0.
- **Histórico preservado:** `GET /meals` soma os macros gravados em cada item
  (`meal_foods`) quando a refeição foi criada. Editar um alimento vale para
  as próximas refeições e não reescreve as antigas.
- `GET /foods` sem `search` devolve todos os alimentos (antes, só 10); com
  `search` continua limitado a 10 sugestões.

### Demais rotas (já existiam)

| Rota | Descrição |
|---|---|
| `GET /health` | Verificação de saúde (`{"status":"ok"}`) |
| `GET /auth/github` → `GET /auth/github/callback` | Login OAuth; ao final redireciona para `FRONTEND_URL/?token=<jwt>` |
| `GET /auth/me` | Usuário autenticado |
| `GET /foods?search=` · `POST /foods` | Alimentos do usuário |
| `GET /meals` · `POST /meals` | Refeições do usuário, com totais de macros. `POST` valida o tipo (`breakfast`, `lunch`, `snack`, `dinner`, `other`) e cada item (`foodId` e `grams` entre 0 e 5000) |

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
entradas inválidas, isolamento entre dois usuários e registro ativo único
(meta, altura e peso); e, para alimentos e refeições, edição, exclusão,
bloqueio de alimento em uso (`409`), validação dos itens da refeição e
preservação do histórico.

Teste manual (com um token obtido no login):

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3333/calorie-goal
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"caloriesGoal": 2000}' http://localhost:3333/calorie-goal
```

## Deploy (Railway + PostgreSQL)

O backend roda no **Railway**, como pede o guia de deploy da disciplina. O
banco é um PostgreSQL externo (no meu caso, Neon; o guia usa Supabase, e
qualquer um serve): o Railway só recebe a `DATABASE_URL`.

O `package.json` já está no formato que o Railway executa:

- build: `prisma generate && tsc`
- start: `prisma migrate deploy && node dist/index.js` (aplica as migrations
  pendentes e sobe a API)
- `prisma` fica em `dependencies`, para o `migrate deploy` funcionar em produção.

Passos:

1. **Railway:** *New Project → Deploy from GitHub repo* e escolha este
   repositório. Em *Settings → Networking*, clique em **Generate Domain**.
2. Em **Variables**, crie: `DATABASE_URL`, `JWT_SECRET` (valor aleatório
   longo), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`
   (`https://SEU-DOMINIO.up.railway.app/auth/github/callback`) e
   `FRONTEND_URL` (URL do frontend na Vercel, sem `/` final). Não defina
   `PORT`: o Railway informa sozinho.
3. **GitHub:** no OAuth App de produção, *Authorization callback URL* = o
   mesmo valor de `GITHUB_CALLBACK_URL`.
4. **Vercel:** atualize `VITE_API_URL` no frontend com a URL do Railway e
   faça um *Redeploy*.
5. Confira `https://SEU-DOMINIO.up.railway.app/health`.

O HTTPS é fornecido pelo Railway. O CORS aceita apenas a origem de
`FRONTEND_URL`. Na conta gratuita, o serviço pode hibernar sem uso e o
primeiro acesso depois disso demora alguns segundos.

**Por que PostgreSQL e não SQLite:** o disco das hospedagens gratuitas é
efêmero; um arquivo SQLite seria apagado a cada deploy ou reinício.

**Alternativa:** o `render.yaml` permite publicar o mesmo backend no Render
(*New → Blueprint*), com as mesmas variáveis.

## Limitações conhecidas (herdadas do projeto original)

- O JWT volta ao frontend na query string (`/?token=`) e fica no `localStorage`.
- `MealFood` tem chave `(mealId, foodId)`: o mesmo alimento não pode aparecer
  duas vezes na mesma refeição.
- Não há edição de refeições (só exclusão).
