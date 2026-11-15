import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index} from 'typeorm';

@Entity({name: 'grupo_categoria'})
// Unicidade só entre grupos ativos: um grupo apagado (soft delete) liberta o nome.
@Index('UQ_grupo_categoria_nome_ativo', ['nome'], { unique: true, where: '"is_active" = true' })
// O domain id é gerado lendo o máximo atual (como nos outros repos); o índice único faz falhar um duplicado gerado por
// dois "criar grupo" simultâneos, em vez de deixar dois grupos com o mesmo id.
@Index('UQ_grupo_categoria_domain_id', ['domainId'], { unique: true })
export class GrupoCategoriaEntity {
    // Nome do constraint fixo para coincidir com a migration 1795000000000-GruposCategorias.
    @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_grupo_categoria_id' })
    id!: number;

    @Column({ name: 'domain_id', type: 'varchar', length: 50 })
    domainId!: string;

    @Column({name: 'nome', type: 'varchar', length: 50})
    nome!: string;

    @Column({name: 'tipo', type: 'varchar', length: 20})
    tipo!: string;

    @Column({name: 'cor', type: 'varchar', length: 20})
    cor!: string;

    @Column({name: 'ordem', type: 'int'})
    ordem!: number;

    @Column({name: 'is_active', type: 'boolean', default: true})
    isActive!: boolean;

    @CreateDateColumn({name: 'created_at'})
    createdAt!: Date;

    @UpdateDateColumn({name: 'updated_at'})
    updatedAt!: Date;
}
