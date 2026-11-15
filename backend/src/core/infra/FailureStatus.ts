/**
 * Maps a failed service `Result` to the HTTP status, following the controllers' convention: 404 when the error says
 * the resource addressed by the URL was not found ("not found" in the older English messages, "não encontrad…" in the
 * Portuguese ones), 400 otherwise (validation, blocked delete, invalid reorder list).
 */
export function failureStatus(error: unknown): number {
    if (typeof error !== 'string') return 400;
    return error.includes('not found') || error.includes('não encontrad') ? 404 : 400;
}
