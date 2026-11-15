import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CategoriasService } from '../../services/categorias.service';
import { GruposCategoriaService } from '../../services/grupos-categoria.service';
import { NotificationService } from '../../../../services/notification.service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { CategoriasModel } from '../../models/categorias.model';
import { CategoriasMapper } from '../../mappers/categorias.mapper';
import { GrupoCategoriaDTO } from '../../dto/categorias.dto';
import { AuthService } from '../../../auth/services/auth.service';

/**
 * Uma secção da página: um grupo (null = "Sem grupo") com as suas categorias, pela ordem do Admin.
 */
export interface SecaoCategorias {
  grupo: GrupoCategoriaDTO | null;
  categorias: CategoriasModel[];
}

/**
 * ViewModel for the categorias list component: secções por grupo, reordenação por drag-and-drop (com reposição da
 * ordem anterior se o pedido falhar) e CRUD de grupos e categorias.
 */
@Injectable()
export class CategoriasListViewModel {
  private service = inject(CategoriasService);
  private gruposService = inject(GruposCategoriaService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  public auth = inject(AuthService);

  // State
  readonly isLoading$ = new BehaviorSubject<boolean>(false);
  /** Secções dos grupos ativos, pela ordem do Admin (inclui grupos sem categorias). */
  readonly grupos$ = new BehaviorSubject<SecaoCategorias[]>([]);
  /** Secção "Sem grupo", só quando há categorias por arrumar. */
  readonly semGrupo$ = new BehaviorSubject<SecaoCategorias | null>(null);
  /**
   * Há uma reordenação (ou a recarga que se segue a uma que falhou) em curso. Enquanto for `true`, as listas não aceitam
   * outra largada: com pedidos sobrepostos, uma recarga podia trazer uma ordem antiga e a largada seguinte já não
   * atualizava o ecrã.
   */
  readonly aGravar$ = new BehaviorSubject<boolean>(false);

  /**
   * Loads the grouped categorias. This method is called when the component initializes and can be
   * called again to refresh the data.
   * @param silencioso - refresh without showing the loading state, so the page keeps its content (and its scroll
   * position) while the new data arrives; used after a delete or a failed reorder
   */
  loadData(silencioso = false, aoTerminar?: () => void): void {
    if (!silencioso) this.isLoading$.next(true);
    this.service.getAgrupadas().subscribe({
      next: (agrupadas) => {
        const secoes = agrupadas.map(a => ({
          grupo: a.grupo,
          categorias: CategoriasMapper.fromAgrupadas([a])
        }));
        this.grupos$.next(secoes.filter(s => s.grupo !== null));
        this.semGrupo$.next(secoes.find(s => s.grupo === null) ?? null);
        this.isLoading$.next(false);
        aoTerminar?.();
      },
      error: (err) => {
        console.error('[FRONTEND] CategoriasListViewModel.loadData -', err);
        this.notification.error('Falha ao carregar categorias');
        this.isLoading$.next(false);
        aoTerminar?.();
      }
    });
  }

  /**
   * Largada de um grupo: aplica a nova ordem logo e grava-a. Se o pedido falhar, volta a carregar a ordem do servidor.
   */
  dropGrupo(event: CdkDragDrop<SecaoCategorias[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const nova = [...this.grupos$.getValue()];
    moveItemInArray(nova, event.previousIndex, event.currentIndex);
    this.grupos$.next(nova);

    this.gravarOrdem(this.gruposService.reordenar(nova.map(s => s.grupo!.id)), 'Falha ao gravar a ordem dos grupos');
  }

  /**
   * Largada de uma categoria dentro do seu grupo: aplica a nova ordem logo e grava-a. Se o pedido falhar, volta a
   * carregar a ordem do servidor.
   */
  dropCategoria(secao: SecaoCategorias, event: CdkDragDrop<CategoriasModel[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const nova = [...secao.categorias];
    moveItemInArray(nova, event.previousIndex, event.currentIndex);
    secao.categorias = nova;

    this.gravarOrdem(this.service.reordenar(secao.grupo?.id ?? null, nova.map(c => c.id)), 'Falha ao gravar a ordem das categorias');
  }

  /**
   * Deletes a grupo after confirming with the user. The backend refuses (400) while the group has categorias; its
   * message says how many.
   */
  async deleteGrupo(grupo: GrupoCategoriaDTO): Promise<void> {
    const confirmed = await this.confirmDialog.confirm(`Tem a certeza que pretende eliminar o grupo "${grupo.nome}"?`, { variant: 'danger' });
    if (!confirmed) return;

    this.gruposService.delete(grupo.id).subscribe({
      next: () => {
        this.notification.success('Grupo eliminado');
        this.loadData(true);
      },
      error: (err: HttpErrorResponse) => {
        console.error('[FRONTEND] CategoriasListViewModel.deleteGrupo -', err);
        this.notification.error(err?.error?.error ?? 'Falha ao eliminar grupo');
      }
    });
  }

  /**
   * Deletes a categoria by id after confirming with the user. If the deletion is successful, it reloads the data to reflect
   * the changes.
   * @param id The id of the categoria to delete
   */
  async deleteCategoria(id: string): Promise<void> {
    if (!id) return;
    const confirmed = await this.confirmDialog.confirm('Tem a certeza que pretende eliminar esta categoria?', { variant: 'danger' });
    if (!confirmed) return;

    this.service.delete(id).subscribe({
      next: () => {
        this.notification.success('Categoria eliminada');
        this.loadData(true);
      },
      error: (err: HttpErrorResponse) => {
        console.error('[FRONTEND] CategoriasListViewModel.deleteCategoria -', err);
        this.notification.error(err?.error?.error ?? 'Falha ao eliminar categoria');
      }
    });
  }

  /**
   * Envia um pedido de reordenação; se falhar, mostra a notificação de erro e volta a carregar a ordem do servidor.
   * Recarregar (em vez de repor uma cópia da lista de antes da largada) mantém o ecrã certo mesmo quando duas
   * largadas seguidas se sobrepõem e só a primeira falha.
   */
  private gravarOrdem(pedido: Observable<unknown>, mensagem: string): void {
    this.aGravar$.next(true);
    pedido.subscribe({
      next: () => this.aGravar$.next(false),
      error: (err: HttpErrorResponse) => {
        console.error('[FRONTEND] CategoriasListViewModel.gravarOrdem -', err);
        this.notification.error(err?.error?.error ?? mensagem);
        this.loadData(true, () => this.aGravar$.next(false));
      }
    });
  }
}
