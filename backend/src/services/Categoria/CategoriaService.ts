import { Service, Inject } from 'typedi';
import { Result } from '../../core/logic/Result.js';
import { mensagemErro } from '../../core/logic/ErroPersistencia.js';
import type { ICategoriaDTO, ICategoriasAgrupadasDTO, IInputCategoriaDTO } from '../../dto/ICategoriaDTO.js';
import type ICategoriaService from './ICategoriaService.js';
import type ICategoriaRepo from '../../repos/Categoria/ICategoriaRepo.js';
import type IGrupoCategoriaRepo from '../../repos/GrupoCategoria/IGrupoCategoriaRepo.js';
import { Categoria } from '../../domain/Categoria/Entities/Categoria.js';
import { PapelCategoria } from '../../domain/Categoria/ValueObjects/PapelCategoria.js';
import { Nome } from '../../domain/Shared/ValueObjects/Nome.js';
import { Icon } from '../../domain/Shared/ValueObjects/Icon.js';
import { Result as CoreResult } from '../../core/logic/Result.js';
import { UniqueEntityID } from '../../core/domain/UniqueEntityID.js';
import { CategoriaMap } from '../../mappers/CategoriaMap.js';
import { GrupoCategoriaMap } from '../../mappers/GrupoCategoriaMap.js';
import { isConjuntoExato } from '../../core/logic/ConjuntoExato.js';

/** Índices únicos de categoria que o Admin pode violar ao preencher o formulário. */
const MENSAGENS_UNICIDADE: Record<string, string> = {
    UQ_categoria_nome_ativo: 'Já existe uma categoria com esse nome.',
    UQ_categoria_papel_ativo: 'Já existe outra categoria com esse papel.'
};

@Service()
export default class CategoriaService implements ICategoriaService {
    /** Validates a papel sent by the client (create and update share it). */
    private static parsePapel(valor: unknown): CoreResult<PapelCategoria> {
        return PapelCategoria.create(valor as string);
    }

    constructor(
        @Inject('CategoriaRepo') private categoriaRepo: ICategoriaRepo,
        @Inject('GrupoCategoriaRepo') private grupoCategoriaRepo: IGrupoCategoriaRepo,
        @Inject('logger') private logger: { error: (...args: unknown[]) => void }
    ) {}

    /**
     * Creates and persists a Categoria. The grupo is required and must be active; the categoria goes to the end of it.
     * An optional papel is moved to the new categoria from the one that had it.
     */
    public async createCategoria(inputDTO: IInputCategoriaDTO): Promise<Result<ICategoriaDTO>> {
        try {
            if (!inputDTO) return Result.fail<ICategoriaDTO>('No categoria data provided');

            const nameResult = Nome.create(inputDTO.nome);
            const iconResult = Icon.create(inputDTO.icon);

            const combine = CoreResult.combine([nameResult, iconResult]);
            if (combine.isFailure) return Result.fail<ICategoriaDTO>(combine.error || 'Invalid categoria data');

            if (!inputDTO.grupoId || typeof inputDTO.grupoId !== 'string') {
                return Result.fail<ICategoriaDTO>('O grupo da categoria é obrigatório.');
            }
            const grupo = await this.grupoCategoriaRepo.findActiveById(inputDTO.grupoId);
            if (!grupo) return Result.fail<ICategoriaDTO>(`O grupo ${inputDTO.grupoId} não existe ou foi apagado.`);

            // papel is optional; when given it is taken from the categoria that had it (see CategoriaRepo.save)
            let papel: PapelCategoria | undefined;
            if (inputDTO.papel) {
                const papelResult = CategoriaService.parsePapel(inputDTO.papel);
                if (papelResult.isFailure) return Result.fail<ICategoriaDTO>(papelResult.error as string);
                papel = papelResult.getValue();
            }

            const categoriaOrError = Categoria.create({
                nome: nameResult.getValue(),
                icon: iconResult.getValue(),
                grupoId: grupo.id,
                ordem: await this.categoriaRepo.nextOrdem(inputDTO.grupoId),
                papel
            });

            if (categoriaOrError.isFailure) return Result.fail<ICategoriaDTO>(categoriaOrError.errorValue() as unknown as string);

            const saved = await this.categoriaRepo.save(categoriaOrError.getValue());
            return Result.ok<ICategoriaDTO>(CategoriaMap.toDTO(saved) as ICategoriaDTO);
        } catch (e) {
            this.logger.error('CategoriaService.createCategoria error: %o', e);
            return Result.fail<ICategoriaDTO>(mensagemErro(e, 'Não foi possível criar a categoria.', MENSAGENS_UNICIDADE));
        }
    }

