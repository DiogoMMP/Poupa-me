/**
 * Normalizes a transaction description so that small variations of the same name compare equal (F0009):
 * lowercase → NFD decomposition without diacritics → digits removed → every run of characters other than a-z becomes
 * one space → spaces collapsed and trimmed. e.g. "Pagamento 123 - Tarifário" → "pagamento tarifario".
 *
 * The categorizador Space (F0010) implements the same rules in Python; both are tested against the shared examples in
 * backend/tests/fixtures/exemplos_normalizacao.json, so change them together.
 */
export function normalizarDescricao(descricao: string): string {
    return descricao
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[0-9]/g, '')
        .replace(/[^a-z]+/g, ' ')
        .trim();
}
