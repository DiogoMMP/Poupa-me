import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GruposCriarViewModel } from './grupos-criar.view-model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { CorGrupoPickerComponent } from '../cor-grupo-picker/cor-grupo-picker.component';
import { TIPO_GRUPO_OPTIONS } from '../../constants/categorias.constants';

/**
 * Component to create a new grupo de categorias: nome, tipo and colour (picked from the closed palette).
 */
@Component({
  selector: 'app-grupos-criar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, IconComponent, SelectComponent, CorGrupoPickerComponent],
  templateUrl: './grupos-criar.component.html',
  providers: [GruposCriarViewModel]
})
export class GruposCriarComponent {
  public vm = inject(GruposCriarViewModel);
  private fb = inject(FormBuilder);

  readonly tipoOptions = TIPO_GRUPO_OPTIONS;

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      tipo: ['Saída', Validators.required],
      cor: ['turquesa', Validators.required]
    });
  }

  onSubmit() {
    if (this.form.valid) {
      this.vm.submit(this.form.value);
    }
  }
}
