import {Result} from "../../../core/logic/Result.js";
import {Guard} from "../../../core/logic/Guard.js";
import {ValueObject} from "../../../core/domain/ValueObject.js";

/**
 * Valid papéis (roles) of a Categoria. A papel marks the categoria the system uses for a specific automatic
 * movimento and belongs to at most one active categoria. For now there is only 'PagamentoCartao' (the categoria of
 * the "Pagamento <cartão>" transação).
 */
export type PapelCategoriaType = "PagamentoCartao";

/**
 * List of the supported papéis.
 */
export const PAPEIS_CATEGORIA: readonly PapelCategoriaType[] = ["PagamentoCartao"];

/**
 * Properties required to create a PapelCategoria value object.
 */
interface PapelCategoriaProps {
    value: PapelCategoriaType;
}

/**
 * Value Object representing the papel of a Categoria.
 * Ensures only supported values are accepted.
 */
export class PapelCategoria extends ValueObject<PapelCategoriaProps> {
    /** Returns the papel value */
    get value(): PapelCategoriaType {
        return this.props.value;
    }

    private constructor(props: PapelCategoriaProps) {
        super(props);
    }

    /** Checks whether the provided value is supported by the domain */
    public static isSupported(value: string): value is PapelCategoriaType {
        return (PAPEIS_CATEGORIA as readonly string[]).includes(value);
    }

    /**
     * Create a new PapelCategoria value object after validating the input.
     * @param value - The papel value to create.
     * @return Result<PapelCategoria> - Success with the value object or Failure with error message.
     */
    public static create(value: string): Result<PapelCategoria> {
        const guardResult = Guard.againstNullOrUndefined(value, "Papel da categoria");
        if (!guardResult.succeeded) {
            return Result.fail<PapelCategoria>(guardResult.message);
        }

        // The value comes from a JSON body: a number or an object must fail as unsupported, not throw on trim()
        if (typeof value !== 'string') {
            return Result.fail<PapelCategoria>(`Papel da categoria '${String(value)}' is not supported by the domain.`);
        }

        const normalized = value.trim();

        if (!PapelCategoria.isSupported(normalized)) {
            return Result.fail<PapelCategoria>(`Papel da categoria '${value}' is not supported by the domain.`);
        }

        return Result.ok<PapelCategoria>(new PapelCategoria({value: normalized}));
    }
}
