import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, Subscription, forkJoin } from 'rxjs';
import { TransacoesService } from '../../services/transacoes.service';
import { CategoriasService } from '../../../categorias/services/categorias.service';
import { CartoesCreditoService } from '../../../cartoes-credito/services/cartoes-credito.service';
import { ContasService } from '../../../contas/services/contas.service';
import { NotificationService } from '../../../../services/notification.service';
import { SelectedBancoService } from '../../../../services/selected-banco.service';
import { ListStateService } from '../../../../services/list-state.service';
import { TransacoesMapper } from '../../mappers/transacoes.mapper';
import { TransacaoModel } from '../../models/transacoes.model';
import { TransacoesDTO } from '../../dto/transacoes.dto';
import { PaginatedDTO } from '../../../../shared/dto/paginated.dto';
import { CategoriasDTO } from '../../../categorias/dto/categorias.dto';
import { CartoesCreditoModel } from '../../../cartoes-credito/models/cartoes-credito.model';
import { CartoesCreditoMapper } from '../../../cartoes-credito/mappers/cartoes-credito.mapper';
import { ContasModel } from '../../../contas/models/contas.model';
import { ContasMapper } from '../../../contas/mappers/contas.mapper';
import { ContaFilters, CartaoFilters } from './transacoes-listar.filter';
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from '../../../../shared/components/pagination/pagination.component';

export type { PeriodFilter, ContaFilters, CartaoFilters } from './transacoes-listar.filter';

/**
 * Uma página de transações já mapeada para o modelo do frontend.
 */
export interface TransacoesPage {
  items: TransacaoModel[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

/** Where the list keeps its state in `ListStateService`: the `/transacoes` route group */
const STATE_GROUP = 'transacoes';
const STATE_KEY = 'listar';

/**
 * Filters and pagination of both columns, kept while the user navigates inside `/transacoes`
 * (e.g. to a create/edit form and back). `bancoId` is the banco they belong to.
 */
interface TransacoesListState {
  bancoId: string | null;
  contaFilters: ContaFilters;
  cartaoFilters: CartaoFilters;
  contaPage: number;
  contaPageSize: number;
  cartaoPage: number;
  cartaoPageSize: number;
}

const emptyPage = (pageSize: number = DEFAULT_PAGE_SIZE): TransacoesPage => ({
  items: [], page: 1, pageSize, totalPages: 0, totalItems: 0
});

const toPage = (dto: PaginatedDTO<TransacoesDTO>): TransacoesPage => ({
  items: TransacoesMapper.toModelArray(dto.items),
  page: dto.page,
  pageSize: dto.pageSize,
  totalPages: dto.totalPages,
  totalItems: dto.totalItems
});

@Injectable()
export class TransacoesListViewModel {
  private transacoesService = inject(TransacoesService);
  private categoriasService = inject(CategoriasService);
  private cartoesService = inject(CartoesCreditoService);
  private contasService = inject(ContasService);
  private notification = inject(NotificationService);
  private selectedBanco = inject(SelectedBancoService);
  private listState = inject(ListStateService);
  private destroyRef = inject(DestroyRef);

  /** Set when the list is destroyed: late callbacks (e.g. a delete answering after the user left) must not load or save anything */
  private destroyed = false;

  readonly isLoading$ = new BehaviorSubject<boolean>(false);

  readonly contaPage$ = new BehaviorSubject<TransacoesPage>(emptyPage());
  readonly cartaoPage$ = new BehaviorSubject<TransacoesPage>(emptyPage());

  readonly cartoes$ = new BehaviorSubject<CartoesCreditoModel[]>([]);
  readonly contas$ = new BehaviorSubject<ContasModel[]>([]);
  readonly categorias$ = new BehaviorSubject<CategoriasDTO[]>([]);

  /** Emits when the ViewModel changed the filters on its own (banco switch), so the filter forms can copy them again */
  readonly filtersReset$ = new Subject<void>();

  contaFilters: ContaFilters = { categoriaId: '', contaId: '', period: 'Este Mês' };
  cartaoFilters: CartaoFilters = { categoriaId: '', cartaoId: '', status: '', period: 'Este Mês' };

  readonly PERIODS = ['Este Mês', 'Últimos 3 Meses', 'Último Ano'] as const;
  readonly STATUSES = ['Pendente', 'Concluído'];
  readonly PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS;

  private contaPage = 1;
  private contaPageSize = DEFAULT_PAGE_SIZE;
  private cartaoPage = 1;
  private cartaoPageSize = DEFAULT_PAGE_SIZE;

  private allSub?: Subscription;
  private contaSub?: Subscription;
  private cartaoSub?: Subscription;

  /** Last banco seen on `selectedBancoId$`; `undefined` until the first emission */
  private lastBancoId: string | null | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.destroyed = true);
    this.restoreState();
    this.selectedBanco.selectedBancoId$.pipe(takeUntilDestroyed()).subscribe(bancoId => {
      const bancoChanged = this.lastBancoId !== undefined && bancoId !== this.lastBancoId;
      this.lastBancoId = bancoId;
      if (bancoChanged) this.dropBancoScopedFilters();
      this.loadAll();
    });
  }

