# F0009 — Categorização automática em camadas: histórico por utilizador e cliente do modelo próprio

| | |
| :--- | :--- |
| **Tipo** | Feature — [issue #53](https://github.com/DiogoMMP/Poupa-me/issues/53) "[Feat/Bug] Treinar a IA para a categorização automática" (fase 1 da issue e a parte backend da fase 2) |
| **Branch** | `feature/categorizacao-modelo-proprio` (base: `develop`) |
| **Estado** | Aprovado |
| **Âmbito** | A sugestão de categoria passa a ser feita em 3 camadas: histórico do próprio utilizador → modelo próprio num Hugging Face Space (cliente pronto, desligado até o Space existir) → LLM atual do HF Inference como último recurso. A sugestão passa a respeitar o tipo do movimento. A transação guarda a categoria sugerida e a camada que a sugeriu. O modelo Python e o seu deploy são a change seguinte (F0010), numa branch própria. |
| **Verificação** | `backend`: `npm run build`, `npm run lint`, `npm test`. `frontend`: `npm run build`, `npm test -- --watch=false --browsers=ChromeHeadless`. Passos manuais (Postgres, browser) listados em §4. |

## 1. Situação

Hoje a sugestão de categoria envia a descrição da transação e a lista de todas as categorias a um LLM (`Qwen/Qwen2.5-7B-Instruct`) através do Hugging Face Inference. Cada sugestão gasta créditos, que são poucos, e quando o serviço do HF está em baixo a sugestão deixa de funcionar. A sugestão também ignora o tipo do movimento: um form de Saída pode receber uma categoria de um grupo de Entrada.

O objetivo da issue #53 é ter um modelo próprio, treinado com o histórico de transações, que melhore com as correções dos utilizadores. A abordagem decidida é **aprendizagem supervisionada com ciclo de feedback**, não aprendizagem por reforço: quando o utilizador muda a categoria sugerida, está a dar a resposta certa, e essa transação entra no treino seguinte. O trabalho foi dividido em duas changes:

- **F0009 (esta):** colunas de sugestão, camada de histórico, novo contrato da sugestão com o tipo, cliente do Space (camada 2) e frontend. Pode ir para produção sozinha: sem Space configurado, a camada 2 é saltada.
- **F0010 (seguinte, branch própria, escrita pelo utilizador com apoio):** o modelo Python (pasta `categorizador/`), o Space Gradio e o workflow de deploy. Implementa o contrato definido em §2 desta change.

**Análise dos dados (export da BD feito pelo utilizador, 1341 transações):**

- Só 401 descrições diferentes: os mesmos nomes repetem-se muito ("Continente", "Mercadona", tarifários…).
- ~39% estão na categoria "Outros". São dados antigos, de antes de as categorias serem usadas: a mesma loja aparece umas vezes como "Supermercado" e outras como "Outros". As transações da BD não vão ser alteradas: nem esta change nem o utilizador as reclassificam. Por isso a sugestão (e o treino do F0010) têm de se proteger delas de forma permanente, excluindo "Outros".
- Baseline medido (TF-IDF por n-gramas de caracteres `char_wb` 2–5 + `LogisticRegression(C=10)`, sem as linhas "Outros"): ~88% de acerto com validação cruzada aleatória (descrições já vistas) e ~59% em descrições nunca vistas (`GroupKFold` por descrição). A maior parte do valor está em reutilizar o histórico, que é a camada 1 desta change.

**Infraestrutura já preparada pelo utilizador (fora do repo):**

- Space Hugging Face `DiogoMMP/poupa-me-categorizador`, privado, SDK Gradio, hardware ZeroGPU (o único gratuito sem PRO), licença MIT. Ainda sem código (F0010).
- Token HF do backend (`HF_TOKEN`, token fine-grained `PoupaMe-Backend`) com permissão "Read contents of selected repos" sobre o Space, além da permissão de inferência que já tinha.

**Evidência:**

- [`backend/src/services/IACategorizacao/IACategorizacaoService.ts`](../../../../backend/src/services/IACategorizacao/IACategorizacaoService.ts): `suggestCategory(description)` chama `InferenceClient.chatCompletion` com `config.ai.model`, filtra só "Sem Categoria" da lista, e devolve `Result<ICategoriaDTO>`; mapeia a resposta por nome e cai em "Outros" quando não reconhece. Em erro devolve `Result.fail('AI_SERVICE_UNAVAILABLE')`.
- [`backend/src/services/IACategorizacao/IIACategorizacaoService.ts`](../../../../backend/src/services/IACategorizacao/IIACategorizacaoService.ts): `suggestCategory(description: string): Promise<Result<ICategoriaDTO>>`.
- [`backend/src/controllers/IACategorizacao/IACategorizacaoController.ts`](../../../../backend/src/controllers/IACategorizacao/IACategorizacaoController.ts) e [`backend/src/api/routes/IACategorizacaoRoute.ts`](../../../../backend/src/api/routes/IACategorizacaoRoute.ts): `GET /ia-categorizacao/sugerir?description=…` com `isAuth`; 400 sem descrição, 500 em falha; resposta `ICategoriaDTO`.
- [`backend/src/config/index.ts:98-101`](../../../../backend/src/config/index.ts): `ai: { hfToken: process.env.HF_TOKEN, model: 'Qwen/Qwen2.5-7B-Instruct' }`.
- [`frontend/src/app/features/ia-categorizacao/ia-categorizacao.service.ts`](../../../../frontend/src/app/features/ia-categorizacao/ia-categorizacao.service.ts): `sugerir(transacao)` → `Observable<CategoriasDTO>`.
- Consumidores do frontend: `features/transacoes/components/{criar-entradas,criar-saidas,criar-credito,criar-reembolso}/*.component.ts` chamam `sugerir` em `onDescricaoBlur()` e fazem `form.categoriaId.setValue(categoria.id)`. Os view-models correspondentes carregam as categorias com `categoriasService.getAll('Entrada')` (entradas, reembolso) ou `getAll('Saída')` (saídas, crédito) e submetem com `submit(formData)`.
- Regra do filtro por tipo (F0008), em [`frontend/src/app/features/categorias/services/categorias.service.ts:24-30`](../../../../frontend/src/app/features/categorias/services/categorias.service.ts): uma categoria entra para o tipo `T` se não tiver grupo, ou se o grupo tiver tipo `T` ou `Ambos`.
- [`backend/src/persistence/entities/TransacaoEntity.ts`](../../../../backend/src/persistence/entities/TransacaoEntity.ts): tabela `transacao` com `descricao` (varchar 500), `categoria_id` (int, FK), `user_domain_id` (varchar 50), `is_pagamento_cartao`, `created_at`, etc. Não há colunas de sugestão nem soft delete.
- [`backend/src/domain/Transacao/Entities/Transacao.ts`](../../../../backend/src/domain/Transacao/Entities/Transacao.ts): `TransacaoProps` com `descricao`, `data`, `valor`, `tipo`, `categoria`, `status`, `conta?`, `cartaoCredito?`, `contaDestino?`, `contaPoupanca?`, `isPagamentoCartao?`; fábricas `createEntrada/createSaida/createCredito/createReembolso`.
- [`backend/src/mappers/TransacaoMap.ts`](../../../../backend/src/mappers/TransacaoMap.ts): `toPersistence` escreve `categoria_id` com o **domain id** da categoria; [`backend/src/repos/Transacao/TransacaoRepo.ts`](../../../../backend/src/repos/Transacao/TransacaoRepo.ts) resolve esse domain id para o id numérico da tabela `categoria` (linhas ~38–84, ~210–264, ~314) antes de gravar.
- [`backend/src/dto/ITransacaoDTO.ts`](../../../../backend/src/dto/ITransacaoDTO.ts): `ITransacaoInputDTO` e `ITransacaoReembolsoDTO` (entrada da criação); [`backend/src/services/Transacao/TransacaoService.ts`](../../../../backend/src/services/Transacao/TransacaoService.ts) `createEntrada` (l. 63), `createSaida` (l. 110), `createCredito` (l. 157), `createReembolso` (l. 219) validam a categoria com `categoriaRepo.findActiveById`.
- `Categoria` tem `grupo` (com `tipo`) e `papel` desde o F0008 ([`backend/src/domain/Categoria/Entities/Categoria.ts`](../../../../backend/src/domain/Categoria/Entities/Categoria.ts)).
- [`backend/src/loaders/typeorm.ts:38-43`](../../../../backend/src/loaders/typeorm.ts): fora de produção as colunas vêm do `synchronize`; em produção correm as migrations de `backend/src/persistence/migrations/` (estilo `queryRunner.query(...)` com `IF NOT EXISTS`, `up` e `down`; a mais recente é `1795000000000-GruposCategorias.ts`).
- Não há hooks de commit (`.husky/`, `.pre-commit-config.yaml` e `core.hooksPath` ausentes).

**Inventário:**

- **A. Colunas de sugestão na transação**: migration, entity, domínio, mapper, repo, DTOs de entrada, serviço de criação.
- **B. Camada 1 — histórico por utilizador (backend)**: normalização da descrição, query agregada no repo, escolha.
- **C. Orquestração das camadas e novo contrato da sugestão (backend)**: service, interface, controller, rota (com `tipo`), DTO de resposta, config.
- **D. Cliente do Space (backend)**: `@gradio/client` com timeout, desligado quando não configurado.
- **E. Camada 3 — LLM atual restringido às candidatas (backend)**.
- **F. Frontend**: serviço `sugerir` com `tipo` e novo DTO; 4 forms de criação guardam a sugestão e enviam-na no submit.
- **G. Documentação**: `CLAUDE.md`, `docs/domain_model.puml`.

**Escala:** 1 migration (2 colunas), 1 endpoint com contrato alterado (`GET /ia-categorizacao/sugerir`: novo parâmetro `tipo` e nova resposta), 4 métodos de criação de transações, 4 forms e 4 view-models do frontend, 1 dependência npm nova no backend (`@gradio/client`), 2 ficheiros de teste Jest novos.

## 2. Resultado pretendido

Quando o utilizador sai do campo descrição num form de criação (Entrada, Saída, Crédito, Reembolso), o frontend pede uma sugestão indicando o tipo do form. O backend tenta, por esta ordem, e pára na primeira resposta aceite:

1. **Histórico do utilizador.** Se o próprio utilizador já criou transações com a mesma descrição normalizada, numa categoria candidata, devolve essa categoria (origem `historico`).
2. **Modelo próprio.** Se o Space estiver configurado, pede-lhe a previsão, só entre as categorias candidatas. Se a confiança for ≥ limiar (0.6 por omissão), devolve-a (origem `modelo`).
3. **LLM.** O pedido atual ao HF Inference, mas só com as categorias candidatas (origem `llm`).

Se a camada 3 falhar e a camada 2 tiver dado uma resposta abaixo do limiar, devolve essa (origem `modelo`). Se nada responder, o endpoint responde como hoje em falha e o form fica sem sugestão: **a criação de transações nunca fica bloqueada**.

O form preenche a categoria e memoriza a sugestão. No submit, envia `categoriaSugeridaId` e `origemSugestao`. A transação grava as duas colunas, quer o utilizador mantenha quer mude a categoria. Assim, cada correção (`categoria_sugerida_id` ≠ `categoria_id`) fica registada para o treino do F0010 e para as métricas da fase 4 da issue.

Até o F0010 existir, `HF_SPACE_ID` não está definido e o fluxo é histórico → LLM.

**Decisões:**

- **Normalização da descrição:** minúsculas → decomposição Unicode NFD e remoção das marcas diacríticas → remoção de dígitos → qualquer sequência de caracteres que não seja letra `a-z` passa a um espaço → espaços colapsados e `trim`. Ex.: `"Pagamento 123 - Tarifário"` → `"pagamento tarifario"`; `"CONTINENTE  Bom Dia"` → `"continente bom dia"`. Se a descrição normalizada ficar vazia, as camadas 1 e 2 são saltadas. Os exemplos do teste ficam num ficheiro JSON (`backend/tests/fixtures/exemplos_normalizacao.json`, lista de `{ "entrada": …, "esperado": … }`, pelo menos 12 casos: acentos, maiúsculas, números, pontuação, hífenes, espaços múltiplos, só números, string vazia). **O F0010 vai implementar a mesma normalização em Python e testá-la com este mesmo ficheiro**, para as duas implementações nunca divergirem.
- **Categorias candidatas para o tipo:** categorias ativas, sem as excluídas (ver abaixo), filtradas pela regra do F0008. O parâmetro `tipo` vale `Entrada` ou `Saída`; uma categoria entra se não tiver grupo ou se o grupo tiver tipo `tipo` ou `Ambos`. Sem `tipo` no pedido, todas as categorias ativas não excluídas são candidatas (compatibilidade). A lista é calculada uma vez por pedido e usada pelas 3 camadas.
- **Categorias excluídas da sugestão:** por nome, configurável na variável de ambiente `IA_CATEGORIAS_EXCLUIDAS` (lista separada por vírgulas, comparação sem maiúsculas nem acentos), com valor por omissão `Outros,Sem Categoria`. Também são excluídas as categorias com `papel` definido (p.ex. "Pagamento de cartão"), que são atribuídas pelo sistema e nunca escolhidas pelo utilizador. **Razão:** "Outros" é o ruído dos dados antigos; se entrasse, o histórico aprenderia a responder "Outros". A camada 3 também deixa de receber "Outros"; quando o LLM responde algo que não é uma candidata, a resposta é rejeitada em vez de cair em "Outros" (era o comportamento antigo).
- **Camada 1 (histórico):** novo método no `ITransacaoRepo`/`TransacaoRepo`, p.ex. `findHistoricoDescricoes(userDomainId)`, que devolve linhas agregadas `{ descricao, categoriaDomainId, total, ultima }` (`GROUP BY descricao, categoria_id`, `ultima = MAX(created_at)`) sobre as transações do utilizador (`user_domain_id`), excluindo `is_pagamento_cartao = true`. A normalização é feita em TypeScript sobre estas linhas (são centenas, não milhares). Entre as linhas cuja descrição normalizada é igual à pedida e cuja categoria está nas candidatas, somam-se os `total` por categoria; ganha a de maior soma e, em empate, a de `ultima` mais recente. O utilizador é `req.currentUser.id` (quem está a criar a transação), também para Admins.
- **Novo contrato de `GET /ia-categorizacao/sugerir`:** query `description` (obrigatória, como hoje) e `tipo` (opcional, `Entrada` | `Saída`; outro valor → 400). Resposta 200: `ISugestaoCategoriaDTO = { categoria: ICategoriaDTO; origem: 'historico' | 'modelo' | 'llm'; confianca: number | null }` (`confianca` só na origem `modelo`). Falhas mantêm 400/500 como hoje. O único cliente é o frontend desta app, atualizado no mesmo PR.
- **`IIACategorizacaoService.suggestCategory(description: string, userId: string, tipo?: 'Entrada' | 'Saída'): Promise<Result<ISugestaoCategoriaDTO>>`.**
- **Colunas novas em `transacao`** (ambas nullable; transações antigas ficam `NULL`):
  - `categoria_sugerida_id integer NULL`, FK para `categoria(id)` com `ON DELETE SET NULL`;
  - `origem_sugestao varchar(20) NULL`, valores `historico` | `modelo` | `llm`.
- **Domínio:** `TransacaoProps` ganha `categoriaSugerida?: Categoria` e `origemSugestao?: OrigemSugestao`, com getters. Novo VO `domain/Transacao/ValueObjects/OrigemSugestao.ts` (valores acima, `create` devolve `Result`). Regra: as duas vêm juntas ou nenhuma (Guard em `Transacao.create`).
- **Entrada:** `ITransacaoInputDTO` e `ITransacaoReembolsoDTO` ganham `categoriaSugeridaId?: string` e `origemSugestao?: string`. Nos 4 `create*` do `TransacaoService`: se vierem os dois, a categoria sugerida é carregada com `categoriaRepo.findActiveById`; se não existir ou a origem for inválida, **a sugestão é ignorada** (com `logger.info`) e a transação é criada na mesma — dados de métrica nunca bloqueiam a criação. Se vier só um dos dois, também é ignorado. `ITransacaoUpdateDTO` não muda: editar uma transação não mexe na sugestão.
- **Saída:** `ITransacaoDTO` **não** ganha os campos (ninguém os lê ainda; as métricas são a fase 4 da issue).
- **Camada 2, cliente:** `@gradio/client` no backend. Configuração em `config.ai`:
  - `spaceId: process.env.HF_SPACE_ID` (p.ex. `DiogoMMP/poupa-me-categorizador`; também aceita um URL, p.ex. `http://localhost:7860` para desenvolvimento local);
  - `spaceTimeoutMs: Number(process.env.IA_SPACE_TIMEOUT_MS ?? 8000)`;
  - `limiarConfianca: Number(process.env.IA_LIMIAR_CONFIANCA ?? 0.6)`;
  - `categoriasExcluidas` a partir de `IA_CATEGORIAS_EXCLUIDAS`.
  O token é o `HF_TOKEN` que já existe. Sem `HF_SPACE_ID`, a camada 2 é saltada. A ligação (`Client.connect`) é criada uma vez e reutilizada; se uma chamada falhar, a ligação é descartada e recriada no pedido seguinte. Qualquer erro, timeout ou resposta mal formada → camada seguinte, com `logger.error`. O nome exato da opção de token no `Client.connect` é o da versão instalada (verificar nos tipos do pacote).
- **Contrato do Space (implementado pelo F0010, consumido aqui):** função Gradio com `api_name="predict"`, entradas `descricao: str` (a descrição original; o Space normaliza) e `candidatas: str` (JSON com a lista de domain ids das categorias candidatas; lista vazia = todas), saída uma string JSON `{ "categoriaId": str | null, "confianca": float | null, "versaoModelo": str | null }`. `categoriaId: null` quando o Space não tem modelo treinado ou nenhuma candidata é conhecida pelo modelo. O cliente aceita a saída como string JSON ou como objeto já decodificado, e valida que `categoriaId` é uma das candidatas.

**Alternativas rejeitadas:**

- **Aprendizagem por reforço:** a correção do utilizador dá a resposta certa, que é um sinal mais forte do que uma recompensa; aprendizagem supervisionada com retreino é mais simples e estável.
- **Ollama no Render:** os planos gratuitos do Render não têm RAM para um LLM local, e sem GPU seria lento.
- **Serviço Python no Render:** um segundo serviço sempre ligado esgota as horas grátis da conta.
- **HF Space com Docker ou CPU Basic:** ambos exigem PRO; só o Gradio com ZeroGPU é gratuito.
- **Treinar no GitHub Actions e prever no Node (modelo exportado):** sem alojamento extra, mas obriga a reimplementar a previsão em TypeScript e limita a modelos lineares. Fica como saída de emergência se o HF mudar os planos.
- **Modelo por utilizador:** com poucos dados por pessoa, treina pior. As preferências pessoais ficam cobertas pela camada 1, que é por utilizador.
- **O backend recalcular a sugestão no momento da criação:** dava o valor certo sem confiar no cliente, mas duplicava a chamada às camadas (custo e latência). A sugestão vem do cliente e só serve para métricas e pesos; é validada (categoria existe, origem válida) e ignorada se for inválida.
- **Tudo numa só change (backend, frontend e Python):** PR grande e difícil de rever; e o utilizador quer escrever a parte Python para aprender. Separado em F0009 + F0010.

## 3. Implementação

Cada fase compila e verifica sozinha. Ordem: dados → backend → frontend → documentação.

**Fase 1 — Migration e colunas (A).**

- Nova migration `backend/src/persistence/migrations/1796000000000-SugestaoCategoriaTransacao.ts` no estilo das existentes: `ADD COLUMN IF NOT EXISTS "categoria_sugerida_id" integer`, `ADD COLUMN IF NOT EXISTS "origem_sugestao" character varying(20)`, FK `FK_transacao_categoria_sugerida` para `categoria(id)` `ON DELETE SET NULL` (criada só se não existir). `down` remove a FK e as colunas.
- `TransacaoEntity`: `@ManyToOne(() => CategoriaEntity, { eager: false, nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'categoria_sugerida_id' }) categoriaSugerida?` + `@Column({ name: 'categoria_sugerida_id', type: 'int', nullable: true }) categoriaSugeridaId?` + `@Column({ name: 'origem_sugestao', type: 'varchar', length: 20, nullable: true }) origemSugestao?`.
- Confirmar que a migration é apanhada pelo glob de migrations em `backend/src/loaders/typeorm.ts` como as anteriores.

**Fase 2 — Domínio, mapper, repo e criação (A).**

- VO `OrigemSugestao` e props/getters `categoriaSugerida`, `origemSugestao` em `Transacao`, com o Guard "as duas ou nenhuma".
- `TransacaoMap.toPersistence`: `categoria_sugerida_id` (domain id, como `categoria_id`) e `origem_sugestao`. `toDomain`: só preenche `categoriaSugerida`/`origemSugestao` se a linha trouxer o objeto da categoria sugerida; caso contrário deixa-as por preencher (as leituras desta change não precisam delas). Documentar isto num comentário curto.
- `TransacaoRepo`: nos caminhos de gravação que resolvem `categoria_id` (domain id → id numérico), resolver `categoria_sugerida_id` da mesma forma; `NULL` quando não vier. **Atenção ao `update`:** gravar uma transação existente não pode apagar `categoria_sugerida_id`/`origem_sugestao` (se o domínio não as tiver carregadas, não escrever essas colunas).
- DTOs de entrada e os 4 `create*` do `TransacaoService` conforme §2.

**Fase 3 — Camada 1, orquestração e contrato (B, C, E).**

- Função de normalização num módulo utilitário do backend (p.ex. `backend/src/utils/normalizarDescricao.ts`, seguindo a pasta utilitária que o repo já usa), o ficheiro `backend/tests/fixtures/exemplos_normalizacao.json` e um teste Jest em `backend/tests/` que lê esse ficheiro.
- Método de histórico no `ITransacaoRepo`/`TransacaoRepo`.
- `backend/src/dto/ISugestaoCategoriaDTO.ts`.
- `config.ai` com as chaves novas.
- `IACategorizacaoService`: calcula as candidatas, corre as camadas, devolve `ISugestaoCategoriaDTO`. O código atual do LLM passa a um método privado que recebe as candidatas. Injetar o repo de transações (`@Inject(...)` com o nome registado em `config/index.ts`).
- Controller: lê e valida `tipo`, passa `req.currentUser.id`. Rota: documentação OpenAPI do parâmetro `tipo` e da nova resposta.

**Fase 4 — Cliente do Space (D).**

- `npm install @gradio/client` no backend (versão fixada no `package.json` como as restantes dependências).
- Cliente isolado numa classe/módulo próprio (p.ex. `backend/src/services/IACategorizacao/CategorizadorSpaceClient.ts`) com `predict(descricao, candidatas): Promise<{ categoriaId: string; confianca: number } | null>`, timeout com `Promise.race`, reutilização e descarte da ligação, e validação da resposta.
- Teste Jest do `IACategorizacaoService` com o cliente, o LLM e os repos simulados, a cobrir: histórico ganha; histórico vazio → modelo acima do limiar; modelo abaixo do limiar → LLM; LLM falha → modelo abaixo do limiar; tudo falha → `Result.fail`; Space não configurado → salta para o LLM; `tipo` filtra as candidatas; "Outros" e categorias com `papel` nunca são sugeridas; resposta do LLM fora das candidatas é rejeitada. Para o LLM poder ser simulado, a chamada ao HF Inference fica num ponto substituível (p.ex. método protegido ou dependência injetada), sem mudar o comportamento.

**Fase 5 — Frontend (F).**

- `ia-categorizacao.service.ts`: `sugerir(descricao: string, tipo?: 'Entrada' | 'Saída'): Observable<SugestaoCategoriaDTO>`, com o DTO novo conforme o padrão das outras features (`dto/`).
- Os 4 componentes de criação: passam o tipo do form (o mesmo que o view-model usa em `getAll`), preenchem `categoriaId` com `sugestao.categoria.id` e guardam `{ categoriaSugeridaId, origemSugestao }` num campo do componente. Uma nova sugestão substitui o valor guardado; se a sugestão falhar, é limpo.
- Os 4 view-models: `submit` envia `categoriaSugeridaId` e `origemSugestao` quando existirem. `TransacoesInputDTO`/`TransacoesReembolsoDTO` em `features/transacoes/dto/transacoes.dto.ts` ganham os dois campos opcionais.
- Atualizar specs existentes destes componentes/serviços se deixarem de compilar ou passar.

**Fase 6 — Documentação (G).**

- `CLAUDE.md`: uma linha sobre a sugestão de categoria em 3 camadas (histórico, Space, LLM) e as variáveis `HF_SPACE_ID`, `IA_SPACE_TIMEOUT_MS`, `IA_LIMIAR_CONFIANCA`, `IA_CATEGORIAS_EXCLUIDAS`.
- `docs/domain_model.puml`: `Transacao` com `categoriaSugerida` (0..1 → `Categoria`) e `origemSugestao`. Regenerar `docs/domain_model.svg` se houver ferramenta disponível; senão, registar em RESULT §4.
- O `.env.example` do backend (se existir) ganha as variáveis novas, sem valores.

## 4. Verificação

**Comandos (baseline a registar antes da Fase 1):**

- `backend/`: `npm run build`, `npm run lint`, `npm test`.
- `frontend/`: `npm run build`, `npm test -- --watch=false --browsers=ChromeHeadless`.

Passa quando build e lint não têm erros novos face à baseline, e todos os testes passam, incluindo os novos (normalização e orquestração das camadas).

**Manuais (precisam de ambiente; se não puderem ser corridos, vão para RESULT §4):**

1. Colunas na BD. Em desenvolvimento (docker) as colunas são criadas pelo `synchronize` a partir da `TransacaoEntity`, sem correr a migration; isso valida a entity. A migration só corre em produção: no primeiro deploy, confirmar que a tabela `transacao` tem `categoria_sugerida_id` e `origem_sugestao`, e que as transações antigas ficam com `NULL`.
2. Criar uma Saída no browser: a sugestão aparece; depois de gravar, a linha tem `categoria_sugerida_id` e `origem_sugestao`; mudar a categoria antes de gravar mantém a sugerida original. Editar essa transação a seguir não apaga as duas colunas.
3. Criar uma segunda Saída com a mesma descrição: a sugestão vem com origem `historico`.
4. Uma descrição nova num form de Entrada só sugere categorias de grupos `Entrada`/`Ambos`/sem grupo, e nunca "Outros".
5. Sem `HF_SPACE_ID`: o fluxo é histórico → LLM. Com `HF_SPACE_ID` apontado para um Space inexistente: a sugestão cai para o LLM dentro do timeout e a criação continua a funcionar.

## 5. Riscos

- **Atualizações de transações a apagar a sugestão** (o `update` reescreve a linha sem as colunas novas). Validação: inspeção do caminho de `update` no `TransacaoRepo`; passo manual 2.
- **Primeira chamada ao Space lenta** (arranque do Space, ligação inicial) → a sugestão demora. Validação: timeout configurável (8 s por omissão) e fallback coberto pelo teste Jest e pelo passo manual 5.
- **Ruído dos dados antigos ("Outros")** a contaminar o histórico. Validação: teste Jest garante que as categorias excluídas nunca são sugeridas; a lista é configurável sem deploy de código.
- **Mudança do contrato de `/ia-categorizacao/sugerir`** partir o frontend. Validação: os 4 consumidores são atualizados no mesmo PR; build e testes do frontend.
- **Divergência futura da normalização em Python (F0010).** Mitigação: os exemplos ficam num ficheiro JSON partilhado, que o F0010 tem de usar nos testes.
- **Ciclo vicioso** (o modelo do F0010 treina com as próprias sugestões aceites sem revisão). Mitigação: a origem e a categoria sugerida ficam gravadas, o que permite pesar as correções e medir o acerto.
- **Credenciais:** nenhum token ou URI entra no código, nos testes nem nos logs. Validação: revisão do diff; os valores só existem nas variáveis de ambiente.

## 6. Ordem dos commits

| # | Unidade | Ficheiros principais | Inventário |
| :--- | :--- | :--- | :--- |
| 1 | Migration e colunas | migration nova, `TransacaoEntity.ts` | A |
| 2 | Domínio, mapper, repo e criação com sugestão | `Transacao.ts`, `OrigemSugestao.ts`, `TransacaoMap.ts`, `TransacaoRepo.ts`, `ITransacaoDTO.ts`, `TransacaoService.ts` | A |
| 3 | Normalização + camada de histórico + novo contrato | `normalizarDescricao.ts`, fixture JSON, repo de transações, `ISugestaoCategoriaDTO.ts`, `IACategorizacaoService.ts`, interface, controller, rota, `config/index.ts`, testes Jest | B, C, E |
| 4 | Cliente do Space como camada 2 | `package.json`/lock, `CategorizadorSpaceClient.ts`, service, testes Jest | D |
| 5 | Frontend envia tipo e grava a sugestão | `ia-categorizacao.service.ts`, DTO, 4 componentes + 4 view-models, `transacoes.dto.ts` | F |
| 6 | Documentação | `CLAUDE.md`, `docs/domain_model.puml` (+ `.svg`), `.env.example` | G |

## 7. Fora de âmbito / passagem

- **F0010 — modelo Python, Space e deploy** (branch própria a partir de `develop` depois do merge desta; código escrito pelo utilizador com apoio). Decisões já tomadas para essa change:
  - pasta `categorizador/` no monorepo: `README.md` (cartão do Space, cabeçalho YAML `sdk: gradio`, `app_file: app.py`, `license: mit`), `app.py` só com a camada Gradio, pacote com `normalizacao.py`, `dados.py` (query e pesos), `modelo.py` (treino e previsão), `requirements.txt` com versões fixas, testes `pytest` (incluindo a normalização com `backend/tests/fixtures/exemplos_normalizacao.json`);
  - implementa o contrato `predict` de §2, e uma função `train` protegida por um secret `TRAIN_KEY`;
  - modelo inicial `TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5))` + `LogisticRegression(C=10, max_iter=2000)` sobre a descrição normalizada, classes = domain ids das categorias, previsão restrita às candidatas com a probabilidade renormalizada;
  - dados de treino lidos diretamente da BD (secret `DATABASE_URL` do Space, `psycopg` 3), com as mesmas exclusões desta change (`IA_CATEGORIAS_EXCLUIDAS`, categorias com `papel`, `is_pagamento_cartao`), data de corte opcional `IA_TREINO_DATA_CORTE`, pesos por recência (meia-vida de 1 ano), correções ×2 e no máximo 20 exemplos por par (descrição, categoria); mínimo de 2 classes e 10 exemplos;
  - treino no arranque e de `TREINO_INTERVALO_HORAS` em `TREINO_INTERVALO_HORAS` horas (por omissão 6), com troca atómica do modelo;
  - workflow `.github/workflows/categorizador.yml`: `pytest` em PRs e em `main`; em `main`, deploy com `huggingface_hub.upload_folder` usando o secret `HF_TOKEN` e a variable `HF_SPACE_ID` do GitHub (já criados).
- **Fase 3 da issue — cadeia de LLM** (Groq, Gemini, OpenRouter atrás de uma interface comum): change futura. Nesta, a camada 3 continua a ser o HF Inference atual.
- **Fase 4 da issue — métricas de acerto** (total e por origem, ao longo do tempo): change futura; as colunas desta change são a base.
- **Reclassificação das transações antigas em "Outros"**: não vai ser feita. As transações da BD ficam como estão; a exclusão de "Outros" (e, no F0010, a data de corte opcional) é a proteção permanente contra esse ruído.
- **Experimentação local do modelo (F0010):** o utilizador pode treinar e avaliar o modelo localmente a partir de um export CSV da BD (como o `Result_3.csv` já analisado), preparando esse CSV como quiser. Isso serve só para experimentar e escolher o modelo; o treino em produção é sempre feito pelo Space a partir da BD, com as exclusões de §2. A normalização da descrição (§2) é outra coisa: é automática e feita pelo código.
- **Utilizador Postgres só de leitura no Aiven** e troca do secret `DATABASE_URL` do Space: o utilizador, antes do F0010 ir para produção.
- **Variáveis de ambiente no Render** (`HF_SPACE_ID` só depois do F0010; opcionalmente `IA_SPACE_TIMEOUT_MS`, `IA_LIMIAR_CONFIANCA`, `IA_CATEGORIAS_EXCLUIDAS`): o utilizador, no deploy.
- **Keep-alive do Space no cron existente**: o utilizador, depois do F0010.
- **Sugestão no form de editar transação e nas regras de despesas recorrentes**: hoje não existe e continua sem existir.
- **`docs/wiki/Categorias-e-IA.md`**: atualizado pelo fluxo da knowledge base (`compile-wiki`), não por esta change.
