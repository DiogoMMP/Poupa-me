import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grupos de categorias (F0008 / issue #81).
 *
 * - Nova tabela grupo_categoria (nome, tipo, cor, ordem), com soft delete e nome único entre grupos ativos.
 * - categoria ganha grupo_id (FK opcional para grupo_categoria), ordem (posição dentro do grupo) e papel (p.ex.
 *   'PagamentoCartao', único entre categorias ativas).
 * - As categorias existentes ficam sem grupo ("Sem grupo") e recebem uma ordem inicial pelo id (1..n). Ids, nomes e
 *   ícones não mudam, por isso transações e regras continuam a apontar para as mesmas linhas.
 */
export class GruposCategorias1795000000000 implements MigrationInterface {
    name = 'GruposCategorias1795000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "grupo_categoria" (
                "id" SERIAL NOT NULL,
                "domain_id" character varying(50) NOT NULL,
                "nome" character varying(50) NOT NULL,
                "tipo" character varying(20) NOT NULL,
                "cor" character varying(20) NOT NULL,
                "ordem" integer NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_grupo_categoria_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_grupo_categoria_nome_ativo" ON "grupo_categoria" ("nome") WHERE "is_active" = true'
        );
        await queryRunner.query(
            'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_grupo_categoria_domain_id" ON "grupo_categoria" ("domain_id")'
        );

        await queryRunner.query('ALTER TABLE "categoria" ADD COLUMN IF NOT EXISTS "grupo_id" integer');
        await queryRunner.query('ALTER TABLE "categoria" ADD COLUMN IF NOT EXISTS "ordem" integer NOT NULL DEFAULT 0');
        await queryRunner.query('ALTER TABLE "categoria" ADD COLUMN IF NOT EXISTS "papel" character varying(30)');

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_categoria_grupo_id') THEN
                    ALTER TABLE "categoria" ADD CONSTRAINT "FK_categoria_grupo_id"
                        FOREIGN KEY ("grupo_id") REFERENCES "grupo_categoria"("id");
                END IF;
            END $$;
        `);

        // Ordem inicial: todas as categorias ficam em "Sem grupo", pela ordem do id.
        await queryRunner.query(`
            UPDATE "categoria" c SET ordem = n.rn
            FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM "categoria") n
            WHERE c.id = n.id
        `);

        await queryRunner.query(
            'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categoria_papel_ativo" ON "categoria" ("papel") WHERE "is_active" = true AND "papel" IS NOT NULL'
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "UQ_categoria_papel_ativo"');
        await queryRunner.query('ALTER TABLE "categoria" DROP CONSTRAINT IF EXISTS "FK_categoria_grupo_id"');
        await queryRunner.query('ALTER TABLE "categoria" DROP COLUMN IF EXISTS "papel"');
        await queryRunner.query('ALTER TABLE "categoria" DROP COLUMN IF EXISTS "ordem"');
        await queryRunner.query('ALTER TABLE "categoria" DROP COLUMN IF EXISTS "grupo_id"');

        await queryRunner.query('DROP INDEX IF EXISTS "UQ_grupo_categoria_domain_id"');
        await queryRunner.query('DROP INDEX IF EXISTS "UQ_grupo_categoria_nome_ativo"');
        await queryRunner.query('DROP TABLE IF EXISTS "grupo_categoria"');
    }
}
