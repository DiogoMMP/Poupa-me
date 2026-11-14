import { Service, Inject } from 'typedi';
import type { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { IsNull, Not } from 'typeorm';
import type ICategoriaRepo from "./ICategoriaRepo.js";
import type {Categoria} from "../../domain/Categoria/Entities/Categoria.js";
import {CategoriaMap} from "../../mappers/CategoriaMap.js";
import {CategoriaEntity} from "../../persistence/entities/CategoriaEntity.js";
import {GrupoCategoriaEntity} from "../../persistence/entities/GrupoCategoriaEntity.js";
import type {PapelCategoriaType} from "../../domain/Categoria/ValueObjects/PapelCategoria.js";
import { CategoriaIdHelper, extractSequenceNumber } from '../../utils/IDGenerator.js';

/**
 * Categoria Repository implementation using TypeORM. This class is responsible for handling all database operations related
 * to the Categoria entity, including saving, updating, finding by domain ID or name, retrieving all categorias, and deleting by domain ID.
 * It uses a Mapper to convert between the domain model and the persistence model.
 * The repository is designed to be injected with a DataSource and a logger, allowing for flexible configuration and
 * testing.
 * Error handling is implemented to log any issues that arise during database operations, ensuring that problems can
 * be diagnosed and addressed effectively.
 * The repository methods return domain entities, abstracting away the details of the underlying database interactions
 * from the rest of the application.
 */
@Service()
export default class CategoriaRepo implements ICategoriaRepo {
    private repo: Repository<CategoriaEntity>;

    constructor(
        @Inject('dataSource') private dataSource: DataSource,
        @Inject('logger') private logger: { error: (...args: unknown[]) => void }
    ) {
        this.repo = this.dataSource.getRepository(CategoriaEntity);
    }

    /**
     * Saves a Categoria entity to the database. It first converts the domain Categoria object to a persistence format
     * using the CategoriaMap. Then it creates a new entity instance and saves it to the database. After saving, it maps
     * the saved entity back to the domain model and returns it. If any error occurs during this process, it logs the
     * error and rethrows it.
     * @param categoria - The Categoria domain entity that needs to be saved to the database. This object will be mapped
     * to a persistence format before being saved.
     * @returns A Promise that resolves to the saved Categoria domain entity. If the save operation is successful, the
     * method returns the Categoria object as it exists in the domain model after being persisted. If there is an error
     * during the save operation, it logs the error and rethrows it.
     */
    public async save(categoria: Categoria): Promise<Categoria> {
        try {
            const raw = CategoriaMap.toPersistence(categoria);

            // Always generate sequential domain ID (override UUID from domain entity)
            const allCategorias = await this.repo.find({ select: ['domainId'], order: { id: 'DESC' }, take: 100 });
            let maxSeq = 0;
            for (const c of allCategorias) {
                const seq = extractSequenceNumber(String(c.domainId), CategoriaIdHelper.prefix);
                if (seq !== null && seq > maxSeq) maxSeq = seq;
            }
            raw.domainId = maxSeq === 0 ? CategoriaIdHelper.generateFirst() : CategoriaIdHelper.generateNext(maxSeq);
            const papel = (raw.papel as string | null) ?? null;

            // Same rule as update: a papel belongs to at most one active categoria, so it is taken from the one that
            // had it in the same DB transaction that creates the new one.
            const saved = await this.dataSource.transaction(async (manager) => {
                raw.grupoId = await this.resolveGrupoPk(manager, categoria.grupoId?.toString() ?? null);
                const repo = manager.getRepository(CategoriaEntity);
                if (papel) await repo.update({ papel }, { papel: null });
                return repo.save(repo.create(raw as unknown as CategoriaEntity));
            });

            if (!saved) throw new Error('Failed to save categoria');
            // map back to domain (reloaded so the grupo relation comes with it)
            const domain = await this.findById(String(raw.domainId));
            if (!domain) throw new Error('Failed to map saved categoria to domain');
            return domain;
        } catch (err) {
            this.logger.error('CategoriaRepo.save error: %o', err);
            throw err;
        }
    }

    /**
     * Updates an existing Categoria entity in the database, located by its domain ID: nome, icon, grupo, ordem and
     * papel. When a papel is set, it is first removed from the categoria that had it, in the same DB transaction
     * (a papel belongs to at most one active categoria).
     * @param categoria - The Categoria domain entity with updated values.
     * @param id - The domain ID of the Categoria to update.
     */
    public async update(categoria: Categoria, id: string): Promise<Categoria> {
        try {
            const raw = CategoriaMap.toPersistence(categoria);
            const papel = (raw.papel as string | null) ?? null;

            await this.dataSource.transaction(async (manager) => {
                const grupoPk = await this.resolveGrupoPk(manager, categoria.grupoId?.toString() ?? null);

                if (papel) {
                    await manager.getRepository(CategoriaEntity).update(
                        { papel, domainId: Not(id) },
                        { papel: null }
                    );
                }

                await manager.createQueryBuilder()
                    .update(CategoriaEntity)
                    .set({
                        nome: raw.nome as string,
                        icon: raw.icon as string,
                        grupoId: grupoPk,
                        ordem: raw.ordem as number,
                        papel
                    })
                    .where('domain_id = :domainId', { domainId: id })
                    .execute();
            });

            const saved = await this.repo.findOne({ where: { domainId: id }, relations: { grupo: true } });
            if (!saved) throw new Error('Failed to find updated categoria by domainId');
            const domain = await CategoriaMap.toDomain(saved);
            if (!domain) throw new Error('Failed to map updated categoria to domain');
            return domain;
        } catch (err) {
            this.logger.error('CategoriaRepo.update error: %o', err);
            throw err;
        }
    }

    /**
     * Soft-deletes a Categoria by its domain ID (is_active = false). Transações and regras keep pointing at it.
     * @param id - The domain ID of the Categoria to delete.
     */
    public async deleteById(id: string): Promise<void> {
        try {
            // A deleted categoria cannot keep a papel (e.g. PagamentoCartao), otherwise it would still be chosen.
            await this.repo.update({ domainId: id }, { isActive: false, papel: null });
        } catch (err) {
            this.logger.error('CategoriaRepo.deleteById error: %o', err);
            throw err;
        }
    }


    /**
     * Finds all Categoria entities in the database. It uses the repository's find method to retrieve all records,
     * ordered by the ordem of their group ("Sem grupo" last), then by their own ordem and by ID.
     * For each retrieved record, it maps the persistence entity back to the domain model and collects them into an
     * array. Finally, it returns the array of Categoria domain entities.
     * If any error occurs during this process, it logs the error and rethrows it.
      * @returns A Promise that resolves to an array of all Categoria domain entities found in the database. If there
     * is an error during the find operation, it logs the error and rethrows it.
     */
    public async findAll(includeInactive = false): Promise<Categoria[]> {
        const rows = await this.repo.find({
            where: includeInactive ? {} : { isActive: true },
            relations: { grupo: true },
            order: { grupo: { ordem: 'ASC' }, ordem: 'ASC', id: 'ASC' }
        });
        const res: Categoria[] = [];

        for (const r of rows) {
            const d = await CategoriaMap.toDomain(r);
            if (d) res.push(d);
        }
        return res;
    }

    /**
     * Finds a Categoria entity in the database by its domain ID. It uses the repository's findOne method to retrieve the record
     * that matches the given domain ID. If a record is found, it maps the persistence entity back to the domain model and returns it.
     * If no record is found, it returns null. If any error occurs during this process, it logs the error and rethrows it.
     * @param id - The domain ID of the Categoria to find.
     * @returns A Promise that resolves to the found Categoria domain entity or null if no record is found. If there is an
     * error during the find operation, it logs the error and rethrows it.
     */
    public async findById(id: string): Promise<Categoria | null> {
        const row = await this.repo.findOne({ where: { domainId: id }, relations: { grupo: true } });
        if (!row) return null;
        return await CategoriaMap.toDomain(row);
    }

    /**
     * Finds a Categoria by domain ID only if it is active. Used to validate new movimentos and rules; a soft-deleted
     * Categoria returns null. Existing transações keep their category through findById-based reads.
     */
    public async findActiveById(id: string): Promise<Categoria | null> {
        const ativa = await this.repo.count({ where: { domainId: id, isActive: true } });
        return ativa > 0 ? this.findById(id) : null;
    }

    /**
     * Finds the active Categoria that has the given papel (at most one, guaranteed by UQ_categoria_papel_ativo).
     */
    public async findActiveByPapel(papel: PapelCategoriaType): Promise<Categoria | null> {
        const row = await this.repo.findOne({ where: { papel, isActive: true }, relations: { grupo: true } });
        if (!row) return null;
        return await CategoriaMap.toDomain(row);
    }

    /**
     * Returns max(ordem) + 1 among the active categorias of the group (null = "Sem grupo"); 1 when it is empty.
     */
    public async nextOrdem(grupoId: string | null): Promise<number> {
        const qb = this.repo.createQueryBuilder('cat')
            .select('MAX(cat.ordem)', 'max')
            .where('cat.is_active = true');
        if (grupoId) {
            qb.innerJoin('cat.grupo', 'g').andWhere('g.domain_id = :grupoId', { grupoId });
        } else {
            qb.andWhere('cat.grupo_id IS NULL');
        }
        const row = await qb.getRawOne<{ max: number | string | null }>();
        return Number(row?.max ?? 0) + 1;
    }

    /**
     * Rewrites the ordem of the given categorias (1..n, by position in the list) in a single DB transaction. The
     * grupoId (null = "Sem grupo") restricts the update to that group, so an id from another group is never touched.
     */
    public async reordenar(grupoId: string | null, ids: string[]): Promise<void> {
        try {
            await this.dataSource.transaction(async (manager) => {
                const grupoPk = await this.resolveGrupoPk(manager, grupoId);
                const repo = manager.getRepository(CategoriaEntity);
                for (let i = 0; i < ids.length; i++) {
                    await repo.update({ domainId: ids[i], grupoId: grupoPk ?? IsNull() }, { ordem: i + 1 });
                }
            });
        } catch (err) {
            this.logger.error('CategoriaRepo.reordenar error: %o', err);
            throw err;
        }
    }

    /**
     * Finds the active categorias of a group (null = "Sem grupo"), by ordem and ID.
     */
    public async findAllActiveByGrupo(grupoId: string | null): Promise<Categoria[]> {
        const where: FindOptionsWhere<CategoriaEntity> = grupoId
            ? { isActive: true, grupo: { domainId: grupoId } }
            : { isActive: true, grupoId: IsNull() };
        const rows = await this.repo.find({ where, relations: { grupo: true }, order: { ordem: 'ASC', id: 'ASC' } });
        const res: Categoria[] = [];
        for (const r of rows) {
            const d = await CategoriaMap.toDomain(r);
            if (d) res.push(d);
        }
        return res;
    }

    /**
     * Resolves the primary key of a GrupoCategoria from its domain ID (null stays null = "Sem grupo").
     */
    private async resolveGrupoPk(manager: EntityManager, grupoDomainId: string | null): Promise<number | null> {
        if (!grupoDomainId) return null;
        const grupo = await manager.getRepository(GrupoCategoriaEntity).findOne({ where: { domainId: grupoDomainId } });
        if (!grupo) throw new Error(`GrupoCategoria not found with id=${grupoDomainId}`);
        return grupo.id;
    }
}
