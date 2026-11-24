// Limites aceitos para altura e peso.
//
// Assim como os da meta de calorias, servem só para barrar erros de digitação
// (ex.: altura 1.75 digitada em metros, peso 7000) e não são uma avaliação de
// saúde. O frontend replica estes valores em src/utils/profile.ts.
export const HEIGHT_CM_MIN = 50;
export const HEIGHT_CM_MAX = 250;
export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 400;
