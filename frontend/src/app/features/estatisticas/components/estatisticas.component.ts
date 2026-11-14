import {Component, ChangeDetectionStrategy, inject, OnInit, HostListener} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {AuthService} from '../../auth/services/auth.service';
import { signal } from '@angular/core';
import { EstatisticasViewModel, GastosGrupo } from './estatisticas.view-model';
import { FormsModule } from '@angular/forms';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { map } from 'rxjs/operators';

import { IconComponent } from '../../../shared/components/icon/icon.component';
import { SelectComponent, AppSelectOption } from '../../../shared/components/select/select.component';
import { CORES_GRUPO } from '../../../shared/constants/cores-grupo';

/** Cores das fatias quando não há cor de grupo (vista por categoria e detalhe de um grupo): a paleta, em ciclo. */
const PALETA_FATIAS: string[] = Object.values(CORES_GRUPO);

/** Linha de uma legenda HTML de um donut (o nome quebra linha, ao contrário das etiquetas SVG do ngx-charts). */
export interface LinhaLegenda {
  nome: string;
  icon?: string;
  valor: number;
  percentagem: number;
  cor: string;
}

const FORMATO_EURO = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Escapa texto para o HTML do tooltip do ngx-charts (os nomes das categorias são escritos pelo utilizador). */
function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
/**
 * Estatisticas component.
 */
@Component({
  selector: 'app-estatisticas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, FormsModule, NgxChartsModule, IconComponent, SelectComponent],
  templateUrl: 'estatisticas.component.html',
  styleUrls: ['estatisticas.component.css'],
  host: {class: 'page-estatisticas'},
  standalone: true,
  providers: [EstatisticasViewModel, CurrencyPipe]
})

/**
 * Estatísticas component class.
 */
export class EstatisticasComponent implements OnInit {
  private auth = inject(AuthService);
  user = this.auth.user;

  msg = signal('');

  // ViewModel
  vm = inject(EstatisticasViewModel);

  estatisticas$ = this.vm.estatisticas$;
  isLoading$ = this.vm.isLoading$;
  hasBancoSelected$ = this.vm.hasBancoSelected$;

  // Vista do cartão de gastos ("Por grupo" / "Por categoria") e detalhe do grupo aberto
  vista$ = this.vm.vista$;
  gastosPorGrupo$ = this.vm.gastosPorGrupo$;
  detalheGrupo$ = this.vm.detalheGrupo$;

  // Chart data
  /** Legenda da vista "Por categoria": nome, valor, % e cor da fatia. */
  legendaCategorias$ = this.estatisticas$.pipe(
    map((stats): LinhaLegenda[] => {
      const categorias = stats?.categorias ?? [];
      const total = categorias.reduce((s, c) => s + c.total.valor, 0);
      return categorias.map((c, i) => ({
        nome: c.categoria.nome,
        icon: c.categoria.icon,
        valor: c.total.valor,
        percentagem: total > 0 ? (c.total.valor / total) * 100 : 0,
        cor: PALETA_FATIAS[i % PALETA_FATIAS.length]
      }));
    })
  );

  pieChartData$ = this.legendaCategorias$.pipe(
    map(linhas => linhas.map(l => ({ name: l.nome, value: l.valor })))
  );

  /** Cores das fatias da vista "Por categoria", iguais às da legenda. */
  pieChartColors$ = this.legendaCategorias$.pipe(
    map(linhas => linhas.map(l => ({ name: l.nome, value: l.cor })))
  );

  /** Uma fatia por grupo. */
  pieGruposData$ = this.gastosPorGrupo$.pipe(
    map(grupos => grupos.map(g => ({ name: g.nome, value: g.total })))
  );

  /** Cor de cada fatia = cor do grupo (`customColors` do ngx-charts, pelo nome da fatia). */
  pieGruposColors$ = this.gastosPorGrupo$.pipe(
    map(grupos => grupos.map(g => ({ name: g.nome, value: g.cor })))
  );

  /** Donut das categorias do grupo aberto no detalhe. */
  pieDetalheData$ = this.detalheGrupo$.pipe(
    map(grupo => grupo?.categorias.map(c => ({ name: c.nome, value: c.valor })) ?? [])
  );

  /** Cores das fatias do detalhe, as mesmas dos pontos da tabela (`corDetalhe`). */
  pieDetalheColors$ = this.detalheGrupo$.pipe(
    map(grupo => grupo?.categorias.map((c, i) => ({ name: c.nome, value: this.corDetalhe(i) })) ?? [])
  );

  /** Cor da i-ésima categoria do detalhe de um grupo. */
  corDetalhe(i: number): string {
    return PALETA_FATIAS[i % PALETA_FATIAS.length];
  }

