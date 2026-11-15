import { Component, ChangeDetectionStrategy, Input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CHAVES_CORES_GRUPO, CorGrupo, corGrupoHex } from '../../../../shared/constants/cores-grupo';

/**
 * Seletor da cor de um grupo de categorias: um círculo por cor da paleta fechada. Usado pelos forms de criar e de
 * editar grupo, com `formControlName="cor"` (o valor é a chave da cor, p.ex. `turquesa`).
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

  /** Escolhe uma cor: atualiza a amostra selecionada e o valor do form. */
  escolher(cor: CorGrupo): void {
    this.value.set(cor);
    this.onChange(cor);
    this.onTouched();
  }
}
