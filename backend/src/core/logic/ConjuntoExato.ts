/**
 * Checks that `ids` is exactly the set `esperados` (same elements, no duplicates, nothing missing or extra).
 * Used by the batch reorder of grupos and of categorias to validate the request body.
 */
export function isConjuntoExato(ids: unknown, esperados: string[]): boolean {
    if (!Array.isArray(ids) || ids.length !== esperados.length) return false;
    if (!ids.every((id) => typeof id === 'string')) return false;
    const unicos = new Set(ids as string[]);
    return unicos.size === esperados.length && esperados.every((id) => unicos.has(id));
}
