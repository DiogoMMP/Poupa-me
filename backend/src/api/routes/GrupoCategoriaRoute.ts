import { Router } from 'express';
import { Container } from 'typedi';
import { isAuth, authorize, Role } from '../middlewares/index.js';
import type { AuthenticatedRequest } from '../middlewares/index.js';
import GrupoCategoriaController from '../../controllers/GrupoCategoria/GrupoCategoriaController.js';

const route = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     GrupoCategoria:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "GCT00000000001"
 *         nome:
 *           type: string
 *           example: "Alimentação"
 *         tipo:
 *           type: string
 *           enum: [Entrada, Saída, Ambos]
 *           example: "Saída"
 *         cor:
 *           type: string
 *           enum: [turquesa, verde, lima, amarelo, laranja, areia, coral, rosa, roxo, indigo, azul, cinza]
 *           example: "laranja"
 *         ordem:
 *           type: integer
 *           example: 2
 *     GrupoCategoriaInput:
 *       type: object
 *       required: [nome, tipo, cor]
 *       properties:
 *         nome:
 *           type: string
 *         tipo:
 *           type: string
 *           enum: [Entrada, Saída, Ambos]
 *         cor:
 *           type: string
 *           enum: [turquesa, verde, lima, amarelo, laranja, areia, coral, rosa, roxo, indigo, azul, cinza]
 *     ReordenarGruposInput:
 *       type: object
 *       required: [ids]
 *       properties:
 *         ids:
 *           type: array
 *           description: Domain IDs of all active groups, in the new order.
 *           items:
 *             type: string
 *           example: ["GCT00000000002", "GCT00000000001"]
 */
export default (app: Router) => {
  app.use('/grupo-categoria', route);

  const ctrl = Container.get(GrupoCategoriaController);

  /**
   * @openapi
   * /grupo-categoria:
   *   post:
   *     tags:
   *       - GrupoCategoria
   *     summary: Create a new grupo de categorias
   *     description: Creates a group at the end of the order. Admin only.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GrupoCategoriaInput'
   *     responses:
   *       201:
   *         description: Grupo created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GrupoCategoria'
   *       400:
   *         description: Validation failed
   */
  route.post('/', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.createGrupo(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /grupo-categoria:
   *   get:
   *     tags:
   *       - GrupoCategoria
   *     summary: Get all grupos de categorias
   *     description: Returns the active groups by ordem. Requires authentication.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of groups
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/GrupoCategoria'
   */
  route.get('/', isAuth, (req, res, next) => ctrl.getAllGrupos(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /grupo-categoria/ordem:
   *   put:
   *     tags:
   *       - GrupoCategoria
   *     summary: Reorder the grupos de categorias
   *     description: Rewrites ordem = position (1..n) in one DB transaction. The list must contain exactly all active groups. Admin only.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ReordenarGruposInput'
   *     responses:
   *       200:
   *         description: Order saved
   *       400:
   *         description: The list is not exactly the set of active groups
   */
  // Declared before PUT /:id so that "ordem" is not taken as an id.
  route.put('/ordem', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.reordenarGrupos(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /grupo-categoria/{id}:
   *   get:
   *     tags:
   *       - GrupoCategoria
   *     summary: Get grupo de categorias by ID
   *     description: Returns a single active group by domain ID. Requires authentication.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The group
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GrupoCategoria'
   *       404:
   *         description: Not found
   */
  route.get('/:id', isAuth, (req, res, next) => ctrl.getGrupoByDomainId(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /grupo-categoria/{id}:
   *   put:
   *     tags:
   *       - GrupoCategoria
   *     summary: Update a grupo de categorias
   *     description: Updates nome, tipo and cor of a group. Admin only.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GrupoCategoriaInput'
   *     responses:
   *       200:
   *         description: Updated group
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GrupoCategoria'
   *       400:
   *         description: Validation or update error
   *       404:
   *         description: Grupo not found
   */
  route.put('/:id', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.updateGrupo(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /grupo-categoria/{id}:
   *   delete:
   *     tags:
   *       - GrupoCategoria
   *     summary: Delete a grupo de categorias by ID
   *     description: Soft-deletes a group (frees its nome). Blocked while the group has active categorias. Admin only.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Deletion successful
   *       400:
   *         description: The group still has active categorias
   *       404:
   *         description: Grupo not found
   */
  route.delete('/:id', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.deleteGrupoByDomainId(req as AuthenticatedRequest, res, next));
};
