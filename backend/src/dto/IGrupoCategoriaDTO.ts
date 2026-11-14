export interface IGrupoCategoriaDTO {
    id?: string;
    nome: string;
    tipo: string;
    cor: string;
    ordem: number;
}

export interface IInputGrupoCategoriaDTO {
    nome: string;
    tipo: string;
    cor: string;
}

/**
 * Body of a batch reorder: the full list of ids in the new order.
 */
export interface IReordenarDTO {
    ids: string[];
}
