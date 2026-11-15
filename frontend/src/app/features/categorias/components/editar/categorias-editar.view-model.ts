import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { CategoriasService } from '../../services/categorias.service';
import { NotificationService } from '../../../../services/notification.service';
import { CategoriasModel } from '../../models/categorias.model';
import { CategoriasMapper } from '../../mappers/categorias.mapper';
import { CategoriasInputDTO } from '../../dto/categorias.dto';
import { GruposCategoriaService } from '../../services/grupos-categoria.service';
import { AppSelectOption } from '../../../../shared/components/select/select.component';

/**
 * ViewModel for the Categorias Editar component. Handles the logic for loading category data and submitting updates.
 */
@Injectable()
export class CategoriasEditarViewModel {
  private service = inject(CategoriasService);
  private notification = inject(NotificationService);
  private router = inject(Router);
  private gruposService = inject(GruposCategoriaService);

  // State
  readonly isLoading$ = new BehaviorSubject<boolean>(false);
  readonly categoria$ = new BehaviorSubject<CategoriasModel | null>(null);
  /** Grupos ativos para o select "Grupo", pela ordem do Admin. */
  readonly grupoOptions$ = new BehaviorSubject<AppSelectOption[]>([]);

  /**
   * Loads the active grupos for the "Grupo" select.
   */
  loadGrupos(): void {
    this.gruposService.getOptions().subscribe({
      next: (options) => this.grupoOptions$.next(options),
      error: () => {
        this.grupoOptions$.next([]);
        this.notification.error('Falha ao carregar grupos');
      }
    });
  }

  /**
   * Loads the category data by ID and updates the state accordingly.
   * @param id
   */
  loadData(id: string): void {
    this.isLoading$.next(true);

    this.service.getById(id).subscribe({
      next: (dto) => {
        const model = CategoriasMapper.toModel(dto);
        this.categoria$.next(model);
        this.isLoading$.next(false);
      },
      error: (_err) => {
        this.notification.error('Falha ao carregar categoria');
        this.isLoading$.next(false);
        this.router.navigate(['/categorias']);
      }
    });
  }

  /**
   * Submits the updated category data to the service and handles the response.
   * @param id - The ID of the category being updated.
   * @param formData - The updated category data from the form.
   */
  submit(id: string, formData: Partial<CategoriasInputDTO>): void {
    // Build full input DTO merging with existing values (PUT semantics)
    const existing = this.categoria$.getValue();
    const payload: CategoriasInputDTO = {
      nome: formData.nome !== undefined ? formData.nome : (existing?.nome || ''),
      icon: formData.icon !== undefined ? formData.icon : (existing?.icon || ''),
      // Sem grupo escolhido (categoria antiga ainda em "Sem grupo") não se envia: não é possível voltar a "Sem grupo"
      grupoId: formData.grupoId || undefined,
    };
    // O papel só vai no pedido quando mudou em relação ao carregado: omitido, o backend não lhe mexe. Enviá-lo sempre
    // tiraria o papel a outra categoria que o tivesse recebido depois de este form abrir. "Nenhum" (vazio) limpa-o.
    const papel = formData.papel || null;
    if (papel !== (existing?.papel ?? null)) payload.papel = papel;

    this.isLoading$.next(true);

    this.service.update(id, payload).subscribe({
      next: () => {
        this.notification.success('Categoria atualizada com sucesso');
        this.isLoading$.next(false);
        this.router.navigate(['/categorias']);
      },
      error: (err: HttpErrorResponse) => {
        this.notification.error(err?.error?.error ?? 'Falha ao atualizar categoria');
        this.isLoading$.next(false);
      }
    });
  }
}
