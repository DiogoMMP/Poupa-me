import {Result} from "../../../core/logic/Result.js";
import {Guard} from "../../../core/logic/Guard.js";
import {ValueObject} from "../../../core/domain/ValueObject.js";

/**
 * Valid origens of an automatic categoria suggestion: the layer that proposed it.
 * "historico" (the user's own past transactions), "modelo" (the categorizador Space) or "llm" (HF Inference).
 */
export type OrigemSugestaoType = "historico" | "modelo" | "llm";

/**
 * List of the supported origens.
 */
export const ORIGENS_SUGESTAO: readonly OrigemSugestaoType[] = ["historico", "modelo", "llm"];

/**
 * Properties required to create an OrigemSugestao value object.
 */
interface OrigemSugestaoProps {
    value: OrigemSugestaoType;
}

/**
 * Value Object representing the origem of the categoria suggestion stored on a transaction.
 * Ensures only supported values are accepted.
 */
export class OrigemSugestao extends ValueObject<OrigemSugestaoProps> {
    /** Returns the origem value */
    get value(): OrigemSugestaoType {
        return this.props.value;
    }

    private constructor(props: OrigemSugestaoProps) {
        super(props);
    }

    /** Checks whether the provided value is supported by the domain */
    public static isSupported(value: string): value is OrigemSugestaoType {
        return (ORIGENS_SUGESTAO as readonly string[]).includes(value);
    }

    /**
     * Create a new OrigemSugestao value object after validating the input.
     * @param value - The origem value to create.
     * @return Result<OrigemSugestao> - Success with the value object or Failure with error message.
     */
    public static create(value: string): Result<OrigemSugestao> {
        const guardResult = Guard.againstNullOrUndefined(value, "OrigemSugestao");
        if (!guardResult.succeeded) {
            return Result.fail<OrigemSugestao>(guardResult.message);
        }

        const normalized = String(value).trim();

        if (!OrigemSugestao.isSupported(normalized)) {
            return Result.fail<OrigemSugestao>(`OrigemSugestao '${value}' is not supported by the domain.`);
        }

        return Result.ok<OrigemSugestao>(new OrigemSugestao({value: normalized}));
    }
}
