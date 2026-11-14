import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subscription, skip } from 'rxjs';
import { CategoriasService } from '../../../categorias/services/categorias.service';
import { NotificationService } from '../../../../services/notification.service';
import { SelectedBancoService } from '../../../../services/selected-banco.service';
import { ListStateService } from '../../../../services/list-state.service';
import { TransacoesService } from '../../../transacoes/services/transacoes.service';
import { TransacoesMapper } from '../../../transacoes/mappers/transacoes.mapper';
import { TransacaoModel } from '../../../transacoes/models/transacoes.model';
import { CategoriasDTO } from '../../../categorias/dto/categorias.dto';
import { DespesasRecorrentesService } from '../../services/despesas-recorrentes.service';
import { DespesasRecorrentesMapper } from '../../mappers/despesas-recorrentes.mapper';
import { DespesaRecorrenteModel } from '../../models/despesas-recorrentes.model';
import { DespesaFilters, filterByPeriod } from './despesas-recorrentes-listar.filter';

export type { PeriodFilter, DespesaFilters } from './despesas-recorrentes-listar.filter';

/** Items per page in both columns (paginated on the client) */
export const PAGE_SIZE = 10;

/** Where the list keeps its state in `ListStateService`: the `/despesas-recorrentes` route group */
const STATE_GROUP = 'despesas-recorrentes';
const STATE_KEY = 'listar';

/** Filters and pages of both columns, kept while the user navigates inside `/despesas-recorrentes` */
interface DespesasRecorrentesListState {
  pendenteFilters: DespesaFilters;
  concluidaFilters: DespesaFilters;
  pendentePage: number;
  concluidaPage: number;
}

@Injectable()
export class DespesasRecorrentesListViewModel {
  private transacoesService = inject(TransacoesService);
  private despesasRecorrentesService = inject(DespesasRecorrentesService);
  private categoriasService = inject(CategoriasService);
  private notification = inject(NotificationService);
  private selectedBanco = inject(SelectedBancoService);
  private listState = inject(ListStateService);

  readonly isLoading$ = new BehaviorSubject<boolean>(false);

  /** Left column — Pendente */
  readonly pendentes$ = new BehaviorSubject<TransacaoModel[]>([]);
  /** Right column — Concluído */
  readonly concluidas$ = new BehaviorSubject<TransacaoModel[]>([]);
  /** Recurring expense rules without valor/diaDoMes configured */
  readonly despesasSemValorSemanal$ = new BehaviorSubject<DespesaRecorrenteModel[]>([]);
  readonly despesasSemValorMensal$ = new BehaviorSubject<DespesaRecorrenteModel[]>([]);
  readonly despesasSemValorAnual$ = new BehaviorSubject<DespesaRecorrenteModel[]>([]);
  readonly despesasSemValorPoupanca$ = new BehaviorSubject<DespesaRecorrenteModel[]>([]);

  readonly categorias$ = new BehaviorSubject<CategoriasDTO[]>([]);

  private allSub?: Subscription;
  private pendentesSub?: Subscription;
  private concluidasSub?: Subscription;
  private semValorSemanalSub?: Subscription;
  private semValorMensalSub?: Subscription;
  private semValorAnualSub?: Subscription;
  private semValorPoupancaSub?: Subscription;

  pendenteFilters: DespesaFilters = { categoriaId: '', period: '' };
  concluidaFilters: DespesaFilters = { categoriaId: '', period: 'Este Mês' };

  private _pendentePage = 1;
  private _concluidaPage = 1;

  /** Set of transaction ids currently being processed to prevent duplicate clicks */
  private busyIds = new Set<string>();

  readonly PERIODS = ['Este Mês', 'Últimos 3 Meses', 'Último Ano'] as const;

