# F0008 — Resultado: grupos de categorias, ordenação definida pelo admin e estatísticas por grupo

| | |
| :--- | :--- |
| **Tipo** | Feature — [issue #81](https://github.com/DiogoMMP/poupa-me/issues/81) "[Feat] Correções nas Categorias" |
| **Branch** | `feature/grupos-categorias` (base: `develop`) |
| **Estado** | Implementado — sem verificação contra Postgres nem em browser nesta sessão (ver §4) |
| **Build** | Backend `npm run build` ✅ (baseline ✅). Frontend `npm run build` ✅ sem erros nem warnings (baseline ✅, sem warnings). `npm run build-storybook` ✅, com as 3 stories novas `shared-select--default`, `--com-icones` e `--agrupado` no `index.json` |
| **Lint** | Backend `npm run lint`: 58 problemas (51 erros, 7 warnings), **igual ao baseline** e nos mesmos 18 ficheiros. Nenhum dos ficheiros novos aparece. O frontend não tem script de lint |
| **Testes** | Backend 77/77 em 15 suites (baseline 77/77). Frontend 26/26 (baseline 26/26). **0 testes novos**: os testes novos ficam para a issue de testes dedicada, por decisão do utilizador (README §7). Dois specs existentes tiveram de receber mocks para as dependências novas (ver §3) |
| **Commits** | A ordem do README §6 (12 unidades) foi juntada em 6 commits: `eb82e81` backend dos grupos, `ba350a9` pagamento do cartão, `59824a6` `app-select`, `dfa0b9b` página de categorias e selects, `e5b45d2` estatísticas, `d4c97f1` registos. As correções da análise de código antes do PR vão em commits seguintes |

## 1. O que foi fechado

- **A. Agregado `GrupoCategoria` (backend)** — ✅ VOs `TipoGrupoCategoria` (`Entrada`/`Saída`/`Ambos`) e `CorGrupoCategoria` (12 chaves, exporta `CORES_GRUPO_CATEGORIA`); entidade `GrupoCategoria` (`AggregateRoot`, `create()` com `Guard`, `ordem` inteiro ≥ 1); `GrupoCategoriaIdHelper` (`GCT`); `GrupoCategoriaEntity` (`grupo_categoria`, índice `UQ_grupo_categoria_nome_ativo`); repo, service, controller, rota `/grupo-categoria` com Swagger (`GET /`, `GET /:id`, `POST /`, `PUT /ordem`, `PUT /:id`, `DELETE /:id`), DTOs, mapper e DI nos dois sítios (`config/index.ts` e `loaders/index.ts`). Apagar é soft delete e devolve 400 enquanto houver categorias ativas, com a contagem na mensagem.
- **B. `Categoria` com grupo, ordem e papel (backend)** — ✅ `grupoId?`, `ordem` e `papel?` no domínio (VO novo `PapelCategoria`, só com `'PagamentoCartao'`); `CategoriaEntity` com `grupo`/`grupo_id` (FK), `ordem` e `papel` e o índice `UQ_categoria_papel_ativo`; o `CategoriaMap` lê o domain id do grupo a partir da relação carregada (se não houver relação, a categoria fica sem grupo). `POST` exige um `grupoId` ativo e põe a categoria no fim do grupo. Um `PUT` com outro grupo põe-na no fim desse grupo e recusa voltar a "Sem grupo". Marcar um papel tira-o, na mesma transação, à categoria que o tinha. Apagar limpa o papel. Id, nome e ícone das categorias existentes não mudam.
- **C. Listagem agrupada e reordenação (backend)** — ✅ `GET /categoria` devolve `ICategoriasAgrupadasDTO[]`: grupos ativos por `ordem` (incluídos os vazios), categorias por `ordem`/`id` e "Sem grupo" no fim, só se tiver categorias. `PUT /grupo-categoria/ordem` e `PUT /categoria/ordem` (Admin) validam que a lista é exatamente o conjunto ativo, sem repetições, e respondem 400 se não for. Cada um reescreve 1..n numa transação de BD e está declarado antes do `PUT /:id`.
- **D. Migration de produção** — ✅ `1795000000000-GruposCategorias.ts`. O `up` cria a tabela e o índice do grupo, as colunas `grupo_id`/`ordem`/`papel`, a FK `FK_categoria_grupo_id`, a ordem inicial `ROW_NUMBER() OVER (ORDER BY id)` e `UQ_categoria_papel_ativo`, tudo idempotente (`IF NOT EXISTS` / verificação em `pg_constraint`). O `down` reverte tudo. **Não foi corrida** (ver §4).
- **E. Categoria do pagamento do cartão (backend)** — ✅ `CartaoCreditoService.pagarCartao` chama `ICategoriaRepo.findActiveByPapel('PagamentoCartao')` e, se não houver nenhuma, falha com a mensagem do README antes de qualquer escrita. `ITransacaoPagarCartaoRepo.pagarCartao` recebe o domain id da categoria como último parâmetro e carrega-a por `domainId` + `isActive` no `manager` da transação. `grep -n "orderBy('cat.id'" backend/src/repos/Transacao/TransacaoPagarCartaoRepo.ts` dá zero resultados.
- **F. Estatísticas com grupo (backend)** — ✅ `ICategoriaEstatistica` ganha `grupo` e `numTransacoes`. O `EstatisticasService` injeta `GrupoCategoriaRepo` e `CategoriaRepo` e usa `findAll(true)` nos dois, para que os inativos também contem. Os repos de query de transações não foram tocados.
- **G. `app-select` com grupos e ícone pintado + story** — ✅ `AppSelectOption` ganha `group?`, `icon?` e `color?`. Os cabeçalhos são `<li role="presentation" class="app-select-group">`, só com texto, e ficam fora de `options`/`optionEls`, por isso a lógica de índices do teclado não mudou. O emoji aparece num círculo com fundo a 30% e contorno com a cor sólida, na lista e no gatilho (o README pedia quadrado, 18% e 45%; ver §3). Sem estes campos o componente comporta-se como antes. O pipe `toSelectOptions` só agrupa itens que têm a propriedade `grupo` ("Sem grupo" + `cinza` quando é `null`), e a opção vazia fica no topo, sem grupo. Story nova `frontend/src/stories/select.stories.ts` com `Default`, `ComIcones` e `Agrupado`.
- **H. Service, DTOs e paleta do frontend** — ✅ `shared/constants/cores-grupo.ts` (chave → hex, `corGrupoHex`, `fundoIconeGrupo`; `contornoIconeGrupo` foi removido depois, ver §3); constantes `TIPO_GRUPO_OPTIONS` e `PAPEL_OPTIONS` em `features/categorias/constants/categorias.constants.ts`; `GruposCategoriaService.getOptions()` para o select "Grupo"; DTOs `CategoriasAgrupadasDTO`, `GrupoCategoriaDTO`, `GrupoCategoriaInputDTO`, `TipoGrupo`; `CategoriasModel` com `grupo`; `CategoriasMapper.fromAgrupadas`; `CategoriasService.getAgrupadas()`, `getAll(tipo?)` (achatado e filtrado), `reordenar()`; `GruposCategoriaService` novo (CRUD + `reordenar`).
- **I. Página de categorias do Admin** — ✅ uma secção por grupo: título simples, etiqueta do tipo, editar/eliminar, e uma pega para arrastar o grupo (`CdkDropList` vertical). Dentro de cada grupo há um `CdkDropList` (`mixed`) para as suas categorias, mostradas com o card partilhado `app-entity-card`, com o emoji num círculo pintado com a cor do grupo, todos os cards de um grupo da mesma altura e o papel numa etiqueta. "Sem grupo" fica no fim, não se arrasta e só aparece se tiver categorias. Cada largada grava logo; se o pedido falhar, mostra uma notificação e volta a carregar a ordem do servidor. Cada grupo tem um botão "+" que abre o criar categoria com o grupo já escolhido, e a posição do scroll mantém-se ao voltar de um form e ao eliminar. Botões "Criar Grupo" e "Criar Categoria". Forms novos `grupos-criar`/`grupos-editar` (nome, tipo em `app-select`, cor no componente `app-cor-grupo-picker`: círculos com a cor sólida, sem emoji de exemplo) e rotas `grupos/criar` e `grupos/editar/:id`. Os forms de criar e de editar categoria ganham "Grupo" (obrigatório no criar) e "Papel" ("Nenhum" / "Pagamento de cartão"; no README só estava previsto no editar, ver §3).
- **J. Selects de categoria agrupados e filtrados por tipo** — ✅ `criar-entradas`/`criar-reembolso` → `getAll('Entrada')`; `criar-saidas`/`criar-credito`/`nova-regra`/`editar-regra` → `getAll('Saída')`; `editar` → tipo da transação carregada, mantendo a categoria atual no seu grupo; `transacoes/listar` e `despesas-recorrentes/listar` → `getAll()` sem tipo. Os mocks dos `*.view-model.spec.ts` não precisaram de mudar.
- **K. Estatísticas "Por grupo" / "Por categoria" (frontend)** — ✅ seletor no cartão de gastos, com "Por grupo" por omissão. Donut por grupo com `customColors` da paleta. Os nomes aparecem em legendas HTML que quebram linha (sem etiquetas SVG cortadas) e o tooltip mostra o valor em euros. Clicar numa fatia ou numa linha da legenda abre o detalhe do grupo (total, % do total, donut das categorias e tabela com categoria, valor, % do grupo e nº de transações), com "Voltar". O detalhe é estado do view-model (`grupoSelecionado$`), sem rota nova. "Por categoria" é o donut de antes.
- **L. Modelo de domínio** — ✅ `docs/domain_model.puml` com o pacote `GrupoCategoria` (`<<aggregate>>`), `TipoGrupoCategoria`, `CorGrupoCategoria`, `PapelCategoria` e as relações pedidas; `docs/domain_model.svg` regenerado (ver §3).

## 2. Pontos que precisam de decisão

- **Os pagamentos de cartão param logo após o deploy, até um Admin marcar uma categoria com o papel "Pagamento de cartão"** (passo de deploy previsto no README §5). **Consequência:** até alguém editar a categoria "Cartão de crédito" (ou outra) e escolher o papel, todos os "Pagar cartão" falham com 400 e os saldos ficam como estavam. **E o utilizador não vê a mensagem clara:** `cartoes-credito-pagar.view-model.ts:133` mostra sempre o genérico "Falha ao pagar o cartão!" e ignora `err.error.error`. Esse ficheiro está fora do âmbito do §3, por isso não foi mudado. Até alguém decidir, quem pagar um cartão sem o papel definido vê um erro genérico e não sabe o que fazer.
- **As categorias antigas aparecem em todos os selects, na secção "Sem grupo".** É o que o README pede. **Consequência:** até o Admin as atribuir a grupos, os forms de entrada continuam a mostrar categorias de despesa e vice-versa, todas debaixo de "Sem grupo".
- **As categorias aninhadas em transações e regras vêm com `grupoId: null`.** Os repos de transação só carregam `t.categoria`, sem a relação `grupo`, e o README proíbe mexer nas queries das transações. O mapper aceita a falta do grupo, e as estatísticas preenchem o `grupoId` a partir do `CategoriaRepo`. **Consequência:** hoje nenhum cliente lê `categoria.grupoId` de uma transação. Um cliente futuro que o leia recebe sempre `null`, mesmo que a categoria tenha grupo.

- **Sequência de ids da `categoria` em produção:** se as categorias de produção também foram inseridas com ids explícitos, criar uma categoria nova falha (agora com "Não foi possível criar a categoria.") até a sequência ser acertada. Para confirmar: `select last_value from categoria_id_seq;` contra `select max(id) from categoria;`. Se estiver atrás, corrigir com `select setval('categoria_id_seq', (select max(id) from categoria));`.

## 3. Desvios do plano aprovado

- **O domínio da `Categoria` não aparece em nenhuma fase do §3, mas o inventário B pede-o.** Foi feito na fase 3: `Categoria.ts` e o VO novo `backend/src/domain/Categoria/ValueObjects/PapelCategoria.ts`. Em `CategoriaProps`, **`ordem` é opcional** (o getter devolve 0 por omissão) e `grupoId`/`papel` também, para que os `Categoria.create({ nome, icon })` existentes (5 specs e o mapper das transações aninhadas) continuem a compilar sem mudanças.
- **Não há `clearPapel(papel)` público no `ICategoriaRepo`.** O papel é tirado à outra categoria dentro do `CategoriaRepo.update`, na mesma transação de BD que grava a nova, como pede o §2 ("na mesma transação"). Um método público à parte correria fora dessa transação e ficaria sem uso.
- **Os nomes do PK de `grupo_categoria` e da FK `categoria.grupo_id` estão fixos na entity** (`primaryKeyConstraintName: 'PK_grupo_categoria_id'`, `foreignKeyConstraintName: 'FK_categoria_grupo_id'`), iguais aos da migration. Assim o `synchronize` (dev) e a migration (produção) dão os mesmos nomes de constraints, o que reduz o risco de "migration e `synchronize` divergirem" do README §5.
- **`IDespesaRecorrenteDTO.categoria` passou a `Pick<ICategoriaDTO, 'id' | 'nome' | 'icon'>`.** O ficheiro não está no §3. Mudou porque o `DespesaRecorrenteMap` monta esse objeto à mão só com id/nome/ícone, e com os campos novos obrigatórios em `ICategoriaDTO` o build falhava. A resposta da API das regras não muda.
- **Specs existentes adaptados, sem enfraquecer asserções.** Em `CartaoCreditoService.spec.ts`, o `{}` passado como `ICategoriaRepo` passou a ser um mock com `findActiveByPapel`, definido no teste de sucesso. Sem isso, o teste "delegates all persistence…" falhava, porque o service agora resolve a categoria antes de chamar o repo. O id da categoria entrou como **último** parâmetro de `pagarCartao`, para não deslocar a desestruturação posicional que o teste verifica. Em `EstatisticasService.spec.ts`, o construtor passou a receber os dois repos novos, com mocks que devolvem `[]`.
- **A verificação do papel no `pagarCartao` vem depois das verificações do cartão e da conta de pagamento.** Continua antes de qualquer escrita (todas as escritas estão no repo). Fica nesse sítio para que os testes de cartão/conta apagados continuem a falhar pela razão original.
- **`shared/constants/cores-grupo.ts` foi criado na fase 7 e não na 8**, porque o `app-select` e o pipe precisam dos helpers de fundo e contorno.
- **`CategoriasService.getAll(tipo?, incluirId?)` tem um segundo parâmetro opcional.** É o que implementa a regra "No editar transação, a categoria atual é acrescentada, no seu grupo". Por isso, no editar, as categorias passaram a carregar depois da transação (o construtor carregava-as antes, quando ainda não se sabia o tipo).
- **Ficheiros e símbolos que o README não nomeia:** `IReordenarCategoriasDTO` (body de `PUT /categoria/ordem`) em `ICategoriaDTO.ts`; `isConjuntoExato`, exportado de `GrupoCategoriaService.ts` e reutilizado pelo `CategoriaService`; `IGrupoCategoriaRepo.ts` ao lado do repo (`repos/GrupoCategoria/`), seguindo o layout de `repos/Categoria/`; `GET /grupo-categoria/:id` devolve só grupos ativos (404 se estiver apagado).
- **Mensagens:** as mensagens novas de validação, mostradas ao Admin, estão em PT-PT. As de "não encontrado" ficam em inglês (`... not found with id=...`), como no resto dos services, porque os controllers novos mapeiam para 404 por `includes('not found')`.
- **Estatísticas:** a legenda "Por grupo" é uma lista própria de botões (cor, nome, valor, %), em vez da legenda do ngx-charts, para que cada linha seja clicável e acessível por teclado. O donut do detalhe usa o esquema de cores por omissão do ngx-charts: todas as categorias têm a cor do grupo, e com ela as fatias não se distinguiam.
- **Ajustes visuais pedidos pelo utilizador depois da implementação** (o README aprovado não foi alterado; ficam registados aqui):
  - Seletor de cor dos forms de grupo (`grupos-criar`, `grupos-editar`): as amostras passaram a círculos de 36px com a cor sólida, **sem emoji de exemplo** (contra o §2 do README, que pedia um emoji dentro do quadrado). Os métodos `fundo()`/`contorno()` foram trocados por `hex()`.
  - Opções do tipo do grupo (`TIPO_GRUPO_OPTIONS`): `Saída`, `Entrada`, `Ambos`, sem texto entre parênteses.
  - Página de categorias (`categorias-listar`): os cards das categorias usam o componente partilhado `app-entity-card`, com o emoji num **círculo** igual ao dos outros cards (`card-icon card-icon--circle`). O círculo é projetado pelo slot `[card-icon]` e pintado com a cor do grupo: fundo a 18% e contorno com a cor sólida, como o contorno a `--brand-accent` dos outros cards. Os botões editar/eliminar do cabeçalho do grupo passaram a só ícone (`btn-edit-small` / `btn-delete-small`, como na lista de transações). O CSS `.categoria-icon` deixou de ser usado e foi removido.
  - `app-select`: o emoji das opções e do gatilho passou de quadrado (`border-radius: 6px`) a **círculo** (`50%`), contra o §2 do README, que falava em "quadrado".
  - Contraste das cores (o utilizador achou-as pouco visíveis na página de categorias e no dropdown): o fundo do círculo passou de 18% para **30%** (`ALPHA_FUNDO` em `cores-grupo.ts`, que serve os dois sítios). O contorno no `app-select` passou de cor a 45% para a **cor sólida**, com 1,5px. `contornoIconeGrupo` deixou de ser usado e foi removido.
  - Gate depois destes ajustes: `frontend npm run build` OK; `npm test` 26/26.
- **Criar categoria a partir do grupo** (pedido do utilizador): o cabeçalho de cada grupo na página de categorias tem um botão "+" (`btn-edit-small`, só ícone), antes de editar/eliminar, que abre `/categorias/criar?grupo=<id>`. O form de criar lê o `grupo` da query string e já abre com esse grupo escolhido, que pode ser mudado. Sem o parâmetro, o form comporta-se como antes. Gate: `frontend npm run build` OK, `npm test` 26/26.
- **Scroll e altura dos cards na página de categorias** (pedido do utilizador):
  - Ao sair da lista para criar/editar, `categorias-listar.component.ts` guarda a posição do scroll (janela e `main.content`) no `ListStateService` (grupo `categorias`). A posição é guardada no `NavigationStart` do router. A primeira versão guardava no `ngOnDestroy`, e o utilizador viu que não funcionava: quando o `ngOnDestroy` corre, o Angular já tirou a lista do DOM e o browser já pôs o scroll a 0. No regresso, repõe-na depois de a lista acabar de carregar. Sair para outra secção da app descarta a posição, como nas listas de transações.
  - Os cards de um grupo ficam todos com a altura do mais alto (`grid-auto-rows: 1fr` em `.categorias-grid`).
  - `entity-card.component.css` tinha `:host { height: 100% }`, que não se aplicava porque o componente usa `ViewEncapsulation.None`. Passou a usar seletores pelo elemento (`app-entity-card`, `> .card` com `height: 100%`, ações com `margin-top: auto`), para o card encher a célula e as ações ficarem alinhadas em baixo. O `app-entity-card` só é usado nesta página e na sua story.
  - Gate: `frontend npm run build` OK, `npm test` 26/26. Não verificado em browser.
- **Nomes completos e € nas estatísticas** (pedido do utilizador):
  - Os donuts deixaram de mostrar etiquetas (`[labels]="false"`). O ngx-charts desenha-as em SVG, corta-as aos 10 caracteres com "…" e não as consegue quebrar em várias linhas.
  - Os nomes aparecem agora em legendas HTML, que quebram linha (`overflow-wrap: anywhere`):
    - "Por grupo": a lista de grupos que já existia;
    - "Por categoria": uma lista nova com ponto de cor, nome, valor e %;
    - detalhe do grupo: a tabela, que ganhou um ponto de cor por categoria.
  - Na vista por categoria e no detalhe, as cores das fatias passaram a ser fixadas (`customColors`, a paleta em ciclo) para baterem com os pontos das legendas.
  - O tooltip dos três donuts mostra o valor em euros (`tooltipText`, formato pt-PT, nome escapado).
  - Gate: `frontend npm run build` OK, `npm test` 26/26.
- **Papel ao criar e etiqueta do papel** (pedido do utilizador):
  - O README só previa o papel no form de editar. O form de criar passou a ter também o select "Papel" (`PAPEL_OPTIONS`, partilhado com o editar). `CategoriaService.createCategoria` valida o `papel` com `PapelCategoria`. `CategoriaRepo.save` passou a correr numa transação de BD que primeiro tira o papel à categoria que o tinha e depois cria a nova, com a mesma regra do `update`.
  - Na página de categorias, "Pagamento de cartão" passou de texto solto a etiqueta (`.badge`, a pílula das etiquetas de tipo das regras de despesas recorrentes).
  - O `margin-top: auto` das ações do `app-entity-card` anulava o `margin-top: 1rem` global de `.card-actions` e colava os botões ao nome. Passou a haver `padding-top: 1.25rem`.
  - Gate: `backend npm run build` OK, `npm test` 77/77, ESLint limpo nos ficheiros tocados; `frontend npm run build` OK, `npm test` 26/26.
- **Erros de BD com mensagem legível** (pedido do utilizador depois de ver `duplicate key value violates unique constraint "PK_…"` ao criar uma categoria): novo `backend/src/core/logic/ErroPersistencia.ts` com `mensagemErro(e, fallback)`. As escritas de `CategoriaService` e `GrupoCategoriaService` (criar, atualizar, eliminar, reordenar) passaram a usá-lo. Um `QueryFailedError` nunca chega ao cliente tal como vem do Postgres: as violações de `UQ_categoria_nome_ativo`, `UQ_grupo_categoria_nome_ativo` e `UQ_categoria_papel_ativo` dão uma mensagem própria em PT-PT, e os outros erros de BD dão uma mensagem genérica ("Não foi possível criar a categoria." etc.). Os erros que não vêm da BD mantêm a mensagem de antes. Gate: `backend npm run build` OK, `npm test` 77/77, ESLint limpo nos 3 ficheiros.
  - **A causa do erro não estava no código desta change:** na BD local do Docker, `categoria_id_seq` estava em 2 com `max(id) = 19`. As categorias tinham sido inseridas com ids explícitos sem avançar a sequência, e o `INSERT` tentou o id 1. Corrigido localmente com `setval('categoria_id_seq', 19)`. As outras sequências estavam certas. **Em produção há que confirmar o mesmo** antes de criar categorias (ver §2).
- **Correções da análise de código antes do PR** (7 revisores em paralelo, sem bloqueantes nem graves; o utilizador pediu para corrigir todos os pontos menores listados):
  - **Editar só categorias ativas:** `updateCategoria` usa `findActiveById`. Antes dava para dar um grupo ou o papel "Pagamento de cartão" a uma categoria apagada, o que fazia falhar todos os pagamentos de cartão.
  - **O editar só grava o que mudou:** `CategoriaRepo.update` recebe `{ mudaGrupo, mudaPapel }` e só escreve grupo/ordem quando o grupo muda e papel quando vem no pedido. Antes, mudar o nome de uma categoria repunha uma ordem ou um papel lidos antes de uma reordenação ou troca de papel feita noutro separador.
  - **Só grupos ativos:** `resolveGrupoPk` filtra `isActive`, para uma categoria nunca ficar num grupo apagado ao mesmo tempo.
  - **Erros sem detalhes internos:** `mensagemErro(e, fallback, mensagensUnicidade)` passa a devolver sempre a mensagem genérica para exceções (antes deixava passar a mensagem de erros que não vinham de um `QueryFailedError`, p.ex. ligação à BD recusada com host e porta). Os índices únicos e as suas mensagens saem de `core/` e passam para cada service. As leituras (`getAllCategorias`, `getCategoriaById`, `getAllGrupos`, `getGrupoById`) também o usam.
  - **Valores que não são texto:** `PapelCategoria`, `TipoGrupoCategoria` e `CorGrupoCategoria` falham com a mensagem do domínio (em vez de `value.trim is not a function`), e um `grupoId` que não seja texto é recusado.
  - **Mensagens:** as do `GrupoCategoriaService` passaram a PT-PT. "Grupo X não encontrado." dá 404 porque `failureStatus` (agora em `core/infra/FailureStatus.ts`, partilhado pelos dois controllers) reconhece "não encontrad" além de "not found". O grupo inexistente na reordenação de categorias passou a dar a mesma mensagem e o mesmo 400 que no criar/editar.
  - **Arrumação:** `isConjuntoExato` passou para `core/logic/ConjuntoExato.ts` (o `CategoriaService` importava-o do ficheiro do `GrupoCategoriaService`); `IGrupoCategoriaService.ts` passou para ao lado do service, como no `Categoria`; o seletor de cor dos dois forms de grupo passou a componente (`app-cor-grupo-picker`, `ControlValueAccessor`), o que tirou o CSS e os métodos duplicados; `TIPO_GRUPO_OPTIONS` e `PAPEL_OPTIONS` passaram para `features/categorias/constants/categorias.constants.ts`; `GruposCategoriaService.getOptions()` substitui o mapeamento duplicado nos dois view-models de categoria.
  - **Lista de categorias:** eliminar um grupo ou uma categoria recarrega a lista sem mostrar o "A carregar…" (`loadData(true)`), por isso a página não salta para o topo. Uma reordenação que falha volta a carregar a ordem do servidor em vez de repor uma cópia antiga, o que dava uma ordem errada no ecrã quando duas largadas se sobrepunham.
  - **`?grupo=` no criar categoria:** só é aplicado depois de os grupos chegarem e se o grupo existir.
  - **Documentação:** Swagger do `papel` (já não diz "Update only"), `CLAUDE.md` (contexto `GrupoCategoria`), `README.md` da raiz, este RESULT (§1, §6 e commits) e o índice.
  - Gate: `backend npm run build` OK, `npm test` 77/77, ESLint limpo nos ficheiros tocados; `frontend npm run build` OK, `npm test` 26/26.
- **SVG do modelo de domínio:** não há PlantUML no repo. Foi gerado com o `plantuml-mit-1.2025.4.jar` que já estava instalado localmente (plugin plantuml4idea do DataGrip), com o Graphviz do PATH. O SVG foi regenerado por inteiro (diff de uma linha enorme).

## 4. Por verificar

- **Postgres e browser (passos manuais 1–8 do README §4): nada disto foi corrido.** Arrancar o backend em dev ia alterar, via `synchronize`, o schema da BD local do utilizador, e nesta sessão não há uma BD descartável nem credenciais de seed. Por verificar, por isso:
  1. arranque em dev (`synchronize`): a tabela `grupo_categoria` e as colunas `grupo_id`/`ordem`/`papel` (`\d categoria`, `\d grupo_categoria`);
  2. a migration num Postgres limpo com o schema anterior (`NODE_ENV=production`), depois o `down`, e comparar com o passo 1;
  3. criar 2 grupos, atribuir categorias, reordenar grupos e categorias, recarregar e confirmar que a ordem persiste;
  4. apagar um grupo com categorias → 400 com a contagem;
  5. os grupos mostrados em cada form da tabela "Filtro por tipo";
  6. pagar um cartão sem papel → erro e saldos intactos; marcar o papel → o pagamento fica nessa categoria;
  7. estatísticas: alternar as vistas, abrir o detalhe, voltar;
  8. o `app-select` agrupado navegado só com o teclado.
- **Queries novas nunca correram contra uma BD:** `order: { grupo: { ordem: 'ASC' }, ... }` com `relations` no `findAll`, `MAX(ordem)` nos dois `nextOrdem`, `update({ papel, domainId: Not(id) })` e a reordenação dentro de `dataSource.transaction`. Só estão validadas pelo build.
- **Drag-and-drop:** o `cdkDropListOrientation="mixed"` na grelha de categorias e o rollback visual não foram testados em browser.
- **Cypress (`npm run test:ci`)** — não corrido; precisa do backend e do frontend a correr.
- **Type-check dos specs fora do ts-jest:** com um `tsc` que inclua os specs (o `tsconfig.json` do backend exclui-os e o gate não os verifica assim), `CartaoCreditoService.spec.ts` dá TS2488 na desestruturação de `mock.calls[0]` (linha 121, que esta change não alterou) e dois TS2345 que já existiam. O `EstatisticasService.spec.ts` dá três TS2532 que já existiam. Corrido sobre a cópia de `HEAD` com o código novo, o mesmo `tsc` não reportou esse TS2488, e a causa não ficou apurada. O Jest (ts-jest) passa nos dois.
- **Testes novos** — nenhum, por decisão do utilizador (issue de testes dedicada). O comportamento novo (validação de conjunto exato, bloqueio de apagar, papel único, filtro por tipo, pipe, cabeçalhos do select) não tem nenhum teste automático.

## 5. Como correr a verificação

- `cd backend && npm run build && npm run lint && npm test` — compila; o lint tem de ficar nos 58 problemas pré-existentes; as 77 specs têm de passar (incluindo o `pagarCartao` com o mock do papel).
- `cd frontend && npm run build && npm test -- --watch=false --browsers=ChromeHeadless` — compila os templates (tipos do `app-select`, forms, estatísticas) e corre as 26 specs.
- `cd frontend && npm run build-storybook` — prova que a story nova do `app-select` compila; `Shared/Select › Agrupado` mostra os cabeçalhos e o teclado salta-os.
- `grep -n "orderBy('cat.id'" backend/src/repos/Transacao/TransacaoPagarCartaoRepo.ts` — zero resultados: o pagamento já não usa a primeira categoria da tabela.
- `git diff --stat -- backend/src/services/IACategorizacao backend/src/api/routes/IACategorizacaoRoute.ts frontend/src/app/features/ia-categorizacao` — vazio: a IA de categorização não foi tocada.
- **Manual com Postgres e browser:** os 8 passos de §4 e do README §4. Antes do passo 6, confirmar que o 400 sem papel deixa `saldo_utilizado` e o período do cartão iguais.

## 6. Inventário de alterações

- `backend/src/domain/GrupoCategoria/Entities/GrupoCategoria.ts` — novo
- `backend/src/domain/GrupoCategoria/ValueObjects/TipoGrupoCategoria.ts` — novo
- `backend/src/domain/GrupoCategoria/ValueObjects/CorGrupoCategoria.ts` — novo
- `backend/src/domain/Categoria/ValueObjects/PapelCategoria.ts` — novo
- `backend/src/domain/Categoria/Entities/Categoria.ts` — alterado
- `backend/src/utils/IDGenerator.ts` — alterado (`GrupoCategoriaIdHelper`)
- `backend/src/persistence/entities/GrupoCategoriaEntity.ts` — novo
- `backend/src/persistence/entities/CategoriaEntity.ts` — alterado
- `backend/src/persistence/migrations/1795000000000-GruposCategorias.ts` — novo
- `backend/src/loaders/typeorm.ts` — alterado
- `backend/src/dto/IGrupoCategoriaDTO.ts` — novo
- `backend/src/dto/ICategoriaDTO.ts` — alterado
- `backend/src/dto/IDespesaRecorrenteDTO.ts` — alterado (tipo da `categoria`, ver §3)
- `backend/src/dto/IEstatisticasDTO.ts` — alterado
- `backend/src/mappers/GrupoCategoriaMap.ts` — novo
- `backend/src/mappers/CategoriaMap.ts` — alterado
- `backend/src/repos/GrupoCategoria/IGrupoCategoriaRepo.ts` — novo
- `backend/src/repos/GrupoCategoria/GrupoCategoriaRepo.ts` — novo
- `backend/src/repos/Categoria/ICategoriaRepo.ts` — alterado
- `backend/src/repos/Categoria/CategoriaRepo.ts` — alterado
- `backend/src/repos/Transacao/IRepos/ITransacaoPagarCartaoRepo.ts` — alterado
- `backend/src/repos/Transacao/TransacaoPagarCartaoRepo.ts` — alterado
- `backend/src/services/GrupoCategoria/IGrupoCategoriaService.ts` — novo
- `backend/src/services/GrupoCategoria/GrupoCategoriaService.ts` — novo
- `backend/src/services/Categoria/ICategoriaService.ts` — alterado
- `backend/src/services/Categoria/CategoriaService.ts` — alterado
- `backend/src/services/CartaoCredito/CartaoCreditoService.ts` — alterado
- `backend/src/services/CartaoCredito/tests/CartaoCreditoService.spec.ts` — alterado (mock do `findActiveByPapel`)
- `backend/src/services/Estatisticas/EstatisticasService.ts` — alterado
- `backend/src/services/Estatisticas/tests/EstatisticasService.spec.ts` — alterado (mocks dos repos novos)
- `backend/src/controllers/GrupoCategoria/IGrupoCategoriaController.ts` — novo
- `backend/src/controllers/GrupoCategoria/GrupoCategoriaController.ts` — novo
- `backend/src/controllers/Categoria/ICategoriaController.ts` — alterado
- `backend/src/controllers/Categoria/CategoriaController.ts` — alterado
- `backend/src/api/routes/GrupoCategoriaRoute.ts` — novo
- `backend/src/api/routes/CategoriaRoute.ts` — alterado (`PUT /ordem`, Swagger)
- `backend/src/api/index.ts` — alterado
- `backend/src/config/index.ts` — alterado
- `backend/src/loaders/index.ts` — alterado
- `frontend/src/app/shared/constants/cores-grupo.ts` — novo
- `frontend/src/app/shared/components/select/select.component.ts` — alterado
- `frontend/src/app/shared/components/select/select.component.html` — alterado
- `frontend/src/app/shared/components/select/select.component.css` — alterado
- `frontend/src/app/shared/pipes/to-select-options.pipe.ts` — alterado
- `frontend/src/stories/select.stories.ts` — novo
- `frontend/src/app/features/categorias/dto/categorias.dto.ts` — alterado
- `frontend/src/app/features/categorias/models/categorias.model.ts` — alterado
- `frontend/src/app/features/categorias/mappers/categorias.mapper.ts` — alterado
- `frontend/src/app/features/categorias/services/categorias.service.ts` — alterado
- `frontend/src/app/features/categorias/services/grupos-categoria.service.ts` — novo
- `frontend/src/app/features/categorias/categorias.routes.ts` — alterado
- `frontend/src/app/features/categorias/components/listar/categorias-listar.component.ts` — alterado
- `frontend/src/app/features/categorias/components/listar/categorias-listar.component.html` — alterado (reescrito)
- `frontend/src/app/features/categorias/components/listar/categorias-listar.component.css` — alterado (estava vazio)
- `frontend/src/app/features/categorias/components/listar/categorias-listar.view-model.ts` — alterado (reescrito)
- `frontend/src/app/features/categorias/components/grupos-criar/grupos-criar.component.ts` — novo
- `frontend/src/app/features/categorias/components/grupos-criar/grupos-criar.component.html` — novo
- `frontend/src/app/features/categorias/components/grupos-criar/grupos-criar.view-model.ts` — novo
- `frontend/src/app/features/categorias/components/grupos-editar/grupos-editar.component.ts` — novo
- `frontend/src/app/features/categorias/components/grupos-editar/grupos-editar.component.html` — novo
- `frontend/src/app/features/categorias/components/grupos-editar/grupos-editar.view-model.ts` — novo
- `frontend/src/app/features/categorias/components/criar/categorias-criar.component.ts` — alterado
- `frontend/src/app/features/categorias/components/criar/categorias-criar.component.html` — alterado
- `frontend/src/app/features/categorias/components/criar/categorias-criar.view-model.ts` — alterado
- `frontend/src/app/features/categorias/components/editar/categorias-editar.component.ts` — alterado
- `frontend/src/app/features/categorias/components/editar/categorias-editar.component.html` — alterado
- `frontend/src/app/features/categorias/components/editar/categorias-editar.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-entradas/transacoes-criar-entradas.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-saidas/transacoes-criar-saidas.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-credito/transacoes-criar-credito.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-reembolso/transacoes-criar-reembolso.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/editar/transacoes-editar.view-model.ts` — alterado
- `frontend/src/app/features/despesas-recorrentes/components/nova-regra/despesas-recorrentes-nova-regra.view-model.ts` — alterado
- `frontend/src/app/features/despesas-recorrentes/components/editar-regra/despesas-recorrentes-editar-regra.view-model.ts` — alterado
- `frontend/src/app/features/estatisticas/dto/estatisticas.dto.ts` — alterado
- `frontend/src/app/features/estatisticas/models/estatisticas.model.ts` — alterado
- `frontend/src/app/features/estatisticas/mappers/estatisticas.mapper.ts` — alterado
- `frontend/src/app/features/estatisticas/components/estatisticas.view-model.ts` — alterado
- `frontend/src/app/features/estatisticas/components/estatisticas.component.ts` — alterado
- `frontend/src/app/features/estatisticas/components/estatisticas.component.html` — alterado
- `frontend/src/app/features/estatisticas/components/estatisticas.component.css` — alterado
- `docs/domain_model.puml` — alterado
- `docs/domain_model.svg` — alterado (regenerado)
- `backend/src/core/logic/ErroPersistencia.ts` — novo
- `backend/src/core/logic/ConjuntoExato.ts` — novo
- `backend/src/core/infra/FailureStatus.ts` — novo
- `frontend/src/app/features/categorias/components/cor-grupo-picker/cor-grupo-picker.component.{ts,html,css}` — novo
- `frontend/src/app/features/categorias/constants/categorias.constants.ts` — novo
- `frontend/src/app/shared/components/entity-card/entity-card.component.css` — alterado
- `CLAUDE.md` — alterado (contexto `GrupoCategoria`)
- `README.md` — alterado (grupos de categorias, `GrupoCategoria/` e `/api/grupo-categoria`)
- `docs/changes/features/F0008-grupos-categorias/README.md` — novo (spec aprovada)
- `docs/changes/features/F0008-grupos-categorias/RESULT.md` — novo
- `docs/changes/features/README.md` — alterado (linha da F0008)
