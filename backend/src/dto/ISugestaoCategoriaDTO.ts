import type {ICategoriaDTO} from './ICategoriaDTO.js';
import type {OrigemSugestaoType} from '../domain/Transacao/ValueObjects/OrigemSugestao.js';

/**
 * Response of GET /ia-categorizacao/sugerir: the suggested categoria and the layer that suggested it.
 */
export interface ISugestaoCategoriaDTO {
    categoria: ICategoriaDTO;
    origem: OrigemSugestaoType;
    /** Model confidence (0–1); only set when origem is 'modelo'. */
    confianca: number | null;
}
