import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import config from '../../../config/index.js';
import AICategorizationService, { nomeDoMovimento } from '../IACategorizacaoService.js';
import type { Result } from '../../../core/logic/Result.js';
import type { ISugestaoCategoriaDTO } from '../../../dto/ISugestaoCategoriaDTO.js';
import CategorizadorSpaceClient from '../CategorizadorSpaceClient.js';
import { Categoria } from '../../../domain/Categoria/Entities/Categoria.js';
import { PapelCategoria } from '../../../domain/Categoria/ValueObjects/PapelCategoria.js';
import { Nome } from '../../../domain/Shared/ValueObjects/Nome.js';
import { Icon } from '../../../domain/Shared/ValueObjects/Icon.js';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID.js';
import type ICategoriaRepo from '../../../repos/Categoria/ICategoriaRepo.js';
import type IGrupoCategoriaRepo from '../../../repos/GrupoCategoria/IGrupoCategoriaRepo.js';
import type ITransacaoRepo from '../../../repos/Transacao/IRepos/ITransacaoRepo.js';
import type { IHistoricoDescricao } from '../../../repos/Transacao/IRepos/ITransacaoRepo.js';

const USER = 'USR00000000001';

function categoria(id: string, nome: string, grupoId?: string, papel?: string): Categoria {
  return Categoria.create(
    {
      nome: Nome.create(nome).getValue(),
      icon: Icon.create('🛒').getValue(),
      grupoId: grupoId ? new UniqueEntityID(grupoId) : undefined,
      papel: papel ? PapelCategoria.create(papel).getValue() : undefined
    },
    new UniqueEntityID(id)
  ).getValue();
}

// Supermercado and Restaurantes: Saída group; Salário: Entrada group; Diversos: Ambos; Presentes: no group
const SUPERMERCADO = categoria('CAT00000000001', 'Supermercado', 'GCT00000000001');
const RESTAURANTES = categoria('CAT00000000002', 'Restaurantes', 'GCT00000000001');
const SALARIO = categoria('CAT00000000003', 'Salário', 'GCT00000000002');
const DIVERSOS = categoria('CAT00000000004', 'Diversos', 'GCT00000000003');
const PRESENTES = categoria('CAT00000000005', 'Presentes');
const OUTROS = categoria('CAT00000000006', 'Outros');
const SEM_CATEGORIA = categoria('CAT00000000007', 'Sem Categoria');
const PAGAMENTO_CARTAO = categoria('CAT00000000008', 'Pagamento de cartão', 'GCT00000000001', 'PagamentoCartao');

const GRUPOS = [
  { id: new UniqueEntityID('GCT00000000001'), tipo: { value: 'Saída' } },
  { id: new UniqueEntityID('GCT00000000002'), tipo: { value: 'Entrada' } },
  { id: new UniqueEntityID('GCT00000000003'), tipo: { value: 'Ambos' } }
];

function linha(descricao: string, cat: Categoria, total: number, ultima = '2026-01-01'): IHistoricoDescricao {
  return { descricao, categoriaDomainId: cat.id.toString(), total, ultima: new Date(ultima) };
}

/** The suggestion of a successful result; fails the test when there is none. */
function sugestaoDe(result: Result<ISugestaoCategoriaDTO | null>): ISugestaoCategoriaDTO {
  const sugestao = result.getValue();
  if (!sugestao) throw new Error('Esperava uma sugestão, veio null');
  return sugestao;
}

/** Replaces the HF Inference call, so no test reaches the network. */
class ServicoTeste extends AICategorizationService {
  public llm = jest.fn<(description: string, labels: string[]) => Promise<string | undefined>>();
  public tiposPedidos: Array<'Entrada' | 'Saída' | undefined> = [];

  protected override pedirAoLlm(description: string, labels: string[], tipo?: 'Entrada' | 'Saída'): Promise<string | undefined> {
    this.tiposPedidos.push(tipo);
    return this.llm(description, labels);
  }
}

describe('nomeDoMovimento (prompt do LLM)', () => {
  it('Entrada é receita, Saída é despesa, sem tipo é transação', () => {
    expect(nomeDoMovimento('Entrada')).toBe('receita');
    expect(nomeDoMovimento('Saída')).toBe('despesa');
    expect(nomeDoMovimento()).toBe('transação');
  });
});

