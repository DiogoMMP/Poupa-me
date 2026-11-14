import { Mapper } from '../core/infra/Mapper.js';
import { Result } from '../core/logic/Result.js';
import { Categoria } from "../domain/Categoria/Entities/Categoria.js";
import { Icon } from "../domain/Shared/ValueObjects/Icon.js";
import { Nome } from "../domain/Shared/ValueObjects/Nome.js";
import { PapelCategoria } from "../domain/Categoria/ValueObjects/PapelCategoria.js";
import { UniqueEntityID } from '../core/domain/UniqueEntityID.js';
import type { ICategoriaDTO } from '../dto/ICategoriaDTO.js';

/**
 * Mapper class for the Categoria entity. This class is responsible for converting between the domain model and the
 * persistence model, as well as creating Data Transfer Objects (DTOs) for use in the application. It includes methods
 * for mapping raw data to a Categoria domain entity, converting a Categoria domain entity to a persistence format,
 * and creating a DTO from a Categoria domain entity. The mapper ensures that the data is correctly transformed and
 * validated according to the rules defined in the domain model.
 */
export class CategoriaMap extends Mapper<Categoria> {

    /**
     * Converts raw data to a Categoria domain entity. This method takes in raw data, validates it, and attempts to
     * create a Categoria instance using the domain model's create method. If the raw data is invalid or if the creation
     * of the Categoria entity fails, it returns null. This method is essential for ensuring that only valid data is
     * transformed into domain entities, maintaining the integrity of the domain model.
     * @param raw - The raw data that needs to be converted into a Categoria domain entity. This data is typically
     * retrieved from the database or received from an external source and may not be in the correct format or may contain invalid values.
     * @returns A Promise that resolves to a Categoria domain entity if the conversion is successful, or null if the
     * raw data is invalid or if the creation of the Categoria entity fails.
     */
    public static async toDomain(raw: unknown): Promise<Categoria | null> {
        if (!raw) return null;
        const r = raw as Record<string, unknown>;

        const nameResult = Nome.create((r.nome as string) || '');
        const iconResult = Icon.create((r.icon as string) || '');

        const result = Result.combine([nameResult, iconResult]);

        if (result.isFailure) {
            return null;
        }

        // The group is only known when the `grupo` relation was loaded; nested categorias (e.g. inside a transação)
        // are mapped without it and stay without grupoId.
        const grupo = r.grupo as Record<string, unknown> | null | undefined;
        const grupoDomainId = grupo?.domainId as string | undefined;

        // An unknown papel is ignored rather than making the whole categoria unreadable.
        const papelResult = r.papel ? PapelCategoria.create(r.papel as string) : null;

        const categoriaOrError = Categoria.create(
            {
                nome: nameResult.getValue(),
                icon: iconResult.getValue(),
                grupoId: grupoDomainId ? new UniqueEntityID(grupoDomainId) : undefined,
                ordem: typeof r.ordem === 'number' ? r.ordem : undefined,
                papel: papelResult?.isSuccess ? papelResult.getValue() : undefined
            },
            new UniqueEntityID((r.domainId as string) || (r.id as string))
        );

        return categoriaOrError.isSuccess ? categoriaOrError.getValue() : null;
    }

    /**
     * Converts a Categoria domain entity to a persistence format. This method takes a Categoria instance and transforms it
     * into a plain JavaScript object that can be easily stored in a database. The resulting object includes the domain ID,
     * nome, icon, ordem and papel of the Categoria entity (the group relation is resolved by the repository). This method is crucial for ensuring that the data is correctly
     * formatted for persistence while maintaining the necessary information from the domain entity.
     * @param categoria - The Categoria domain entity that needs to be converted into a persistence format. This object
     * contains the properties and values that represent the state of the Categoria in the domain model.
     * @returns A plain JavaScript object that represents the Categoria in a format suitable for persistence. This object
     * includes the domain ID, nome, and icon properties extracted from the Categoria domain entity.
     */
    public static toPersistence(categoria: Categoria): Record<string, unknown> {
        return {
            domainId: categoria.id.toString(),
            nome: categoria.nome.value,
            icon: categoria.icon.value,
            ordem: categoria.ordem,
            papel: categoria.papel?.value ?? null
        };
    }

    /**
     * Creates a Data Transfer Object (DTO) from a Categoria domain entity. This method takes a Categoria instance and transforms it
     * into a plain JavaScript object that can be easily used for data transfer, such as in API responses. The resulting DTO
     * includes the id, nome, and icon properties of the Categoria entity. This method is essential for ensuring that the data
     * is correctly formatted for transfer while maintaining the necessary information from the domain entity.
     * @param categoria - The Categoria domain entity that needs to be converted into a DTO. This object contains the
     * properties and values that represent the state of the Categoria in the domain model.
     * @returns A plain JavaScript object that represents the Categoria in a format suitable for data transfer. This
     * object includes the id, nome, and icon properties extracted from the Categoria domain entity.
     */
    public static toDTO(categoria: Categoria): ICategoriaDTO {
        return {
            id: categoria.id.toString(),
            nome: categoria.nome.value,
            icon: categoria.icon.value,
            grupoId: categoria.grupoId?.toString() ?? null,
            ordem: categoria.ordem,
            papel: categoria.papel?.value ?? null
        };
    }
}