import type {Nome} from "../../Shared/ValueObjects/Nome.js";
import type {TipoGrupoCategoria} from "../ValueObjects/TipoGrupoCategoria.js";
import type {CorGrupoCategoria} from "../ValueObjects/CorGrupoCategoria.js";
import {AggregateRoot} from "../../../core/domain/AggregateRoot.js";
import {Result} from "../../../core/logic/Result.js";
import {Guard} from "../../../core/logic/Guard.js";
import type {UniqueEntityID} from "../../../core/domain/UniqueEntityID.js";

/**
 * Interface representing the properties of a GrupoCategoria entity
 */
interface GrupoCategoriaProps {
    nome: Nome;
    tipo: TipoGrupoCategoria;
    cor: CorGrupoCategoria;
    ordem: number;
}

/**
 * Aggregate root representing a group of categorias (e.g. "Alimentação"), with its tipo, colour and the position
 * defined by the Admin. The group has no icon: it is shown as a plain title.
 */
export class GrupoCategoria extends AggregateRoot<GrupoCategoriaProps> {

    /**
     * Gets the nome of the GrupoCategoria
     */
    get nome(): Nome {
        return this.props.nome;
    }

    /**
     * Gets the tipo of the GrupoCategoria
     */
    get tipo(): TipoGrupoCategoria {
        return this.props.tipo;
    }

    /**
     * Gets the colour key of the GrupoCategoria
     */
    get cor(): CorGrupoCategoria {
        return this.props.cor;
    }

    /**
     * Gets the position of the GrupoCategoria (1..n)
     */
    get ordem(): number {
        return this.props.ordem;
    }

    /**
     * Private constructor to enforce the use of the static create method for instantiation
     * @param props - The properties of the GrupoCategoria entity
     * @param id - Optional unique identifier for the GrupoCategoria entity
     * @private
     */
    private constructor(props: GrupoCategoriaProps, id?: UniqueEntityID) {
        super(props, id);
    }

    /**
     * Static factory method to create a new instance of GrupoCategoria with validation
     * @param props - The properties required to create a GrupoCategoria entity
     * @param id - Optional UniqueEntityID to restore/preserve domain id from persistence
     * @returns A Result object containing either a valid GrupoCategoria instance or an error message
     */
    public static create(props: GrupoCategoriaProps, id?: UniqueEntityID): Result<GrupoCategoria> {
        const guardedProps = [
            { argument: props.nome, argumentName: 'nome' },
            { argument: props.tipo, argumentName: 'tipo' },
            { argument: props.cor, argumentName: 'cor' },
            { argument: props.ordem, argumentName: 'ordem' }
        ];

        const guardResult = Guard.againstNullOrUndefinedBulk(guardedProps);
        if (!guardResult.succeeded) {
            return Result.fail<GrupoCategoria>(guardResult.message || 'Invalid grupo categoria properties');
        }

        if (!Number.isInteger(props.ordem) || props.ordem < 1) {
            return Result.fail<GrupoCategoria>('ordem must be an integer greater than or equal to 1');
        }

        const grupo = new GrupoCategoria(props, id);
        return Result.ok<GrupoCategoria>(grupo);
    }
}
