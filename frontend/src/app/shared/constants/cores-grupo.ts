/**
 * Paleta fechada das cores dos grupos de categorias. A BD guarda só a chave; o valor hex vive aqui, desenhado para
 * o fundo escuro da app, para que a paleta possa ser afinada sem mexer nos grupos gravados.
 */
export const CORES_GRUPO = {
  turquesa: '#61edd6',
  verde: '#4ade80',
  lima: '#a3e635',
  amarelo: '#facc15',
  laranja: '#fb923c',
  areia: '#d6b98c',
  coral: '#fb7185',
  rosa: '#f472b6',
  roxo: '#c084fc',
  indigo: '#818cf8',
  azul: '#60a5fa',
  cinza: '#94a3b8'
} as const;

export type CorGrupo = keyof typeof CORES_GRUPO;

/** Chaves da paleta, pela ordem em que aparecem no seletor de cor. */
export const CHAVES_CORES_GRUPO = Object.keys(CORES_GRUPO) as CorGrupo[];

/** Cor usada por "Sem grupo" e por qualquer chave desconhecida. */
export const COR_SEM_GRUPO: CorGrupo = 'cinza';

/** Opacidade do fundo do círculo do emoji de uma categoria (o contorno usa a cor sólida). */
const ALPHA_FUNDO = 0.3;

/**
 * Hex da cor de um grupo a partir da chave; `cinza` para "Sem grupo" (null) ou chaves desconhecidas.
 */
export function corGrupoHex(cor: string | null | undefined): string {
  return CORES_GRUPO[(cor ?? COR_SEM_GRUPO) as CorGrupo] ?? CORES_GRUPO[COR_SEM_GRUPO];
}

/**
 * Converte um hex `#rrggbb` em `rgba(r, g, b, alpha)`.
 */
function hexComAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Fundo do círculo do emoji (cor do grupo a 30%). */
export function fundoIconeGrupo(hex: string): string {
  return hexComAlpha(hex, ALPHA_FUNDO);
}
