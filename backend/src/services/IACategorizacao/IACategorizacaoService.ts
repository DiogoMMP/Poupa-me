import { Service, Inject } from 'typedi';
import { InferenceClient } from "@huggingface/inference";
import config from '../../config/index.js';
import { Result } from '../../core/logic/Result.js';
import { Guard } from '../../core/logic/Guard.js';
import type ICategoriaRepo from '../../repos/Categoria/ICategoriaRepo.js';
import type IGrupoCategoriaRepo from '../../repos/GrupoCategoria/IGrupoCategoriaRepo.js';
import type ITransacaoRepo from '../../repos/Transacao/IRepos/ITransacaoRepo.js';
import type IIACategorizacaoService from './IIACategorizacaoService.js';
import type { ISugestaoCategoriaDTO } from '../../dto/ISugestaoCategoriaDTO.js';
import type { Categoria } from '../../domain/Categoria/Entities/Categoria.js';
import { CategoriaMap } from '../../mappers/CategoriaMap.js';
import { normalizarDescricao } from '../../utils/normalizarDescricao.js';
import CategorizadorSpaceClient from './CategorizadorSpaceClient.js';

/** Case- and accent-insensitive form of a categoria nome, to compare with IA_CATEGORIAS_EXCLUIDAS. */
function normalizarNome(nome: string): string {
    return nome.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}

/** How the LLM prompt names the movimento, so that an Entrada form is not described as a despesa. */
export function nomeDoMovimento(tipo?: 'Entrada' | 'Saída'): string {
    if (tipo === 'Entrada') return 'receita';
    if (tipo === 'Saída') return 'despesa';
    return 'transação';
}

/**
 * Suggests a categoria for a transação description in layers, stopping at the first accepted answer (F0009):
 * 1. the user's own history (same normalized descricao);
 * 2. the categorizador Space, when configured and confident enough;
 * 3. the LLM on HF Inference.
 * Every layer only chooses among the same candidatas: active categorias that fit the tipo, without the excluded
 * names (IA_CATEGORIAS_EXCLUIDAS) and without the categorias with a papel, which only the system assigns.
 */
@Service()
export default class AICategorizationService implements IIACategorizacaoService {
    private client: InferenceClient;
    private spaceClient: CategorizadorSpaceClient | null;

    constructor(
        @Inject('CategoriaRepo') private categoriaRepo: ICategoriaRepo,
        @Inject('GrupoCategoriaRepo') private grupoCategoriaRepo: IGrupoCategoriaRepo,
        @Inject('TransacaoRepo') private transacaoRepo: ITransacaoRepo,
        @Inject('logger') private logger: { error: (...args: unknown[]) => void, info: (...args: unknown[]) => void }
    ) {
        // Initialize the client with your HF_TOKEN
        this.client = new InferenceClient(config.ai.hfToken);
        // Without HF_SPACE_ID the model layer is skipped
        this.spaceClient = config.ai.spaceId
            ? new CategorizadorSpaceClient(
                { spaceId: config.ai.spaceId, hfToken: config.ai.hfToken, timeoutMs: config.ai.spaceTimeoutMs },
                logger
            )
            : null;
    }

    /**
     * Suggests a categoria for a given transaction description. When no layer has a suggestion the result is ok with
     * null (no suggestion is a normal outcome, not an error); it fails only on invalid input or an unexpected error.
     */
    public async suggestCategory(description: string, userId: string, tipo?: 'Entrada' | 'Saída'): Promise<Result<ISugestaoCategoriaDTO | null>> {
        try {
            // 1. Logic Guard
            const guardResult = Guard.againstNullOrUndefined(description, 'description');
            if (!guardResult.succeeded) {
                return Result.fail<ISugestaoCategoriaDTO | null>(guardResult.message || 'Descrição inválida');
            }

            // 2. Candidatas, computed once for all layers
            const candidatas = await this.calcularCandidatas(tipo);
            if (candidatas.length === 0) {
                return Result.ok<ISugestaoCategoriaDTO | null>(null);
            }

            // Layers 1 and 2 work on the normalized descricao; when nothing is left of it, only the LLM is asked
            const normalizada = normalizarDescricao(description);

            // 3. Layer 1: the user's own history
            if (normalizada) {
                const doHistorico = await this.sugerirPeloHistorico(normalizada, userId, candidatas);
                if (doHistorico) {
                    return Result.ok<ISugestaoCategoriaDTO | null>({ categoria: CategoriaMap.toDTO(doHistorico), origem: 'historico', confianca: null });
                }
            }

            // 4. Layer 2: the categorizador Space; below the threshold it is kept as a fallback for the LLM
            let doModelo: { categoria: Categoria; confianca: number } | null = null;
            if (normalizada && this.spaceClient) {
                const previsao = await this.spaceClient.predict(description, candidatas.map(c => c.id.toString()));
                const categoria = previsao ? candidatas.find(c => c.id.toString() === previsao.categoriaId) : undefined;
                if (previsao && categoria) {
                    doModelo = { categoria, confianca: previsao.confianca };
                    if (previsao.confianca >= config.ai.limiarConfianca) {
                        return Result.ok<ISugestaoCategoriaDTO | null>({ categoria: CategoriaMap.toDTO(categoria), origem: 'modelo', confianca: previsao.confianca });
                    }
                }
            }

            // 5. Layer 3: the LLM
            const doLlm = await this.sugerirPeloLlm(description, candidatas, tipo);
            if (doLlm) {
                return Result.ok<ISugestaoCategoriaDTO | null>({ categoria: CategoriaMap.toDTO(doLlm), origem: 'llm', confianca: null });
            }

            if (doModelo) {
                return Result.ok<ISugestaoCategoriaDTO | null>({ categoria: CategoriaMap.toDTO(doModelo.categoria), origem: 'modelo', confianca: doModelo.confianca });
            }

            // No layer had a suggestion: the form simply stays without one
            return Result.ok<ISugestaoCategoriaDTO | null>(null);
        } catch (e) {
            this.logger.error('AICategorizationService error: %o', e);
            return Result.fail<ISugestaoCategoriaDTO | null>('AI_SERVICE_UNAVAILABLE');
        }
    }

