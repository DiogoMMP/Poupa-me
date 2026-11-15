/**
 * Frontend DTOs that mirror backend `IEstatisticasDTO` shape
 */

export interface IDataProps {
  dia: number;
  mes: number;
  ano: number;
}

export interface IDinheiroProps {
  valor: number;
  moeda: string;
}

export interface ICategoriaDTO {
  id?: string;
  nome: string;
  icon: string;
}

export interface IGrupoEstatisticaDTO {
  id?: string;
  nome: string;
  tipo: string;
  /** Chave da paleta (ver `shared/constants/cores-grupo.ts`). */
  cor: string;
  ordem: number;
}

export interface ICategoriaEstatisticaDTO {
  categoria: ICategoriaDTO;
  /** Grupo da categoria; null = "Sem grupo". */
  grupo: IGrupoEstatisticaDTO | null;
  total: IDinheiroProps;
  numTransacoes: number;
}

export interface IHistoricoDiarioDTO {
  data: IDataProps;
  total: IDinheiroProps;
}

export interface EstatisticasDto {
  cashflowMensal: {
    totalIn: number;
    totalOut: number;
    netBalance: number;
  };
  categorias: ICategoriaEstatisticaDTO[];
  historicoDiario: IHistoricoDiarioDTO[];
}

