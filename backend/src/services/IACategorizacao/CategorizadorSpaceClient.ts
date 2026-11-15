import type { Client } from '@gradio/client';

/**
 * A prediction of the categorizador Space, already validated against the candidate categorias.
 */
export interface IPrevisaoCategorizador {
    categoriaId: string;
    confianca: number;
}

export interface ICategorizadorSpaceOpcoes {
    /** Space id ("owner/nome") or URL (e.g. http://localhost:7860 for local development). */
    spaceId: string;
    hfToken?: string;
    timeoutMs: number;
}

/**
 * Client of the categorizador Hugging Face Space (camada 2 of the categoria suggestion, F0009). The Space exposes a
 * Gradio function `predict(descricao, candidatas)` whose output is a JSON string
 * `{ categoriaId: string | null, confianca: number | null, versaoModelo: string | null }` (contract implemented by F0010).
 *
 * The connection is created once and reused; when a call fails or times out it is dropped and recreated on the next
 * request. Every failure resolves to null, so the caller just moves on to the next layer.
 */
export default class CategorizadorSpaceClient {
    private ligacao: Promise<Client> | null = null;

    constructor(
        private opcoes: ICategorizadorSpaceOpcoes,
        private logger: { error: (...args: unknown[]) => void }
    ) {}

    /**
     * Asks the Space for the categoria of a descricao, restricted to the candidate domain ids.
     * @returns The prediction, or null when the Space fails, times out, has no answer or answers something invalid.
     */
    public async predict(descricao: string, candidatas: string[]): Promise<IPrevisaoCategorizador | null> {
        let resposta: unknown;
        try {
            resposta = await this.comTimeout(this.chamar(descricao, candidatas));
        } catch (e) {
            this.ligacao = null;
            this.logger.error('CategorizadorSpaceClient: chamada ao Space falhou: %o', e);
            return null;
        }

        const { valida, previsao } = CategorizadorSpaceClient.validar(resposta, candidatas);
        if (!valida) {
            this.logger.error('CategorizadorSpaceClient: resposta do Space mal formada: %o', resposta);
        }
        return previsao;
    }

    private async chamar(descricao: string, candidatas: string[]): Promise<unknown> {
        if (!this.ligacao) {
            const token = this.opcoes.hfToken as `hf_${string}` | undefined;
            // Loaded on demand: the package is only needed when a Space is configured
            this.ligacao = import('@gradio/client')
                .then(({ Client }) => Client.connect(this.opcoes.spaceId, token ? { token } : {}));
        }
        const cliente = await this.ligacao;
        const resultado = await cliente.predict('/predict', {
            descricao,
            candidatas: JSON.stringify(candidatas)
        });
        return resultado.data;
    }

    private comTimeout<T>(promessa: Promise<T>): Promise<T> {
        let temporizador: ReturnType<typeof setTimeout> | undefined;
        const limite = new Promise<never>((_, rejeitar) => {
            temporizador = setTimeout(
                () => rejeitar(new Error(`Timeout de ${this.opcoes.timeoutMs} ms no Space`)),
                this.opcoes.timeoutMs
            );
        });
        return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
    }

    /**
     * Validates the Space output: Gradio returns the outputs as an array, the first being the JSON string (or an
     * already decoded object). A prediction is accepted only with a categoriaId among the candidatas and a confianca
     * in [0, 1]. `categoriaId: null` (no trained model, or no candidata known to it) is a valid answer without a
     * prediction; anything else is malformed.
     */
    public static validar(resposta: unknown, candidatas: string[]): { valida: boolean; previsao: IPrevisaoCategorizador | null } {
        const malFormada = { valida: false, previsao: null };

        let saida: unknown = Array.isArray(resposta) ? resposta[0] : resposta;
        if (typeof saida === 'string') {
            try {
                saida = JSON.parse(saida);
            } catch {
                return malFormada;
            }
        }
        if (!saida || typeof saida !== 'object') return malFormada;

        const { categoriaId, confianca } = saida as Record<string, unknown>;
        if (categoriaId === null) return { valida: true, previsao: null };
        if (typeof categoriaId !== 'string' || !candidatas.includes(categoriaId)) return malFormada;
        if (typeof confianca !== 'number' || !Number.isFinite(confianca) || confianca < 0 || confianca > 1) return malFormada;

        return { valida: true, previsao: { categoriaId, confianca } };
    }
}
