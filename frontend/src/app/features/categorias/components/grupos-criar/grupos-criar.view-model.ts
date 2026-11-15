import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { GruposCategoriaService } from '../../services/grupos-categoria.service';
import { NotificationService } from '../../../../services/notification.service';
import { GrupoCategoriaInputDTO } from '../../dto/categorias.dto';

/**
 * ViewModel for the Grupos de categorias Create component.
 */
@Injectable()
export class GruposCriarViewModel {
  private service = inject(GruposCategoriaService);
  private notification = inject(NotificationService);
  private router = inject(Router);

  // State
  readonly isLoading$ = new BehaviorSubject<boolean>(false);

  submit(formData: GrupoCategoriaInputDTO): void {
    this.isLoading$.next(true);

    this.service.create(formData).subscribe({
      next: () => {
        this.notification.success('Grupo criado com sucesso');
        this.isLoading$.next(false);
        this.router.navigate(['/categorias']);
      },
      error: (err: HttpErrorResponse) => {
        this.notification.error(err?.error?.error ?? 'Falha ao criar grupo');
        this.isLoading$.next(false);
      }
    });
  }
}
