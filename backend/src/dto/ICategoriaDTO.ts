import type {IGrupoCategoriaDTO} from './IGrupoCategoriaDTO.js';

export interface ICategoriaDTO {
    id?: string;
    nome: string;
    icon: string;
    /** Domain id of the group; null for categorias in "Sem grupo". */
    grupoId: string | null;
    ordem: number;
    papel: string | null;
}

export interface IInputCategoriaDTO {
    nome: string;
    icon: string;
    /** Required on create; optional on update (must be an active group). */
    grupoId?: string;
    /** null clears the papel. */
    papel?: string | null;
}

/**
 * One entry of GET /categoria: a group (null = "Sem grupo") with its categorias, both by ordem.
 */
export interface ICategoriasAgrupadasDTO {
    grupo: IGrupoCategoriaDTO | null;
    categorias: ICategoriaDTO[];
}

/**
 * Body of PUT /categoria/ordem.
 */
export interface IReordenarCategoriasDTO {
    grupoId: string | null;
    ids: string[];
}
