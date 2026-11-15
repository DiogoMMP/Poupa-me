import { Result } from '../../core/logic/Result.js';
import type { ISugestaoCategoriaDTO } from '../../dto/ISugestaoCategoriaDTO.js';

export default interface IIACategorizacaoService {
    /**
     * Suggests a categoria for a descricao, trying the user's history, then the categorizador Space, then the LLM.
     * @param userId - The user creating the transação (their own history is used, also for Admins).
     * @param tipo - Tipo of the form; restricts the candidatas to groups of that tipo, "Ambos" or no group.
     * @returns Ok with null when no layer has a suggestion; fails only on invalid input or an unexpected error.
     */
    suggestCategory(description: string, userId: string, tipo?: 'Entrada' | 'Saída'): Promise<Result<ISugestaoCategoriaDTO | null>>;
}
