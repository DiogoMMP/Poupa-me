import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DespesasRecorrentesListViewModel, DespesaFilters, PAGE_SIZE } from './despesas-recorrentes-listar.view-model';
import { TransacaoModel } from '../../../transacoes/models/transacoes.model';
import { DespesaRecorrenteModel } from '../../models/despesas-recorrentes.model';
import { formatData } from './despesas-recorrentes-listar.formatter';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { ToSelectOptionsPipe } from '../../../../shared/pipes/to-select-options.pipe';

@Component({
  selector: 'app-despesas-recorrentes-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, SelectComponent, ToSelectOptionsPipe],
  templateUrl: './despesas-recorrentes-listar.component.html',
  styleUrls: ['./despesas-recorrentes-listar.component.css'],
  providers: [DespesasRecorrentesListViewModel]
})
export class DespesasRecorrentesListComponent implements OnInit {
  public vm = inject(DespesasRecorrentesListViewModel);
  private router = inject(Router);

  readonly formatData = formatData;

  // Filter form state, starting from the filters the list is using (restored when coming back from a form)
  pendenteFilterForm: DespesaFilters = { ...this.vm.pendenteFilters };
  concluidaFilterForm: DespesaFilters = { ...this.vm.concluidaFilters };

  // Toggle filter panels
  showPendenteFilters = false;
  showConcluidaFilters = false;

  // Pagination — kept in the ViewModel so it survives a trip to a form and back
  get pendentePage(): number { return this.vm.pendentePage; }
  set pendentePage(page: number) { this.vm.pendentePage = page; }

  get concluidaPage(): number { return this.vm.concluidaPage; }
  set concluidaPage(page: number) { this.vm.concluidaPage = page; }

  ngOnInit(): void {
    this.vm.loadAll();
  }


  /**
   * User clicked a recurring expense without valor — navigate to gerar-transacao form
   */
  onDespesaSemValorClick(d: DespesaRecorrenteModel): void {
    this.router.navigate(['/despesas-recorrentes/gerar-transacao', d.id]);
  }

  paginate(items: TransacaoModel[], page: number): TransacaoModel[] {
    return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }

  totalPages(items: TransacaoModel[]): number {
    return Math.ceil(items.length / PAGE_SIZE) || 1;
  }

  // ── Pendente filters ──────────────────────────────────────

  applyPendenteFilters(): void {
    this.vm.applyPendenteFilters({ ...this.pendenteFilterForm });
  }

  clearPendenteFilters(): void {
    this.pendenteFilterForm = { categoriaId: '', period: '' };
    this.vm.clearPendenteFilters();
  }

  hasActivePendenteFilters(): boolean {
    return !!this.pendenteFilterForm.categoriaId;
  }

  // ── Concluída filters ─────────────────────────────────────

  applyConcluidaFilters(): void {
    this.vm.applyConcluidaFilters({ ...this.concluidaFilterForm });
  }

  clearConcluidaFilters(): void {
    this.concluidaFilterForm = { categoriaId: '', period: 'Este Mês' };
    this.vm.clearConcluidaFilters();
  }

  hasActiveConcluidaFilters(): boolean {
    return !!(this.concluidaFilterForm.categoriaId || this.concluidaFilterForm.period);
  }
}
