import {ICategoriaDTO} from "./ICategoriaDTO.js";
import type {IGrupoCategoriaDTO} from "./IGrupoCategoriaDTO.js";
import {IDataDTO} from "./shared/IDataDTO.js";
import {IDinheiroDTO} from "./shared/IDinheiroDTO.js";

/**
 * Statistics for a single category returned by the statistics endpoint.
 */
export interface ICategoriaEstatistica {
    categoria: ICategoriaDTO;
    /** Group of the categoria (inactive groups included, so old movimentos keep it); null = "Sem grupo". */
    grupo: IGrupoCategoriaDTO | null;
    total: IDinheiroDTO;
    /** Number of expense transactions summed into total. */
    numTransacoes: number;
}

/**
 * Daily history entry used to build charts.
 */
export interface IHistoricoDiario {
    data: IDataDTO;
    total: IDinheiroDTO;
}

/**
 * Top-level statistics payload returned by the statistics API.
 */
export interface IEstatisticasDTO {
    cashflowMensal: {
        totalIn: number;
        totalOut: number;
        netBalance: number;
    };
    categorias: ICategoriaEstatistica[];
    historicoDiario: IHistoricoDiario[];
}