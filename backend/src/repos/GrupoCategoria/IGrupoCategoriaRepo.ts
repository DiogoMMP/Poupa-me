import type {GrupoCategoria} from "../../domain/GrupoCategoria/Entities/GrupoCategoria.js";

export default interface IGrupoCategoriaRepo {
    save(grupo: GrupoCategoria): Promise<GrupoCategoria>;
    update(grupo: GrupoCategoria, id: string): Promise<GrupoCategoria>;
    /** Soft delete (is_active = false). */
    deleteIfEmpty(id: string): Promise<number>;
    /** All groups by ordem (ties by id); inactive ones only when includeInactive is true. */
    findAll(includeInactive?: boolean): Promise<GrupoCategoria[]>;
    findById(id: string): Promise<GrupoCategoria | null>;
    findActiveById(id: string): Promise<GrupoCategoria | null>;
    /** Number of active categorias in the group. */
    /** Rewrites ordem = position (1..n) of each id, in a single DB transaction. */
    reordenar(ids: string[]): Promise<void>;
    /** max(ordem) + 1 among the active groups. */
    nextOrdem(): Promise<number>;
}
