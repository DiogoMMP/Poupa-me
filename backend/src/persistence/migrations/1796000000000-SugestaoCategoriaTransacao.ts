import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sugestão de categoria na transação (F0009 / issue #53).
 *
 * - transacao ganha categoria_sugerida_id (FK opcional para categoria, ON DELETE SET NULL) e origem_sugestao
 *   ('historico' | 'modelo' | 'llm'): a categoria que a sugestão automática propôs e a camada que a propôs.
 * - As transações existentes ficam com as duas colunas a NULL.
 */
export class SugestaoCategoriaTransacao1796000000000 implements MigrationInterface {
    name = 'SugestaoCategoriaTransacao1796000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "transacao" ADD COLUMN IF NOT EXISTS "categoria_sugerida_id" integer');
        await queryRunner.query('ALTER TABLE "transacao" ADD COLUMN IF NOT EXISTS "origem_sugestao" character varying(20)');

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_transacao_categoria_sugerida') THEN
                    ALTER TABLE "transacao" ADD CONSTRAINT "FK_transacao_categoria_sugerida"
                        FOREIGN KEY ("categoria_sugerida_id") REFERENCES "categoria"("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "transacao" DROP CONSTRAINT IF EXISTS "FK_transacao_categoria_sugerida"');
        await queryRunner.query('ALTER TABLE "transacao" DROP COLUMN IF EXISTS "origem_sugestao"');
        await queryRunner.query('ALTER TABLE "transacao" DROP COLUMN IF EXISTS "categoria_sugerida_id"');
    }
}
