import {Result} from "../../core/logic/Result.js";
import type {ICategoriaDTO, ICategoriasAgrupadasDTO, IInputCategoriaDTO} from "../../dto/ICategoriaDTO.js";

/**
 * Service interface for operations on `Categoria` (Category).
 * CRUD operations for the Categoria entity:
 * - Create Categoria
 * - Get Categoria by ID
 * - Get all Categories, grouped by GrupoCategoria
 * - Update Categoria
 * - Delete Categoria by ID
 * - Reorder the Categories of a group
 */
export default interface ICategoriaService {

    /**
     * Creates and persists a Categoria, at the end of its (required, active) group.
     * @param inputDTO - Input data for creating a Categoria.
     * @returns Result containing the DTO of the created Categoria.
     */
    createCategoria(inputDTO: IInputCategoriaDTO): Promise<Result<ICategoriaDTO>>;

    /**
     * Retrieves a Categoria by its ID.
     * @param id - ID of the Categoria.
     * @returns Result containing the Categoria DTO or an error.
     */
    getCategoriaById(id: string): Promise<Result<ICategoriaDTO>>;

    /**
     * Retrieves all active Categorias grouped by their active GrupoCategoria, groups and categorias by ordem.
     * Groups without categorias are included; "Sem grupo" (grupo: null) comes last and only when it has categorias.
     * @returns Result containing the grouped Categoria DTOs.
     */
    getAllCategorias(): Promise<Result<ICategoriasAgrupadasDTO[]>>;

    /**
     * Updates an existing Categoria.
     * @param updateDTO - Input data for updating the Categoria.
     * @param id - The current id of the Categoria to find in the DB before updating.
     * @returns Result containing the updated Categoria DTO.
     */
    updateCategoria(updateDTO: IInputCategoriaDTO, id: string): Promise<Result<ICategoriaDTO>>;

    /**
     * Deletes a Categoria by its ID.
     * @param id - ID of the Categoria to delete.
     * @returns Result indicating success (true) or failure.
     */
    deleteCategoriaById(id: string): Promise<Result<boolean>>;

    /**
     * Rewrites the order of the Categorias of a group (null = "Sem grupo"). The list must contain exactly all active
     * Categorias of that group.
     * @param grupoId - Domain ID of the group, or null for "Sem grupo".
     * @param ids - Domain IDs of the Categorias in the new order.
     */
    reordenarCategorias(grupoId: string | null, ids: string[]): Promise<Result<boolean>>;
}
