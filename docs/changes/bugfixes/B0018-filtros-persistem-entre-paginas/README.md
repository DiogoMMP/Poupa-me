# B0018 — Filtros perdem-se ao sair da lista para um formulário e voltar

| | |
| :--- | :--- |
| **Tipo** | Bugfix (issue [#61](https://github.com/DiogoMMP/poupa-me/issues/61), label `bug`) |
| **Branch** | `fix/filtros-persistem-entre-paginas` (base: `develop` — não existe nenhum `release/*`, como nos registos anteriores) |
| **Estado** | Aprovado (2026-11-14), com a adição do item F pedida na aprovação |
| **Âmbito** | Frontend apenas: um serviço `root` novo que guarda o estado das listas enquanto se navega dentro do mesmo grupo de rotas, usado pelas listas de Transações e de Despesas Recorrentes. Backend sem alterações. |
| **Verificação** | `cd frontend && npm run build && npm test` — linha de base medida: build OK, 15 testes Karma a passar. Verificação manual na app (`npm start` + backend). |

## 1. Situação

Issue #61: *"Quando filtramos no ecrã das transações por exemplo, e depois entramos no form de guardar uma transação quando voltamos o filtro perdeu-se."*

**Causa.** O estado de cada lista (filtros e página) vive em objetos que pertencem ao componente da lista. Quando se navega para um formulário, o componente é destruído e esse estado perde-se. Ao voltar, a lista abre com os valores por omissão.

**Evidência:**

- [`transacoes-listar.component.ts:23`](../../../../frontend/src/app/features/transacoes/components/listar/transacoes-listar.component.ts) — `providers: [TransacoesListViewModel]`: o ViewModel é criado e destruído com o componente.
- [`transacoes-listar.view-model.ts`](../../../../frontend/src/app/features/transacoes/components/listar/transacoes-listar.view-model.ts) — `contaFilters`/`cartaoFilters` arrancam sempre com `{ ..., period: 'Este Mês' }`; `contaPage`/`contaPageSize`/`cartaoPage`/`cartaoPageSize` arrancam com `1`/`DEFAULT_PAGE_SIZE`.
- [`transacoes-listar.component.ts:35-36`](../../../../frontend/src/app/features/transacoes/components/listar/transacoes-listar.component.ts) — `contaFilterForm`/`cartaoFilterForm` (ligados por `ngModel` ao painel de filtros) também arrancam com os valores por omissão, por isso o painel não mostraria os filtros mesmo que o ViewModel os tivesse.
- Os formulários voltam à lista com `router.navigate(['/transacoes'])` (`criar-*`/`editar` view-models) ou `routerLink="/transacoes"` (botão Cancelar).
- [`despesas-recorrentes-listar.component.ts:21`](../../../../frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.component.ts) — o mesmo padrão: `providers: [DespesasRecorrentesListViewModel]`, `pendenteFilters`/`concluidaFilters` no ViewModel, `pendenteFilterForm`/`concluidaFilterForm` e `pendentePage`/`concluidaPage` (paginação no cliente) no componente. As sub-páginas `editar-transacao`, `gerar-transacao`, `nova-regra`, `listar-regras` e `editar-regra` estão todas debaixo de `/despesas-recorrentes`.
- [`estatisticas.component.ts`](../../../../frontend/src/app/features/estatisticas/components/estatisticas.component.ts) — também perde mês/ano ao sair, mas não tem sub-páginas (ver §2, decisões).

**Reprodução (traçada no código):** em `/transacoes`, filtrar a coluna de contas por uma categoria e passar para a página 2 → clicar em editar numa transação → Guardar (ou Cancelar) → `/transacoes` volta a criar `TransacoesListComponent` e um `TransacoesListViewModel` novos, com `categoriaId: ''`, `period: 'Este Mês'` e página 1.

**Inventário:**

- **A.** Serviço novo `ListStateService` (`services/list-state.service.ts`, `providedIn: 'root'`): guarda o estado de cada lista, associado ao seu grupo de rotas (o primeiro segmento do URL), e apaga-o quando a navegação sai desse grupo. Também é limpo no logout.
- **B.** Transações — `TransacoesListViewModel` restaura e grava filtros, página e tamanho de página das duas colunas no `ListStateService`; `TransacoesListComponent` arranca os formulários de filtro a partir do ViewModel.
- **C.** Despesas Recorrentes — `DespesasRecorrentesListViewModel` restaura e grava os filtros das duas colunas e a página de cada uma; `DespesasRecorrentesListComponent` arranca os formulários a partir do ViewModel e lê/escreve a página através dele.
- **D.** `AuthService.logout()` limpa o `ListStateService`.
- **E.** Testes unitários (Karma/Jasmine) para o serviço e para o restauro em Transações e Despesas Recorrentes.
- **F.** (Acrescentado na aprovação.) Transações — mudar de banco no header com a lista aberta descarta os filtros `contaId`/`cartaoId` do banco anterior, no ViewModel e no painel de filtros. Hoje mantêm-se e a coluna fica vazia ou com um filtro que não existe no banco novo.

**Escala:** 1 serviço novo, 4 ficheiros alterados (2 ViewModels, 2 componentes; Transações com mais uma condição para o item F) + 1 linha no `AuthService`, 3 ficheiros de testes novos. Templates HTML sem alterações.

## 2. Resultado pretendido

Enquanto o utilizador navega **dentro do mesmo grupo** (`/transacoes/...` ou `/despesas-recorrentes/...`), a lista mantém os filtros e a paginação: sair para criar/editar/gerar e voltar mostra a lista exatamente como estava, com o painel de filtros preenchido com os mesmos valores. Quando a navegação **sai do grupo** (ex.: `/transacoes` → `/contas` → `/transacoes`), o estado é apagado e a lista volta aos valores por omissão, como hoje.

**Decisões:**

- **Âmbito: Transações e Despesas Recorrentes** (decidido com o utilizador). Estatísticas fica de fora: não tem sub-páginas, por isso, com a regra do grupo, sair do ecrã limpa sempre o estado, que é o comportamento de hoje.
- **Guardar em memória, num serviço `root`** (decidido com o utilizador). Um F5 volta aos valores por omissão. Sem `localStorage`/`sessionStorage`, sem query params.
- **O estado só vive enquanto se está no grupo** (decidido com o utilizador). O serviço ouve o `NavigationEnd` do `Router` e apaga as entradas cujo grupo (primeiro segmento do URL guardado com a entrada) é diferente do primeiro segmento do URL novo. Assim o serviço não precisa de uma lista de rotas configurada: cada lista guarda o estado com a chave do seu grupo (`'transacoes'`, `'despesas-recorrentes'`).
- **Mantém também a paginação** (decidido com o utilizador): página e tamanho de página nas duas colunas de Transações; página das duas colunas de Despesas Recorrentes (lá o tamanho é fixo, `PAGE_SIZE = 10`). Se a página guardada deixar de existir, a lógica que já existe trata disso: em Transações, `loadContaTransacoes`/`loadCartaoTransacoes` recuam para a última página; em Despesas Recorrentes, a página guardada passa a ser limitada a `totalPages(...)` na leitura.
- **Mudança de banco com a lista aberta** (item F, pedido na aprovação): quando `selectedBancoId$` emite um banco diferente do atual, o ViewModel descarta `contaId`/`cartaoId`, grava o estado e avisa o componente (um `Subject` `filtersReset$`) para recopiar os formulários de filtro. Categoria, estado e período mantêm-se, como no restauro.
- **Mudança de banco entre a gravação e o restauro.** O estado de Transações guarda o `bancoId` em que foi gravado. Se, ao restaurar, o banco selecionado for outro (o seletor de banco está no header e pode ser mudado a partir de um formulário), os filtros `contaId`/`cartaoId` são descartados (são contas/cartões do outro banco) e as páginas voltam a 1; categoria, estado e período mantêm-se. Despesas Recorrentes só filtra por categoria e período, que não dependem do banco.
- **Logout limpa tudo** de forma explícita (`AuthService.logout()`), mesmo que a navegação para `/entrar` já o fizesse, para que um segundo utilizador no mesmo browser nunca herde filtros.
- **Não se guarda se o painel de filtros estava aberto** (`showContaFilters`, etc.): ao voltar, o painel aparece fechado, como hoje.

**Alternativas rejeitadas:**

- *`providers` na rota do grupo (`transacoes.routes.ts`)* — o injector de uma rota lazy não é destruído quando se sai do grupo, por isso o estado nunca seria limpo; o comportamento seria "guardar sempre", que o utilizador rejeitou.
- *Query params no URL* — obrigava a mudar todos os `navigate`/`routerLink` de regresso dos formulários para levarem os params, e dava a persistência em F5, que não foi pedida.
- *`sessionStorage`* — persistência em F5 não pedida; precisaria de guardas de SSR e de validação de valores antigos.
- *ViewModels `providedIn: 'root'`* — manteriam também os `BehaviorSubject` de dados e as subscrições vivos para sempre, e a limpeza ao sair do grupo teria de ser feita à mão em cada ViewModel.

## 3. Implementação

Não há hooks de commit no repo (sem `.husky/`, `.githooks/`, `.pre-commit-config.yaml` nem `core.hooksPath`).

1. **`frontend/src/app/services/list-state.service.ts`** (novo) — `ListStateService`, `providedIn: 'root'`:
   - `get<T>(group: string, key: string): T | undefined` e `set<T>(group: string, key: string, value: T): void` (guarda uma cópia; `group` é o primeiro segmento do URL, `key` identifica a lista dentro do grupo);
   - `clear(): void`;
   - no construtor, subscreve `Router.events` filtrado a `NavigationEnd` e apaga os grupos diferentes do primeiro segmento de `urlAfterRedirects` (sem query string nem fragmento).
   - **Spec** `list-state.service.spec.ts`: o estado mantém-se ao navegar dentro do grupo (`/transacoes` → `/transacoes/editar/1` → `/transacoes`); é apagado ao sair (`/transacoes` → `/contas`); `clear()` apaga tudo; `get` devolve uma cópia (alterar o objeto devolvido não altera o guardado).
2. **Transações** — [`transacoes-listar.view-model.ts`](../../../../frontend/src/app/features/transacoes/components/listar/transacoes-listar.view-model.ts) e [`transacoes-listar.component.ts`](../../../../frontend/src/app/features/transacoes/components/listar/transacoes-listar.component.ts):
   - o ViewModel lê o estado (`contaFilters`, `cartaoFilters`, `contaPage`, `contaPageSize`, `cartaoPage`, `cartaoPageSize`, `bancoId`) do `ListStateService` no construtor, antes de subscrever `selectedBancoId$`; aplica a regra da mudança de banco (§2);
   - `loadAll()` deixa de forçar a página 1 na primeira carga (continua a forçá-la quando o banco muda depois da carga inicial, como hoje);
   - `applyContaFilters`, `clearContaFilters`, `setContaPage`, `setContaPageSize` e as quatro equivalentes de cartão gravam o estado depois de o mudarem; a correção de "página para lá do fim" também grava a página corrigida;
   - o componente passa a iniciar `contaFilterForm`/`cartaoFilterForm` com uma cópia de `vm.contaFilters`/`vm.cartaoFilters`, e volta a copiá-los quando o ViewModel emite `filtersReset$`;
   - (F) na subscrição de `selectedBancoId$`, se o banco mudou em relação ao último visto, descartar `contaId`/`cartaoId` e emitir `filtersReset$` antes de `loadAll()`.
   - **Spec** `transacoes-listar.view-model.spec.ts` (serviços mockados com `of(...)`): um ViewModel novo, criado depois de outro ter aplicado filtros e mudado de página, arranca com esses filtros e essa página e pede-os à API — **reprodução da issue, tem de falhar contra o código atual**; com outro banco selecionado, `contaId`/`cartaoId` são descartados e a página volta a 1; (F) mudar de banco com o ViewModel vivo descarta `contaId`/`cartaoId`, emite `filtersReset$` e o pedido seguinte à API já não leva esses filtros.
3. **Despesas Recorrentes** — [`despesas-recorrentes-listar.view-model.ts`](../../../../frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.view-model.ts) e [`despesas-recorrentes-listar.component.ts`](../../../../frontend/src/app/features/despesas-recorrentes/components/listar/despesas-recorrentes-listar.component.ts):
   - o ViewModel lê e grava `pendenteFilters`, `concluidaFilters`, `pendentePage` e `concluidaPage` (as páginas passam do componente para o ViewModel);
   - o componente passa a ter `pendentePage`/`concluidaPage` como getter/setter que delegam no ViewModel (o template, que faz `pendentePage = pendentePage - 1`, fica igual) e inicia os formulários a partir do ViewModel;
   - **Spec** `despesas-recorrentes-listar.view-model.spec.ts`: um ViewModel novo restaura os filtros e as páginas gravados por outro.
4. **Logout** — [`auth.service.ts`](../../../../frontend/src/app/features/auth/services/auth.service.ts): `logout()` chama `listState.clear()`.

## 4. Verificação

- `cd frontend && npm run build` — linha de base: OK.
- `cd frontend && npm test` — linha de base: 15 testes a passar. Depois: 15 + os novos, todos a passar. O spec do ViewModel de Transações corre primeiro contra o código atual (tem de falhar no restauro) e depois contra a correção.
- O frontend não tem `lint` em `package.json`; não há gate de lint a correr.
- Verificação manual (precisa do backend e de `npm start`):
  1. `/transacoes`: filtrar por categoria e conta, passar para a página 2, editar uma transação, Guardar → lista na página 2 com os mesmos filtros e o painel preenchido. Repetir com Cancelar e com "Nova transação".
  2. `/transacoes` com filtros → ir a `/contas` → voltar a `/transacoes` → filtros por omissão.
  3. Com filtro de conta → abrir um formulário → mudar de banco no header → voltar → filtro de conta descartado, categoria/período mantidos.
  4. `/despesas-recorrentes`: filtrar as duas colunas → `editar-transacao` → voltar → filtros mantidos.
  5. Logout e login → filtros por omissão.
  6. (F) `/transacoes` com filtro de conta → mudar de banco no header → o painel deixa de mostrar a conta e a coluna mostra as transações do banco novo.

## 5. Riscos

- **Restaurar um filtro que já não existe** (conta/cartão/categoria apagados entretanto). **Validação:** a API devolve a lista vazia ou sem esse filtro (não é erro), e o `app-select` mostra a opção vazia quando o valor não está nas opções; confirmar na verificação manual 3. Contas/cartões do outro banco ficam cobertos pela regra do `bancoId` e pelo teste.
- **Página guardada para lá do fim** depois de apagar transações. **Validação:** Transações já recua para a última página (lógica existente, F0007); Despesas Recorrentes passa a limitar a página na leitura — coberto pelo spec de Despesas Recorrentes.
- **Primeira carga a ir para a página 1 em vez da restaurada.** `loadAll()` força hoje a página 1 e corre logo na subscrição de `selectedBancoId$` (que é um `BehaviorSubject`). **Validação:** spec de Transações verifica que o primeiro pedido à API leva a página restaurada.
- **Estado que não é limpo ao sair do grupo** (ex.: o serviço só ser criado depois da primeira navegação). **Validação:** o serviço é injetado pelo ViewModel ao entrar no grupo, por isso já está a ouvir o `Router` quando se sai; spec do serviço cobre a saída.
- **SSR.** O serviço é por pedido no servidor e só guarda objetos em memória; não usa APIs do browser. **Validação:** `npm run build` (inclui o prerender/SSR) passa.

## 6. Ordem de commits

| # | Unidade | Ficheiros | Inventário |
| :--- | :--- | :--- | :--- |
| 1 | `feat(shared)`: `ListStateService` guarda o estado das listas enquanto se navega no mesmo grupo | `services/list-state.service.ts`, `services/list-state.service.spec.ts` | A |
| 2 | `fix(transacoes)`: a lista mantém filtros e paginação ao voltar de um formulário | `transacoes-listar.view-model.ts`, `transacoes-listar.component.ts`, `transacoes-listar.view-model.spec.ts` | B |
| 3 | `fix(transacoes)`: mudar de banco descarta os filtros de conta/cartão do banco anterior | os mesmos três ficheiros | F |
| 4 | `fix(despesas-recorrentes)`: a lista mantém filtros e paginação ao voltar de um formulário | `despesas-recorrentes-listar.view-model.ts`, `despesas-recorrentes-listar.component.ts`, `despesas-recorrentes-listar.view-model.spec.ts` | C |
| 5 | `fix(auth)`: o logout limpa o estado das listas | `auth.service.ts` | D |
| 6 | `docs(changes)`: regista B0018 | `docs/changes/bugfixes/B0018-*/`, `docs/changes/bugfixes/README.md` | — |

Os testes (E) vão no mesmo commit que o código que testam.

## 7. Fora do âmbito e handoff

- **Estatísticas** — sem sub-páginas; fica como está (ver §2).
- **Guardar se o painel de filtros estava aberto** — não pedido.
- **Persistência após F5** — rejeitada nesta decisão; se for pedida mais tarde, o `ListStateService` é o único sítio a mudar.