  constructor() {
    this.restoreState();
    // After every (re)load or delete, keep each column's page inside the pages that exist
    // (skip the initial empty value, which would throw away a restored page)
    this.pendentes$.pipe(skip(1), takeUntilDestroyed())
      .subscribe(items => this.pendentePage = Math.min(this.pendentePage, totalPages(items.length)));
    this.concluidas$.pipe(skip(1), takeUntilDestroyed())
      .subscribe(items => this.concluidaPage = Math.min(this.concluidaPage, totalPages(items.length)));
    this.selectedBanco.selectedBancoId$.pipe(takeUntilDestroyed()).subscribe(() => this.loadAll());
  }

  /** Current page of the Pendente column */
  get pendentePage(): number {
    return this._pendentePage;
  }

  set pendentePage(page: number) {
    if (page === this._pendentePage) return;
    this._pendentePage = page;
    this.saveState();
  }

  /** Current page of the Concluído column */
  get concluidaPage(): number {
    return this._concluidaPage;
  }

  set concluidaPage(page: number) {
    if (page === this._concluidaPage) return;
    this._concluidaPage = page;
    this.saveState();
  }

  get bancoId(): string | null {
    return this.selectedBanco.currentBancoId;
  }

  /** Load categories then refresh both columns and sem-valor list */
  loadAll(): void {
    this.allSub?.unsubscribe();
    // Cancel the columns' requests now, not when the categories arrive: a late answer for the previous
    // banco would otherwise publish its items and clamp (and save) the pages against them
    this.pendentesSub?.unsubscribe();
    this.concluidasSub?.unsubscribe();
    this.isLoading$.next(true);
    this.allSub = this.categoriasService.getAll().subscribe({
      next: cats => {
        this.categorias$.next(cats);
        this.loadPendentes();
        this.loadConcluidas();
        this.loadDespesasSemValor();
      },
      error: err => {
        console.error('[DespesasRecorrentesListViewModel] loadAll error', err);
        this.notification.error('Falha ao carregar dados');
        this.isLoading$.next(false);
      }
    });
  }

  // ── Sem Valor ─────────────────────────────────────────────

  loadDespesasSemValor(): void {
    this.semValorSemanalSub?.unsubscribe();
    this.semValorMensalSub?.unsubscribe();
    this.semValorAnualSub?.unsubscribe();
    this.semValorPoupancaSub?.unsubscribe();
    const bancoId = this.bancoId;
    if (!bancoId) {
      this.despesasSemValorSemanal$.next([]);
      this.despesasSemValorMensal$.next([]);
      this.despesasSemValorAnual$.next([]);
      this.despesasSemValorPoupanca$.next([]);
      return;
    }
    this.semValorSemanalSub = this.despesasRecorrentesService.getSemValorPorTipo(bancoId, 'Despesa Semanal').subscribe({
      next: dtos => this.despesasSemValorSemanal$.next(DespesasRecorrentesMapper.toModelArray(dtos)),
      error: err => { console.error('[DespesasRecorrentesListViewModel] loadDespesasSemValor error', err); }
    });
    this.semValorMensalSub = this.despesasRecorrentesService.getSemValorPorTipo(bancoId, 'Despesa Mensal').subscribe({
      next: dtos => this.despesasSemValorMensal$.next(DespesasRecorrentesMapper.toModelArray(dtos)),
      error: err => { console.error('[DespesasRecorrentesListViewModel] loadDespesasSemValor error', err); }
    });
    this.semValorAnualSub = this.despesasRecorrentesService.getSemValorPorTipo(bancoId, 'Despesa Anual').subscribe({
      next: dtos => this.despesasSemValorAnual$.next(DespesasRecorrentesMapper.toModelArray(dtos)),
      error: err => { console.error('[DespesasRecorrentesListViewModel] loadDespesasSemValor error', err); }
    });
    this.semValorPoupancaSub = this.despesasRecorrentesService.getSemValorPorTipo(bancoId, 'Poupança').subscribe({
      next: dtos => this.despesasSemValorPoupanca$.next(DespesasRecorrentesMapper.toModelArray(dtos)),
      error: err => { console.error('[DespesasRecorrentesListViewModel] loadDespesasSemValor error', err); }
    });
  }

