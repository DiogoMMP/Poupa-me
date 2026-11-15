import type {Categoria} from "../../domain/Categoria/Entities/Categoria.js";
import type {PapelCategoriaType} from "../../domain/Categoria/ValueObjects/PapelCategoria.js";

export default interface ICategoriaRepo {
    save(categoria: Categoria): Promise<Categoria>;
    /** Updates nome, icon, grupo, ordem and papel. Setting a papel takes it from the categoria that had it, in the same DB transaction. */
    update(categoria: Categoria, id: string, alteracoes?: { mudaGrupo: boolean; mudaPapel: boolean }): Promise<Categoria>;
    /** Soft delete (is_active = false); also clears the papel. */
    deleteById(id: string): Promise<void>;
    /** Ordered by group ordem ("Sem grupo" last), then ordem and id. */
    findAll(includeInactive?: boolean): Promise<Categoria[]>;
    findById(id: string): Promise<Categoria | null>;
    findActiveById(id: string): Promise<Categoria | null>;
    /** The active categoria with the given papel, if any. */
    findActiveByPapel(papel: PapelCategoriaType): Promise<Categoria | null>;
    /** max(ordem) + 1 among the active categorias of the group (null = "Sem grupo"). */
    nextOrdem(grupoId: string | null): Promise<number>;
    /** Rewrites ordem = position (1..n) of each id of the group (null = "Sem grupo"), in a single DB transaction. */
    reordenar(grupoId: string | null, ids: string[]): Promise<void>;
    /** Active categorias of the group (null = "Sem grupo"), by ordem. */
    findAllActiveByGrupo(grupoId: string | null): Promise<Categoria[]>;
}