    /**
     * Retrieves all active Categorias grouped by their active group, both by ordem. Groups without categorias are
     * included (the Admin page needs them); "Sem grupo" comes last and only when it has categorias.
     */
    public async getAllCategorias(): Promise<Result<ICategoriasAgrupadasDTO[]>> {
        try {
            const [grupos, categorias] = await Promise.all([
                this.grupoCategoriaRepo.findAll(),
                this.categoriaRepo.findAll()
            ]);

            const porGrupo = new Map<string, ICategoriaDTO[]>(grupos.map(g => [g.id.toString(), []]));
            const semGrupo: ICategoriaDTO[] = [];

            // categoriaRepo.findAll already sorts by ordem (and id), so each bucket keeps that order.
            for (const c of categorias) {
                const dto = CategoriaMap.toDTO(c);
                const lista = dto.grupoId ? porGrupo.get(dto.grupoId) : undefined;
                // A categoria pointing at an inactive group (should not happen: deleting a group with active
                // categorias is blocked) is shown in "Sem grupo" rather than lost.
                (lista ?? semGrupo).push(dto);
            }

            const agrupadas: ICategoriasAgrupadasDTO[] = grupos.map(g => ({
                grupo: GrupoCategoriaMap.toDTO(g),
                categorias: porGrupo.get(g.id.toString()) ?? []
            }));
            if (semGrupo.length > 0) agrupadas.push({ grupo: null, categorias: semGrupo });

            return Result.ok<ICategoriasAgrupadasDTO[]>(agrupadas);
        } catch (e) {
            this.logger.error('CategoriaService.getAllCategorias error: %o', e);
            return Result.fail<ICategoriasAgrupadasDTO[]>(mensagemErro(e, 'Não foi possível obter as categorias.'));
        }
    }

    /**
     * Retrieves a Categoria by its domain ID.
     */
    public async getCategoriaById(id: string): Promise<Result<ICategoriaDTO>> {
        try {
            if (!id) return Result.fail<ICategoriaDTO>('ID is required');
            const categoria = await this.categoriaRepo.findById(id);
            if (!categoria) return Result.fail<ICategoriaDTO>(`Categoria not found with id=${id}`);
            return Result.ok<ICategoriaDTO>(CategoriaMap.toDTO(categoria) as ICategoriaDTO);
        } catch (e) {
            this.logger.error('CategoriaService.getCategoriaById error: %o', e);
            return Result.fail<ICategoriaDTO>(mensagemErro(e, 'Não foi possível obter a categoria.'));
        }
    }

