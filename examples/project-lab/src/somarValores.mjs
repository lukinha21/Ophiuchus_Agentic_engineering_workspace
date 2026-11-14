// Laboratório: contém um erro intencional para validar propostas do Ophiuchus.
export function somarValores(valores) {
  if (!Array.isArray(valores) || valores.some(n => !Number.isFinite(n))) {
    throw new TypeError('Informe um array de números finitos');
  }
  return valores.reduce((total, valor) => total - valor, 0);
}
