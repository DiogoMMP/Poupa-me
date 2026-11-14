import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { DespesasRecorrentesListViewModel } from './despesas-recorrentes-listar.view-model';
import { TransacoesService } from '../../../transacoes/services/transacoes.service';
import { TransacoesMapper } from '../../../transacoes/mappers/transacoes.mapper';
import { TransacaoModel } from '../../../transacoes/models/transacoes.model';
import { DespesasRecorrentesService } from '../../services/despesas-recorrentes.service';
import { CategoriasService } from '../../../categorias/services/categorias.service';
import { NotificationService } from '../../../../services/notification.service';
import { SelectedBancoService } from '../../../../services/selected-banco.service';

describe('DespesasRecorrentesListViewModel (estado ao voltar à lista)', () => {
  let transacoes: jasmine.SpyObj<TransacoesService>;

  /** `count` fake transactions with the given status (the mapper is stubbed to pass them through) */
  const items = (count: number, status: string) => of(Array.from({ length: count }, () => ({ status })));

  const newViewModel = () => TestBed.runInInjectionContext(() => new DespesasRecorrentesListViewModel());

  beforeEach(() => {
    spyOn(TransacoesMapper, 'toModelArray').and.callFake(dtos => dtos as unknown as TransacaoModel[]);
    transacoes = jasmine.createSpyObj<TransacoesService>('TransacoesService',
      ['getDespesaRecorrenteByStatus', 'getDespesaRecorrenteByCategoria', 'getDespesaRecorrenteByPeriod']);
    transacoes.getDespesaRecorrenteByStatus.and.callFake(status => items(35, status) as never);
    transacoes.getDespesaRecorrenteByCategoria.and.returnValue(items(35, 'Pendente') as never);
    transacoes.getDespesaRecorrenteByPeriod.and.returnValue(items(35, 'Concluído') as never);
    const bancoId$ = new BehaviorSubject<string | null>('BNC1');

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: new Subject<unknown>() } },
        { provide: TransacoesService, useValue: transacoes },
        { provide: DespesasRecorrentesService, useValue: { getSemValorPorTipo: () => of([]) } },
        { provide: CategoriasService, useValue: { getAll: () => of([]) } },
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
    before.applyPendenteFilters({ categoriaId: 'CAT1', period: '' });
    before.pendentePage = 3;
    before.applyConcluidaFilters({ categoriaId: '', period: 'Último Ano' });
    before.concluidaPage = 2;

    transacoes.getDespesaRecorrenteByCategoria.calls.reset();
    transacoes.getDespesaRecorrenteByPeriod.calls.reset();
    const after = newViewModel();

    expect(after.pendenteFilters).toEqual({ categoriaId: 'CAT1', period: '' });
    expect(after.concluidaFilters).toEqual({ categoriaId: '', period: 'Último Ano' });
    expect(after.pendentePage).toBe(3);
    expect(after.concluidaPage).toBe(2);
    expect(transacoes.getDespesaRecorrenteByCategoria).toHaveBeenCalledWith('CAT1', 'BNC1');
    expect(transacoes.getDespesaRecorrenteByPeriod).toHaveBeenCalledWith('Último Ano', 'BNC1');
  });

  it('a saved page that no longer exists falls back to the last page', () => {
    const vm = newViewModel();
    vm.pendentePage = 4; // 35 items → 4 pages of 10

    vm.pendentes$.next(Array.from({ length: 12 }, () => ({ status: 'Pendente' }) as TransacaoModel));

    expect(vm.pendentePage).toBe(2);
    expect(newViewModel().pendentePage).toBe(2);
  });
});
