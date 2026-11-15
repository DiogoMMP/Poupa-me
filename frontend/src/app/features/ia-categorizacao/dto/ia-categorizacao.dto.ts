import {CategoriasDTO} from '../../categorias/dto/categorias.dto';

/**
 * Camada que sugeriu a categoria: histórico do utilizador, modelo próprio (Space) ou LLM.
 */
export type OrigemSugestao = 'historico' | 'modelo' | 'llm';

/**
 * Resposta do `GET /ia-categorizacao/sugerir`.
 */
export interface SugestaoCategoriaDTO {
  categoria: CategoriasDTO;
  origem: OrigemSugestao;
  /** Confiança do modelo (0–1); só na origem `modelo`. */
  confianca: number | null;
}

/**
 * Sugestão que o form guarda e envia na criação da transação, para registar a categoria sugerida e a sua origem.
 */
export interface SugestaoGuardada {
  categoriaSugeridaId: string;
  origemSugestao: OrigemSugestao;
}
