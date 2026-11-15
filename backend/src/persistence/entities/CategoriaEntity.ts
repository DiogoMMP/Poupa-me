import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn} from 'typeorm';
import {GrupoCategoriaEntity} from './GrupoCategoriaEntity.js';

@Entity({name: 'categoria'})
// Unicidade só entre categorias ativas: uma categoria apagada (soft delete) liberta o nome.
@Index('UQ_categoria_nome_ativo', ['nome'], { unique: true, where: '"is_active" = true' })
// Cada papel (p.ex. 'PagamentoCartao') pertence no máximo a uma categoria ativa.
@Index('UQ_categoria_papel_ativo', ['papel'], { unique: true, where: '"is_active" = true AND "papel" IS NOT NULL' })
export class CategoriaEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'domain_id', type: 'varchar', length: 50, nullable: true })
    domainId?: string;

    @Column({name: 'nome', type: 'varchar', length: 50})
    nome!: string;

    @Column({name: 'icon', type: 'varchar', length: 255})
    icon!: string;

    // Grupo opcional: as categorias anteriores aos grupos ficam em "Sem grupo" até o Admin as atribuir.
    @ManyToOne(() => GrupoCategoriaEntity, { nullable: true, eager: false })
    @JoinColumn({ name: 'grupo_id', foreignKeyConstraintName: 'FK_categoria_grupo_id' })
    grupo?: GrupoCategoriaEntity | null;

    @Column({ name: 'grupo_id', type: 'int', nullable: true })
    grupoId?: number | null;

    // Posição dentro do grupo (ou dentro de "Sem grupo").
    @Column({ name: 'ordem', type: 'int', default: 0 })
    ordem!: number;

    @Column({ name: 'papel', type: 'varchar', length: 30, nullable: true })
    papel?: string | null;

    @Column({name: 'is_active', type: 'boolean', default: true})
    isActive!: boolean;

    @Column({name: 'locale', type: 'varchar', length: 10, nullable: true})
    locale?: string;

    @CreateDateColumn({name: 'created_at'})
    createdAt!: Date;

    @UpdateDateColumn({name: 'updated_at'})
    updatedAt!: Date;
}
