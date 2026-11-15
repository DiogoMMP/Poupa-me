import type {NextFunction, Request, Response} from 'express';

/**
 * Controller interface for GrupoCategoria operations
 */
export default interface IGrupoCategoriaController {

    /**
     * Creates a new GrupoCategoria
     */
    createGrupo(req: Request, res: Response, next: NextFunction): Promise<Response | void>;

    /**
     * Retrieves a GrupoCategoria by domain ID
     */
    getGrupoByDomainId(req: Request, res: Response, next: NextFunction): Promise<Response | void>;

    /**
     * Retrieves all GrupoCategorias, by ordem
     */
    getAllGrupos(req: Request, res: Response, next: NextFunction): Promise<Response | void>;

    /**
     * Updates a GrupoCategoria
     */
    updateGrupo(req: Request, res: Response, next: NextFunction): Promise<Response | void>;

    /**
     * Deletes (soft) a GrupoCategoria by domain ID
     */
    deleteGrupoByDomainId(req: Request, res: Response, next: NextFunction): Promise<Response | void>;

    /**
     * Rewrites the order of all active GrupoCategorias
     */
    reordenarGrupos(req: Request, res: Response, next: NextFunction): Promise<Response | void>;
}