  // ── Pendentes column ──────────────────────────────────────

  loadPendentes(): void {
    this.pendentesSub?.unsubscribe();
    const f = this.pendenteFilters;
    const bancoId = this.bancoId ?? undefined;

    if (!bancoId) {
      this.pendentes$.next([]);
      this.isLoading$.next(false);
      return;
    }

    // Categoria filter
    if (f.categoriaId) {
      this.pendentesSub = this.transacoesService.getDespesaRecorrenteByCategoria(f.categoriaId, bancoId).subscribe({
        next: dtos => {
          this.pendentes$.next(TransacoesMapper.toModelArray(dtos).filter(t => t.status === 'Pendente'));
          this.isLoading$.next(false);
        },
        error: () => { this.notification.error('Falha ao filtrar despesas pendentes'); this.isLoading$.next(false); }
      });
      return;
    }

    // No filter — load by status directly
    this.pendentesSub = this.transacoesService.getDespesaRecorrenteByStatus('Pendente', bancoId).subscribe({
      next: dtos => { this.pendentes$.next(TransacoesMapper.toModelArray(dtos)); this.isLoading$.next(false); },
      error: () => { this.notification.error('Falha ao carregar despesas pendentes'); this.isLoading$.next(false); }
    });
  }

  applyPendenteFilters(filters: DespesaFilters): void {
    this.pendenteFilters = { ...filters };
    this._pendentePage = 1;
    this.saveState();
    this.loadPendentes();
  }

  clearPendenteFilters(): void {
    this.pendenteFilters = { categoriaId: '', period: '' };
    this._pendentePage = 1;
    this.saveState();
    this.loadPendentes();
  }

  // ── Concluídas column ─────────────────────────────────────

  loadConcluidas(): void {
    this.concluidasSub?.unsubscribe();
    const f = this.concluidaFilters;
    const bancoId = this.bancoId ?? undefined;

    if (!bancoId) {
      this.concluidas$.next([]);
      this.isLoading$.next(false);
      return;
    }

    // Period filter
    if (f.period && !f.categoriaId) {
      this.concluidasSub = this.transacoesService.getDespesaRecorrenteByPeriod(f.period, bancoId).subscribe({
        next: dtos => {
          this.concluidas$.next(TransacoesMapper.toModelArray(dtos).filter(t => t.status === 'Concluído'));
          this.isLoading$.next(false);
        },
        error: () => { this.notification.error('Falha ao filtrar despesas concluídas'); this.isLoading$.next(false); }
      });
      return;
    }

    // Categoria filter (or both)
    if (f.categoriaId) {
      this.concluidasSub = this.transacoesService.getDespesaRecorrenteByCategoria(f.categoriaId, bancoId).subscribe({
        next: dtos => {
          let all = TransacoesMapper.toModelArray(dtos).filter(t => t.status === 'Concluído');
          if (f.period) all = filterByPeriod(all, f.period);
          this.concluidas$.next(all);
          this.isLoading$.next(false);
        },
        error: () => { this.notification.error('Falha ao filtrar despesas concluídas'); this.isLoading$.next(false); }
      });
      return;
    }

    // No filter — load by status directly
    this.concluidasSub = this.transacoesService.getDespesaRecorrenteByStatus('Concluído', bancoId).subscribe({
      next: dtos => { this.concluidas$.next(TransacoesMapper.toModelArray(dtos)); this.isLoading$.next(false); },
      error: () => { this.notification.error('Falha ao carregar despesas concluídas'); this.isLoading$.next(false); }
    });
  }

  applyConcluidaFilters(filters: DespesaFilters): void {
    this.concluidaFilters = { ...filters };
    this._concluidaPage = 1;
    this.saveState();
    this.loadConcluidas();
  }

