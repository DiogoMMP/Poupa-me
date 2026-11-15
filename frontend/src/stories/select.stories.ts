import { Meta, StoryObj, componentWrapperDecorator } from '@storybook/angular';
import { AppSelectOption, SelectComponent } from '../app/shared/components/select/select.component';
import { CORES_GRUPO } from '../app/shared/constants/cores-grupo';

const meta: Meta<SelectComponent> = {
  title: 'Shared/Select',
  component: SelectComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Dropdown reutilizável que substitui o `<select>` nativo, compatível com Reactive Forms e `ngModel`. Navegável por teclado (setas, Enter, Escape). As opções podem ter `icon` e `color` (emoji num círculo pintado com a cor) e `group` (cabeçalho de texto simples quando o grupo muda; os cabeçalhos não são opções e o teclado salta-os).'
      }
    }
  },
  argTypes: {
    options: {
      control: 'object',
      description: 'Lista de opções `{ value, label, group?, icon?, color? }`.'
    },
    placeholder: {
      control: 'text',
      description: 'Texto do gatilho quando não há valor selecionado.'
    },
    ariaLabel: {
      control: 'text',
      description: 'Nome acessível do controlo, quando não há `<label>` associado.'
    }
  },
  decorators: [
    // Espaço para a lista aberta e o fundo escuro da app
    componentWrapperDecorator((story) => `<div style="background:#00101f;padding:16px;min-height:380px;max-width:320px">${story}</div>`)
  ]
};

export default meta;
type Story = StoryObj<SelectComponent>;

/**
 * Lista plana de texto, como nos filtros de período.
 */
export const Default: Story = {
  args: {
    placeholder: 'Selecionar período',
    options: [
      { value: 'mes', label: 'Este mês' },
      { value: 'trimestre', label: 'Últimos 3 meses' },
      { value: 'ano', label: 'Este ano' }
    ]
  }
};

/**
 * Opções com emoji num círculo pintado, sem grupos.
 */
export const ComIcones: Story = {
  args: {
    placeholder: 'Selecione uma categoria',
    options: [
      { value: 'CAT1', label: 'Supermercado', icon: '🛒', color: CORES_GRUPO.laranja },
      { value: 'CAT2', label: 'Restaurantes', icon: '🍽️', color: CORES_GRUPO.laranja },
      { value: 'CAT3', label: 'Combustível', icon: '⛽', color: CORES_GRUPO.azul }
    ]
  }
};

const agrupado: AppSelectOption[] = [
  { value: 'CAT01', label: 'Salário', icon: '💶', color: CORES_GRUPO.verde, group: 'Rendimentos' },
  { value: 'CAT02', label: 'Investimentos', icon: '📈', color: CORES_GRUPO.verde, group: 'Rendimentos' },
  { value: 'CAT03', label: 'Reembolsos de compras', icon: '↩️', color: CORES_GRUPO.verde, group: 'Rendimentos' },
  { value: 'CAT04', label: 'Supermercado', icon: '🛒', color: CORES_GRUPO.laranja, group: 'Alimentação' },
  { value: 'CAT05', label: 'Restaurantes', icon: '🍽️', color: CORES_GRUPO.laranja, group: 'Alimentação' },
  { value: 'CAT06', label: 'Cafés', icon: '☕', color: CORES_GRUPO.laranja, group: 'Alimentação' },
  { value: 'CAT07', label: 'Combustível', icon: '⛽', color: CORES_GRUPO.azul, group: 'Transportes' },
  { value: 'CAT08', label: 'Transportes públicos', icon: '🚇', color: CORES_GRUPO.azul, group: 'Transportes' },
  { value: 'CAT09', label: 'Táxis e TVDE', icon: '🚕', color: CORES_GRUPO.azul, group: 'Transportes' },
  { value: 'CAT10', label: 'Farmácia', icon: '💊', color: CORES_GRUPO.coral, group: 'Saúde' },
  { value: 'CAT11', label: 'Ginásio e desporto', icon: '🏋️', color: CORES_GRUPO.coral, group: 'Saúde' },
  { value: 'CAT12', label: 'Outras despesas', icon: '📦', color: CORES_GRUPO.cinza, group: 'Outros' }
];

/**
 * Categorias agrupadas como nos selects da app: cabeçalho de texto simples por grupo e o emoji de cada categoria
 * pintado com a cor do grupo. A navegação por teclado salta os cabeçalhos.
 */
export const Agrupado: Story = {
  args: {
    placeholder: 'Selecione uma categoria',
    ariaLabel: 'Categoria',
    options: agrupado
  }
};
