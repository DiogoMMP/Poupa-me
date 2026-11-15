import type { Request, Response, NextFunction } from 'express';
import { Service, Inject } from 'typedi';
import { type AuthenticatedRequest } from '../../api/middlewares/isAuth.js';
import type IIACategorizacaoController from './IIACategorizacaoController.js';
import type IIACategorizacaoService from '../../services/IACategorizacao/IIACategorizacaoService.js';

const TIPOS_SUGESTAO = ['Entrada', 'Saída'] as const;
type TipoSugestao = typeof TIPOS_SUGESTAO[number];

@Service()
export default class IACategorizacaoController implements IIACategorizacaoController {
    constructor(
        @Inject('IACategorizacaoService') private aiCategorizacaoService: IIACategorizacaoService
    ) {}

    /**
     * Endpoint to suggest a category for a given transaction description.
     */
    public async sugerirCategoria(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            // Read from query since it's now a GET request
            const description = req.query.description as string;
            if (!description) {
                return res.status(400).json({ error: 'Descrição em falta.' });
            }

            // Optional tipo of the form: restricts the candidatas to that tipo
            const tipo = req.query.tipo as string | undefined;
            if (tipo !== undefined && !(TIPOS_SUGESTAO as readonly string[]).includes(tipo)) {
                return res.status(400).json({ error: `Tipo inválido: use ${TIPOS_SUGESTAO.join(' ou ')}.` });
            }

            // The history used is the one of whoever is creating the transação, also for Admins
            const userId = (req as AuthenticatedRequest).currentUser?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const result = await this.aiCategorizacaoService.suggestCategory(description, userId, tipo as TipoSugestao | undefined);

            if (result.isFailure) {
                return res.status(500).json({ error: result.error });
            }

            // No layer had a suggestion: not an error, the form just stays without one
            const sugestao = result.getValue();
            if (!sugestao) {
                return res.status(204).send();
            }

            return res.status(200).json(sugestao);
        } catch (e) {
            next(e);
        }
    }
}
