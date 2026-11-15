import {Result} from "../../../core/logic/Result.js";
import {Guard} from "../../../core/logic/Guard.js";
import {ValueObject} from "../../../core/domain/ValueObject.js";

/**
 * Keys of the closed colour palette of a GrupoCategoria. The database stores the key, never a hex value, so the
 * palette (key -> hex, kept in the frontend) can be tuned without touching the stored groups.
 */
export const CORES_GRUPO_CATEGORIA = [
    "turquesa",
    "verde",
    "lima",
    "amarelo",
    "laranja",
    "areia",
    "coral",
    "rosa",
    "roxo",
    "indigo",
    "azul",
    "cinza"
] as const;

/**
 * Valid colour keys for a GrupoCategoria.
 */
export type CorGrupoCategoriaType = typeof CORES_GRUPO_CATEGORIA[number];

/**
 * Properties required to create a CorGrupoCategoria value object.
 */
interface CorGrupoCategoriaProps {
    value: CorGrupoCategoriaType;
}

/**
 * Value Object representing the colour key of a GrupoCategoria.
 * Ensures only keys of the closed palette are accepted.
 */
export class CorGrupoCategoria extends ValueObject<CorGrupoCategoriaProps> {
    /** Returns the colour key */
    get value(): CorGrupoCategoriaType {
        return this.props.value;
    }

    private constructor(props: CorGrupoCategoriaProps) {
        super(props);
    }

    /** Checks whether the provided value is a key of the palette */
    public static isSupported(value: string): value is CorGrupoCategoriaType {
        return (CORES_GRUPO_CATEGORIA as readonly string[]).includes(value);
    }

    /**
     * Create a new CorGrupoCategoria value object after validating the input.
     * @param value - The colour key to create.
     * @return Result<CorGrupoCategoria> - Success with the value object or Failure with error message.
     */
    public static create(value: string): Result<CorGrupoCategoria> {
        const guardResult = Guard.againstNullOrUndefined(value, "Cor do grupo");
        if (!guardResult.succeeded) {
            return Result.fail<CorGrupoCategoria>(guardResult.message);
        }

        // The value comes from a JSON body: a number or an object must fail as unsupported, not throw on trim()
        if (typeof value !== 'string') {
            return Result.fail<CorGrupoCategoria>(`Cor do grupo '${String(value)}' is not supported by the domain.`);
        }

        const normalized = value.trim();

        if (!CorGrupoCategoria.isSupported(normalized)) {
            return Result.fail<CorGrupoCategoria>(`Cor do grupo '${value}' is not supported by the domain.`);
        }

        return Result.ok<CorGrupoCategoria>(new CorGrupoCategoria({value: normalized}));
    }
}
