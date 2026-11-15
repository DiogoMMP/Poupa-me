/**
 * Grupo de uma categoria, com o que os selects precisam para o cabeçalho e a cor do ícone.
 */
export interface CategoriaGrupoRef {
  id: string;
  nome: string;
  cor: string;
}

export interface CategoriasModel {
  id: string;
  nome: string;
  icon: string;
  grupoId: string | null;
  ordem: number;
  papel: string | null;
  /** Grupo da categoria; null = "Sem grupo". */
  grupo: CategoriaGrupoRef | null;
}