    /**
     * Active categorias the suggestion may return for the tipo. A categoria fits the tipo when it has no group or its
     * group's tipo is that tipo or "Ambos" (same rule as the frontend selects, F0008); one whose group is not active is
     * treated as without group, as GET /categoria does. Without tipo every non-excluded categoria is a candidata.
     */
    private async calcularCandidatas(tipo?: 'Entrada' | 'Saída'): Promise<Categoria[]> {
        const [categorias, grupos] = await Promise.all([
            this.categoriaRepo.findAll(),
            this.grupoCategoriaRepo.findAll()
        ]);
        const tipoPorGrupo = new Map(grupos.map(g => [g.id.toString(), g.tipo.value]));
        const excluidas = new Set(config.ai.categoriasExcluidas.map(normalizarNome));

        return categorias.filter(c => {
            if (c.papel) return false;
            if (excluidas.has(normalizarNome(c.nome.value))) return false;
            if (!tipo) return true;
            const tipoGrupo = c.grupoId ? tipoPorGrupo.get(c.grupoId.toString()) : undefined;
            return !tipoGrupo || tipoGrupo === tipo || tipoGrupo === 'Ambos';
        });
    }

    /**
     * Layer 1: among the user's past transações with the same normalized descricao in a candidata, the categoria used
     * most often; ties go to the most recently used one. Errors move on to the next layer.
     */
    private async sugerirPeloHistorico(normalizada: string, userId: string, candidatas: Categoria[]): Promise<Categoria | null> {
        try {
            const candidataPorId = new Map(candidatas.map(c => [c.id.toString(), c]));
            const porCategoria = new Map<string, { total: number; ultima: number }>();

            const historico = await this.transacaoRepo.findHistoricoDescricoes(userId);
            for (const linha of historico) {
                if (!candidataPorId.has(linha.categoriaDomainId)) continue;
                if (normalizarDescricao(linha.descricao) !== normalizada) continue;
                const acumulado = porCategoria.get(linha.categoriaDomainId) ?? { total: 0, ultima: 0 };
                acumulado.total += linha.total;
                acumulado.ultima = Math.max(acumulado.ultima, linha.ultima.getTime());
                porCategoria.set(linha.categoriaDomainId, acumulado);
            }

            let melhor: { id: string; total: number; ultima: number } | null = null;
            for (const [id, { total, ultima }] of porCategoria) {
                if (!melhor || total > melhor.total || (total === melhor.total && ultima > melhor.ultima)) {
                    melhor = { id, total, ultima };
                }
            }

            return melhor ? (candidataPorId.get(melhor.id) ?? null) : null;
        } catch (e) {
            this.logger.error('AICategorizationService: histórico indisponível: %o', e);
            return null;
        }
    }

    /**
     * Layer 3: asks the LLM to pick one of the candidatas by nome. An answer that is not a candidata is rejected.
     * Errors move on (the caller may still fall back to a low-confidence model answer).
     */
    private async sugerirPeloLlm(description: string, candidatas: Categoria[], tipo?: 'Entrada' | 'Saída'): Promise<Categoria | null> {
        try {
            const suggestion = await this.pedirAoLlm(description, candidatas.map(c => c.nome.value), tipo);
            if (!suggestion) return null;

            // Clean up potentially trailing punctuation like dots
            const cleanSuggestion = suggestion.trim().replace(/[^\w\sÀ-ú]/gi, '').trim();

            this.logger.info(`Sugestão da IA para "${description}": ${cleanSuggestion}`);

            const suggestedCategory = candidatas.find(c => c.nome.value.toLowerCase() === cleanSuggestion.toLowerCase());
            if (!suggestedCategory) {
                this.logger.info(`Sugestão da IA rejeitada (não é uma categoria candidata): ${cleanSuggestion}`);
                return null;
            }
            return suggestedCategory;
        } catch (e) {
            this.logger.error('AICategorizationService: LLM indisponível: %o', e);
            return null;
        }
    }

    /**
     * The HF Inference call. Protected so that tests can replace it without reaching the network.
     * @returns The raw answer of the model, or undefined when it answered nothing.
     */
    protected async pedirAoLlm(description: string, labels: string[], tipo?: 'Entrada' | 'Saída'): Promise<string | undefined> {
        const movimento = nomeDoMovimento(tipo);
        const chatCompletion = await this.client.chatCompletion({
            model: config.ai.model,
            messages: [
                {
                    role: "system",
                    content: `Tu és o motor de IA da app "Poupa-me".
                    O teu objetivo é ler a descrição de uma ${movimento} e escolher a melhor categoria.
                    Categorias disponíveis: [${labels.join(', ')}].
                    Responde APENAS com o nome da categoria exato. Não uses pontuação.`
                },
                {
                    role: "user",
                    content: `A ${movimento} é: "${description}"`
                },
            ],
            max_tokens: 15,
        });

        return chatCompletion.choices[0]?.message?.content ?? undefined;
    }
}
