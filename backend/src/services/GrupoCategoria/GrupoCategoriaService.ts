import { Service, Inject } from 'typedi';
import { Result } from '../../core/logic/Result.js';
import { mensagemErro } from '../../core/logic/ErroPersistencia.js';
import type { IGrupoCategoriaDTO, IInputGrupoCategoriaDTO } from '../../dto/IGrupoCategoriaDTO.js';
import type IGrupoCategoriaService from './IGrupoCategoriaService.js';
import { isConjuntoExato } from '../../core/logic/ConjuntoExato.js';
import type IGrupoCategoriaRepo from '../../repos/GrupoCategoria/IGrupoCategoriaRepo.js';
import { GrupoCategoria } from '../../domain/GrupoCategoria/Entities/GrupoCategoria.js';
import { TipoGrupoCategoria } from '../../domain/GrupoCategoria/ValueObjects/TipoGrupoCategoria.js';
import { CorGrupoCategoria } from '../../domain/GrupoCategoria/ValueObjects/CorGrupoCategoria.js';
import { Nome } from '../../domain/Shared/ValueObjects/Nome.js';
import { GrupoCategoriaMap } from '../../mappers/GrupoCategoriaMap.js';

/** Índices únicos de grupo_categoria que o Admin pode violar ao preencher o formulário. */
const MENSAGENS_UNICIDADE: Record<string, string> = {
    UQ_grupo_categoria_nome_ativo: 'Já existe um grupo com esse nome.'
};

/** Mensagem de grupo inexistente ou apagado; contém "não encontrado", que o controller mapeia para 404. */
const grupoNaoEncontrado = (id: string) => `Grupo ${id} não encontrado.`;

@Service()
export default class GrupoCategoriaService implements IGrupoCategoriaService {
    constructor(
        @Inject('GrupoCategoriaRepo') private grupoCategoriaRepo: IGrupoCategoriaRepo,
        @Inject('logger') private logger: { error: (...args: unknown[]) => void }
    ) {}

    /**
     * Creates a GrupoCategoria at the end of the order.
     */
    public async createGrupo(inputDTO: IInputGrupoCategoriaDTO): Promise<Result<IGrupoCategoriaDTO>> {
        try {
            if (!inputDTO) return Result.fail<IGrupoCategoriaDTO>('Não foram enviados dados do grupo.');

            const nomeResult = Nome.create(inputDTO.nome);
            const tipoResult = TipoGrupoCategoria.create(inputDTO.tipo);
            const corResult = CorGrupoCategoria.create(inputDTO.cor);

            const combine = Result.combine([nomeResult, tipoResult, corResult]);
            if (combine.isFailure) return Result.fail<IGrupoCategoriaDTO>(combine.error || 'Dados do grupo inválidos.');

            const grupoOrError = GrupoCategoria.create({
                nome: nomeResult.getValue(),
                tipo: tipoResult.getValue(),
                cor: corResult.getValue(),
                ordem: await this.grupoCategoriaRepo.nextOrdem()
            });
            if (grupoOrError.isFailure) return Result.fail<IGrupoCategoriaDTO>(grupoOrError.errorValue() as unknown as string);

            const saved = await this.grupoCategoriaRepo.save(grupoOrError.getValue());
            return Result.ok<IGrupoCategoriaDTO>(GrupoCategoriaMap.toDTO(saved));
        } catch (e) {
            this.logger.error('GrupoCategoriaService.createGrupo error: %o', e);
            return Result.fail<IGrupoCategoriaDTO>(mensagemErro(e, 'Não foi possível criar o grupo.', MENSAGENS_UNICIDADE));
        }
    }

    /**
     * Retrieves an active GrupoCategoria by its domain ID.
     */
    public async getGrupoById(id: string): Promise<Result<IGrupoCategoriaDTO>> {
        try {
            if (!id) return Result.fail<IGrupoCategoriaDTO>('O id do grupo é obrigatório.');
            const grupo = await this.grupoCategoriaRepo.findActiveById(id);
            if (!grupo) return Result.fail<IGrupoCategoriaDTO>(grupoNaoEncontrado(id));
            return Result.ok<IGrupoCategoriaDTO>(GrupoCategoriaMap.toDTO(grupo));
        } catch (e) {
            this.logger.error('GrupoCategoriaService.getGrupoById error: %o', e);
            return Result.fail<IGrupoCategoriaDTO>(mensagemErro(e, 'Não foi possível obter o grupo.'));
        }
    }

