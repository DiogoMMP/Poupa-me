import {
  Component, ChangeDetectionStrategy, Input, forwardRef, signal, computed, ElementRef, QueryList, ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CHAVES_CORES_GRUPO, CorGrupo, corGrupoHex } from '../../../../shared/constants/cores-grupo';

/**
 * Seletor da cor de um grupo de categorias: um círculo por cor da paleta fechada. Usado pelos forms de criar e de
 * editar grupo, com `formControlName="cor"` (o valor é a chave da cor, p.ex. `turquesa`).
 *
 * Comporta-se como um grupo de rádios (padrão ARIA "radio group"): é uma só paragem do Tab (a cor escolhida, ou a
 * primeira) e as setas mudam e escolhem a cor seguinte/anterior, em ciclo.
 */
@Component({
  selector: 'app-cor-grupo-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cor-grupo-picker.component.html',
  styleUrls: ['./cor-grupo-picker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CorGrupoPickerComponent),
    multi: true
  }]
})
export class CorGrupoPickerComponent implements ControlValueAccessor {
  /** Id do elemento que dá nome ao grupo de amostras (o `<span class="form-label">` do form). */
  @Input() labelledBy?: string;

  readonly cores = CHAVES_CORES_GRUPO;
  readonly value = signal<CorGrupo | null>(null);
  readonly disabled = signal(false);

  /** Índice da amostra que recebe o foco do Tab: a cor escolhida, ou a primeira quando não há nenhuma. */
  readonly indiceFocavel = computed(() => Math.max(0, this.cores.indexOf(this.value() as CorGrupo)));

  @ViewChildren('amostra') private amostras?: QueryList<ElementRef<HTMLButtonElement>>;

  /** Hex sólido da cor, para o fundo da amostra. */
  readonly hex = corGrupoHex;

  private onChange: (value: CorGrupo) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: CorGrupo | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: CorGrupo) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /**
   * Setas: escolhe a cor seguinte (direita/baixo) ou anterior (esquerda/cima), em ciclo, e põe-lhe o foco.
   * Home/End vão para a primeira/última.
   */
  onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const total = this.cores.length;
    const atual = this.indiceFocavel();
    let proximo: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        proximo = (atual + 1) % total;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        proximo = (atual - 1 + total) % total;
        break;
      case 'Home':
        proximo = 0;
        break;
      case 'End':
        proximo = total - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.escolher(this.cores[proximo]);
    this.amostras?.get(proximo)?.nativeElement.focus();
  }

  /** Escolhe uma cor: atualiza a amostra selecionada e o valor do form. */
  escolher(cor: CorGrupo): void {
    this.value.set(cor);
    this.onChange(cor);
    this.onTouched();
  }
}
