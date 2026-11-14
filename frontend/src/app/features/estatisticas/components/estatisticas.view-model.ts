import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, catchError, of, switchMap, combineLatest, debounceTime, tap } from 'rxjs';
import { BancosService } from '../../bancos/services/bancos.service';
import { BancosMapper } from '../../bancos/mappers/bancos.mapper';
import { NotificationService } from '../../../services/notification.service';
import { SelectedBancoService } from '../../../services/selected-banco.service';
import { EstatisticasService } from '../services/estatisticas.service';
import { EstatisticasModel, IGrupoEstatisticaModel } from '../models/estatisticas.model';
import { corGrupoHex } from '../../../shared/constants/cores-grupo';
import { EstatisticasMapper } from '../mappers/estatisticas.mapper';
import { BancosModel } from '../../bancos/models/bancos.model';

/** Vista do cartão de gastos. */
export type VistaGastos = 'grupo' | 'categoria';

/** Chave da secção "Sem grupo" (as categorias sem grupo somam-se aqui). */
export const CHAVE_SEM_GRUPO = '__sem_grupo__';

/** Uma linha do detalhe de um grupo: uma categoria com o seu peso no grupo. */
export interface CategoriaDoGrupo {
  nome: string;
  icon: string;
  valor: number;
  /** % do total do grupo. */
  percentagem: number;
  numTransacoes: number;
}

/** Gastos de um grupo, somados a partir das categorias. */
export interface GastosGrupo {
  chave: string;
  nome: string;
  /** Hex da cor do grupo (cinza para "Sem grupo"). */
  cor: string;
  ordem: number;
  total: number;
  /** % do total de gastos. */
  percentagem: number;
  numTransacoes: number;
  categorias: CategoriaDoGrupo[];
}

@Injectable()
export class EstatisticasViewModel {
  private estatisticasService = inject(EstatisticasService);
  private bancosService = inject(BancosService);
  private notification = inject(NotificationService);
  private selectedBancoService = inject(SelectedBancoService);

  readonly estatisticas$ = new BehaviorSubject<EstatisticasModel | null>(null);
  readonly isLoading$ = new BehaviorSubject<boolean>(false);
  readonly bancos$ = new BehaviorSubject<BancosModel[]>([]);

  readonly selectedMonth$ = new BehaviorSubject<number | null>(null);
  readonly selectedYear$ = new BehaviorSubject<number | null>(null);

  readonly hasBancoSelected$ = this.selectedBancoService.selectedBancoId$.pipe(
    map(id => !!id)
  );

  private selectedBancoId: string | null = null;

  /** Vista do cartão de gastos; por omissão "Por grupo". */
  readonly vista$ = new BehaviorSubject<VistaGastos>('grupo');
  /** Chave do grupo aberto no detalhe, ou null na vista dos grupos. */
  readonly grupoSelecionado$ = new BehaviorSubject<string | null>(null);

  /**
   * Gastos somados por grupo (`grupo.id`; null = "Sem grupo"), pela ordem dos grupos, com "Sem grupo" no fim.
   */
  readonly gastosPorGrupo$: Observable<GastosGrupo[]> = this.estatisticas$.pipe(
    map(stats => EstatisticasViewModel.agruparPorGrupo(stats))
  );

  /** O grupo aberto no detalhe, ou null. */
  readonly detalheGrupo$: Observable<GastosGrupo | null> = combineLatest([this.gastosPorGrupo$, this.grupoSelecionado$]).pipe(
    map(([grupos, chave]) => (chave ? grupos.find(g => g.chave === chave) ?? null : null))
  );

  constructor() {
    combineLatest([
      this.selectedBancoService.selectedBancoId$,
      this.selectedMonth$,
      this.selectedYear$
    ]).pipe(
      debounceTime(100)
    ).subscribe(([bancoId, month, year]) => {
      this.loadEstatisticas(bancoId, month, year);
    });
  }

  loadBancos(): void {
    this.bancosService.getAll().subscribe({
      next: (dtos) => {
        const models = BancosMapper.toModelArray(dtos);
        this.bancos$.next(models);

        const storedId = this.selectedBancoService.currentBancoId;
        if (storedId && !models.some(b => b.id === storedId)) {
          this.selectedBancoService.clearSelection();
        }
      },
      error: (err: any) => {
        if (err?.status !== 401) {
          console.error('[FRONTEND] EstatisticasViewModel.loadBancos -', err);
          this.notification.error('Falha ao carregar bancos');
        }
        this.bancos$.next([]);
      }
    });
  }

  setVista(vista: VistaGastos): void {
    this.vista$.next(vista);
    this.grupoSelecionado$.next(null);
  }

  /** Abre o detalhe de um grupo (pela chave). */
  abrirGrupo(chave: string): void {
    this.grupoSelecionado$.next(chave);
  }

  /** Volta da vista de detalhe para a vista dos grupos. */
  voltar(): void {
    this.grupoSelecionado$.next(null);
  }

  /**
   * Soma as categorias por grupo. O agrupamento é feito aqui, a partir de `categorias` (cada uma traz o seu grupo).
   */
  private static agruparPorGrupo(stats: EstatisticasModel | null): GastosGrupo[] {
    if (!stats) return [];
    const totalGeral = stats.categorias.reduce((s, c) => s + c.total.valor, 0);
    const porChave = new Map<string, { grupo: IGrupoEstatisticaModel | null; itens: typeof stats.categorias }>();

    for (const c of stats.categorias) {
      const chave = c.grupo?.id ?? CHAVE_SEM_GRUPO;
      const entrada = porChave.get(chave) ?? { grupo: c.grupo, itens: [] };
      entrada.itens.push(c);
      porChave.set(chave, entrada);
    }

    const grupos = Array.from(porChave.entries()).map(([chave, { grupo, itens }]): GastosGrupo => {
      const total = itens.reduce((s, c) => s + c.total.valor, 0);
      return {
        chave,
        nome: grupo?.nome ?? 'Sem grupo',
        cor: corGrupoHex(grupo?.cor),
        ordem: grupo?.ordem ?? Number.MAX_SAFE_INTEGER,
        total,
        percentagem: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
        numTransacoes: itens.reduce((s, c) => s + c.numTransacoes, 0),
        categorias: itens
          .map(c => ({
            nome: c.categoria.nome,
            icon: c.categoria.icon,
            valor: c.total.valor,
            percentagem: total > 0 ? (c.total.valor / total) * 100 : 0,
            numTransacoes: c.numTransacoes
          }))
          .sort((x, y) => y.valor - x.valor)
      };
    });

    return grupos.sort((x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome));
  }

  setMonthYear(month: number | null, year: number | null): void {
    this.selectedMonth$.next(month);
    this.selectedYear$.next(year);
  }

  private loadEstatisticas(bancoId: string | null, month: number | null, year: number | null): void {
    if (!bancoId) {
      this.estatisticas$.next(null);
      return;
    }

    this.isLoading$.next(true);
    this.estatisticasService.getEstatisticas(bancoId, month ?? undefined, year ?? undefined).subscribe({
      next: (dto) => {
        const model = EstatisticasMapper.toModel(dto);
        // Outro período/banco: o grupo aberto pode já não existir, volta à vista dos grupos
        this.grupoSelecionado$.next(null);
        this.estatisticas$.next(model);
        this.isLoading$.next(false);
      },
      error: (err) => {
        console.error('[FRONTEND] EstatisticasViewModel.loadEstatisticas -', err);
        this.notification.error('Falha ao carregar estatísticas');
        this.isLoading$.next(false);
      }
    });
  }
}
