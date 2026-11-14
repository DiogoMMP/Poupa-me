import { Service, Inject } from 'typedi';
import type { DataSource, Repository } from 'typeorm';
import type IGrupoCategoriaRepo from './IGrupoCategoriaRepo.js';
import type { GrupoCategoria } from '../../domain/GrupoCategoria/Entities/GrupoCategoria.js';
import { GrupoCategoriaMap } from '../../mappers/GrupoCategoriaMap.js';
import { GrupoCategoriaEntity } from '../../persistence/entities/GrupoCategoriaEntity.js';
import { CategoriaEntity } from '../../persistence/entities/CategoriaEntity.js';
import { GrupoCategoriaIdHelper, extractSequenceNumber } from '../../utils/IDGenerator.js';

/**
 * GrupoCategoria Repository implementation using TypeORM. Handles persistence of the groups of categorias, including
 * the soft delete and the batch reordering defined by the Admin. Returns domain entities, mapped by GrupoCategoriaMap.
 */
@Service()
export default class GrupoCategoriaRepo implements IGrupoCategoriaRepo {
    private repo: Repository<GrupoCategoriaEntity>;

    constructor(
        @Inject('dataSource') private dataSource: DataSource,
        @Inject('logger') private logger: { error: (...args: unknown[]) => void }
    ) {
        this.repo = this.dataSource.getRepository(GrupoCategoriaEntity);
    }

    /**
     * Saves a new GrupoCategoria, generating the sequential domain ID (prefix GCT).
     */
    public async save(grupo: GrupoCategoria): Promise<GrupoCategoria> {
        try {
            const raw = GrupoCategoriaMap.toPersistence(grupo);

            // Always generate sequential domain ID (override UUID from domain entity)
            const existentes = await this.repo.find({ select: ['domainId'], order: { id: 'DESC' }, take: 100 });
            let maxSeq = 0;
            for (const g of existentes) {
                const seq = extractSequenceNumber(String(g.domainId), GrupoCategoriaIdHelper.prefix);
                if (seq !== null && seq > maxSeq) maxSeq = seq;
            }
            raw.domainId = maxSeq === 0 ? GrupoCategoriaIdHelper.generateFirst() : GrupoCategoriaIdHelper.generateNext(maxSeq);

            const entity = this.repo.create(raw as unknown as GrupoCategoriaEntity);
            const saved = await this.repo.save(entity);

            if (!saved) throw new Error('Failed to save grupo categoria');
            const domain = GrupoCategoriaMap.toDomain(saved);
            if (!domain) throw new Error('Failed to map saved grupo categoria to domain');
            return domain;
        } catch (err) {
            this.logger.error('GrupoCategoriaRepo.save error: %o', err);
            throw err;
        }
    }

    /**
     * Updates nome, tipo and cor of an existing GrupoCategoria, located by its domain ID. The ordem only changes
     * through reordenar.
     */
    public async update(grupo: GrupoCategoria, id: string): Promise<GrupoCategoria> {
        try {
            const raw = GrupoCategoriaMap.toPersistence(grupo);

            await this.repo.update(
                { domainId: id },
                { nome: raw.nome as string, tipo: raw.tipo as string, cor: raw.cor as string }
            );

            const saved = await this.repo.findOne({ where: { domainId: id } });
            if (!saved) throw new Error('Failed to find updated grupo categoria by domainId');
            const domain = GrupoCategoriaMap.toDomain(saved);
            if (!domain) throw new Error('Failed to map updated grupo categoria to domain');
            return domain;
        } catch (err) {
            this.logger.error('GrupoCategoriaRepo.update error: %o', err);
            throw err;
        }
    }

    /**
     * Soft-deletes a GrupoCategoria by its domain ID (is_active = false), which frees its nome.
     */
    public async deleteById(id: string): Promise<void> {
        try {
            await this.repo.update({ domainId: id }, { isActive: false });
        } catch (err) {
            this.logger.error('GrupoCategoriaRepo.deleteById error: %o', err);
            throw err;
        }
    }

    /**
     * Finds all groups by ordem (ties by id). Inactive groups are only included when includeInactive is true (used
     * by the statistics, so old movimentos keep their group).
     */
    public async findAll(includeInactive = false): Promise<GrupoCategoria[]> {
        const rows = await this.repo.find({
            where: includeInactive ? {} : { isActive: true },
            order: { ordem: 'ASC', id: 'ASC' }
        });
        const res: GrupoCategoria[] = [];
        for (const r of rows) {
            const d = GrupoCategoriaMap.toDomain(r);
            if (d) res.push(d);
        }
        return res;
    }

    /**
     * Finds a GrupoCategoria by its domain ID, active or not.
     */
    public async findById(id: string): Promise<GrupoCategoria | null> {
        const row = await this.repo.findOne({ where: { domainId: id } });
        if (!row) return null;
        return GrupoCategoriaMap.toDomain(row);
    }

    /**
     * Finds a GrupoCategoria by its domain ID only if it is active.
     */
    public async findActiveById(id: string): Promise<GrupoCategoria | null> {
        const row = await this.repo.findOne({ where: { domainId: id, isActive: true } });
        if (!row) return null;
        return GrupoCategoriaMap.toDomain(row);
    }

    /**
     * Counts the active categorias of a group, by the group's domain ID.
     */
    public async countActiveCategorias(grupoId: string): Promise<number> {
        return this.dataSource.getRepository(CategoriaEntity)
            .createQueryBuilder('cat')
            .innerJoin('cat.grupo', 'g')
            .where('g.domain_id = :grupoId', { grupoId })
            .andWhere('cat.is_active = true')
            .getCount();
    }

    /**
     * Rewrites the ordem of the given groups (1..n, by position in the list) in a single DB transaction.
     */
    public async reordenar(ids: string[]): Promise<void> {
        try {
            await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(GrupoCategoriaEntity);
                for (let i = 0; i < ids.length; i++) {
                    await repo.update({ domainId: ids[i] }, { ordem: i + 1 });
                }
            });
        } catch (err) {
            this.logger.error('GrupoCategoriaRepo.reordenar error: %o', err);
            throw err;
        }
    }

    /**
     * Returns max(ordem) + 1 among the active groups (1 when there are none).
     */
    public async nextOrdem(): Promise<number> {
        const row = await this.repo.createQueryBuilder('g')
            .select('MAX(g.ordem)', 'max')
            .where('g.is_active = true')
            .getRawOne<{ max: number | string | null }>();
        return Number(row?.max ?? 0) + 1;
    }
}
