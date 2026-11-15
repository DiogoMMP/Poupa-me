/**
 * Converte uma exceção apanhada num service numa mensagem que pode ser mostrada ao utilizador.
 *
 * Os erros de negócio esperados chegam pelo padrão `Result`, nunca por exceções. Uma exceção é sempre um erro interno
 * (BD indisponível, constraint violada, falha de mapeamento), e o texto dela nunca chega ao cliente: o host da BD, o
 * nome de tabelas ou colunas e o texto do Postgres ficam só no log. A única exceção é a violação de um índice único
 * que o próprio service declara em `mensagensUnicidade`, porque essa resulta do que o utilizador escreveu no formulário
 * (p.ex. um nome repetido) e tem uma mensagem própria.
 *
 * O mapa de índices vem de cada service, para que `core/` não conheça nomes de tabelas ou índices de nenhum contexto.
 */

/** Código do Postgres para violação de unicidade (unique_violation). */
const PG_UNIQUE_VIOLATION = '23505';

interface DriverError {
    code?: string;
    constraint?: string;
}

/**
 * Devolve a mensagem a mostrar para a exceção `e`: a de `mensagensUnicidade` quando `e` é uma violação de um desses
 * índices únicos, `fallback` em todos os outros casos.
 * @param e - a exceção apanhada
 * @param fallback - mensagem genérica, em PT-PT, da operação que falhou
 * @param mensagensUnicidade - nome do índice único → mensagem a mostrar quando é violado
 */
export function mensagemErro(e: unknown, fallback: string, mensagensUnicidade: Record<string, string> = {}): string {
    const driverError = (e as { driverError?: DriverError } | null)?.driverError;
    if (driverError?.code === PG_UNIQUE_VIOLATION && driverError.constraint) {
        return mensagensUnicidade[driverError.constraint] ?? fallback;
    }
    return fallback;
}
