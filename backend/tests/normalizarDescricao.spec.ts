import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { normalizarDescricao } from '../src/utils/normalizarDescricao.js';

/**
 * The examples live in a shared JSON file: the categorizador Space (F0010) runs the same file against its Python
 * normalization, so both implementations never diverge.
 */
const exemplos = JSON.parse(
    readFileSync(new URL('./fixtures/exemplos_normalizacao.json', import.meta.url), 'utf-8')
) as { entrada: string; esperado: string }[];

describe('normalizarDescricao', () => {
    it('has the shared examples', () => {
        expect(exemplos.length).toBeGreaterThanOrEqual(12);
    });

    it.each(exemplos)('normalizes "$entrada" to "$esperado"', ({ entrada, esperado }) => {
        expect(normalizarDescricao(entrada)).toBe(esperado);
    });
});
