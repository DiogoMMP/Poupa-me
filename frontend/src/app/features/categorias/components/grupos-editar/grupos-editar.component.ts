import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { GruposEditarViewModel } from './grupos-editar.view-model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { CorGrupoPickerComponent } from '../cor-grupo-picker/cor-grupo-picker.component';
import { TIPO_GRUPO_OPTIONS } from '../../constants/categorias.constants';

/**
 * Component to edit a grupo de categorias: nome, tipo and colour.
 */
@Component({
  selector: 'app-grupos-editar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, IconComponent, SelectComponent, CorGrupoPickerComponent],
  templateUrl: './grupos-editar.component.html',
  providers: [GruposEditarViewModel]
})
export class GruposEditarComponent implements OnInit, OnDestroy {
  public vm = inject(GruposEditarViewModel);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private sub?: Subscription;

  readonly tipoOptions = TIPO_GRUPO_OPTIONS;

  form: FormGroup;
  id = '';

  constructor() {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      tipo: ['', Validators.required],
      cor: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.id = this.route.snapshot.params['id'];
    if (this.id) {
      this.vm.loadData(this.id);
      this.sub = this.vm.grupo$.subscribe(grupo => {
        if (grupo) {
          this.form.patchValue({ nome: grupo.nome, tipo: grupo.tipo, cor: grupo.cor });
        }
      });
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  onSubmit() {
    if (this.form.valid) {
      this.vm.submit(this.id, this.form.value);
    }
  }
}
