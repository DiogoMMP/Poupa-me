# F0008 — Grupos de categorias, ordenação definida pelo admin e estatísticas por grupo

| | |
| :--- | :--- |
| **Tipo** | Feature — [issue #81](https://github.com/DiogoMMP/poupa-me/issues/81) "[Feat] Correções nas Categorias" |
| **Branch** | `feature/grupos-categorias` (base: `develop`) |
| **Estado** | Aprovado |
| **Âmbito** | Novo agregado `GrupoCategoria` (nome, tipo, cor, ordem; sem ícone) com CRUD e reordenação só para Admin; `Categoria` ganha grupo, ordem e papel; `GET /categoria` passa a devolver as categorias agrupadas pela ordem definida pelo admin; `app-select` com cabeçalhos de grupo; selects de categoria filtrados pelo tipo do grupo; correção da categoria usada no pagamento do cartão; estatísticas "Por grupo" / "Por categoria" com detalhe por grupo; migration de produção; modelo de domínio atualizado |
| **Verificação** | `backend`: `npm run build`, `npm run lint`, `npm test`. `frontend`: `npm run build`, `npm test -- --watch=false --browsers=ChromeHeadless`. Teste manual em browser e contra Postgres listado em §4 |

## 1. Situação

Hoje as categorias são uma lista simples, sem grupos, ordenada por `id`, e só os Admins as gerem. A issue #81 traz 8 prints de um dropdown de categorias agrupado com cabeçalhos. Os grupos dos prints, pela ordem em que aparecem, são: **Rendimentos** (Salário, Investimentos, Reembolsos de compras, Reembolso de impostos, Subsídios e pensões, Rendimento independente, Outros rendimentos), **Alimentação** (Supermercado, Restaurantes, Cafés), **Habitação** (Renda, Contas da casa, …), **Transportes** (Combustível, Transportes públicos, Estacionamento, Manutenção auto, Táxis e TVDE), **Saúde** (Farmácia, Saúde, Ginásio e desporto), **Lazer** (Cuidados pessoais, Prendas, Lazer, Viagens, Donativos, Animais de estimação, Subscrições), **Compras** (Compras, Roupa e calçado, Casa e mobiliário, Eletrónica e tecnologia, Cartão de crédito), **Educação e família** (Educação, Cuidados infantis), **Encargos** (Impostos, Taxas e comissões, Serviços profissionais, Seguros), **Outros** (Outras despesas), **Dinheiro** (Levantamentos) e **Transferências** (Transferências). Nos prints, cada grupo tem uma cor própria que pinta o fundo do ícone das suas categorias. **Os grupos e categorias dos prints são criados à mão pelo utilizador através da UI desta feature, não por seed nem por migration.**

As categorias que já existem têm transações e regras recorrentes ligadas. Não podem ser apagadas nem mudar de id, nome ou ícone por causa desta change. Os ícones continuam a ser emoji.

**Evidência:**

- [`backend/src/domain/Categoria/Entities/Categoria.ts`](../../../../backend/src/domain/Categoria/Entities/Categoria.ts): props `nome: Nome` e `icon: Icon`, nada mais.
- [`backend/src/persistence/entities/CategoriaEntity.ts`](../../../../backend/src/persistence/entities/CategoriaEntity.ts): tabela `categoria` com `id` serial, `domain_id`, `nome` (varchar 50), `icon`, `is_active`, `locale`, `created_at`, `updated_at`, e índice único parcial `UQ_categoria_nome_ativo` (`nome` WHERE `is_active`).
- [`backend/src/repos/Categoria/CategoriaRepo.ts`](../../../../backend/src/repos/Categoria/CategoriaRepo.ts) `findAll`: `order: { id: 'ASC' }`. Os IDs de domínio vêm de [`backend/src/utils/IDGenerator.ts`](../../../../backend/src/utils/IDGenerator.ts) (`CategoriaIdHelper`, prefixo `CAT` + 11 dígitos).
- [`backend/src/services/Categoria/CategoriaService.ts`](../../../../backend/src/services/Categoria/CategoriaService.ts), [`backend/src/controllers/Categoria/CategoriaController.ts`](../../../../backend/src/controllers/Categoria/CategoriaController.ts) e [`backend/src/api/routes/CategoriaRoute.ts`](../../../../backend/src/api/routes/CategoriaRoute.ts): `POST`/`PUT`/`DELETE` só para Admin; `GET /categoria` e `GET /categoria/:id` para qualquer autenticado. `GET /categoria` devolve `ICategoriaDTO[]` (`{ id, nome, icon }`).
- **Bug do pagamento do cartão**: [`backend/src/repos/Transacao/TransacaoPagarCartaoRepo.ts:88-92`](../../../../backend/src/repos/Transacao/TransacaoPagarCartaoRepo.ts) escolhe a categoria da transação "Pagamento <cartão>" com `createQueryBuilder('cat').orderBy('cat.id','ASC').limit(1)`. Isto é a primeira categoria da tabela, seja ela qual for, **inclusive apagada** (não filtra `is_active`). O service que chama esse repo é `CartaoCreditoService.pagarCartao` ([`backend/src/services/CartaoCredito/CartaoCreditoService.ts:340`](../../../../backend/src/services/CartaoCredito/CartaoCreditoService.ts)), que já injeta `CategoriaRepo`.
- [`backend/src/services/Estatisticas/EstatisticasService.ts`](../../../../backend/src/services/Estatisticas/EstatisticasService.ts): agrega gastos (Saída e Crédito, excluindo `isPagamentoCartao`) por categoria num `Map` e devolve `categorias: ICategoriaEstatistica[]`, com o formato `{ categoria: ICategoriaDTO, total: IDinheiroDTO }` ([`backend/src/dto/IEstatisticasDTO.ts`](../../../../backend/src/dto/IEstatisticasDTO.ts)). As transações vêm de `TransacaoContaQueryRepo`/`TransacaoCartaoQueryRepo`, que fazem join só a `t.categoria` (sem grupo).
- Consumidores do backend do `CategoriaRepo` (`TransacaoService`, `TransacaoDespesasRecorrentesService`, `DespesaRecorrenteService`, `CartaoCreditoService`, `IACategorizacaoService`) usam o repo diretamente, **não** o endpoint. `IACategorizacaoService` usa `findAll()` e **não pode ser alterado nesta change**.
- Em produção `synchronize` está desligado e correm as migrations de `backend/src/persistence/migrations/` ([`backend/src/loaders/typeorm.ts:37-42`](../../../../backend/src/loaders/typeorm.ts)). A migration mais recente é `1791100000000-SoftDeleteEntidades.ts`, que segue o estilo `queryRunner.query(...)` com `IF NOT EXISTS`, `up` e `down`.
- DI: cada repo/service/controller está registado em `backend/src/config/index.ts` e em `backend/src/loaders/index.ts`. As rotas são registadas em `backend/src/api/index.ts`.
- Frontend: [`frontend/src/app/features/categorias/services/categorias.service.ts`](../../../../frontend/src/app/features/categorias/services/categorias.service.ts) `getAll()` → `CategoriasDTO[]`. É usado por 8 view-models: `transacoes/components/{criar-entradas,criar-saidas,criar-credito,criar-reembolso,editar,listar}` e `despesas-recorrentes/components/{nova-regra,editar-regra,listar}`. A página `/categorias` (`features/categorias/components/{listar,criar,editar}`) é só Admin (`app.routes.ts`, `allowedRoles: ['Admin']`) e mostra uma grelha de cards; os forms de criar/editar têm nome e emoji (picker Picmo).
- [`frontend/src/app/shared/components/select/select.component.{ts,html}`](../../../../frontend/src/app/shared/components/select/select.component.ts): `AppSelectOption { value, label }`, lista plana, navegação por teclado por índice em `options` (`ArrowUp/Down`, `Enter`, `Escape`). As opções são construídas pelo pipe [`frontend/src/app/shared/pipes/to-select-options.pipe.ts`](../../../../frontend/src/app/shared/pipes/to-select-options.pipe.ts) (`label = "<icon> <nome>"`). **Não existe** story do `app-select` em `frontend/src/stories/`.
- Estatísticas no frontend: `features/estatisticas/components/estatisticas.component.{ts,html}` mostra um donut `ngx-charts-pie-chart` "Gastos por Categoria" a partir de `pieChartData$` (`{ name: categoria.nome, value }`). DTO em `features/estatisticas/dto/estatisticas.dto.ts`.
- `@angular/cdk` (`^20.2.14`) e `@swimlane/ngx-charts` (`^23.1.0`) já estão em `frontend/package.json`.
- Tema: fundo azul-marinho escuro, tokens em `frontend/src/styles/_tokens.css` (`--brand-text: #e2e8f0`, `--brand-accent: #61edd6`, `--brand-entrada: #4ade80`, `--brand-saida: #ff6b6b`).
- Tipos de transação: `Entrada`, `Saída` (conta) e `Crédito`, `Reembolso` (cartão). Tipos de regra recorrente: `Despesa Semanal`, `Despesa Mensal`, `Despesa Anual`, `Poupança`.

**Inventário:**

- **A. Agregado `GrupoCategoria` (backend)**: domínio, VOs, entity, repo, service, controller, rota, DTO, mapper, DI.
- **B. `Categoria` com grupo, ordem e papel (backend)**: domínio, entity, mapper, DTO, repo, service, controller, rota.
- **C. Listagem agrupada e reordenação (backend)**: `GET /categoria` agrupado; `PUT /grupo-categoria/ordem`; `PUT /categoria/ordem`.
- **D. Migration de produção.**
- **E. Correção da categoria do pagamento do cartão (backend).**
- **F. Estatísticas com grupo (backend).**
- **G. `app-select` com grupos e ícone pintado (frontend)** + story nova.
- **H. Service, DTOs e paleta de cores do frontend.**
- **I. Página de categorias do Admin**: secções por grupo, drag-and-drop, CRUD de grupos, forms de categoria com grupo e papel.
- **J. Selects de categoria agrupados e filtrados por tipo** nos 9 consumidores.
- **K. Estatísticas "Por grupo" / "Por categoria" com detalhe do grupo (frontend).**
- **L. `docs/domain_model.puml` (e `.svg`) atualizados.**

**Escala:** 1 agregado novo (cerca de 12 ficheiros novos no backend), 1 migration, 3 endpoints novos + 5 rotas CRUD de grupo, 1 endpoint com formato alterado (`GET /categoria`), 1 componente partilhado alterado, 9 view-models consumidores, 1 página de admin reescrita (lista) + 2 forms novos (grupo) + 2 forms alterados (categoria), 1 ecrã de estatísticas.

## 2. Resultado pretendido

O Admin entra em **Categorias** e vê secções, uma por grupo, pela ordem que ele definiu. Cada secção tem um cabeçalho só com o **título** do grupo (como nos prints), uma etiqueta discreta com o tipo e ações para editar e apagar o grupo. O cabeçalho do grupo não tem ícone nem quadrado colorido: a cor do grupo vê-se nos quadrados dos emojis das suas categorias. Por baixo estão as categorias do grupo, também pela ordem definida. O Admin arrasta os grupos para os reordenar, e arrasta as categorias dentro do mesmo grupo para as reordenar. Cada largada grava logo a nova ordem. No fim fica a secção **"Sem grupo"**, só se houver categorias sem grupo, com as categorias antigas ainda por atribuir. Há botões "Criar grupo" e "Criar categoria".

Em todos os selects de categoria da app, as opções aparecem agrupadas com o nome do grupo como cabeçalho de texto simples (sem ícone nem cor), como nos prints. Cada opção de categoria mostra o seu emoji num quadrado pintado com a cor do grupo a que pertence, seguido do nome. Os selects dos forms só mostram os grupos que fazem sentido para aquele tipo de movimento.

Nas **Estatísticas**, o cartão de gastos tem um seletor "Por grupo" / "Por categoria". "Por categoria" é o donut atual. "Por grupo" é um donut com uma fatia por grupo, na cor do grupo. Clicar numa fatia ou na linha do grupo na legenda abre o detalhe desse grupo: total do grupo, % do total de gastos, donut das categorias do grupo e tabela com categoria, valor, % do grupo e nº de transações. Um botão "Voltar" regressa à vista dos grupos.

O pagamento de um cartão passa a ficar registado na categoria que o Admin marcou como **"Pagamento de cartão"**.

**Decisões:**

- **`GrupoCategoria` é um agregado próprio** (`domain/GrupoCategoria/`), com as props:
  - `nome: Nome` (VO partilhado; único entre grupos ativos);
  - `tipo: TipoGrupoCategoria`;
  - `cor: CorGrupoCategoria`;
  - `ordem: number` (inteiro ≥ 1).
  **O grupo não tem ícone** (decisão do utilizador): nos prints o grupo é só um título. Os IDs de domínio usam um novo `GrupoCategoriaIdHelper` em `IDGenerator.ts`, com prefixo `GCT` e a mesma geração sequencial do `CategoriaRepo.save`.
- **Permissões:** criar, editar, apagar e reordenar grupos, e reordenar categorias, é só para Admin (`authorize([Role.Admin])`). Ler (`GET`) é para qualquer autenticado. Mantêm-se as permissões atuais das categorias.
- **`TipoGrupoCategoria`** (VO): `'Entrada' | 'Saída' | 'Ambos'`. Determina em que selects o grupo aparece (ver "Filtro por tipo").
- **`CorGrupoCategoria`** (VO): a BD guarda uma **chave** de uma paleta fechada, nunca um hex. Assim, se a paleta for afinada, os grupos acompanham. As chaves e os valores estão abaixo, desenhados para o fundo escuro da app; o backend valida só as chaves e o frontend tem o mapa chave → hex.

  | Chave | Hex |
  | :--- | :--- |
  | `turquesa` | `#61edd6` |
  | `verde` | `#4ade80` |
  | `lima` | `#a3e635` |
  | `amarelo` | `#facc15` |
  | `laranja` | `#fb923c` |
  | `areia` | `#d6b98c` |
  | `coral` | `#fb7185` |
  | `rosa` | `#f472b6` |
  | `roxo` | `#c084fc` |
  | `indigo` | `#818cf8` |
  | `azul` | `#60a5fa` |
  | `cinza` | `#94a3b8` |

  Uso visual: a cor do grupo aplica-se **aos quadrados dos emojis das categorias desse grupo** (fundo = cor a 18% de opacidade, contorno = cor a 45%), em todos os selects e na página do Admin, e às fatias do grupo no gráfico das estatísticas (cor sólida). **Nunca** se aplica ao cabeçalho/título do grupo, que é texto simples. "Sem grupo" usa sempre `cinza`. A paleta fica numa constante partilhada do frontend (`shared/constants/cores-grupo.ts`). A cor é escolhida no form do grupo por amostras clicáveis, não por input livre.
- **Apagar um grupo** é soft delete (`is_active = false`, como o resto da app, B0016). É **bloqueado com 400** se o grupo tiver categorias ativas; a mensagem diz quantas. Um grupo apagado liberta o nome.
- **`Categoria` ganha:**
  - `grupoId?: UniqueEntityID`, opcional. As categorias que já existem ficam sem grupo até o Admin as atribuir no form de editar. **No `POST` (criar) o `grupoId` é obrigatório.** No `PUT` é opcional; se vier, tem de ser um grupo ativo; não é possível tirar uma categoria de um grupo para "Sem grupo".
  - `ordem: number`: posição dentro do grupo (ou dentro de "Sem grupo").
  - `papel?: PapelCategoria`, um VO com um único valor por agora: `'PagamentoCartao'`. É único entre categorias ativas. Marcar uma categoria com um papel **retira-o** da categoria que o tinha, na mesma transação. Apagar (soft delete) uma categoria limpa o papel dela.
  Id, nome e ícone das categorias existentes não mudam.
- **Ordem:**
  - Uma categoria ou grupo novo entra no **fim** (`max(ordem) + 1` do conjunto respetivo).
  - Uma categoria que muda de grupo no editar vai para o **fim** do grupo novo.
  - A migration dá ordem inicial às categorias por `id` (1..n, todas em "Sem grupo").
  - Apagar não renumera; a próxima reordenação reescreve 1..n.
  - Empates (não deviam existir) desempatam por `id`.
- **Reordenação em lote, numa transação de BD:**
  - `PUT /grupo-categoria/ordem` com body `{ "ids": ["GCT…", …] }`. A lista tem de conter **exatamente** todos os grupos ativos; caso contrário dá 400. Reescreve `ordem` = posição (1..n).
  - `PUT /categoria/ordem` com body `{ "grupoId": "GCT…" | null, "ids": ["CAT…", …] }`. A lista tem de conter exatamente todas as categorias ativas desse grupo (`null` = "Sem grupo"); caso contrário dá 400. Reescreve 1..n.
  - Os dois endpoints são só para Admin. No frontend, cada largada dispara um pedido; se falhar, a lista volta à ordem anterior e aparece notificação de erro.
- **`GET /categoria` passa a devolver agrupado** (mudança de formato, *breaking*; o único cliente é o frontend, alterado nesta change):

  ```json
  [
    { "grupo": { "id": "GCT…", "nome": "Rendimentos", "tipo": "Entrada", "cor": "verde", "ordem": 1 },
      "categorias": [ { "id": "CAT…", "nome": "Salário", "icon": "💶", "grupoId": "GCT…", "ordem": 1, "papel": null } ] },
    { "grupo": null, "categorias": [ … ] }
  ]
  ```

  Os grupos vêm por `ordem`, e as categorias de cada grupo também por `ordem`. Incluem-se os grupos ativos **sem** categorias, porque a página do Admin precisa deles. A entrada `grupo: null` ("Sem grupo") vem sempre em último e só se tiver categorias. Só entram categorias e grupos ativos.
- **`ICategoriaDTO` ganha `grupoId: string | null`, `ordem: number`, `papel: string | null`.** `IInputCategoriaDTO` ganha `grupoId?: string` e `papel?: string | null` (`null` limpa o papel). `GET /categoria/:id` mantém o formato, com os campos novos.
- **Rotas do grupo** (`api/routes/GrupoCategoriaRoute.ts`, montadas em `/grupo-categoria`), com Swagger JSDoc como em `CategoriaRoute.ts`:
  - `GET /` (lista por `ordem`);
  - `GET /:id`;
  - `POST /`, `PUT /:id`, `DELETE /:id` (Admin);
  - `PUT /ordem` (Admin), declarada **antes** de `PUT /:id`.
  - `PUT /categoria/ordem` fica em `CategoriaRoute.ts`, também declarada antes de `PUT /:id`.
  - Erros: 404 para "não encontrado"; 400 para validação, para o bloqueio de apagar e para listas de reordenação inválidas.
- **Correção do pagamento do cartão:** `CartaoCreditoService.pagarCartao` procura, com um novo `ICategoriaRepo.findActiveByPapel('PagamentoCartao')`, a categoria ativa com esse papel. Se não houver, devolve `Result.fail('Nenhuma categoria está marcada como "Pagamento de cartão". Um administrador tem de a definir em Categorias.')` **antes** de mexer em saldos. Se houver, passa o domain id dela ao `TransacaoPagarCartaoRepo`, que a carrega por `domainId` + `isActive` dentro do `manager` da transação, em vez do `orderBy('cat.id').limit(1)`. A assinatura de `ITransacaoPagarCartaoRepo` é estendida com esse parâmetro.
- **Filtro por tipo de grupo nos selects**:
  - Regra base: um grupo aparece se `tipo` for o pedido ou `Ambos`. As categorias **sem grupo aparecem sempre**, na secção "Sem grupo", até serem arrumadas.

  | Ecrã | Tipos mostrados |
  | :--- | :--- |
  | Criar entradas (`criar-entradas`) | Entrada + Ambos |
  | Criar saídas (`criar-saidas`) | Saída + Ambos |
  | Criar crédito (`criar-credito`) | Saída + Ambos |
  | Criar reembolso (`criar-reembolso`) | Entrada + Ambos |
  | Editar transação | conforme o tipo da transação carregada (`Entrada`/`Reembolso` → Entrada; `Saída`/`Crédito` → Saída) |
  | Despesas recorrentes: nova regra e editar regra | Saída + Ambos |
  | Filtros de listas (transações `listar`, despesas recorrentes `listar`) | todos |

  - **No editar transação**, se a categoria atual da transação não estiver na lista filtrada (por estar num grupo de outro tipo), é acrescentada à lista, no seu grupo, para o form não ficar com o select vazio.
- **Frontend `CategoriasService`:**
  - `getAgrupadas(): Observable<CategoriasAgrupadasDTO[]>` (formato do `GET /categoria`).
  - `getAll(tipo?: 'Entrada' | 'Saída'): Observable<CategoriasModel[]>` devolve a lista **achatada pela ordem dos grupos**, já filtrada por tipo quando `tipo` vem. Cada item traz `grupo` (`{ id, nome, cor } | null`).
  - Os 9 consumidores continuam a chamar `getAll(...)`, só passam o tipo. `getById`/`create`/`update`/`delete` mantêm-se.
  - Novos `reordenar(grupoId, ids)` e um `GruposCategoriaService` (CRUD + `reordenar(ids)`).
- **`app-select`:** `AppSelectOption` ganha 3 campos opcionais:
  - `group?: string`: quando muda entre opções consecutivas, desenha um `<li role="presentation" class="app-select-group">` só com o nome do grupo em texto simples (sem ícone nem cor). Os cabeçalhos **não** entram em `options` nem em `optionEls`, por isso a navegação por teclado salta-os sem mudar a lógica de índices.
  - `icon?: string` e `color?: string` (hex): quando há `icon`, a opção mostra o emoji num quadrado pintado com a cor (18% / 45%) e `label` passa a ser só o nome. O gatilho mostra o mesmo.
  - Sem estes campos, o componente comporta-se exatamente como hoje.
  - O pipe `toSelectOptions` preenche `group`/`icon`/`color` **só** quando o item tem a propriedade `grupo` (isto é, categorias). Contas, cartões e strings mantêm `label = "<icon> <nome>"`. Categorias sem grupo têm `group: 'Sem grupo'` e cor `cinza`. A opção vazia (`emptyLabel`, p.ex. "Todas") não tem grupo e fica no topo.
- **Página de categorias do Admin** (`features/categorias/components/listar`):
  - **Lista**: secções por grupo, com `CdkDropList` para os grupos e um `CdkDropList` por grupo para as suas categorias. As categorias **não** se arrastam entre grupos; mudar de grupo é no form de editar categoria. O grupo "Sem grupo" não se arrasta, mas as categorias dentro dele sim.
  - **Grupos**: novas rotas `grupos/criar` e `grupos/editar/:id` em `categorias.routes.ts`, que herdam `allowedRoles: ['Admin']` da rota pai. Os forms de grupo seguem o estilo dos de categoria e têm nome, tipo (`app-select`) e cor (amostras, cada uma com um emoji de exemplo dentro do quadrado pintado, para se ver como vão ficar as categorias). Sem campo de ícone.
  - **Forms de categoria**: ganham "Grupo" (`app-select` com os grupos; obrigatório no criar) e, no editar, "Papel" (`app-select`: "Nenhum" / "Pagamento de cartão").
- **Estatísticas:**
  - **Backend:** `ICategoriaEstatistica` ganha `grupo: IGrupoCategoriaDTO | null` e `numTransacoes: number`. `EstatisticasService` carrega os grupos com um novo `IGrupoCategoriaRepo.findAll(true)` (inclui inativos, para estatísticas antigas não perderem o grupo) e o `grupoId` de cada categoria com `ICategoriaRepo.findAll(true)`. Junta isto à agregação existente. **Não** se mexe nos repos de query de transações.
  - **Frontend:** o agrupamento por grupo é feito no frontend a partir de `categorias` (soma por `grupo.id`, `null` = "Sem grupo"). As cores do donut vêm de `customColors` do ngx-charts, mapeadas pela paleta. O detalhe do grupo é um estado do view-model (`grupoSelecionado`), sem rota nova.
- **IA de categorização não é tocada** (`IACategorizacaoService`, `IACategorizacaoRoute`, `features/ia-categorizacao`). O `CategoriaRepo.findAll()` mantém a mesma assinatura e passa a ordenar por grupo e ordem, o que não muda o comportamento da IA.

**Alternativas rejeitadas:**

- **Ordem alfabética** (pedida inicialmente na conversa): substituída por ordem definida pelo Admin. Com ordem alfabética, "Outros" ficaria a meio e "Rendimentos" não ficaria no topo.
- **Grupo como texto livre na categoria**: não permite cor, tipo nem ordem do grupo, e renomear um grupo obrigaria a editar todas as categorias.
- **Cor livre (hex/color picker)**: o utilizador quer cores que fiquem bem com a estética da app; uma paleta fechada garante isso e permite afinar todas de uma vez.
- **Manter `GET /categoria` plano e criar `/categoria/agrupadas`**: o utilizador pediu explicitamente que a listagem passe a ser agrupada; o achatar fica no `getAll()` do frontend.
- **Ordem com "buracos" (10, 20, 30…) e um `PATCH` por elemento**: mais pedidos e estados intermédios inconsistentes; o lote numa transação é mais simples com listas desta dimensão (dezenas de itens).
- **Arrastar categorias entre grupos**: aumenta muito a complexidade do drag-and-drop e da API; mudar de grupo é raro e fica no form de editar.
- **Encontrar a categoria do pagamento pelo nome "Cartão de crédito"**: deixaria de funcionar se o Admin renomeasse a categoria.
- **Migration a criar um grupo por omissão para as categorias atuais**: o utilizador prefere arrumá-las à mão; "Sem grupo" deixa visível o que falta arrumar.
- **Lista de transações no detalhe do grupo nas estatísticas**: o detalhe mostra categorias, valores, % e nº de transações. Listar as transações obrigaria a um filtro por grupo nas queries de transações e a conciliar janelas de período diferentes (estatísticas vs lista, ver F0007 §5). Fica em §7.

## 3. Implementação

1. **Domínio do grupo (A)**
   - novo `backend/src/domain/GrupoCategoria/ValueObjects/TipoGrupoCategoria.ts`, `CorGrupoCategoria.ts` (exporta também a lista de chaves `CORES_GRUPO_CATEGORIA`), no estilo dos VOs existentes (`create()` → `Result`).
   - novo `backend/src/domain/GrupoCategoria/Entities/GrupoCategoria.ts` (`AggregateRoot`, construtor privado, `create(props, id?)` com `Guard`; `ordem` inteiro ≥ 1).
   - `backend/src/utils/IDGenerator.ts`: `GrupoCategoriaIdHelper` (prefixo `GCT`).
2. **Persistência e migration (A, B, D)**
   - novo `backend/src/persistence/entities/GrupoCategoriaEntity.ts`, tabela `grupo_categoria`: `id` serial, `domain_id` varchar(50), `nome` varchar(50), `tipo` varchar(20), `cor` varchar(20), `ordem` int, `is_active` boolean default true, `created_at`, `updated_at`; índice único parcial `UQ_grupo_categoria_nome_ativo` (`nome` WHERE `is_active`).
   - `CategoriaEntity.ts`:
     - `@ManyToOne(() => GrupoCategoriaEntity, { nullable: true })` + `@JoinColumn({ name: 'grupo_id' })` `grupo`, e `@Column({ name: 'grupo_id', type: 'int', nullable: true }) grupoId`, no padrão de `TransacaoEntity.categoria`;
     - `ordem` int default 0;
     - `papel` varchar(30) nullable;
     - índice único parcial `UQ_categoria_papel_ativo` (`papel` WHERE `is_active` AND `papel` IS NOT NULL).
   - registar `GrupoCategoriaEntity` em `backend/src/loaders/typeorm.ts`.
   - nova migration `backend/src/persistence/migrations/1795000000000-GruposCategorias.ts`:
     - **up**: cria a tabela e o índice do grupo; acrescenta `grupo_id` (FK para `grupo_categoria(id)`), `ordem` e `papel` a `categoria`; preenche `ordem` com `ROW_NUMBER() OVER (ORDER BY id)`; cria `UQ_categoria_papel_ativo`. Sempre com `IF NOT EXISTS`.
     - **down**: reverte tudo.
     - Comentário no topo a explicar, como a migration anterior.
3. **Mappers, DTOs e repos (A, B, C)**
   - novo `backend/src/dto/IGrupoCategoriaDTO.ts` (`IGrupoCategoriaDTO`, `IInputGrupoCategoriaDTO`, `IReordenarDTO`); `ICategoriaDTO.ts` com os campos novos e `ICategoriasAgrupadasDTO { grupo: IGrupoCategoriaDTO | null; categorias: ICategoriaDTO[] }`.
   - novo `backend/src/mappers/GrupoCategoriaMap.ts`; `CategoriaMap.ts` passa a mapear `grupoId` (domain id do grupo, a partir da relação `grupo` carregada), `ordem` e `papel`.
   - novo `backend/src/repos/GrupoCategoria/{IRepos/IGrupoCategoriaRepo.ts,GrupoCategoriaRepo.ts}`, ou no layout do `CategoriaRepo` (`repos/Categoria/ICategoriaRepo.ts` ao lado), seguindo o que existir:
     - `save`, `update`, `deleteById` (soft), `findAll(includeInactive?)` por `ordem`, `findById`, `findActiveById`, `countActiveCategorias(grupoId)`, `reordenar(ids)` (transação), `nextOrdem()`.
   - `CategoriaRepo`:
     - todas as leituras passam a carregar a relação `grupo` (para o mapper obter o domain id do grupo);
     - `findAll` ordena por `ordem` e `id`;
     - `save`/`update` gravam `grupo` (resolvido por domain id), `ordem` e `papel`;
     - `deleteById` limpa `papel`;
     - novos `findActiveByPapel(papel)`, `clearPapel(papel)`, `nextOrdem(grupoId | null)`, `reordenar(grupoId | null, ids)` (transação), `findAllActiveByGrupo(grupoId | null)`.
     - `ICategoriaRepo` atualizado.
4. **Services, controllers, rotas e DI (A, B, C)**
   - novo `backend/src/services/GrupoCategoria/{IServices/IGrupoCategoriaService.ts,GrupoCategoriaService.ts}`: CRUD, bloqueio de apagar com categorias ativas, `reordenar` com validação de conjunto exato.
   - `CategoriaService`:
     - `createCategoria` exige `grupoId` ativo e põe `ordem` no fim;
     - `updateCategoria` trata a mudança de grupo (fim do grupo novo) e o `papel` (limpa o anterior);
     - `getAllCategorias` passa a devolver `ICategoriasAgrupadasDTO[]`;
     - novo `reordenarCategorias(grupoId, ids)`.
   - novo `backend/src/controllers/GrupoCategoria/{IGrupoCategoriaController.ts,GrupoCategoriaController.ts}`; `CategoriaController` ganha `reordenarCategorias`.
   - novo `backend/src/api/routes/GrupoCategoriaRoute.ts` (Swagger incluído); `CategoriaRoute.ts`: `PUT /ordem` antes de `PUT /:id`, schemas Swagger atualizados (`Categoria`, `CategoriaInput`, `CategoriasAgrupadas`); registar a rota em `backend/src/api/index.ts`.
   - registar repo/service/controller do grupo em `backend/src/config/index.ts` e `backend/src/loaders/index.ts`.
5. **Pagamento do cartão (E)**: `ICategoriaRepo.findActiveByPapel`; `CartaoCreditoService.pagarCartao` resolve a categoria e falha cedo; `ITransacaoPagarCartaoRepo` + `TransacaoPagarCartaoRepo` recebem o domain id da categoria e carregam-na por `domainId` + `isActive` no `manager`; remove-se o `orderBy('cat.id').limit(1)`.
6. **Estatísticas (F)**: `IEstatisticasDTO.ts` (`grupo`, `numTransacoes`); `EstatisticasService` injeta `GrupoCategoriaRepo` e `CategoriaRepo` e enriquece cada entrada. Se o construtor mudar, ajustar os sítios onde é instanciado diretamente (p.ex. `services/Estatisticas/tests/EstatisticasService.spec.ts`) só o necessário para compilar. Não se acrescentam testes.
7. **`app-select` (G)**: `select.component.{ts,html,css}` com `group`/`icon`/`color`; `to-select-options.pipe.ts`; nova `frontend/src/stories/select.stories.ts` com as stories `Default`, `ComIcones` e `Agrupado` (dados de exemplo dos prints).
8. **Base do frontend (H)**:
   - nova `frontend/src/app/shared/constants/cores-grupo.ts` (chave → hex, helpers de fundo e contorno).
   - `features/categorias/dto/categorias.dto.ts` e `models/categorias.model.ts` com os campos novos, `CategoriasAgrupadasDTO`, `GrupoCategoriaDTO`, `GrupoCategoriaInputDTO`, `TipoGrupo`.
   - `features/categorias/mappers/categorias.mapper.ts`.
   - `categorias.service.ts` com `getAgrupadas`, `getAll(tipo?)` e `reordenar`.
   - novo `features/categorias/services/grupos-categoria.service.ts`.
9. **Página do Admin (I)**:
   - `features/categorias/components/listar/*`: secções, `DragDropModule`, reordenação com rollback, ações de grupo.
   - novos `features/categorias/components/grupos-criar/*` e `grupos-editar/*` (component + view-model + html + css, no padrão de `criar`/`editar`).
   - `categorias.routes.ts`: rotas dos grupos.
   - `components/criar/*`: campo grupo.
   - `components/editar/*`: campos grupo e papel.
10. **Consumidores (J)**: passar o tipo a `getAll(...)` em `criar-entradas`, `criar-saidas`, `criar-credito`, `criar-reembolso`, `editar` (com a inclusão da categoria atual), `despesas-recorrentes/nova-regra` e `editar-regra`. As listas (`transacoes/listar`, `despesas-recorrentes/listar`) ficam com `getAll()` sem tipo. Ajustar os mocks em `*.view-model.spec.ts` que fornecem `CategoriasService` só se deixarem de compilar.
11. **Estatísticas no frontend (K)**: `features/estatisticas/dto/estatisticas.dto.ts`, `models`, `mappers`, `components/estatisticas.view-model.ts`, `estatisticas.component.{ts,html,css}`: seletor "Por grupo"/"Por categoria" (por omissão "Por grupo"), donut por grupo com `customColors`, detalhe do grupo e "Voltar".
12. **Modelo de domínio (L)**: `docs/domain_model.puml` com o pacote `GrupoCategoria` (`<<aggregate>>`), VOs `TipoGrupoCategoria`, `CorGrupoCategoria` e `PapelCategoria`, e as relações `Categoria "0..*" --> "0..1" GrupoCategoria: agrupada em`, `GrupoCategoria --> Nome`, `GrupoCategoria --> TipoGrupoCategoria`, `GrupoCategoria --> CorGrupoCategoria`, `Categoria --> "0..1" PapelCategoria`. Regenerar `docs/domain_model.svg` se houver PlantUML disponível; se não, registar em `RESULT.md` §4.

## 4. Verificação

- **Baseline:** medir antes de qualquer alteração e registar em `RESULT.md`. Basta correr `npm run build`, `npm run lint` e `npm test` em `backend/`, e `npm run build` e `npm test -- --watch=false --browsers=ChromeHeadless` em `frontend/`.
- `cd backend && npm run build && npm run lint && npm test`: passa sem erros de build, sem erros de lint novos face à baseline e com os testes existentes verdes.
- `cd frontend && npm run build && npm test -- --watch=false --browsers=ChromeHeadless`: passa sem erros de build e com os testes existentes verdes.
- `cd frontend && npm run build-storybook`: a story nova do `app-select` compila.
- `grep -n "orderBy('cat.id'" backend/src/repos/Transacao/TransacaoPagarCartaoRepo.ts` → zero resultados.
- `git diff --stat -- backend/src/services/IACategorizacao backend/src/api/routes/IACategorizacaoRoute.ts frontend/src/app/features/ia-categorizacao` → vazio.
- **Manual, com Postgres + browser** (se não for possível nesta sessão, fica em `RESULT.md` §4 com estes passos):
  1. Arrancar o backend em dev (`synchronize`) e confirmar as colunas e a tabela novas.
  2. Correr a migration num Postgres limpo com o schema anterior (`NODE_ENV=production`) e depois o `down`.
  3. Criar 2 grupos, atribuir categorias, reordenar grupos e categorias, recarregar e confirmar que a ordem persiste.
  4. Tentar apagar um grupo com categorias → 400.
  5. Abrir cada um dos forms da tabela "Filtro por tipo" e confirmar os grupos mostrados.
  6. Pagar um cartão sem papel definido → erro claro, saldos intactos; marcar "Cartão de crédito" com o papel → o pagamento fica nessa categoria.
  7. Estatísticas: alternar as vistas, abrir o detalhe de um grupo, voltar.
  8. Navegar o `app-select` agrupado só com o teclado.

## 5. Riscos

- **Pagamentos de cartão param de funcionar logo após o deploy**, até o Admin marcar uma categoria com o papel "Pagamento de cartão". É intencional: hoje ficam na categoria errada. **Validação:** a mensagem de erro diz o que fazer; isto fica registado em `RESULT.md` §2 como passo de deploy (marcar o papel logo a seguir), e o passo 6 do teste manual confirma que os saldos não mudam quando falha.
- **Migration e `synchronize` divergirem** (nomes de colunas, tipos ou índices diferentes entre a entity e a migration), partindo produção ou a dev. **Validação:** passos 1 e 2 do teste manual; comparar `\d categoria` e `\d grupo_categoria` nos dois casos.
- **Transações e regras existentes perderem a categoria**, por mudar id ou `domain_id` ou por a relação nova falhar no mapper. **Validação:** a migration só acrescenta colunas; `CategoriaMap.toDomain` aceita `grupo` ausente (categoria sem grupo); listar transações antigas no browser mostra as categorias como antes.
- **Partir os mappers que carregam `categoria` aninhada sem a relação `grupo`** (`TransacaoMap`, repos de transação), se o `CategoriaMap` passar a exigir o grupo. **Validação:** `grupoId` é opcional no domínio e no mapper; build e testes existentes passam; listas de transações e de despesas recorrentes abrem no browser.
- **`PUT /ordem` capturado por `PUT /:id`** (`id = "ordem"`). **Validação:** a rota `ordem` é declarada antes; teste manual 3.
- **Reordenação concorrente ou com lista desatualizada** deixar ordens trocadas. **Validação:** validação de conjunto exato com 400 e rollback visual no frontend; o Admin é um só utilizador na prática.
- **Formato novo de `GET /categoria` partir algum consumidor esquecido.** **Validação:** o build do frontend falha se algum tipo não bater; `grep -rn "categoriasService\|CategoriasService" frontend/src/app` confirma que todos usam `getAll`/`getAgrupadas`.
- **A navegação por teclado do `app-select` partir** com os cabeçalhos. **Validação:** os cabeçalhos não entram em `options`/`optionEls`; teste manual 8 e a story `Agrupado`.
- **Editar uma transação antiga com uma categoria de um grupo de outro tipo** e ficar com o select vazio. **Validação:** regra de incluir a categoria atual; testar no browser com uma transação nessa situação.
- **IA de categorização afetada sem querer.** **Validação:** o `git diff` da §4 aos ficheiros da IA está vazio; `findAll()` mantém a assinatura.

## 6. Ordem de commit

| # | Unidade | Ficheiros principais | Ref. inventário |
| :--- | :--- | :--- | :--- |
| 1 | Domínio do grupo + ID helper | `domain/GrupoCategoria/**`, `utils/IDGenerator.ts` | A |
| 2 | Persistência + migration | `GrupoCategoriaEntity.ts`, `CategoriaEntity.ts`, `loaders/typeorm.ts`, `migrations/1795000000000-GruposCategorias.ts` | A, B, D |
| 3 | DTOs, mappers e repos | `dto/IGrupoCategoriaDTO.ts`, `dto/ICategoriaDTO.ts`, `mappers/{GrupoCategoriaMap,CategoriaMap}.ts`, `repos/GrupoCategoria/**`, `repos/Categoria/**` | A, B |
| 4 | Services, controllers, rotas, DI | `services/{GrupoCategoria,Categoria}/**`, `controllers/{GrupoCategoria,Categoria}/**`, `api/routes/{GrupoCategoriaRoute,CategoriaRoute}.ts`, `api/index.ts`, `config/index.ts`, `loaders/index.ts` | A, B, C |
| 5 | Fix do pagamento do cartão | `CartaoCreditoService.ts`, `ITransacaoPagarCartaoRepo.ts`, `TransacaoPagarCartaoRepo.ts` | E |
| 6 | Estatísticas com grupo (backend) | `IEstatisticasDTO.ts`, `EstatisticasService.ts` | F |
| 7 | `app-select` agrupado + story | `shared/components/select/*`, `shared/pipes/to-select-options.pipe.ts`, `stories/select.stories.ts` | G |
| 8 | Base do frontend | `shared/constants/cores-grupo.ts`, `features/categorias/{dto,models,mappers,services}/**` | H |
| 9 | Página do Admin | `features/categorias/components/**`, `categorias.routes.ts` | I |
| 10 | Consumidores filtrados por tipo | 7 view-models de `transacoes`/`despesas-recorrentes` (+ specs se necessário) | J |
| 11 | Estatísticas no frontend | `features/estatisticas/**` | K |
| 12 | Modelo de domínio | `docs/domain_model.{puml,svg}` | L |

Os commits 4 e 8–10 mudam o contrato de `GET /categoria` dos dois lados. Entre eles a app fica partida, por isso tudo tem de ir no mesmo PR.

## 7. Fora de âmbito / handoff

- **Criar os grupos e categorias dos prints**: o utilizador fá-lo à mão, pela UI, depois do deploy (e marca o papel "Pagamento de cartão").
- **Testes novos** (domínio, services, reordenação, pipe, select): ficam para a issue própria de testes que o utilizador vai tratar de ponta a ponta. Esta change só mantém verdes os testes existentes.
- **IA de categorização** (prompt, uso de grupos, erros de API): o utilizador tem mudanças próprias planeadas; não se toca.
- **Lista de transações no detalhe do grupo nas estatísticas**, com filtro por grupo nas queries de transações: change futura.
- **Arrastar categorias entre grupos** no drag-and-drop: change futura, se fizer falta.
- **Outros papéis de categoria** (p.ex. transferências, levantamentos): o VO `PapelCategoria` fica preparado, mas só `PagamentoCartao` é usado.
