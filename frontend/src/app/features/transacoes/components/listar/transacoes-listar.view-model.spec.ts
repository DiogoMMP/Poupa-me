import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { TransacoesListViewModel } from './transacoes-listar.view-model';
import { TransacoesService } from '../../services/transacoes.service';
import { CategoriasService } from '../../../categorias/services/categorias.service';
import { CartoesCreditoService } from '../../../cartoes-credito/services/cartoes-credito.service';
import { ContasService } from '../../../contas/services/contas.service';
import { NotificationService } from '../../../../services/notification.service';
import { SelectedBancoService } from '../../../../services/selected-banco.service';
import { ListStateService } from '../../../../services/list-state.service';
import { DEFAULT_PAGE_SIZE } from '../../../../shared/components/pagination/pagination.component';
import { PaginatedDTO } from '../../../../shared/dto/paginated.dto';
import { TransacoesDTO } from '../../dto/transacoes.dto';

describe('TransacoesListViewModel (estado ao voltar à lista)', () => {
  let bancoId$: BehaviorSubject<string | null>;
  let transacoes: jasmine.SpyObj<TransacoesService>;

  /** Fake API page that always exists, so the "page beyond the end" correction never kicks in */
  const pageOf = (page: number, pageSize: number) =>
    of({ items: [], page, pageSize, totalPages: 9, totalItems: 90 });

  const newViewModel = () => TestBed.runInInjectionContext(() => new TransacoesListViewModel());

  beforeEach(() => {
    bancoId$ = new BehaviorSubject<string | null>('BNC1');
    transacoes = jasmine.createSpyObj<TransacoesService>('TransacoesService', ['getContaTransactionsPage', 'getCartaoTransactionsPage', 'delete']);
    transacoes.getContaTransactionsPage.and.callFake((_f, page, size) => pageOf(page, size));
    transacoes.getCartaoTransactionsPage.and.callFake((_f, page, size) => pageOf(page, size));

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: new Subject<unknown>() } },
        { provide: TransacoesService, useValue: transacoes },
        { provide: CategoriasService, useValue: { getAll: () => of([]) } },
        { provide: CartoesCreditoService, useValue: { getAll: () => of([]) } },
        { provide: ContasService, useValue: { getAll: () => of([]) } },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
        {
          provide: SelectedBancoService,
          useValue: { selectedBancoId$: bancoId$.asObservable(), get currentBancoId() { return bancoId$.value; } }
        }
      ]
    });
  });

  it('a new list (back from a form) starts with the filters and pages the previous one had', () => {
    const before = newViewModel();
    before.applyContaFilters({ categoriaId: 'CAT1', contaId: 'CNT1', period: 'Último Ano' });
    before.setContaPageSize(50);
    before.setContaPage(3);
    before.applyCartaoFilters({ categoriaId: '', cartaoId: 'CRT1', status: 'Pendente', period: 'Últimos 3 Meses' });
    before.setCartaoPage(2);

    transacoes.getContaTransactionsPage.calls.reset();
    transacoes.getCartaoTransactionsPage.calls.reset();
    const after = newViewModel();

    expect(after.contaFilters).toEqual({ categoriaId: 'CAT1', contaId: 'CNT1', period: 'Último Ano' });
    expect(after.cartaoFilters).toEqual({ categoriaId: '', cartaoId: 'CRT1', status: 'Pendente', period: 'Últimos 3 Meses' });
    expect(transacoes.getContaTransactionsPage.calls.first().args)
      .toEqual([{ bancoId: 'BNC1', contaId: 'CNT1', categoriaId: 'CAT1', period: 'Último Ano' }, 3, 50]);
    expect(transacoes.getCartaoTransactionsPage.calls.first().args)
      .toEqual([{ bancoId: 'BNC1', cartaoCreditoId: 'CRT1', categoriaId: '', status: 'Pendente', period: 'Últimos 3 Meses' }, 2, DEFAULT_PAGE_SIZE]);
  });

  it('coming back with another banco selected drops the account/card filters and goes to page 1', () => {
    TestBed.inject(ListStateService).set('transacoes', 'listar', {
      bancoId: 'BNC1',
      contaFilters: { categoriaId: 'CAT1', contaId: 'CNT1', period: 'Último Ano' },
      cartaoFilters: { categoriaId: '', cartaoId: 'CRT1', status: 'Pendente', period: 'Este Mês' },
      contaPage: 3, contaPageSize: 50, cartaoPage: 2, cartaoPageSize: DEFAULT_PAGE_SIZE
    });
    bancoId$.next('BNC2');

    const vm = newViewModel();

    expect(vm.contaFilters).toEqual({ categoriaId: 'CAT1', contaId: '', period: 'Último Ano' });
    expect(vm.cartaoFilters).toEqual({ categoriaId: '', cartaoId: '', status: 'Pendente', period: 'Este Mês' });
    expect(transacoes.getContaTransactionsPage.calls.first().args)
      .toEqual([{ bancoId: 'BNC2', contaId: '', categoriaId: 'CAT1', period: 'Último Ano' }, 1, 50]);
    expect(transacoes.getCartaoTransactionsPage.calls.first().args[1]).toBe(1);
  });

  it('switching banco with the list open drops the account/card filters and tells the filter forms', () => {
    const vm = newViewModel();
    vm.applyContaFilters({ categoriaId: 'CAT1', contaId: 'CNT1', period: 'Este Mês' });
    vm.applyCartaoFilters({ categoriaId: '', cartaoId: 'CRT1', status: '', period: 'Este Mês' });
    const reset = jasmine.createSpy('filtersReset');
    vm.filtersReset$.subscribe(reset);
    transacoes.getContaTransactionsPage.calls.reset();

    bancoId$.next('BNC2');

    expect(reset).toHaveBeenCalledTimes(1);
    expect(vm.contaFilters).toEqual({ categoriaId: 'CAT1', contaId: '', period: 'Este Mês' });
    expect(vm.cartaoFilters.cartaoId).toBe('');
    expect(transacoes.getContaTransactionsPage.calls.mostRecent().args[0])
      .toEqual({ bancoId: 'BNC2', contaId: '', categoriaId: 'CAT1', period: 'Este Mês' });
    // A list created afterwards (back from a form) sees the same, already-cleaned state
    expect(newViewModel().contaFilters.contaId).toBe('');
  });

  it('a page request answering after the list was destroyed does not save state or load again', () => {
    const lateAnswer = new Subject<PaginatedDTO<TransacoesDTO>>();
    transacoes.getContaTransactionsPage.and.returnValue(lateAnswer);
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    runInInjectionContext(injector, () => new TransacoesListViewModel());
    const listState = TestBed.inject(ListStateService);

    injector.destroy();
    listState.clear(); // e.g. the user left /transacoes or logged out
    transacoes.getContaTransactionsPage.calls.reset();
    // Page beyond the end: a live list would correct the page, save it and ask again
    lateAnswer.next({ items: [], page: 3, pageSize: DEFAULT_PAGE_SIZE, totalPages: 1, totalItems: 5 });

    expect(listState.get('transacoes', 'listar')).toBeUndefined();
    expect(transacoes.getContaTransactionsPage).not.toHaveBeenCalled();
  });
});
