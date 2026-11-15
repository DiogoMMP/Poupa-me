import type { Request, Response, NextFunction } from 'express';
import { Service, Inject } from 'typedi';
import type IGrupoCategoriaController from './IGrupoCategoriaController.js';
import type IGrupoCategoriaService from '../../services/GrupoCategoria/IGrupoCategoriaService.js';
import type { IInputGrupoCategoriaDTO, IReordenarDTO } from '../../dto/IGrupoCategoriaDTO.js';
import { failureStatus } from '../../core/infra/FailureStatus.js';

/**
 * Controller implementation for GrupoCategoria operations.
 */
@Service()
export default class GrupoCategoriaController implements IGrupoCategoriaController {
    constructor(
        @Inject('GrupoCategoriaService') private grupoCategoriaService: IGrupoCategoriaService
    ) {}

    /**
     * Creates a new GrupoCategoria.
     */
    public async createGrupo(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const result = await this.grupoCategoriaService.createGrupo(req.body as IInputGrupoCategoriaDTO);
            if (result.isFailure) return res.status(400).json({ error: result.error });
            return res.status(201).json(result.getValue());
        } catch (e) {
            next(e);
        }
    }

    /**
     * Retrieves all GrupoCategorias, by ordem.
     */
    public async getAllGrupos(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const result = await this.grupoCategoriaService.getAllGrupos();
            if (result.isFailure) return res.status(500).json({ error: result.error });
            return res.status(200).json(result.getValue());
        } catch (e) {
            next(e);
        }
    }

    /**
     * Retrieves a GrupoCategoria by its domain ID.
     */
    public async getGrupoByDomainId(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const id = req.params.id as string;
            if (!id) return res.status(400).json({ error: 'ID is required' });

            const result = await this.grupoCategoriaService.getGrupoById(id);
            if (result.isFailure) return res.status(failureStatus(result.error)).json({ error: result.error });
            return res.status(200).json(result.getValue());
        } catch (e) {
            next(e);
        }
    }

    /**
     * Updates an existing GrupoCategoria identified by its domain ID.
     */
    public async updateGrupo(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const id = req.params.id as string;
            if (!id) return res.status(400).json({ error: 'ID is required to locate grupo categoria' });

            const result = await this.grupoCategoriaService.updateGrupo(req.body as Partial<IInputGrupoCategoriaDTO>, id);
            if (result.isFailure) return res.status(failureStatus(result.error)).json({ error: result.error });
            return res.status(200).json(result.getValue());
        } catch (e) {
            next(e);
        }
    }

    /**
     * Deletes (soft) a GrupoCategoria identified by its domain ID.
     */
    public async deleteGrupoByDomainId(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const id = req.params.id as string;
            if (!id) return res.status(400).json({ error: 'ID is required' });

            const result = await this.grupoCategoriaService.deleteGrupoById(id);
            if (result.isFailure) return res.status(failureStatus(result.error)).json({ error: result.error });
            return res.status(200).json({ success: result.getValue() });
        } catch (e) {
            next(e);
        }
    }

    /**
     * Rewrites the order of all active GrupoCategorias.
     */
    public async reordenarGrupos(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const body = (req.body ?? {}) as Partial<IReordenarDTO>;
            const result = await this.grupoCategoriaService.reordenarGrupos(body.ids as string[]);
            if (result.isFailure) return res.status(failureStatus(result.error)).json({ error: result.error });
            return res.status(200).json({ success: result.getValue() });
        } catch (e) {
            next(e);
        }
    }
}