    /**
     * Updates an existing Categoria identified by its domain ID. A new grupoId (must be active) moves the categoria
     * to the end of that group; a categoria cannot be taken back to "Sem grupo". papel: undefined keeps it, null
     * clears it, a value takes it from the categoria that had it.
     */
    public async updateCategoria(updateDTO: IInputCategoriaDTO, id: string): Promise<Result<ICategoriaDTO>> {
        try {
            if (!updateDTO) return Result.fail<ICategoriaDTO>('No update data provided');
            if (!id) return Result.fail<ICategoriaDTO>('ID is required to locate categoria');

            // Only active categorias can be edited: a deleted one must not receive a group or a papel
            const existing = await this.categoriaRepo.findActiveById(id);
            if (!existing) return Result.fail<ICategoriaDTO>(`Categoria not found with id=${id}`);

            const name = updateDTO.nome ? Nome.create(updateDTO.nome) : CoreResult.ok(existing.nome);
            const icon = updateDTO.icon ? Icon.create(updateDTO.icon) : CoreResult.ok(existing.icon);

            const combine = CoreResult.combine([name, icon]);
            if (combine.isFailure) return Result.fail<ICategoriaDTO>(combine.error || 'Invalid update data');

            let grupoId: UniqueEntityID | undefined = existing.grupoId;
            let ordem = existing.ordem;
            let mudaGrupo = false;
            if (updateDTO.grupoId !== undefined && updateDTO.grupoId !== existing.grupoId?.toString()) {
                if (!updateDTO.grupoId) {
                    return Result.fail<ICategoriaDTO>('Não é possível tirar uma categoria do grupo; escolha outro grupo.');
                }
                if (typeof updateDTO.grupoId !== 'string') return Result.fail<ICategoriaDTO>('Grupo inválido.');
                const grupo = await this.grupoCategoriaRepo.findActiveById(updateDTO.grupoId);
                if (!grupo) return Result.fail<ICategoriaDTO>(`O grupo ${updateDTO.grupoId} não existe ou foi apagado.`);
                grupoId = grupo.id;
                ordem = await this.categoriaRepo.nextOrdem(updateDTO.grupoId);
                mudaGrupo = true;
            }

            // papel: undefined keeps it (and it is not written, so a concurrent change made elsewhere is not undone)
            let papel: PapelCategoria | undefined = existing.papel;
            const mudaPapel = updateDTO.papel !== undefined;
            if (updateDTO.papel === null) {
                papel = undefined;
            } else if (updateDTO.papel !== undefined) {
                const papelResult = CategoriaService.parsePapel(updateDTO.papel);
                if (papelResult.isFailure) return Result.fail<ICategoriaDTO>(papelResult.error as string);
                papel = papelResult.getValue();
            }

            const categoriaOrError = Categoria.create(
                { nome: name.getValue(), icon: icon.getValue(), grupoId, ordem, papel },
                existing.id
            );
            if (categoriaOrError.isFailure) return Result.fail<ICategoriaDTO>(categoriaOrError.errorValue() as unknown as string);

            const updated = await this.categoriaRepo.update(categoriaOrError.getValue(), id, { mudaGrupo, mudaPapel });
            return Result.ok<ICategoriaDTO>(CategoriaMap.toDTO(updated) as ICategoriaDTO);
        } catch (e) {
            this.logger.error('CategoriaService.updateCategoria error: %o', e);
            return Result.fail<ICategoriaDTO>(mensagemErro(e, 'Não foi possível atualizar a categoria.', MENSAGENS_UNICIDADE));
        }
    }

    /**
     * Deletes a Categoria by its domain ID.
     */
    public async deleteCategoriaById(id: string): Promise<Result<boolean>> {
        try {
            if (!id) return Result.fail<boolean>('ID is required');
            const exists = await this.categoriaRepo.findById(id);
            if (!exists) return Result.fail<boolean>(`Categoria not found with id=${id}`);
            await this.categoriaRepo.deleteById(id);
            return Result.ok<boolean>(true);
        } catch (e) {
            this.logger.error('CategoriaService.deleteCategoriaById error: %o', e);
            return Result.fail<boolean>(mensagemErro(e, 'Não foi possível eliminar a categoria.'));
        }
    }

    /**
     * Rewrites the order of the Categorias of a group (null = "Sem grupo"), 1..n by position. The list must contain
     * exactly all active Categorias of that group.
     */
    public async reordenarCategorias(grupoId: string | null, ids: string[]): Promise<Result<boolean>> {
        try {
            if (grupoId && !(await this.grupoCategoriaRepo.findActiveById(grupoId))) {
                return Result.fail<boolean>(`O grupo ${grupoId} não existe ou foi apagado.`);
            }
            const ativas = await this.categoriaRepo.findAllActiveByGrupo(grupoId);
            if (!isConjuntoExato(ids, ativas.map(c => c.id.toString()))) {
                return Result.fail<boolean>('A lista de categorias tem de conter exatamente todas as categorias ativas do grupo, sem repetições.');
            }
            await this.categoriaRepo.reordenar(grupoId, ids);
            return Result.ok<boolean>(true);
        } catch (e) {
            this.logger.error('CategoriaService.reordenarCategorias error: %o', e);
            return Result.fail<boolean>(mensagemErro(e, 'Não foi possível guardar a nova ordem das categorias.'));
        }
    }
}
