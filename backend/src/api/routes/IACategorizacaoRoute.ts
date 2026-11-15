import { Router } from 'express';
import { Container } from 'typedi';
import { isAuth } from '../middlewares/index.js';
import type IIACategorizacaoController from '../../controllers/IACategorizacao/IIACategorizacaoController.js';

const route = Router();

export default (app: Router) => {
    app.use('/ia-categorizacao', route);

    const ctrl = Container.get('IACategorizacaoController') as IIACategorizacaoController;

    /**
     * @openapi
     * /ia-categorizacao/sugerir:
     *   get:
     *     tags:
     *       - IACategorizacao
     *     summary: Sugere uma categoria para a descrição de uma transação
     *     description: >
     *       Sugere uma categoria em camadas, parando na primeira resposta aceite: o histórico do utilizador autenticado
     *       (transações com a mesma descrição normalizada), o modelo próprio no Hugging Face Space (se configurado e com
     *       confiança acima do limiar) e, por fim, o LLM. Só são sugeridas categorias ativas que encaixam no tipo, sem as
     *       excluídas (IA_CATEGORIAS_EXCLUIDAS, por omissão "Outros" e "Sem Categoria") nem as que têm papel. Requer autenticação.
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: description
     *         schema:
     *           type: string
     *         required: true
     *         description: A descrição da transação
     *       - in: query
     *         name: tipo
     *         schema:
     *           type: string
     *           enum: [Entrada, Saída]
     *         required: false
     *         description: Tipo do form. Só ficam as categorias sem grupo ou de grupos desse tipo ou "Ambos". Sem tipo, todas as categorias candidatas.
     *     responses:
     *       200:
     *         description: Categoria sugerida com sucesso
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 categoria:
     *                   type: object
     *                   properties:
     *                     id:
     *                       type: string
     *                     nome:
     *                       type: string
     *                     icon:
     *                       type: string
     *                     grupoId:
     *                       type: string
     *                       nullable: true
     *                     ordem:
     *                       type: integer
     *                     papel:
     *                       type: string
     *                       nullable: true
     *                 origem:
     *                   type: string
     *                   enum: [historico, modelo, llm]
     *                   description: Camada que sugeriu a categoria
     *                 confianca:
     *                   type: number
     *                   nullable: true
     *                   description: Confiança do modelo (0–1); só na origem "modelo"
     *             example:
     *               categoria:
     *                 id: "CAT00000000003"
     *                 nome: "Supermercado"
     *                 icon: "🛒"
     *                 grupoId: "GCT00000000001"
     *                 ordem: 1
     *                 papel: null
     *               origem: "historico"
     *               confianca: null
     *       204:
     *         description: Nenhuma camada tem sugestão para esta descrição (o form fica sem sugestão)
     *       400:
     *         description: Pedido inválido - Descrição em falta ou tipo inválido
     *       401:
     *         description: Não autenticado
     *       500:
     *         description: Erro inesperado ao calcular a sugestão
     */
    route.get(
        '/sugerir',
        isAuth,
        (req, res, next) => ctrl.sugerirCategoria(req, res, next)
    );
};