    /**
     * Retrieves all active GrupoCategorias, by ordem.
     */
    public async getAllGrupos(): Promise<Result<IGrupoCategoriaDTO[]>> {
        try {
            const grupos = await this.grupoCategoriaRepo.findAll();
            return Result.ok<IGrupoCategoriaDTO[]>(grupos.map(g => GrupoCategoriaMap.toDTO(g)));
        } catch (e) {
            this.logger.error('GrupoCategoriaService.getAllGrupos error: %o', e);
            return Result.fail<IGrupoCategoriaDTO[]>(mensagemErro(e, 'Não foi possível obter os grupos.'));
        }
    }

    /**
     * Updates nome, tipo and cor of an active GrupoCategoria. Fields not sent keep their value.
     */
    public async updateGrupo(updateDTO: Partial<IInputGrupoCategoriaDTO>, id: string): Promise<Result<IGrupoCategoriaDTO>> {
        try {
            if (!updateDTO) return Result.fail<IGrupoCategoriaDTO>('Não foram enviados dados do grupo.');
            if (!id) return Result.fail<IGrupoCategoriaDTO>('O id do grupo é obrigatório.');

            const existing = await this.grupoCategoriaRepo.findActiveById(id);
            if (!existing) return Result.fail<IGrupoCategoriaDTO>(grupoNaoEncontrado(id));

            const nome = updateDTO.nome !== undefined ? Nome.create(updateDTO.nome) : Result.ok(existing.nome);
            const tipo = updateDTO.tipo !== undefined ? TipoGrupoCategoria.create(updateDTO.tipo) : Result.ok(existing.tipo);
            const cor = updateDTO.cor !== undefined ? CorGrupoCategoria.create(updateDTO.cor) : Result.ok(existing.cor);

            const combine = Result.combine([nome, tipo, cor]);
            if (combine.isFailure) return Result.fail<IGrupoCategoriaDTO>(combine.error || 'Dados do grupo inválidos.');

            const grupoOrError = GrupoCategoria.create(
                { nome: nome.getValue(), tipo: tipo.getValue(), cor: cor.getValue(), ordem: existing.ordem },
                existing.id
            );
            if (grupoOrError.isFailure) return Result.fail<IGrupoCategoriaDTO>(grupoOrError.errorValue() as unknown as string);

            const updated = await this.grupoCategoriaRepo.update(grupoOrError.getValue(), id);
            return Result.ok<IGrupoCategoriaDTO>(GrupoCategoriaMap.toDTO(updated));
        } catch (e) {
            this.logger.error('GrupoCategoriaService.updateGrupo error: %o', e);
            return Result.fail<IGrupoCategoriaDTO>(mensagemErro(e, 'Não foi possível atualizar o grupo.', MENSAGENS_UNICIDADE));
        }
    }

    /**
     * Soft-deletes a GrupoCategoria, blocked while it still has active categorias.
     */
    public async deleteGrupoById(id: string): Promise<Result<boolean>> {
        try {
            if (!id) return Result.fail<boolean>('O id do grupo é obrigatório.');
            const existing = await this.grupoCategoriaRepo.findActiveById(id);
            if (!existing) return Result.fail<boolean>(grupoNaoEncontrado(id));

            const ativas = await this.grupoCategoriaRepo.countActiveCategorias(id);
            if (ativas > 0) {
                return Result.fail<boolean>(
                    `O grupo "${existing.nome.value}" tem ${ativas} ${ativas === 1 ? 'categoria' : 'categorias'}. ` +
                    'Mude-as de grupo ou apague-as antes de apagar o grupo.'
                );
            }

            await this.grupoCategoriaRepo.deleteById(id);
            return Result.ok<boolean>(true);
        } catch (e) {
            this.logger.error('GrupoCategoriaService.deleteGrupoById error: %o', e);
            return Result.fail<boolean>(mensagemErro(e, 'Não foi possível eliminar o grupo.'));
        }
    }

    /**
     * Rewrites the order of the groups (ordem = position, 1..n). The list must contain exactly all active groups.
     */
    public async reordenarGrupos(ids: string[]): Promise<Result<boolean>> {
        try {
            const ativos = await this.grupoCategoriaRepo.findAll();
            if (!isConjuntoExato(ids, ativos.map(g => g.id.toString()))) {
                return Result.fail<boolean>('A lista de grupos tem de conter exatamente todos os grupos ativos, sem repetições.');
            }
            await this.grupoCategoriaRepo.reordenar(ids);
            return Result.ok<boolean>(true);
        } catch (e) {
            this.logger.error('GrupoCategoriaService.reordenarGrupos error: %o', e);
            return Result.fail<boolean>(mensagemErro(e, 'Não foi possível guardar a nova ordem dos grupos.'));
        }
    }
}
