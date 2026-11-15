import type {Nome} from "../../Shared/ValueObjects/Nome.js";
import type {Icon} from "../../Shared/ValueObjects/Icon.js";
import type {PapelCategoria} from "../ValueObjects/PapelCategoria.js";
import {AggregateRoot} from "../../../core/domain/AggregateRoot.js";
import {Result} from "../../../core/logic/Result.js";
import {Guard} from "../../../core/logic/Guard.js";
import type {UniqueEntityID} from "../../../core/domain/UniqueEntityID.js";

/**
 * Interface representing the properties of a Categoria entity
 */
interface CategoriaProps {
    nome: Nome;
    icon: Icon;
    /** Domain id of the GrupoCategoria; absent for categorias still in "Sem grupo". */
    grupoId?: UniqueEntityID;
    /** Position inside the group (or inside "Sem grupo"); 0 when not yet positioned. */
    ordem?: number;
    papel?: PapelCategoria;
}

/**
 * Aggregate root representing a Categoria in the system
 */
export class Categoria extends AggregateRoot<CategoriaProps> {

    /**
     * Gets the nome of the Categoria
     */
    get nome(): Nome {
        return this.props.nome;
    }

    /**
     * Gets the icon of the Categoria
     */
    get icon(): Icon {
        return this.props.icon;
    }

    /**
     * Gets the domain id of the GrupoCategoria this Categoria belongs to, if any
     */
    get grupoId(): UniqueEntityID | undefined {
        return this.props.grupoId;
    }

    /**
     * Gets the position of the Categoria inside its group
     */
    get ordem(): number {
        return this.props.ordem ?? 0;
    }

    /**
     * Gets the papel of the Categoria, if any
     */
    get papel(): PapelCategoria | undefined {
        return this.props.papel;
    }

    /**
     * Private constructor to enforce the use of the static create method for instantiation
     * @param props - The properties of the Categoria entity
     * @param id - Optional unique identifier for the Categoria entity
     * @private
     */
    private constructor(props: CategoriaProps, id?: UniqueEntityID) {
        super(props, id);
    }

    /**
     * Static factory method to create a new instance of Categoria with validation
     * @param props - The properties required to create a Categoria entity
     * @param id - Optional UniqueEntityID to restore/preserve domain id from persistence
     * @returns A Result object containing either a valid Categoria instance or an error message
     */
    public static create(props: CategoriaProps, id?: UniqueEntityID): Result<Categoria> {
        const guardedProps = [
            { argument: props.nome, argumentName: 'nome' },
            { argument: props.icon, argumentName: 'icon' }
        ];

        const guardResult = Guard.againstNullOrUndefinedBulk(guardedProps);
        if (!guardResult.succeeded) {
            return Result.fail<Categoria>(guardResult.message || 'Invalid categoria properties');
        }

        if (props.ordem !== undefined && (!Number.isInteger(props.ordem) || props.ordem < 0)) {
            return Result.fail<Categoria>('ordem must be a non-negative integer');
        }

        const categoria = new Categoria(props, id);
        return Result.ok<Categoria>(categoria);
    }
}
