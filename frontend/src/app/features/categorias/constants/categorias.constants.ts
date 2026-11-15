import { AppSelectOption } from '../../../shared/components/select/select.component';

/** Opções do tipo de um grupo (define em que selects de categoria o grupo aparece). */
export const TIPO_GRUPO_OPTIONS: AppSelectOption[] = [
  { value: 'Saída', label: 'Saída' },
  { value: 'Entrada', label: 'Entrada' },
  { value: 'Ambos', label: 'Ambos' }
];

/** Opções do select "Papel" de uma categoria: o valor vazio ("Nenhum") não define papel (ou limpa-o, no editar). */
export const PAPEL_OPTIONS: AppSelectOption[] = [
  { value: '', label: 'Nenhum' },
  { value: 'PagamentoCartao', label: 'Pagamento de cartão' }
];
