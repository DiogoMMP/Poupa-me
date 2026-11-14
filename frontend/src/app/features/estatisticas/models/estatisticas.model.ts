/**
 * Model for Dashboard Data
 */
/**
 * Frontend models for statistics feature (maps from backend DTOs)
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

export interface ICategoriaModel {
  id?: string;
  nome: string;
  icon: string;
}

export interface IGrupoEstatisticaModel {
  id?: string;
  nome: string;
  tipo: string;
  cor: string;
  ordem: number;
}

export interface ICategoriaEstatisticaModel {
  categoria: ICategoriaModel;
  /** Grupo da categoria; null = "Sem grupo". */
  grupo: IGrupoEstatisticaModel | null;
  total: IDinheiroProps;
  numTransacoes: number;
}

export interface IHistoricoDiarioModel {
  data: IDataProps;
  total: IDinheiroProps;
}

export interface EstatisticasModel {
  cashflowMensal: {
    totalIn: number;
    totalOut: number;
    netBalance: number;
  };
  categorias: ICategoriaEstatisticaModel[];
  historicoDiario: IHistoricoDiarioModel[];
}