  get bancoId(): string | null {
    return this.selectedBanco.currentBancoId;
  }

  /**
   * Load all supporting data (categories, cards, accounts) and refresh both lists on their current page
   */
  loadAll(): void {
    if (this.destroyed) return;
    this.allSub?.unsubscribe();
    this.contaSub?.unsubscribe();
    this.cartaoSub?.unsubscribe();
    this.isLoading$.next(true);
    const bancoId = this.bancoId ?? undefined;

    if (!bancoId) {
      this.categorias$.next([]);
      this.cartoes$.next([]);
      this.contas$.next([]);
      this.contaPage$.next(emptyPage(this.contaPageSize));
      this.cartaoPage$.next(emptyPage(this.cartaoPageSize));
      this.isLoading$.next(false);
      return;
    }

    this.allSub = forkJoin({
      categorias: this.categoriasService.getAll(),
      cartoes: this.cartoesService.getAll(bancoId),
      contas: this.contasService.getAll(bancoId)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ categorias, cartoes, contas }) => {
        this.categorias$.next(categorias);
        this.cartoes$.next(CartoesCreditoMapper.toModelArray(cartoes));
        this.contas$.next(ContasMapper.toModelArray(contas));
        this.loadContaTransacoes();
        this.loadCartaoTransacoes();
      },
      error: (err) => {
        console.error('[TransacoesListViewModel] loadAll error', err);
        this.notification.error('Falha ao carregar dados');
        this.isLoading$.next(false);
      }
    });
  }

  // ── Conta column ──────────────────────────────────────────

  /**
   * Load the current page of the account column, sending every active filter to the API
   */
  loadContaTransacoes(): void {
    if (this.destroyed) return;
    this.contaSub?.unsubscribe();
    const bancoId = this.bancoId ?? undefined;

    if (!bancoId) {
      this.contaPage$.next(emptyPage(this.contaPageSize));
      this.isLoading$.next(false);
      return;
    }

    const f = this.contaFilters;
    this.contaSub = this.transacoesService.getContaTransactionsPage(
      { bancoId, contaId: f.contaId, categoriaId: f.categoriaId, period: f.period },
      this.contaPage,
      this.contaPageSize
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: dto => {
        // Page beyond the end (e.g. last item of the last page was deleted, or nothing left at all): go to the last page, or 1
        if (dto.page > Math.max(dto.totalPages, 1)) {
          this.contaPage = Math.max(dto.totalPages, 1);
          this.saveState();
          this.loadContaTransacoes();
          return;
        }
        this.contaPage$.next(toPage(dto));
        this.isLoading$.next(false);
      },
      error: () => {
        this.notification.error('Falha ao carregar transações de conta');
        this.isLoading$.next(false);
      }
    });
  }

  setContaPage(page: number): void {
    this.contaPage = page;
    this.saveState();
    this.loadContaTransacoes();
  }

  setContaPageSize(pageSize: number): void {
    this.contaPageSize = pageSize;
    this.contaPage = 1;
    this.saveState();
    this.loadContaTransacoes();
  }

  applyContaFilters(filters: ContaFilters): void {
    this.contaFilters = { ...filters };
    this.contaPage = 1;
    this.saveState();
    this.loadContaTransacoes();
  }

  clearContaFilters(): void {
    this.contaFilters = { categoriaId: '', contaId: '', period: 'Este Mês' };
    this.contaPage = 1;
    this.saveState();
    this.loadContaTransacoes();
  }

  // ── Cartão column ─────────────────────────────────────────

  /**
   * Load the current page of the credit-card column, sending every active filter to the API
   */
  loadCartaoTransacoes(): void {
    if (this.destroyed) return;
    this.cartaoSub?.unsubscribe();
    const bancoId = this.bancoId ?? undefined;

    if (!bancoId) {
      this.cartaoPage$.next(emptyPage(this.cartaoPageSize));
      this.isLoading$.next(false);
      return;
    }

    const f = this.cartaoFilters;
    this.cartaoSub = this.transacoesService.getCartaoTransactionsPage(
      { bancoId, cartaoCreditoId: f.cartaoId, categoriaId: f.categoriaId, status: f.status, period: f.period },
      this.cartaoPage,
      this.cartaoPageSize
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: dto => {
        // Page beyond the end (e.g. last item of the last page was deleted, or nothing left at all): go to the last page, or 1
        if (dto.page > Math.max(dto.totalPages, 1)) {
          this.cartaoPage = Math.max(dto.totalPages, 1);
          this.saveState();
          this.loadCartaoTransacoes();
          return;
        }
        this.cartaoPage$.next(toPage(dto));
        this.isLoading$.next(false);
      },
      error: () => {
        this.notification.error('Falha ao carregar transações de cartão');
        this.isLoading$.next(false);
      }
    });
  }

  setCartaoPage(page: number): void {
    this.cartaoPage = page;
    this.saveState();
    this.loadCartaoTransacoes();
  }

  setCartaoPageSize(pageSize: number): void {
    this.cartaoPageSize = pageSize;
    this.cartaoPage = 1;
    this.saveState();
    this.loadCartaoTransacoes();
  }

  applyCartaoFilters(filters: CartaoFilters): void {
    this.cartaoFilters = { ...filters };
    this.cartaoPage = 1;
    this.saveState();
    this.loadCartaoTransacoes();
  }

  clearCartaoFilters(): void {
    this.cartaoFilters = { categoriaId: '', cartaoId: '', status: '', period: 'Este Mês' };
    this.cartaoPage = 1;
    this.saveState();
    this.loadCartaoTransacoes();
  }

  // ── State kept while navigating inside /transacoes ────────

  /**
   * Take over the filters and pages saved by the previous list (e.g. before opening a form).
   * If the banco changed in the meantime, the account/card filters belong to the other banco and are dropped.
   */
  private restoreState(): void {
    const saved = this.listState.get<TransacoesListState>(STATE_GROUP, STATE_KEY);
    if (!saved) return;
    this.contaFilters = saved.contaFilters;
    this.cartaoFilters = saved.cartaoFilters;
    this.contaPage = saved.contaPage;
    this.contaPageSize = saved.contaPageSize;
    this.cartaoPage = saved.cartaoPage;
    this.cartaoPageSize = saved.cartaoPageSize;
    if (saved.bancoId !== this.bancoId) this.dropBancoScopedFilters();
  }

  /**
   * Drop the filters that point at an account/card of the previous banco, go back to the first pages,
   * and tell the filter forms. Categoria, status and period do not depend on the banco and are kept.
   */
  private dropBancoScopedFilters(): void {
    this.contaFilters = { ...this.contaFilters, contaId: '' };
    this.cartaoFilters = { ...this.cartaoFilters, cartaoId: '' };
    this.contaPage = 1;
    this.cartaoPage = 1;
    this.saveState();
    this.filtersReset$.next();
  }

  private saveState(): void {
    this.listState.set<TransacoesListState>(STATE_GROUP, STATE_KEY, {
      bancoId: this.bancoId,
      contaFilters: this.contaFilters,
      cartaoFilters: this.cartaoFilters,
      contaPage: this.contaPage,
      contaPageSize: this.contaPageSize,
      cartaoPage: this.cartaoPage,
      cartaoPageSize: this.cartaoPageSize
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  /**
   * Return whether there are any cards available
   */
  hasCartoes(): boolean {
    return this.cartoes$.getValue().length > 0;
  }

  /**
   * Delete a transaction by its domain id.
   * Calls API, reloads the current page of the column that held it and notifies the user.
   */
  public deleteTransacao(transacaoId: string): void {
    if (!transacaoId) return;
    this.isLoading$.next(true);
    const inConta = this.contaPage$.getValue().items.some(t => t.id === transacaoId);
    const inCartao = this.cartaoPage$.getValue().items.some(t => t.id === transacaoId);
    this.transacoesService.delete(transacaoId).subscribe({
      next: () => {
        this.notification.success('Transação eliminada com sucesso');
        if (inConta) this.loadContaTransacoes();
        if (inCartao) this.loadCartaoTransacoes();
        if (!inConta && !inCartao) this.isLoading$.next(false);
      },
      error: (err) => {
        console.error('[TransacoesListViewModel] deleteTransacao error', err);
        this.notification.error('Falha ao eliminar transação');
        this.isLoading$.next(false);
      }
    });
  }
}