describe('AICategorizationService.suggestCategory — camadas (F0009)', () => {
  let historico: IHistoricoDescricao[];
  let predict: jest.SpiedFunction<CategorizadorSpaceClient['predict']>;

  function criarServico(comSpace: boolean) {
    config.ai.spaceId = comSpace ? 'teste/categorizador' : undefined;
    config.ai.limiarConfianca = 0.6;
    config.ai.categoriasExcluidas = ['Outros', 'Sem Categoria'];

    const categoriaRepo = {
      findAll: jest.fn(async () => [SUPERMERCADO, RESTAURANTES, SALARIO, DIVERSOS, PRESENTES, OUTROS, SEM_CATEGORIA, PAGAMENTO_CARTAO])
    };
    const grupoCategoriaRepo = { findAll: jest.fn(async () => GRUPOS) };
    const transacaoRepo = {
      findHistoricoDescricoes: jest.fn<(userDomainId: string) => Promise<IHistoricoDescricao[]>>(async () => historico)
    };
    const logger = { error: jest.fn(), info: jest.fn() };

    const service = new ServicoTeste(
      categoriaRepo as unknown as ICategoriaRepo,
      grupoCategoriaRepo as unknown as IGrupoCategoriaRepo,
      transacaoRepo as unknown as ITransacaoRepo,
      logger
    );
    return { service, transacaoRepo };
  }

  beforeEach(() => {
    historico = [];
    predict = jest.spyOn(CategorizadorSpaceClient.prototype, 'predict').mockResolvedValue(null);
  });

  it('o histórico ganha: mesma descrição normalizada, categoria mais usada', async () => {
    historico = [
      linha('CONTINENTE 123', SUPERMERCADO, 3),
      linha('Continente', RESTAURANTES, 2),
      linha('Pingo Doce', RESTAURANTES, 10)
    ];
    const { service, transacaoRepo } = criarServico(true);

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(expect.objectContaining({ origem: 'historico', confianca: null }));
    expect(sugestaoDe(result).categoria.id).toBe(SUPERMERCADO.id.toString());
    expect(transacaoRepo.findHistoricoDescricoes).toHaveBeenCalledWith(USER);
    expect(predict).not.toHaveBeenCalled();
    expect(service.llm).not.toHaveBeenCalled();
  });

  it('no histórico, um empate é ganho pela categoria usada mais recentemente', async () => {
    historico = [
      linha('Continente', SUPERMERCADO, 2, '2025-06-01'),
      linha('Continente', RESTAURANTES, 2, '2026-03-01')
    ];
    const { service } = criarServico(false);

    const result = await service.suggestCategory('continente', USER, 'Saída');

    expect(sugestaoDe(result).categoria.id).toBe(RESTAURANTES.id.toString());
  });

  it('sem histórico, o modelo acima do limiar responde', async () => {
    predict.mockResolvedValue({ categoriaId: SUPERMERCADO.id.toString(), confianca: 0.9 });
    const { service } = criarServico(true);

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(result.getValue()).toEqual(expect.objectContaining({ origem: 'modelo', confianca: 0.9 }));
    expect(sugestaoDe(result).categoria.id).toBe(SUPERMERCADO.id.toString());
    expect(predict).toHaveBeenCalledWith('Continente', expect.arrayContaining([SUPERMERCADO.id.toString()]));
    expect(service.llm).not.toHaveBeenCalled();
  });

  it('o modelo abaixo do limiar passa ao LLM', async () => {
    predict.mockResolvedValue({ categoriaId: SUPERMERCADO.id.toString(), confianca: 0.4 });
    const { service } = criarServico(true);
    service.llm.mockResolvedValue('Restaurantes.');

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(result.getValue()).toEqual(expect.objectContaining({ origem: 'llm', confianca: null }));
    expect(sugestaoDe(result).categoria.id).toBe(RESTAURANTES.id.toString());
  });

  it('se o LLM falhar, devolve o modelo abaixo do limiar', async () => {
    predict.mockResolvedValue({ categoriaId: SUPERMERCADO.id.toString(), confianca: 0.4 });
    const { service } = criarServico(true);
    service.llm.mockRejectedValue(new Error('HF em baixo'));

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(result.getValue()).toEqual(expect.objectContaining({ origem: 'modelo', confianca: 0.4 }));
    expect(sugestaoDe(result).categoria.id).toBe(SUPERMERCADO.id.toString());
  });

  it('se nenhuma camada responder, não há sugestão (ok com null)', async () => {
    const { service } = criarServico(true);
    service.llm.mockRejectedValue(new Error('HF em baixo'));

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
  });

  it('sem Space configurado, salta para o LLM', async () => {
    const { service } = criarServico(false);
    service.llm.mockResolvedValue('Supermercado');

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(sugestaoDe(result).origem).toBe('llm');
    expect(predict).not.toHaveBeenCalled();
  });

  it('o tipo filtra as candidatas: grupo do tipo, Ambos ou sem grupo', async () => {
    const { service } = criarServico(true);
    service.llm.mockResolvedValue('Salário');

    await service.suggestCategory('Ordenado', USER, 'Entrada');

    const esperadas = [SALARIO, DIVERSOS, PRESENTES].map(c => c.id.toString());
    expect(predict).toHaveBeenCalledWith('Ordenado', esperadas);
    expect(service.llm).toHaveBeenCalledWith('Ordenado', ['Salário', 'Diversos', 'Presentes']);
    expect(service.tiposPedidos).toEqual(['Entrada']);
  });

  it('sem tipo, todas as categorias não excluídas são candidatas', async () => {
    const { service } = criarServico(false);
    service.llm.mockResolvedValue('Salário');

    await service.suggestCategory('Ordenado', USER);

    expect(service.llm).toHaveBeenCalledWith('Ordenado', ['Supermercado', 'Restaurantes', 'Salário', 'Diversos', 'Presentes']);
  });

  it('"Outros", "Sem Categoria" e as categorias com papel nunca são sugeridas', async () => {
    historico = [
      linha('Continente', OUTROS, 50),
      linha('Continente', PAGAMENTO_CARTAO, 20),
      linha('Continente', SEM_CATEGORIA, 10)
    ];
    const { service } = criarServico(true);
    service.llm.mockResolvedValue('Outros');

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
    const candidatasDoModelo = predict.mock.calls[0]?.[1];
    expect(candidatasDoModelo).not.toContain(OUTROS.id.toString());
    expect(candidatasDoModelo).not.toContain(PAGAMENTO_CARTAO.id.toString());
    expect(service.llm.mock.calls[0]?.[1]).not.toContain('Outros');
    expect(service.llm.mock.calls[0]?.[1]).not.toContain('Pagamento de cartão');
  });

  it('a exclusão compara sem maiúsculas nem acentos', async () => {
    const { service } = criarServico(false);
    config.ai.categoriasExcluidas = ['SALARIO'];
    service.llm.mockResolvedValue('Salário');

    const result = await service.suggestCategory('Ordenado', USER, 'Entrada');

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
    expect(service.llm).toHaveBeenCalledWith('Ordenado', ['Diversos', 'Presentes', 'Outros', 'Sem Categoria']);
  });

  it('uma resposta do LLM fora das candidatas é rejeitada', async () => {
    const { service } = criarServico(false);
    service.llm.mockResolvedValue('Salário');

    const result = await service.suggestCategory('Continente', USER, 'Saída');

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
  });

  it('uma descrição sem letras salta o histórico e o modelo', async () => {
    historico = [linha('123', SUPERMERCADO, 5)];
    const { service, transacaoRepo } = criarServico(true);
    service.llm.mockResolvedValue('Supermercado');

    const result = await service.suggestCategory('123', USER, 'Saída');

    expect(sugestaoDe(result).origem).toBe('llm');
    expect(transacaoRepo.findHistoricoDescricoes).not.toHaveBeenCalled();
    expect(predict).not.toHaveBeenCalled();
  });
});

