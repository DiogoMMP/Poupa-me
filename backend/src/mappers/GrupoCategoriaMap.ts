import { Mapper } from '../core/infra/Mapper.js';
import { Result } from '../core/logic/Result.js';
import { GrupoCategoria } from '../domain/GrupoCategoria/Entities/GrupoCategoria.js';
import { TipoGrupoCategoria } from '../domain/GrupoCategoria/ValueObjects/TipoGrupoCategoria.js';
import { CorGrupoCategoria } from '../domain/GrupoCategoria/ValueObjects/CorGrupoCategoria.js';
import { Nome } from '../domain/Shared/ValueObjects/Nome.js';
import { UniqueEntityID } from '../core/domain/UniqueEntityID.js';
import type { IGrupoCategoriaDTO } from '../dto/IGrupoCategoriaDTO.js';

/**
 * Mapper class for the GrupoCategoria entity: converts between the persistence row, the domain entity and the DTO.
 */
export class GrupoCategoriaMap extends Mapper<GrupoCategoria> {

    /**
     * Converts raw persistence data to a GrupoCategoria domain entity.
     * @param raw - The persistence row (GrupoCategoriaEntity).
     * @returns The domain entity, or null if the raw data is invalid.
     */
    public static toDomain(raw: unknown): GrupoCategoria | null {
        if (!raw) return null;
        const r = raw as Record<string, unknown>;

        const nomeResult = Nome.create((r.nome as string) || '');
        const tipoResult = TipoGrupoCategoria.create((r.tipo as string) || '');
        const corResult = CorGrupoCategoria.create((r.cor as string) || '');

        const result = Result.combine([nomeResult, tipoResult, corResult]);
        if (result.isFailure) return null;

        const grupoOrError = GrupoCategoria.create(
            {
                nome: nomeResult.getValue(),
                tipo: tipoResult.getValue(),
                cor: corResult.getValue(),
                ordem: Number(r.ordem)
            },
            new UniqueEntityID((r.domainId as string) || (r.id as string))
        );

        return grupoOrError.isSuccess ? grupoOrError.getValue() : null;
    }

    /**
     * Converts a GrupoCategoria domain entity to a persistence format.
     */
    public static toPersistence(grupo: GrupoCategoria): Record<string, unknown> {
        return {
            domainId: grupo.id.toString(),
            nome: grupo.nome.value,
            tipo: grupo.tipo.value,
            cor: grupo.cor.value,
            ordem: grupo.ordem
        };
    }

    /**
     * Creates a DTO from a GrupoCategoria domain entity.
     */
    public static toDTO(grupo: GrupoCategoria): IGrupoCategoriaDTO {
        return {
            id: grupo.id.toString(),
            nome: grupo.nome.value,
            tipo: grupo.tipo.value,
            cor: grupo.cor.value,
            ordem: grupo.ordem
        };
    }
}
