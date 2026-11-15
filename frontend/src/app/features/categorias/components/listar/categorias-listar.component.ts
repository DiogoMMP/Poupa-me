import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router, NavigationStart } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subscription, filter, take } from 'rxjs';
import { CategoriasListViewModel } from './categorias-listar.view-model';
import { GrupoCategoriaDTO } from '../../dto/categorias.dto';
import { corGrupoHex, fundoIconeGrupo } from '../../../../shared/constants/cores-grupo';
import { ListStateService } from '../../../../services/list-state.service';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { EntityCardComponent } from '../../../../shared/components/entity-card/entity-card.component';

/** Grupo de rotas e chave sob as quais a posição do scroll da lista é guardada no `ListStateService`. */
const LIST_STATE_GROUP = 'categorias';
const LIST_STATE_KEY = 'listar-scroll';

/** Posição do scroll da página: a janela e a área de conteúdo do layout (a que tiver scroll). */
interface ScrollGuardado {
  janela: number;
  conteudo: number;
}

@Component({
  selector: 'app-categorias-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DragDropModule, IconComponent, EntityCardComponent],
  templateUrl: './categorias-listar.component.html',
  styleUrls: ['./categorias-listar.component.css'],
  providers: [CategoriasListViewModel]
})
export class CategoriasListComponent implements OnInit, OnDestroy {
  public vm = inject(CategoriasListViewModel);
  private listState = inject(ListStateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private router = inject(Router);
  private restoreSub?: Subscription;
  private saveSub?: Subscription;

  // Expose commonly used observables/actions directly to the template for easier bindings
  public isLoading$ = this.vm.isLoading$;
  public grupos$ = this.vm.grupos$;
  public semGrupo$ = this.vm.semGrupo$;
  public auth = this.vm.auth;

  // helpers that forward to vm
  deleteCategoria(id: string) { this.vm.deleteCategoria(id); }
  deleteGrupo(grupo: GrupoCategoriaDTO) { this.vm.deleteGrupo(grupo); }

  /** Fundo do círculo do emoji, na cor do grupo a 30% (cinza para "Sem grupo"). */
  iconBackground(grupo: GrupoCategoriaDTO | null): string {
    return fundoIconeGrupo(corGrupoHex(grupo?.cor));
  }

  /** Contorno do círculo do emoji, na cor sólida do grupo, como o contorno dos outros cards. */
  iconBorder(grupo: GrupoCategoriaDTO | null): string {
    return corGrupoHex(grupo?.cor);
  }

  ngOnInit() {
    this.vm.loadData();
    this.guardarScrollAoSair();
    this.restaurarScroll();
  }

  ngOnDestroy() {
    this.restoreSub?.unsubscribe();
    this.saveSub?.unsubscribe();
  }

  /**
   * Ao sair para criar/editar (mesmo grupo de rotas), guarda a posição do scroll para a repor no regresso.
   * Sair para outra secção da app descarta-a (comportamento do `ListStateService`).
   *
   * Guarda no `NavigationStart`, e não no `ngOnDestroy`: quando o `ngOnDestroy` corre, o Angular já tirou a
   * lista do DOM e o browser já encolheu a página e pôs o scroll a 0.
   */
  private guardarScrollAoSair(): void {
    if (!this.isBrowser) return;
    this.saveSub = this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => {
        this.listState.set<ScrollGuardado>(LIST_STATE_GROUP, LIST_STATE_KEY, {
          janela: window.scrollY,
          conteudo: this.areaConteudo()?.scrollTop ?? 0
        });
      });
  }

  /**
   * Repõe a posição guardada depois de a lista acabar de carregar e de o DOM estar desenhado; antes disso a
   * página ainda não tem altura para chegar lá.
   */
  private restaurarScroll(): void {
    if (!this.isBrowser) return;
    const guardado = this.listState.get<ScrollGuardado>(LIST_STATE_GROUP, LIST_STATE_KEY);
    if (!guardado) return;

    this.restoreSub = this.isLoading$.pipe(filter(loading => !loading), take(1)).subscribe(() => {
      setTimeout(() => {
        window.scrollTo({ top: guardado.janela });
        const conteudo = this.areaConteudo();
        if (conteudo) conteudo.scrollTop = guardado.conteudo;
      });
    });
  }

  /** Área de conteúdo do layout (`<main class="content">`), que pode ter o seu próprio scroll. */
  private areaConteudo(): HTMLElement | null {
    return document.querySelector<HTMLElement>('main.content');
  }
}