  clearConcluidaFilters(): void {
    this.concluidaFilters = { categoriaId: '', period: 'Este Mês' };
    this._concluidaPage = 1;
    this.saveState();
    this.loadConcluidas();
  }

  // ── State kept while navigating inside /despesas-recorrentes ──

  /** Take over the filters and pages saved by the previous list (e.g. before opening a form) */
  private restoreState(): void {
    const saved = this.listState.get<DespesasRecorrentesListState>(STATE_GROUP, STATE_KEY);
    if (!saved) return;
    this.pendenteFilters = saved.pendenteFilters;
    this.concluidaFilters = saved.concluidaFilters;
    this._pendentePage = saved.pendentePage;
    this._concluidaPage = saved.concluidaPage;
  }

  private saveState(): void {
    this.listState.set<DespesasRecorrentesListState>(STATE_GROUP, STATE_KEY, {
      pendenteFilters: this.pendenteFilters,
      concluidaFilters: this.concluidaFilters,
      pendentePage: this._pendentePage,
      concluidaPage: this._concluidaPage
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  /**
   * Returns true if the transaction id is currently being processed
   */
  isBusy(id: string): boolean {
    return this.busyIds.has(id);
  }

  /**
   * Conclude a recurring transaction: calls the correct endpoint depending on the transaction type.
   * Supports 'Despesa Mensal' and 'Poupança'. Refreshes lists on success.
   */
  concluirTransacao(t: TransacaoModel): void {
    if (!t || !t.id) return;
    if (this.isBusy(t.id)) return;

    // Only allow concluding pending items
    if (t.status !== 'Pendente') {
      this.notification.info('Transaction is not pending');
      return;
    }

    let obs$;
    if (t.tipo === 'Despesa Mensal' || 'Despesa Semanal' || 'Despesa Anual') {
      obs$ = this.transacoesService.concluirDespesaRecorrente(t.id);
    } else if (t.tipo === 'Poupança' || t.tipo === 'Poupanca') {
      obs$ = this.transacoesService.concluirPoupanca(t.id);
    } else {
      this.notification.info('Não é possível concluir este tipo de transação');
      return;
    }

    this.busyIds.add(t.id);
    this.isLoading$.next(true);

    obs$.subscribe({
      next: () => {
        this.notification.success('Transação concluída com sucesso');
        // reload both columns to reflect new status
        this.loadPendentes();
        this.loadConcluidas();
        this.busyIds.delete(t.id);
        this.isLoading$.next(false);
      },
      error: (err) => {
        console.error('concluirTransacao error', err);
        this.notification.error('Falha ao concluir transação');
        this.busyIds.delete(t.id);
        this.isLoading$.next(false);
      }
    });
  }

  /**
   * Delete a transaction by its domain id.
   * Calls API, removes the transaction from the current lists and notifies the user.
   */
  public deleteTransacao(transacaoId: string): void {
    if (!transacaoId) return;
    if (this.isBusy(transacaoId)) return;

    this.busyIds.add(transacaoId);
    this.isLoading$.next(true);

    this.transacoesService.delete(transacaoId).subscribe({
      next: () => {
        // Remove from pendentes and concluidas lists if present
        this.pendentes$.next(this.pendentes$.getValue().filter(t => t.id !== transacaoId));
        this.concluidas$.next(this.concluidas$.getValue().filter(t => t.id !== transacaoId));

        this.notification.success('Transação eliminada com sucesso');
        this.busyIds.delete(transacaoId);
        this.isLoading$.next(false);
      },
      error: (err) => {
        console.error('[DespesasRecorrentesListViewModel] deleteTransacao error', err);
        this.notification.error('Falha ao eliminar transação');
        this.busyIds.delete(transacaoId);
        this.isLoading$.next(false);
      }
    });
  }
}

/** Number of pages for a column with `count` items (at least 1) */
const totalPages = (count: number): number => Math.max(1, Math.ceil(count / PAGE_SIZE));
