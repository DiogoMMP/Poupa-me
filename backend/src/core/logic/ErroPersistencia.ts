/**
 * Converte um erro apanhado num service numa mensagem que pode ser mostrada ao utilizador.
 *
 * Os erros da base de dados (QueryFailedError do TypeORM, com `driverError.code`) nunca chegam ao cliente tal como
 * vêm do Postgres: uma violação de um índice único conhecido dá uma mensagem própria, e qualquer outro erro de BD dá
 * a mensagem genérica `fallback`. Os restantes erros mantêm a sua mensagem, como antes.
 */

/** Código do Postgres para violação de unicidade (unique_violation). */
const PG_UNIQUE_VIOLATION = '23505';

/** Mensagens para os índices únicos que o utilizador pode violar ao preencher um formulário. */
const MENSAGENS_UNICIDADE: Record<string, string> = {
    UQ_categoria_nome_ativo: 'Já existe uma categoria com esse nome.',
    UQ_grupo_categoria_nome_ativo: 'Já existe um grupo com esse nome.',
    UQ_categoria_papel_ativo: 'Já existe outra categoria com esse papel.'
};

interface DriverError {
    code?: string;
    constraint?: string;
}

/**
 * Devolve a mensagem a mostrar para `e`, usando `fallback` para erros de base de dados sem mensagem própria.
 */
export function mensagemErro(e: unknown, fallback: string): string {
    if (!(e instanceof Error)) return fallback;

    const driverError = (e as Error & { driverError?: DriverError }).driverError;
    if (!driverError) return e.message;

    if (driverError.code === PG_UNIQUE_VIOLATION && driverError.constraint) {
        return MENSAGENS_UNICIDADE[driverError.constraint] ?? fallback;
    }
    return fallback;
}
