# F0009 — Resultado: categorização automática em camadas (histórico, modelo próprio, LLM)

| | |
| :--- | :--- |
| **Tipo** | Feature — [issue #53](https://github.com/DiogoMMP/Poupa-me/issues/53) "[Feat/Bug] Treinar a IA para a categorização automática" (fase 1 e parte backend da fase 2) |
| **Branch** | `feature/categorizacao-modelo-proprio` (base: `develop`) |
| **Estado** | Implementado — sem verificação contra Postgres, contra um Space real nem em browser nesta sessão (ver §4) |
| **Build** | Backend `npm run build` ✅ (baseline ✅). Frontend `npm run build` ✅ sem warnings (baseline ✅, sem warnings) |
| **Lint** | Backend `npm run lint`: 58 problemas (51 erros, 7 warnings), **igual ao baseline** e nos mesmos 18 ficheiros. Nenhum ficheiro novo ou alterado por esta change aparece como novo problema. O frontend não tem script de lint |
| **Testes** | Backend 118/118 em 17 suites (baseline 77/77 em 15 suites): **41 testes novos** em 2 ficheiros novos — 19 da normalização (18 exemplos do JSON partilhado + 1 de contagem) e 22 da orquestração das camadas, do prompt e da validação da resposta do Space. Frontend 26/26 (baseline 26/26), sem testes novos (o §3 não os pedia) e sem specs a adaptar |
| **Commits** | Nenhum (por instrução: sem commit, push nem PR). A ordem do README §6 continua aplicável, com a ressalva do §3 abaixo sobre `IACategorizacaoService.ts` (fases 3 e 4 no mesmo ficheiro) |

## 1. O que foi fechado

- **A. Colunas de sugestão na transação** — ✅ Migration `1796000000000-SugestaoCategoriaTransacao.ts` (`ADD COLUMN IF NOT EXISTS` de `categoria_sugerida_id integer` e `origem_sugestao character varying(20)`, FK `FK_transacao_categoria_sugerida` para `categoria(id)` `ON DELETE SET NULL` criada só se não existir em `pg_constraint`; `down` remove FK e colunas). O glob `persistence/migrations/*.js` do `loaders/typeorm.ts` apanha-a (o `.js` compilado está em `dist/persistence/migrations/`). `TransacaoEntity` com a relação `categoriaSugerida` e as colunas `categoriaSugeridaId`/`origemSugestao`, nullable. VO novo `OrigemSugestao` (`historico` | `modelo` | `llm`, `create` devolve `Result`); `Transacao` ganha `categoriaSugerida?`/`origemSugestao?` com getters e o Guard "as duas ou nenhuma" em `Transacao.create`. `TransacaoMap.toPersistence` escreve `categoria_sugerida_id` (domain id) e `origem_sugestao`; `toDomain` só as preenche se a linha trouxer o objeto `categoriaSugerida` (comentado). `TransacaoRepo` resolve o domain id para o id numérico no `save`, no `update` e no fallback do `update`; quando o domínio não traz sugestão, não escreve as colunas, por isso **editar uma transação não as apaga**. `ITransacaoInputDTO` e `ITransacaoReembolsoDTO` ganham `categoriaSugeridaId?`/`origemSugestao?`; os 4 `create*` do `TransacaoService` usam `resolverSugestao`, que ignora a sugestão (com `logger.info`) quando falta um dos dois campos, a origem é inválida ou a categoria não existe, e a transação é criada na mesma. `ITransacaoUpdateDTO` e `ITransacaoDTO` não mudaram.
- **B. Camada 1 — histórico por utilizador** — ✅ `backend/src/utils/normalizarDescricao.ts` (minúsculas → NFD sem marcas diacríticas → sem dígitos → tudo o que não é `a-z` passa a um espaço → espaços colapsados e `trim`), `backend/tests/fixtures/exemplos_normalizacao.json` com 18 casos (acentos, maiúsculas, números, pontuação, hífenes, espaços múltiplos, tab/newline, só números, só pontuação, string vazia) e `backend/tests/normalizarDescricao.spec.ts`, que lê esse ficheiro. `ITransacaoRepo.findHistoricoDescricoes(userDomainId)` / `TransacaoRepo`: `GROUP BY t.descricao, c.domain_id`, `COUNT(*)` e `MAX(created_at)`, só do utilizador e sem `is_pagamento_cartao`. A escolha (em TypeScript) soma os `total` por categoria candidata entre as linhas com a mesma descrição normalizada; ganha a maior soma e, em empate, a `ultima` mais recente. O utilizador é `req.currentUser.id`, também para Admins.
- **C. Orquestração e novo contrato** — ✅ `IIACategorizacaoService.suggestCategory(description, userId, tipo?)` → `Result<ISugestaoCategoriaDTO>`; `backend/src/dto/ISugestaoCategoriaDTO.ts` (`categoria`, `origem`, `confianca`). As candidatas são calculadas uma vez por pedido: categorias ativas, sem `papel`, sem os nomes de `IA_CATEGORIAS_EXCLUIDAS` (comparação sem maiúsculas nem acentos) e, com `tipo`, só as sem grupo ou de grupos `tipo`/`Ambos`. Ordem: histórico → Space (aceite se `confianca ≥ IA_LIMIAR_CONFIANCA`) → LLM → modelo abaixo do limiar → `Result.fail('AI_SERVICE_UNAVAILABLE')`. Descrição normalizada vazia salta as camadas 1 e 2. `config.ai` ganha `spaceId`, `spaceTimeoutMs` (8000), `limiarConfianca` (0.6) e `categoriasExcluidas` (`Outros,Sem Categoria`). O controller valida `tipo` (`Entrada`/`Saída`, outro valor → 400) e passa `req.currentUser.id`. A rota tem a documentação OpenAPI do `tipo` e da nova resposta (com exemplo).
- **D. Cliente do Space** — ✅ `@gradio/client` `^2.8.0` no `package.json` (caret, como as restantes dependências) e no `package-lock.json`. `backend/src/services/IACategorizacao/CategorizadorSpaceClient.ts`: `predict(descricao, candidatas)` chama `/predict` com `{ descricao, candidatas: JSON.stringify(ids) }`, com timeout por `Promise.race`; a ligação (`Client.connect(spaceId, { token })`, opção `token` confirmada nos tipos da 2.8.0) é criada uma vez e reutilizada, e descartada quando uma chamada falha ou expira. A saída é aceite como string JSON ou objeto, dentro do array de outputs do Gradio, e só com `categoriaId` entre as candidatas e `confianca` em [0, 1]. Qualquer erro, timeout ou resposta mal formada devolve `null` com `logger.error`. Sem `HF_SPACE_ID` o cliente nem é criado e a camada é saltada.
- **E. Camada 3 — LLM restringido às candidatas** — ✅ O pedido ao HF Inference passou para o método protegido `pedirAoLlm(description, labels)` (substituível nos testes), só com os nomes das candidatas. A frase do prompt sobre "Outros" foi retirada, porque "Outros" já não é candidata. Uma resposta que não é uma candidata é rejeitada (com `logger.info`) em vez de cair em "Outros".
- **F. Frontend** — ✅ `IaCategorizacaoService.sugerir(descricao, tipo?)` → `Observable<SugestaoCategoriaDTO>`; DTO novo em `features/ia-categorizacao/dto/ia-categorizacao.dto.ts` (`OrigemSugestao`, `SugestaoCategoriaDTO`, `SugestaoGuardada`). Os 4 componentes de criação passam o tipo do form (`Entrada` em entradas/reembolso, `Saída` em saídas/crédito, os mesmos do `getAll` dos view-models), preenchem `categoriaId` com `sugestao.categoria.id` e guardam `{ categoriaSugeridaId, origemSugestao }`; uma nova sugestão substitui a guardada e uma falha limpa-a. Os 4 view-models recebem a sugestão como 2.º argumento de `submit` e enviam os dois campos só quando existem. `TransacoesInputDTO` e `TransacoesReembolsoDTO` ganham os dois campos opcionais. Nenhum spec do frontend referia estes ficheiros.
- **G. Documentação** — ✅ `CLAUDE.md` (uma linha em "Backend architecture → Key conventions" sobre as 3 camadas, as exclusões, as colunas e as variáveis `HF_SPACE_ID`, `IA_SPACE_TIMEOUT_MS`, `IA_LIMIAR_CONFIANCA`, `IA_CATEGORIAS_EXCLUIDAS`). `docs/domain_model.puml` com `OrigemSugestao` (0..1) no agregado `Transacao` e `Transacao "0..*" --> "0..1" Categoria: sugerida como (categoriaSugerida)`; `docs/domain_model.svg` regenerado. Não havia `.env.example`; foi criado depois (ver "Correções depois da implementação" em §3).

## 2. Pontos que precisam de decisão

Os seis pontos que a implementação deixou em aberto foram revistos com o utilizador e resolvidos na mesma branch (ver "Correções depois da implementação" em §3). Ficam:

- **`npm audit` no backend reporta 37 vulnerabilidades (7 low, 21 moderate, 7 high, 2 critical)**, todas anteriores a esta change (o `@gradio/client` não acrescentou nenhuma). As dependências diretas envolvidas são `fast-xml-parser`, `jest`, `moment`, `morgan`, `multer`, `nodemon`, `ts-jest`, `typeorm` e `typescript-eslint`. **Consequência:** ficam como estavam até uma change própria (p.ex. `chore/`) correr `npm audit fix` e rever o que muda no lockfile; não foram mexidas aqui para não misturar dezenas de atualizações de dependências com esta feature.
- **Modelo do LLM indisponível na conta HF.** Em produção o HF responde `model_not_supported` ("The requested model 'Qwen/Qwen2.5-7B-Instruct' is not supported by any provider you have enabled"). O modelo passou a ser configurável (`HF_MODEL`), mas o valor certo depende dos Inference Providers ativos na conta. **Consequência:** até o utilizador ativar um provider que sirva o modelo ou definir `HF_MODEL` com um modelo servido, a camada 3 falha sempre; a sugestão fica só com o histórico (e, depois do F0010, com o modelo), e sem resposta o endpoint dá 204.
- **Os specs têm erros de tipo anteriores a esta change** (60 num `tsc` que os inclua: mocks `jest.fn()` tipados como `never`, valores possivelmente `undefined`). Os que esta change criou foram corrigidos. **Consequência:** nenhuma no gate (o ts-jest corre-os na mesma); quem ligar o type-check dos specs encontra os que já existiam.

## 3. Desvios do plano aprovado

- **Fases 3 e 4 no mesmo ficheiro.** O `IACategorizacaoService.ts` foi escrito uma vez, já com a camada 2. Para fazer os commits 3 e 4 do README §6 separados é preciso staging parcial desse ficheiro (ou juntar os dois commits). Os outros ficheiros de cada fase estão separados.
- **Localização dos testes.** O teste da normalização está em `backend/tests/normalizarDescricao.spec.ts`, como o README pede, ao lado da fixture partilhada; no resto do backend os testes estão junto do código (`src/**/tests/`). O `testMatch` do Jest apanha os dois sítios. O teste da orquestração (sem localização no README) ficou em `backend/src/services/IACategorizacao/tests/IACategorizacaoService.spec.ts`, como os outros services, e inclui também os casos de `CategorizadorSpaceClient.validar` — assim ficam os 2 ficheiros de teste previstos na escala do README.
- **Simulação nos testes.** O LLM é substituído por uma subclasse que redefine `pedirAoLlm` (método protegido). O Space é simulado com `jest.spyOn(CategorizadorSpaceClient.prototype, 'predict')`; "Space não configurado" é `config.ai.spaceId = undefined` antes de construir o service. O teste escreve `config.ai.*` (limiar e exclusões) para não depender do `.env` local.
- **`categoriaId: null` do Space não é registado como erro.** O README manda `logger.error` em "resposta mal formada"; `null` é a resposta normal de um Space sem modelo treinado, por isso é tratado como "sem previsão" sem log. A validação também exige `confianca` numérica em [0, 1] (o contrato diz `float | null`); fora disso, é mal formada.
- **`@gradio/client` é carregado com `import()` dinâmico** na primeira chamada ao Space. Sem `HF_SPACE_ID` o pacote nunca é carregado, e os testes não o importam.
- **Erros da camada 1 (BD do histórico) passam à camada seguinte** com `logger.error`, como o README pede para a camada 2. Os erros do LLM também deixaram de terminar o pedido: passam ao fallback do modelo abaixo do limiar.
- **Uma categoria cujo grupo não está ativo conta como "sem grupo"** no filtro por tipo, como faz o `GET /categoria` (o README não cobre o caso; com o `deleteIfEmpty` do F0008 não devia acontecer).
- **Sem candidatas** (todas excluídas), o pedido falha logo com a mensagem que já existia para "nenhuma categoria".
- **O controller responde 401 quando não há `req.currentUser`.** A rota já tem `isAuth`, por isso não devia acontecer; existe para não passar um `userId` vazio ao repo.
- **`foreignKeyConstraintName: 'FK_transacao_categoria_sugerida'` na `TransacaoEntity`**, igual ao nome da migration, seguindo o F0008 (`FK_categoria_grupo_id`): o `synchronize` (dev) e a migration (produção) dão o mesmo nome à FK.
- **Tipo `IHistoricoDescricao`** (linhas agregadas do histórico) exportado de `ITransacaoRepo.ts`.
- **`TransacaoRepo.resolverSugestao`**: se a categoria sugerida já não existir no momento de gravar, a sugestão não é gravada (com `logger.error`, o único nível do logger do repo) e a transação é gravada na mesma. O `TransacaoService` já tinha validado com `findActiveById`; isto cobre o intervalo entre as duas leituras.
- **`TransacaoService`**: o tipo do `logger` passou a incluir `info`, para o `logger.info` pedido no README. É o mesmo logger (winston) injetado como `'logger'`.
- **Leituras não carregam a categoria sugerida.** Nenhum repo pede a relação `categoriaSugerida`, por isso `toDomain` nunca a preenche hoje — é o que o README descreve ("as leituras desta change não precisam delas").
- **Frontend**: a subscrição da sugestão passou a ter `error` (antes não tinha, e uma falha ficava só na consola); `submit` dos view-models recebe a sugestão como 2.º argumento opcional.
- **`.env.example`**: não existe no repo; o README dizia "se existir", por isso não foi criado.
- **SVG do modelo de domínio**: regenerado com o `plantuml.jar` da extensão VS Code `jebbs.plantuml-2.18.1` já instalada localmente (`java -jar … -tsvg domain_model.puml`); o diff é uma linha enorme, como no F0008.

**Correções depois da implementação** (pedidas pelo utilizador ao rever os pontos em aberto):

- **Sem sugestão deixa de ser erro:** `suggestCategory` devolve `Result.ok(null)` quando nenhuma camada sugere nada (também sem candidatas), e o controller responde **204**; 500 fica só para erros inesperados. `IIACategorizacaoService` passa a `Result<ISugestaoCategoriaDTO | null>`; o serviço do frontend emite `null` (os 4 forms já tratavam `null` como "sem sugestão"). OpenAPI da rota atualizado. Os 4 testes que esperavam falha passam a esperar ok com `null`.
- **Prompt do LLM conforme o tipo:** `nomeDoMovimento(tipo)` → "receita" (Entrada), "despesa" (Saída) ou "transação" (sem tipo), usado no prompt; `pedirAoLlm` recebe o `tipo`. Teste novo para `nomeDoMovimento` e verificação do `tipo` passado ao LLM.
- **Modelo do LLM configurável:** `config.ai.model = process.env.HF_MODEL ?? 'Qwen/Qwen2.5-7B-Instruct'` (ver §2).
- **Swagger dos `POST /transacao/*`:** `categoriaSugeridaId` e `origemSugestao` documentados nos schemas `TransacaoInput`, `TransacaoReembolsoInput` e `TransacaoCreditoInput`.
- **Mocks dos specs:** `info: jest.fn()` nos loggers dos specs de transações que o exigiam e `findHistoricoDescricoes` no mock de `ITransacaoRepo`; já nenhum erro de tipo nos specs vem desta change.
- **`CLAUDE.md`:** a nota de cobertura de testes passou a descrever as 17 suites; a linha da sugestão menciona `HF_MODEL` e o 204; a convenção de `.env.example` foi acrescentada à secção Config.
- **`.env.example`:** criado `backend/.env.example` com todas as variáveis lidas pelo backend (só valores de exemplo, sem segredos) e `.env.example` na raiz (`NGROK_AUTHTOKEN` do docker-compose); `backend/.gitignore` ganhou `!.env.example`, porque ignorava todos os `.env.*`. O frontend não usa variáveis de ambiente (usa `environment.ts`).

## 4. Por verificar

- **Postgres (passo manual 1 do README §4): nada correu contra uma BD.** Nem o `synchronize` em dev (validaria a entity) nem a migration (`NODE_ENV=production`, `up` e `down`). No primeiro deploy, confirmar que `transacao` tem `categoria_sugerida_id` e `origem_sugestao`, a FK `FK_transacao_categoria_sugerida` com `ON DELETE SET NULL`, e as transações antigas a `NULL`.
- **A query do histórico nunca correu**: `GROUP BY t.descricao, c.domainId`, `COUNT(*)`, `MAX(t.createdAt)` e os aliases `categoriaDomainId`/`ultima` em `getRawMany`. Está validada só pelo build e por mocks; o tipo devolvido pelo `pg` para `COUNT(*)` (string) e `MAX` (Date) é convertido com `Number()`/`new Date()`.
- **Browser (passos manuais 2–4)**: criar uma Saída e ver a sugestão; confirmar na BD `categoria_sugerida_id`/`origem_sugestao` depois de gravar, também quando se muda a categoria antes de gravar; editar essa transação e confirmar que as colunas ficam; uma segunda Saída com a mesma descrição a vir com origem `historico`; uma descrição nova num form de Entrada a sugerir só categorias de grupos `Entrada`/`Ambos`/sem grupo e nunca "Outros". Nada disto foi corrido (sem browser nem backend a correr nesta sessão).
- **Space (passo manual 5)**: com um Space real não foi testado (o F0010 ainda não existe). Foi feito só um teste de fumo do `CategorizadorSpaceClient` compilado: contra um Space id inexistente no Hugging Face e contra `http://127.0.0.1:9` (porta fechada), ambos devolveram `null` com `logger.error` em ~250 ms, dentro do timeout de 4 s usado. O passo completo (backend com `HF_SPACE_ID` inválido, a sugestão a cair para o LLM e a criação a funcionar) fica por fazer.
- **Chamada real ao HF Inference**: não foi feita (nos testes o LLM é simulado). O formato da resposta do `chatCompletion` não mudou.
- **Cypress (`npm run test:ci`)** — não corrido; precisa do backend e do frontend a correr.

## 5. Como correr a verificação

- `cd backend && npm run build` — compila o backend (entity, migration, domínio, service, cliente do Space).
- `cd backend && npm test` — corre as 118 specs; as novas são `tests/normalizarDescricao.spec.ts` (exemplos partilhados com o F0010) e `src/services/IACategorizacao/tests/IACategorizacaoService.spec.ts` (camadas, limiar, fallbacks, filtro por tipo, exclusões, rejeição do LLM, contrato do Space).
- `cd backend && npm run lint` — à parte, porque já falha antes desta change: tem de ficar nos 58 problemas pré-existentes, nos mesmos 18 ficheiros.
- `cd frontend && npm run build && npm test -- --watch=false --browsers=ChromeHeadless` — compila os 4 forms e view-models e o serviço novo, e corre as 26 specs.
- `ls backend/dist/persistence/migrations/` depois do build — mostra `1796000000000-SugestaoCategoriaTransacao.js`, que o glob de produção apanha.
- **Manual com Postgres e browser:** os passos 1–5 do README §4 (ver §4 acima).

## 6. Inventário de alterações

- `backend/src/persistence/migrations/1796000000000-SugestaoCategoriaTransacao.ts` — novo
- `backend/src/persistence/entities/TransacaoEntity.ts` — alterado
- `backend/src/domain/Transacao/ValueObjects/OrigemSugestao.ts` — novo
- `backend/src/domain/Transacao/Entities/Transacao.ts` — alterado
- `backend/src/mappers/TransacaoMap.ts` — alterado
- `backend/src/repos/Transacao/IRepos/ITransacaoRepo.ts` — alterado (`findHistoricoDescricoes`, `IHistoricoDescricao`)
- `backend/src/repos/Transacao/TransacaoRepo.ts` — alterado
- `backend/src/dto/ITransacaoDTO.ts` — alterado
- `backend/src/dto/ISugestaoCategoriaDTO.ts` — novo
- `backend/src/services/Transacao/TransacaoService.ts` — alterado
- `backend/src/utils/normalizarDescricao.ts` — novo
- `backend/src/config/index.ts` — alterado (`config.ai`)
- `backend/src/services/IACategorizacao/IIACategorizacaoService.ts` — alterado
- `backend/src/services/IACategorizacao/IACategorizacaoService.ts` — alterado (reescrito)
- `backend/src/services/IACategorizacao/CategorizadorSpaceClient.ts` — novo
- `backend/src/controllers/IACategorizacao/IACategorizacaoController.ts` — alterado
- `backend/src/api/routes/IACategorizacaoRoute.ts` — alterado (OpenAPI)
- `backend/package.json` — alterado (`@gradio/client`)
- `backend/package-lock.json` — alterado
- `backend/tests/fixtures/exemplos_normalizacao.json` — novo
- `backend/tests/normalizarDescricao.spec.ts` — novo
- `backend/src/services/IACategorizacao/tests/IACategorizacaoService.spec.ts` — novo
- `frontend/src/app/features/ia-categorizacao/dto/ia-categorizacao.dto.ts` — novo
- `frontend/src/app/features/ia-categorizacao/ia-categorizacao.service.ts` — alterado
- `frontend/src/app/features/transacoes/dto/transacoes.dto.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-entradas/transacoes-criar-entradas.component.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-entradas/transacoes-criar-entradas.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-saidas/transacoes-criar-saidas.component.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-saidas/transacoes-criar-saidas.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-credito/transacoes-criar-credito.component.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-credito/transacoes-criar-credito.view-model.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-reembolso/transacoes-criar-reembolso.component.ts` — alterado
- `frontend/src/app/features/transacoes/components/criar-reembolso/transacoes-criar-reembolso.view-model.ts` — alterado
- `backend/src/api/routes/Transacao/TransacaoRoute.ts` — alterado (OpenAPI dos campos de sugestão)
- `backend/src/services/Transacao/tests/TransacaoService.spec.ts` — alterado (mocks)
- `backend/src/services/Transacao/tests/TransacaoService.activeTargets.spec.ts` — alterado (mocks)
- `backend/src/services/Transacao/tests/TransacaoService.contasApagadas.spec.ts` — alterado (mocks)
- `backend/src/services/Transacao/tests/TransacaoDespesasRecorrentesService.impacto.spec.ts` — alterado (mocks)
- `backend/.env.example` — novo
- `backend/.gitignore` — alterado (`!.env.example`)
- `.env.example` — novo
- `CLAUDE.md` — alterado (sugestão de categoria em 3 camadas, variáveis de ambiente, cobertura de testes, convenção do `.env.example`)
- `docs/domain_model.puml` — alterado
- `docs/domain_model.svg` — alterado (regenerado)
- `docs/changes/features/F0009-categorizacao-modelo-proprio/README.md` — novo (spec aprovada, não alterada)
- `docs/changes/features/F0009-categorizacao-modelo-proprio/RESULT.md` — novo
- `docs/changes/features/README.md` — alterado (linha da F0009)
