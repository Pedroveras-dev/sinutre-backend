// Limites aceitos para a meta diária de calorias (kcal).
//
// São apenas limites de sanidade da entrada — servem para barrar erros de
// digitação (ex.: 20 ou 200000) — e NÃO uma recomendação nutricional. A meta
// é sempre escolhida pelo próprio usuário.
//
// O frontend replica estes valores em src/utils/calorieGoal.ts; se mudar
// aqui, mude lá também. A validação do backend é a que vale.
export const CALORIE_GOAL_MIN = 500;
export const CALORIE_GOAL_MAX = 10000;
