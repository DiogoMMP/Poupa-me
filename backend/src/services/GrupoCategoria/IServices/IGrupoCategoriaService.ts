import type {Result} from "../../../core/logic/Result.js";
import type {IGrupoCategoriaDTO, IInputGrupoCategoriaDTO} from "../../../dto/IGrupoCategoriaDTO.js";

/**
 * Service interface for operations on `GrupoCategoria` (group of categorias):
 * - Create, get, list (by ordem), update and soft-delete a group
 * - Reorder all active groups in one batch
 */
export default interface IGrupoCategoriaService {

    /**
     * Creates a GrupoCategoria at the end of the order (max(ordem) + 1).
     */
    createGrupo(inputDTO: IInputGrupoCategoriaDTO): Promise<Result<IGrupoCategoriaDTO>>;

    /**
     * Retrieves an active GrupoCategoria by its domain ID.
     */
    getGrupoById(id: string): Promise<Result<IGrupoCategoriaDTO>>;

    /**
     * Retrieves all active GrupoCategorias, by ordem.
     */
    getAllGrupos(): Promise<Result<IGrupoCategoriaDTO[]>>;

    /**
     * Updates nome, tipo and cor of a GrupoCategoria.
     */
    updateGrupo(updateDTO: Partial<IInputGrupoCategoriaDTO>, id: string): Promise<Result<IGrupoCategoriaDTO>>;

    /**
     * Soft-deletes a GrupoCategoria. Fails while the group still has active categorias.
     */
    deleteGrupoById(id: string): Promise<Result<boolean>>;

    /**
     * Rewrites the order of the groups. The list must contain exactly all active groups.
     */
    reordenarGrupos(ids: string[]): Promise<Result<boolean>>;
}
