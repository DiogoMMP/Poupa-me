import type { Transacao } from '../../../domain/Transacao/Entities/Transacao.js';

/**
 * One aggregated row of a user's history: how many of their transações had this exact descricao in this categoria,
 * and when the most recent one was created.
 */
export interface IHistoricoDescricao {
    descricao: string;
    categoriaDomainId: string;
    total: number;
    ultima: Date;
}

export default interface ITransacaoRepo {
    save(transacao: Transacao): Promise<Transacao>;
    update(transacao: Transacao): Promise<Transacao>;
    delete(transacaoId: string): Promise<void>;
    findById(transacaoId: string): Promise<Transacao | null>;
    findAll(userId: string): Promise<Transacao[]>;
    /** History of the user's transações grouped by (descricao, categoria), without the "Pagamento X" records. */
    findHistoricoDescricoes(userDomainId: string): Promise<IHistoricoDescricao[]>;
}
