import { Router } from 'express';
import { Container } from 'typedi';
import { isAuth, authorize, Role } from '../middlewares/index.js';
import type { AuthenticatedRequest } from '../middlewares/index.js';
import CategoriaController from '../../controllers/Categoria/CategoriaController.js';

const route = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Categoria:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "CAT-2026-00001"
 *         nome:
 *           type: string
 *           example: "Groceries"
 *         icon:
 *           type: string
 *           example: "🛒"
 *         grupoId:
 *           type: string
 *           nullable: true
 *           description: Domain ID of the group; null while the categoria is in "Sem grupo".
 *           example: "GCT00000000002"
 *         ordem:
 *           type: integer
 *           description: Position inside the group.
 *           example: 1
 *         papel:
 *           type: string
 *           nullable: true
 *           enum: [PagamentoCartao]
 *           example: null
 *     CategoriaInput:
 *       type: object
 *       required: [nome, icon]
 *       properties:
 *         nome:
 *           type: string
 *         icon:
 *           type: string
 *         grupoId:
 *           type: string
 *           description: Required on create; on update, moves the categoria to the end of that (active) group.
 *         papel:
 *           type: string
 *           nullable: true
 *           enum: [PagamentoCartao]
 *           description: Update only. Setting it takes it from the categoria that had it; null clears it.
 *     CategoriasAgrupadas:
 *       type: object
 *       properties:
 *         grupo:
 *           nullable: true
 *           description: The group, or null for "Sem grupo" (always last, only when it has categorias).
 *           allOf:
 *             - $ref: '#/components/schemas/GrupoCategoria'
 *         categorias:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Categoria'
 *     ReordenarCategoriasInput:
 *       type: object
 *       required: [grupoId, ids]
 *       properties:
 *         grupoId:
 *           type: string
 *           nullable: true
 *           description: Domain ID of the group, or null for "Sem grupo".
 *         ids:
 *           type: array
 *           description: Domain IDs of all active categorias of that group, in the new order.
 *           items:
 *             type: string
 */
export default (app: Router) => {
  app.use('/categoria', route);

  const ctrl = Container.get(CategoriaController);

  /**
   * @openapi
   * /categoria:
   *   post:
   *     tags:
   *       - Categoria
   *     summary: Create a new categoria
   *     description: Creates a new categoria at the end of its group (grupoId is required). Admin only.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CategoriaInput'
   *     responses:
   *       201:
   *         description: Categoria created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Categoria'
   *       400:
   *         description: Validation failed
   */
  route.post('/', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.createCategoria(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /categoria:
   *   get:
   *     tags:
   *       - Categoria
   *     summary: Get all categorias, grouped
   *     description: Returns the active categorias grouped by their active group, groups and categorias by the order defined by the Admin. Groups without categorias are included; "Sem grupo" (grupo null) comes last. Requires authentication.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Categorias grouped by group
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/CategoriasAgrupadas'
   */
  route.get('/', isAuth, (req, res, next) => ctrl.getAllCategorias(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /categoria/ordem:
   *   put:
   *     tags:
   *       - Categoria
   *     summary: Reorder the categorias of a group
   *     description: Rewrites ordem = position (1..n) in one DB transaction. The list must contain exactly all active categorias of the group (grupoId null = "Sem grupo"). Admin only.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ReordenarCategoriasInput'
   *     responses:
   *       200:
   *         description: Order saved
   *       400:
   *         description: The list is not exactly the set of active categorias of the group
   *       404:
   *         description: Grupo not found
   */
  // Declared before PUT /:id so that "ordem" is not taken as an id.
  route.put('/ordem', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.reordenarCategorias(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /categoria/{id}:
   *   get:
   *     tags:
   *       - Categoria
   *     summary: Get categoria by ID
   *     description: Returns a single categoria by domain ID. Requires authentication.
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
   *         description: The categoria
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Categoria'
   *       404:
   *         description: Not found
   */
  route.get('/:id', isAuth, (req, res, next) => ctrl.getCategoriaByDomainId(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /categoria/{id}:
   *   put:
   *     tags:
   *       - Categoria
   *     summary: Update a categoria
   *     description: Update categoria fields by ID. Admin only.
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
   *             $ref: '#/components/schemas/CategoriaInput'
   *     responses:
   *       200:
   *         description: Updated categoria
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Categoria'
   *       400:
   *         description: Validation or update error
   *       404:
   *         description: Categoria not found
   */
  route.put('/:id', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.updateCategoria(req as AuthenticatedRequest, res, next));

  /**
   * @openapi
   * /categoria/{id}:
   *   delete:
   *     tags:
   *       - Categoria
   *     summary: Delete a categoria by ID
   *     description: Removes a categoria identified by its domain ID. Admin only.
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
   *         description: Deletion failed
   *       404:
   *         description: Categoria not found
   */
  route.delete('/:id', isAuth, authorize([Role.Admin]), (req, res, next) => ctrl.deleteCategoriaByDomainId(req as AuthenticatedRequest, res, next));
};
