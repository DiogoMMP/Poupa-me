# B0018 — Resultado: filtros perdem-se ao sair da lista para um formulário e voltar

| | |
| :--- | :--- |
| **Tipo** | Bugfix (issue [#61](https://github.com/DiogoMMP/poupa-me/issues/61)) |
| **Branch** | `fix/filtros-persistem-entre-paginas` (base: `develop`) |
| **Estado** | Implementado e testado manualmente na app pelo utilizador (2026-11-14) |
| **Build** | `cd frontend && npm run build` OK, sem erros nem avisos — linha de base também OK |
| **Testes** | `cd frontend && npm test`: 26 testes a passar (linha de base: 15); **11 novos** — 4 em `list-state.service.spec.ts`, 4 em `transacoes-listar.view-model.spec.ts`, 3 em `despesas-recorrentes-listar.view-model.spec.ts` (2 deles da revisão do PR, ver §7) |
| **Lint** | O frontend não tem script de lint — não há gate a correr |
| **Commits** | `b5642e8`..`8017966` (5 commits, PR #96) + os commits da revisão CodeRabbit (§7) |

## 1. O que foi fechado

- **A.** `ListStateService` (`frontend/src/app/services/list-state.service.ts`): guarda cópias do estado de cada lista por grupo de rotas (primeiro segmento do URL), apaga os outros grupos em cada `NavigationEnd`, e tem `clear()`. Fechado.
- **B.** Transações: o ViewModel restaura e grava filtros, página e tamanho de página das duas colunas; o componente arranca o painel de filtros com os filtros restaurados. Se o banco tiver mudado entre a gravação e o restauro, `contaId`/`cartaoId` são descartados e as páginas voltam a 1. Fechado. **O teste da issue falhou contra o código antigo** (filtros `''`/`'Este Mês'` e página 1 em vez dos valores gravados) e passa com a correção.
- **C.** Despesas Recorrentes: o ViewModel restaura e grava os filtros e a página das duas colunas (a página passou do componente para o ViewModel; o componente delega por getter/setter e o template ficou igual). Fechado.
- **D.** `AuthService.logout()` chama `listState.clear()`. Fechado (sem teste próprio — é uma chamada de uma linha; coberto por `clear()` no spec do serviço).
- **E.** Testes: ver tabela de metadados. Fechado.
- **F.** (Acrescentado na aprovação.) Transações: mudar de banco com a lista aberta descarta `contaId`/`cartaoId`, grava o estado e emite `filtersReset$`; o componente volta a copiar os formulários de filtro. O pedido seguinte à API já não leva a conta/cartão do banco anterior. Fechado.

## 2. Pontos a decidir

Nenhum.

## 3. Desvios ao plano aprovado

- **`takeUntilDestroyed()` nas subscrições de `selectedBancoId$`** dos dois ViewModels (não estava no plano). Estas subscrições nunca eram canceladas, por isso cada ViewModel de uma lista já fechada continuava a recarregar quando o banco mudava. Antes era só trabalho desnecessário. Com esta correção, um ViewModel morto gravaria o estado *dele* no `ListStateService` (pela regra F em Transações, pela limitação de página em Despesas Recorrentes) por cima do estado da lista aberta. Os ViewModels estão nos `providers` do componente, por isso `takeUntilDestroyed()` termina a subscrição quando o componente é destruído.
- **Despesas Recorrentes: a página é limitada depois de cada carga, não na leitura.** O plano dizia "limitada a `totalPages(...)` na leitura". Ficou como uma subscrição a `pendentes$`/`concluidas$` (sem o valor inicial vazio) que limita a página ao número de páginas que existem. Cobre também o caso de apagar o último item da última página, que hoje deixa a coluna numa página vazia. Por isso, `PAGE_SIZE` passou do componente para o ViewModel (exportado; o componente importa-o).
- **`loadAll()` de Transações deixou de pôr as páginas a 1.** Estava no plano para a primeira carga. A forma final é mais simples: `loadAll()` nunca mexe nas páginas, e só a mudança de banco (regra F) as põe a 1. O comportamento visível é o mesmo que o plano descrevia.

## 4. Por verificar

- **Verificação manual na app** (README §4) — feita pelo utilizador depois da implementação (2026-11-14), sem problemas reportados. Não foi feita nesta sessão: não havia backend, frontend nem contentores a correr. Não está registado, passo a passo, que cenários foram cobertos; o caso de um filtro restaurado que aponta para uma categoria entretanto apagada (README §5) só fica confirmado se tiver sido um deles.
- **Cypress e2e** (`npm run test:ci`) — não corrido. Precisa da app a correr em `localhost:4200`, e não há nenhum teste e2e de filtros.

## 5. Como correr a verificação

- `cd frontend && npm run build` — compila a app, incluindo o build de SSR/prerender: prova que o serviço novo não usa APIs só do browser.
- `cd frontend && npm test` — corre os 24 testes Karma. Os novos provam: o estado sobrevive dentro do grupo e é apagado ao sair dele; um ViewModel novo (a lista recriada ao voltar de um formulário) pede à API os filtros e a página da lista anterior; os filtros de conta/cartão são descartados quando o banco muda, quer com a lista aberta quer entre gravação e restauro; uma página guardada que deixou de existir recua para a última.

## 6. Inventário de alterações

- `frontend/src/app/services/list-state.service.ts` — novo
- `frontend/src/app/services/list-state.service.spec.ts` — novo
- `frontend/src/app/features/transacoes/components/listar/transacoes-listar.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/listar/transacoes-listar.component.ts` — alterado
- `frontend/src/app/features/transacoes/components/listar/transacoes-listar.view-model.spec.ts` — novo
- `frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.view-model.ts` — alterado
- `frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.component.ts` — alterado
- `frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.view-model.spec.ts` — novo
- `frontend/src/app/features/auth/services/auth.service.ts` — alterado
- `docs/changes/bugfixes/B0018-filtros-persistem-entre-paginas/README.md` — novo
- `docs/changes/bugfixes/B0018-filtros-persistem-entre-paginas/RESULT.md` — novo
- `docs/changes/bugfixes/README.md` — alterado (linha do B0018)

## 7. Revisão do CodeRabbit (PR #96)

2 findings (2 inline, ambos Minor), verificados contra o código antes de corrigir.

| # | Finding | Verificação | Resolução |
| :--- | :--- | :--- | :--- |
| 1 | Despesas Recorrentes: ao mudar de banco, uma resposta atrasada das colunas do banco anterior ainda publica os itens e corta (e grava) a página | Válido: `loadAll()` só cancelava `allSub`; os pedidos das colunas só eram cancelados quando chegavam as categorias do banco novo | `loadAll()` cancela `pendentesSub`/`concluidasSub` logo no início. Teste com respostas do banco anterior atrasadas (`Subject`): falha contra o código antigo (página 3 → 2) e passa com a correção |
| 2 | Transações: os pedidos de página não são cancelados quando o ViewModel é destruído; uma resposta atrasada no ramo "página para lá do fim" grava estado da instância morta | Válido: `allSub`/`contaSub`/`cartaoSub` só eram cancelados ao recarregar | `pipe(takeUntilDestroyed(this.destroyRef))` nos três pedidos. Além do que o bot sugeriu: `loadAll`/`loadContaTransacoes`/`loadCartaoTransacoes` não fazem nada depois da destruição, porque o `deleteTransacao` (que não é cancelado, para não abortar um DELETE) recarrega a coluna quando a resposta chega, e `takeUntilDestroyed` num `DestroyRef` já destruído lança NG0911. Teste com o ViewModel num injector destruído: falha contra o código antigo (estado recriado e novo pedido) e passa com a correção |

**Gate depois da revisão:** build OK; testes 26/26.

**Por fazer:** não foi feito novo teste manual na app depois destas correções.

**Ficheiros alterados na revisão:**
- `frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.view-model.ts`
- `frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.view-model.spec.ts`
- `frontend/src/app/features/transacoes/components/listar/transacoes-listar.view-model.ts`
- `frontend/src/app/features/transacoes/components/listar/transacoes-listar.view-model.spec.ts`
- `docs/changes/bugfixes/B0018-filtros-persistem-entre-paginas/RESULT.md`
