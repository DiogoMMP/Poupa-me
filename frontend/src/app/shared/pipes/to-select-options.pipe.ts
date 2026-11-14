import { Pipe, PipeTransform } from '@angular/core';
import { AppSelectOption } from '../components/select/select.component';
import { corGrupoHex } from '../constants/cores-grupo';

interface EntityWithIconENome {
  id?: string;
  icon?: string;
  nome: string;
  /**
   * Só as categorias têm esta propriedade (`null` = "Sem grupo"). Quando existe, a opção ganha o grupo como
   * cabeçalho e o emoji num círculo com a cor do grupo.
   */
  grupo?: { nome: string; cor: string } | null;
}

/** Nome do grupo das categorias ainda por arrumar. */
const SEM_GRUPO = 'Sem grupo';

/**
 * Converte uma lista de entidades `{id, icon, nome}` (ex.: `ContasDTO[]`, `CategoriasModel[]`,
 * `CartoesCreditoDTO[]`) ou uma lista simples de strings num array de `AppSelectOption`, para usar
 * diretamente no `[options]` do `<app-select>`. Itens com a propriedade `grupo` (categorias) ficam agrupados pelo
 * nome do grupo ("Sem grupo" quando é `null`), com o emoji num círculo pintado com a cor do grupo.
 *
 * @example
 * ```html
 * <app-select [options]="vm.contas$ | async | toSelectOptions" formControlName="contaId"></app-select>
 * <app-select [options]="vm.contas$ | async | toSelectOptions:false" formControlName="contaId"></app-select> <!-- sem ícone -->
 * <app-select [options]="vm.PERIODS | toSelectOptions" [(ngModel)]="filterForm.period"></app-select>
 * <app-select [options]="vm.contas$ | async | toSelectOptions:true:'Nenhuma / Selecionar conta'" formControlName="contaId"></app-select> <!-- com opção vazia real -->
 * ```
 */
@Pipe({ name: 'toSelectOptions', standalone: true })
export class ToSelectOptionsPipe implements PipeTransform {
  transform(
    items: readonly (EntityWithIconENome | string)[] | null | undefined,
    withIcon = true,
    emptyLabel?: string
  ): AppSelectOption[] {
    const mapped = (items ?? []).map((item): AppSelectOption => {
      if (typeof item === 'string') {
        return { value: item, label: item };
      }
      if ('grupo' in item) {
        const comIcone = withIcon && !!item.icon;
        return {
          value: item.id,
          label: item.nome,
          group: item.grupo?.nome ?? SEM_GRUPO,
          icon: comIcone ? item.icon : undefined,
          color: comIcone ? corGrupoHex(item.grupo?.cor) : undefined
        };
      }
      return {
        value: item.id,
        label: withIcon && item.icon ? `${item.icon} ${item.nome}` : item.nome
      };
    });
    // A opção vazia (p.ex. "Todas") não tem grupo e fica no topo.
    return emptyLabel ? [{ value: '', label: emptyLabel }, ...mapped] : mapped;
  }
}
