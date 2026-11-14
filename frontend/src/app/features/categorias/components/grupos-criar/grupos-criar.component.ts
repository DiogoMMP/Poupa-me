import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GruposCriarViewModel } from './grupos-criar.view-model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SelectComponent, AppSelectOption } from '../../../../shared/components/select/select.component';
import {
  CHAVES_CORES_GRUPO, CORES_GRUPO, CorGrupo
} from '../../../../shared/constants/cores-grupo';

/** Opções do tipo de um grupo (em que selects aparece). */
export const TIPO_GRUPO_OPTIONS: AppSelectOption[] = [
  { value: 'Saída', label: 'Saída' },
  { value: 'Entrada', label: 'Entrada' },
  { value: 'Ambos', label: 'Ambos' }
];

/**
 * Component to create a new grupo de categorias: nome, tipo and colour (picked from the closed palette).
 */
@Component({
  selector: 'app-grupos-criar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, IconComponent, SelectComponent],
  templateUrl: './grupos-criar.component.html',
  styleUrls: ['./grupos-criar.component.css'],
  providers: [GruposCriarViewModel]
})
export class GruposCriarComponent {
  public vm = inject(GruposCriarViewModel);
  private fb = inject(FormBuilder);

  readonly tipoOptions = TIPO_GRUPO_OPTIONS;
  readonly cores = CHAVES_CORES_GRUPO;

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      tipo: ['Saída', Validators.required],
      cor: ['turquesa', Validators.required]
    });
  }

  /** Hex sólido da cor, para a amostra do seletor. */
  hex(cor: CorGrupo): string { return CORES_GRUPO[cor]; }


  escolherCor(cor: CorGrupo): void {
    this.form.patchValue({ cor });
  }

  onSubmit() {
    if (this.form.valid) {
      this.vm.submit(this.form.value);
    }
  }
}