describe('CategorizadorSpaceClient.validar — contrato do Space', () => {
  const candidatas = ['CAT00000000001', 'CAT00000000002'];

  it('aceita a saída do Gradio como string JSON dentro de um array', () => {
    const resposta = [JSON.stringify({ categoriaId: 'CAT00000000002', confianca: 0.75, versaoModelo: 'v1' })];

    expect(CategorizadorSpaceClient.validar(resposta, candidatas))
      .toEqual({ valida: true, previsao: { categoriaId: 'CAT00000000002', confianca: 0.75 } });
  });

  it('aceita a saída já decodificada', () => {
    const resposta = [{ categoriaId: 'CAT00000000001', confianca: 1, versaoModelo: null }];

    expect(CategorizadorSpaceClient.validar(resposta, candidatas).previsao)
      .toEqual({ categoriaId: 'CAT00000000001', confianca: 1 });
  });

  it('categoriaId null é uma resposta válida sem previsão', () => {
    const resposta = [JSON.stringify({ categoriaId: null, confianca: null, versaoModelo: null })];

    expect(CategorizadorSpaceClient.validar(resposta, candidatas)).toEqual({ valida: true, previsao: null });
  });

  it.each([
    ['uma categoria fora das candidatas', [JSON.stringify({ categoriaId: 'CAT00000000009', confianca: 0.9 })]],
    ['uma confiança fora de [0, 1]', [JSON.stringify({ categoriaId: 'CAT00000000001', confianca: 1.5 })]],
    ['sem confiança', [JSON.stringify({ categoriaId: 'CAT00000000001' })]],
    ['JSON inválido', ['{ não é json']],
    ['vazia', []]
  ])('rejeita %s', (_caso, resposta) => {
    expect(CategorizadorSpaceClient.validar(resposta, candidatas)).toEqual({ valida: false, previsao: null });
  });
});