  /** Tooltip dos donuts: nome e valor em euros. */
  readonly tooltipEuro = (arc: { data: { name: string; value: number } }): string =>
    `<span class="tooltip-label">${escaparHtml(String(arc.data.name))}</span>` +
    `<span class="tooltip-val">${FORMATO_EURO.format(Number(arc.data.value) || 0)} €</span>`;

  /**
   * Clique numa fatia do donut dos grupos: abre o detalhe do grupo com esse nome.
   */
  onSelectGrupo(event: { name?: string } | string, grupos: GastosGrupo[]): void {
    const nome = typeof event === 'string' ? event : event?.name;
    const grupo = grupos.find(g => g.nome === nome);
    if (grupo) this.vm.abrirGrupo(grupo.chave);
  }

  lineChartData$ = this.estatisticas$.pipe(
    map(stats => stats ? [{
      name: 'Despesas',
      series: stats.historicoDiario.map(h => ({
        name: `${h.data.dia}/${h.data.mes}`,
        value: h.total.valor
      }))
    }] : [])
  );

  selectedMonth: number | '' = '';
  selectedYear: number | '' = '';

  showFilters = false;

  months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  years: number[] = [];

  /**
   * Opções do `<app-select>` do mês, com "Mês Atual" como opção vazia real.
   */
  get monthOptions(): AppSelectOption[] {
    return [{ value: '', label: 'Mês Atual' }, ...this.months];
  }

  /**
   * Opções do `<app-select>` do ano, com "Ano Atual" como opção vazia real.
   */
  get yearOptions(): AppSelectOption[] {
    return [{ value: '', label: 'Ano Atual' }, ...this.years.map(y => ({ value: y, label: String(y) }))];
  }


  ngOnInit(): void {
    this.msg.set(this.computeMsg());
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      this.years.push(i);
    }

    // Set initial filters (empty by default)
    this.vm.setMonthYear(null, null);

    this.vm.loadBancos();
  }

  hasActiveFilters(): boolean {
    return this.selectedMonth !== '' || this.selectedYear !== '';
  }

  applyFilters(): void {
    const month = this.selectedMonth === '' ? null : Number(this.selectedMonth);
    const year = this.selectedYear === '' ? null : Number(this.selectedYear);

    this.vm.setMonthYear(month, year);
    this.showFilters = false;
  }

  clearFilters(): void {
    this.selectedMonth = '';
    this.selectedYear = '';
    this.vm.setMonthYear(null, null);
    this.showFilters = false;
  }

  mensagensEstatisticas = [
    "O segredo não é ganhar mais, é gerir melhor o que já tem na mão.",
    "Cada euro provisionado para o seu cartão é uma dor de cabeça a menos no final do mês.",
    "O seu cashflow é o batimento cardíaco das suas finanças: mantenha-o estável e saudável.",
    "Saber exatamente para onde vai o seu dinheiro é o primeiro passo para decidir onde ele deve estar.",
    "As despesas pequenas são como fugas num barco; se as ignorar, acaba por afundar sem perceber porquê.",
    "Provisionar não é 'perder' dinheiro, é ganhar a liberdade de o gastar com consciência.",
    "Um mês terminado no verde não é fruto da sorte, é o resultado direto do seu planeamento.",
    "As suas categorias revelam as suas prioridades reais. Estão alinhadas com os seus objetivos de vida?",
    "Automatizar o registo das suas despesas recorrentes liberta espaço mental para o que realmente importa.",
    "O saldo da conta pode enganar, mas as estatísticas mostram sempre a verdade nua e crua.",
    "Analisar os gastos do passado é a única forma de garantir que não comete os mesmos erros no futuro.",
    "Sempre que o seu saldo líquido é positivo, está a financiar os sonhos do seu 'eu' de amanhã.",
    "O controlo financeiro não serve para limitar a sua liberdade, serve para a criar.",
    "Gastar sem provisão é como conduzir de olhos vendados: o embate com a fatura é inevitável.",
    "A clareza sobre os seus números é o maior luxo que pode oferecer à sua tranquilidade.",
    "Se não consegue medir, não consegue gerir. Estes gráficos são o seu painel de controlo.",
    "O dinheiro que poupa nas categorias supérfluas é o combustível para os seus grandes investimentos.",
    "A consistência na análise é o que separa quem sobrevive ao mês de quem domina as finanças.",
    "Não olhe para os gastos como perdas, olhe como dados para uma estratégia mais inteligente.",
    "Finanças pessoais são 20% matemática e 80% comportamento. Os seus dados mostram o seu hábito."
  ];

  private computeMsg(): string {
    const index = Math.floor(Math.random() * this.mensagensEstatisticas.length);
    return this.mensagensEstatisticas[index];
  }
}

/**
 * Routes for the dashboard feature module.
 */
export const routes: Routes = [
  { path: '', component: EstatisticasComponent }
];
