/**
 * Tipo de um grupo de categorias: em que selects o grupo aparece.
 */
export type TipoGrupo = 'Entrada' | 'Saída' | 'Ambos';

/**
 * Data Transfer Object for categoria
 */
export interface CategoriasDTO {
  id?: string;
  nome: string;
  icon: string;
  /** Domain id do grupo; null enquanto a categoria está em "Sem grupo". */
  grupoId: string | null;
  /** Posição dentro do grupo. */
  ordem: number;
  /** Papel da categoria (p.ex. 'PagamentoCartao'), ou null. */
  papel: string | null;
}

/**
 * Data Transfer Object for Categoria (Input)
 * Used when creating (grupoId obrigatório) and updating (papel: null limpa o papel)
 */
export interface CategoriasInputDTO {
  nome: string;
  icon: string;
  grupoId?: string;
  papel?: string | null;
}

/**
 * Data Transfer Object for a grupo de categorias
 */
export interface GrupoCategoriaDTO {
  id: string;
  nome: string;
  tipo: TipoGrupo;
  /** Chave da paleta (ver `shared/constants/cores-grupo.ts`). */
  cor: string;
  ordem: number;
}

/**
 * Data Transfer Object for GrupoCategoria (Input)
 */
export interface GrupoCategoriaInputDTO {
  nome: string;
  tipo: TipoGrupo;
  cor: string;
}

/**
 * Uma entrada do `GET /categoria`: um grupo (null = "Sem grupo") com as suas categorias, pela ordem do Admin.
 */
export interface CategoriasAgrupadasDTO {
  grupo: GrupoCategoriaDTO | null;
  categorias: CategoriasDTO[];
}
