import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { CategoriasService } from '../../services/categorias.service';
import { NotificationService } from '../../../../services/notification.service';
import { CategoriasInputDTO } from '../../dto/categorias.dto';
import { GruposCategoriaService } from '../../services/grupos-categoria.service';
import { AppSelectOption } from '../../../../shared/components/select/select.component';

/**
 * ViewModel for the Categorias Create component.
 */
@Injectable()
export class CategoriasCriarViewModel {
  private service = inject(CategoriasService);
  private notification = inject(NotificationService);
  private router = inject(Router);
  private gruposService = inject(GruposCategoriaService);

  // State
  readonly isLoading$ = new BehaviorSubject<boolean>(false);
  /** Grupos ativos para o select "Grupo", pela ordem do Admin. */
  readonly grupoOptions$ = new BehaviorSubject<AppSelectOption[]>([]);

  /**
   * Loads the active grupos for the "Grupo" select.
   */
  loadGrupos(): void {
    this.gruposService.getAll().subscribe({
      next: (grupos) => this.grupoOptions$.next(grupos.map(g => ({ value: g.id, label: g.nome }))),
      error: () => {
        this.grupoOptions$.next([]);
        this.notification.error('Falha ao carregar grupos');
      }
    });
  }

  submit(formData: CategoriasInputDTO): void {
    this.isLoading$.next(true);

    // "Nenhum" (valor vazio) não envia papel
    this.service.create({ ...formData, papel: formData.papel || undefined }).subscribe({
      next: () => {
        this.notification.success('Categoria criada com sucesso');
        this.isLoading$.next(false);
        this.router.navigate(['/categorias']);
      },
      error: (err: HttpErrorResponse) => {
        this.notification.error(err?.error?.error ?? 'Falha ao criar categoria');
        this.isLoading$.next(false);
      }
    });
  }
}
