import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { GruposCategoriaService } from '../../services/grupos-categoria.service';
import { NotificationService } from '../../../../services/notification.service';
import { GrupoCategoriaDTO, GrupoCategoriaInputDTO } from '../../dto/categorias.dto';

/**
 * ViewModel for the Grupos de categorias Editar component. Loads the group and submits the updates.
 */
@Injectable()
export class GruposEditarViewModel {
  private service = inject(GruposCategoriaService);
  private notification = inject(NotificationService);
  private router = inject(Router);

  // State
  readonly isLoading$ = new BehaviorSubject<boolean>(false);
  readonly grupo$ = new BehaviorSubject<GrupoCategoriaDTO | null>(null);

  loadData(id: string): void {
    this.isLoading$.next(true);

    this.service.getById(id).subscribe({
      next: (dto) => {
        this.grupo$.next(dto);
        this.isLoading$.next(false);
      },
      error: (_err) => {
        this.notification.error('Falha ao carregar grupo');
        this.isLoading$.next(false);
        this.router.navigate(['/categorias']);
      }
    });
  }

  submit(id: string, formData: GrupoCategoriaInputDTO): void {
    this.isLoading$.next(true);

    this.service.update(id, formData).subscribe({
      next: () => {
        this.notification.success('Grupo atualizado com sucesso');
        this.isLoading$.next(false);
        this.router.navigate(['/categorias']);
      },
      error: (err: HttpErrorResponse) => {
        this.notification.error(err?.error?.error ?? 'Falha ao atualizar grupo');
        this.isLoading$.next(false);
      }
    });
  }
}
