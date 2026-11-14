import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { ListStateService } from './list-state.service';

describe('ListStateService', () => {
  let service: ListStateService;
  let events: Subject<unknown>;
  let navId = 0;

  const navigate = (url: string) => events.next(new NavigationEnd(++navId, url, url));

  beforeEach(() => {
    events = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }]
    });
    service = TestBed.inject(ListStateService);
  });

  it('keeps the state while navigating inside the same group', () => {
    navigate('/transacoes');
    service.set('transacoes', 'lista', { categoriaId: 'CAT1' });

    navigate('/transacoes/editar/1');
    navigate('/transacoes?x=1');

    expect(service.get('transacoes', 'lista')).toEqual({ categoriaId: 'CAT1' });
  });

  it('drops the state when navigating out of the group', () => {
    navigate('/transacoes');
    service.set('transacoes', 'lista', { categoriaId: 'CAT1' });
    service.set('despesas-recorrentes', 'lista', { categoriaId: 'CAT2' });

    navigate('/despesas-recorrentes/editar-transacao/1');
    expect(service.get('transacoes', 'lista')).toBeUndefined();
    expect(service.get('despesas-recorrentes', 'lista')).toEqual({ categoriaId: 'CAT2' });

    navigate('/contas');
    expect(service.get('despesas-recorrentes', 'lista')).toBeUndefined();
  });

  it('clear() drops every saved state', () => {
    service.set('transacoes', 'lista', { page: 2 });
    service.clear();
    expect(service.get('transacoes', 'lista')).toBeUndefined();
  });

  it('stores and returns copies, so outside changes do not leak in', () => {
    const state = { filters: { categoriaId: 'CAT1' } };
    service.set('transacoes', 'lista', state);
    state.filters.categoriaId = 'MUDOU';

    const read = service.get<typeof state>('transacoes', 'lista')!;
    read.filters.categoriaId = 'MUDOU-OUTRA-VEZ';

    expect(service.get('transacoes', 'lista')).toEqual({ filters: { categoriaId: 'CAT1' } });
  });
});
