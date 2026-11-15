import {Result} from "../../../core/logic/Result.js";
import {Guard} from "../../../core/logic/Guard.js";
import {ValueObject} from "../../../core/domain/ValueObject.js";

/**
 * Valid tipos for a GrupoCategoria. Determines in which category selects the group is shown:
 * "Entrada" (income forms), "Saída" (expense forms) or "Ambos" (both).
 */
export type TipoGrupoCategoriaType = "Entrada" | "Saída" | "Ambos";

/**
 * List of the supported tipos, in display order.
 */
export const TIPOS_GRUPO_CATEGORIA: readonly TipoGrupoCategoriaType[] = ["Entrada", "Saída", "Ambos"];

/**
 * Properties required to create a TipoGrupoCategoria value object.
 */
interface TipoGrupoCategoriaProps {
    value: TipoGrupoCategoriaType;
}

/**
 * Value Object representing the tipo of a GrupoCategoria.
 * Ensures only supported values are accepted.
 */
export class TipoGrupoCategoria extends ValueObject<TipoGrupoCategoriaProps> {
    /** Returns the tipo value */
    get value(): TipoGrupoCategoriaType {
        return this.props.value;
    }

    private constructor(props: TipoGrupoCategoriaProps) {
        super(props);
    }

    /** Checks whether the provided value is supported by the domain */
    public static isSupported(value: string): value is TipoGrupoCategoriaType {
        return (TIPOS_GRUPO_CATEGORIA as readonly string[]).includes(value);
    }

    /**
     * Create a new TipoGrupoCategoria value object after validating the input.
     * @param value - The tipo value to create.
     * @return Result<TipoGrupoCategoria> - Success with the value object or Failure with error message.
     */
    public static create(value: string): Result<TipoGrupoCategoria> {
        const guardResult = Guard.againstNullOrUndefined(value, "Tipo do grupo");
        if (!guardResult.succeeded) {
            return Result.fail<TipoGrupoCategoria>(guardResult.message);
        }

        // The value comes from a JSON body: a number or an object must fail as unsupported, not throw on trim()
        if (typeof value !== 'string') {
            return Result.fail<TipoGrupoCategoria>(`Tipo do grupo '${String(value)}' is not supported by the domain.`);
        }

        const normalized = value.trim();

        if (!TipoGrupoCategoria.isSupported(normalized)) {
            return Result.fail<TipoGrupoCategoria>(`Tipo do grupo '${value}' is not supported by the domain.`);
        }

        return Result.ok<TipoGrupoCategoria>(new TipoGrupoCategoria({value: normalized}));
    }
}
