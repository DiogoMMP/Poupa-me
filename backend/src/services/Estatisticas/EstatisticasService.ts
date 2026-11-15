import { Service, Inject } from 'typedi';
import { Result } from '../../core/logic/Result.js';
import type ITransacaoContaQueryRepo from '../../repos/Transacao/IRepos/ITransacaoContaQueryRepo.js';
import type ITransacaoCartaoQueryRepo from '../../repos/Transacao/IRepos/ITransacaoCartaoQueryRepo.js';
import type IGrupoCategoriaRepo from '../../repos/GrupoCategoria/IGrupoCategoriaRepo.js';
import type ICategoriaRepo from '../../repos/Categoria/ICategoriaRepo.js';
import type { IEstatisticasDTO, ICategoriaEstatistica, IHistoricoDiario } from '../../dto/IEstatisticasDTO.js';
import type { IDataDTO } from '../../dto/shared/IDataDTO.js';
import { CategoriaMap } from '../../mappers/CategoriaMap.js';
import { GrupoCategoriaMap } from '../../mappers/GrupoCategoriaMap.js';
import type { IGrupoCategoriaDTO } from '../../dto/IGrupoCategoriaDTO.js';
import type { Categoria } from '../../domain/Categoria/Entities/Categoria.js';
import IEstatisticasService from "./IEstatisticasService.js";

/**
 * Service responsible for building statistics payloads.
 */
@Service()
export default class EstatisticasService implements IEstatisticasService {
    constructor(
        @Inject('TransacaoContaQueryRepo') private transacaoContaQueryRepo: ITransacaoContaQueryRepo,
        @Inject('TransacaoCartaoQueryRepo') private transacaoCartaoQueryRepo: ITransacaoCartaoQueryRepo,
        @Inject('GrupoCategoriaRepo') private grupoCategoriaRepo: IGrupoCategoriaRepo,
        @Inject('CategoriaRepo') private categoriaRepo: ICategoriaRepo,
        @Inject('logger') private logger: { error: (...args: unknown[]) => void }
    ) {}

    /**
     * Builds statistics for a specific banco and month/year.
     * If userRole !== 'Admin', results are scoped to the provided userId.
     */
    public async getEstatisticas(bancoId: string, month: number, year: number, userId: string, userRole?: string): Promise<Result<IEstatisticasDTO>> {
        try {
            const filterUserId = userRole === 'Admin' ? undefined : userId;

            // Fetch all conta (Entrada/Saída) and cartao (Crédito/Reembolso) transactions for this banco/user
            // The transaction queries only join the categoria (not its group), so the group of each categoria comes
            // from the categoria/grupo repos. Inactive ones included: an old movimento keeps its categoria and group.
            const [contaTransacoes, cartaoTransacoes, grupos, todasCategorias] = await Promise.all([
                this.transacaoContaQueryRepo.findAllContaTransactions({ userId: filterUserId, bancoId }),
                this.transacaoCartaoQueryRepo.findAllCartaoTransactions({ userId: filterUserId, bancoId }),
                this.grupoCategoriaRepo.findAll(true),
                this.categoriaRepo.findAll(true)
            ]);
            const grupoPorId = new Map<string, IGrupoCategoriaDTO>(grupos.map(g => [g.id.toString(), GrupoCategoriaMap.toDTO(g)]));
            const grupoIdPorCategoria = new Map<string, string | null>(
                todasCategorias.map(c => [c.id.toString(), c.grupoId?.toString() ?? null])
            );

            // Build date range. If the requested month/year is the current month/year,
            // interpret "este mês" as a rolling 1-month window: from today minus one month (same day)
            // up to now. Example: today 12/04 => window 12/03 - 12/04.
            const today = new Date();
            let startDate: Date;
            let endDate: Date;
            if (month === (today.getMonth() + 1) && year === today.getFullYear()) {
                // rolling last-month window
                endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 1);
                startDate.setHours(0, 0, 0, 0);
            } else {
                // full calendar month
                startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
                endDate = new Date(year, month, 0, 23, 59, 59, 999);
            }

            const toDateFromData = (dataObj: any) => new Date(dataObj.year ?? dataObj.ano ?? 0, (dataObj.month ?? dataObj.mes ?? 1) - 1, dataObj.day ?? dataObj.dia ?? 1);

            // Keep only transactions within requested date range
            const contasNoMes = contaTransacoes.filter(t => {
                const dt = toDateFromData((t as any).data);
                return dt >= startDate && dt <= endDate;
            });
            // Excludes the auto-generated "Pagamento X" record (isPagamentoCartao): its valor already
            // sums up purchases that were already counted individually as they happened, so including
            // it here would double-count that spending.
            const cartoesNoMes = cartaoTransacoes.filter(t => {
                const dt = toDateFromData((t as any).data);
                return dt >= startDate && dt <= endDate;
            }).filter(t => !t.isPagamentoCartao);

            // 1) Monthly cashflow: totalIn = Entrada + Reembolso, totalOut = Saída + Crédito
            const sumValor = (arr: Array<{ tipo: { value: string }; valor: { value: number; moeda?: string } }>, tipos: string[]) =>
                arr.filter(t => tipos.includes(t.tipo.value)).reduce((s, t) => s + (Number((t.valor as any).value) || 0), 0);

            const totalIn = sumValor(contasNoMes, ['Entrada']) + sumValor(cartoesNoMes, ['Reembolso']);
            const totalOut = sumValor(contasNoMes, ['Saída']) + sumValor(cartoesNoMes, ['Crédito']);
            const netBalance = totalIn - totalOut;

            // 2) Aggregation by category (only expenses: Saída and Crédito)
            const categoriaMap = new Map<string, { categoria: ICategoriaEstatistica['categoria']; total: number; moeda: string; numTransacoes: number }>();

            const accumulateCategoria = (t: unknown) => {
                const tr = t as { categoria?: { id: { toString(): string } }; valor?: { value?: number; moeda?: string } };
                if (!tr.categoria) return;
                const catId = tr.categoria.id.toString();
                const valor = Number(tr.valor?.value ?? 0) || 0;
                const moeda = String(tr.valor?.moeda ?? 'EUR');
                const existing = categoriaMap.get(catId);
                if (existing) {
                    existing.total += valor;
                    existing.numTransacoes += 1;
                } else {
                    // map categoria domain to DTO where possible
                    const catDto = CategoriaMap.toDTO((tr.categoria as unknown) as Categoria);
                    catDto.grupoId = grupoIdPorCategoria.get(catId) ?? null;
                    categoriaMap.set(catId, { categoria: catDto, total: valor, moeda, numTransacoes: 1 });
                }
            };

            // Only expense types
            const despesasConta = contasNoMes.filter(t => ['Saída'].includes(t.tipo.value));
            const despesasCartao = cartoesNoMes.filter(t => ['Crédito'].includes(t.tipo.value));

            despesasConta.forEach(accumulateCategoria);
            despesasCartao.forEach(accumulateCategoria);

            const categorias: ICategoriaEstatistica[] = Array.from(categoriaMap.values()).map(v => ({
                categoria: v.categoria,
                grupo: v.categoria.grupoId ? (grupoPorId.get(v.categoria.grupoId) ?? null) : null,
                total: { valor: v.total, moeda: v.moeda },
                numTransacoes: v.numTransacoes
            }));

            // 3) Daily history (expenses only) - group by date
            const dailyMap = new Map<string, { data: IDataDTO; total: number; moeda: string }>();
            const accumulateDaily = (t: unknown) => {
                const tr = t as { valor?: { value?: number; moeda?: string }; data?: { day?: number; month?: number; year?: number } };
                const valor = Number(tr.valor?.value ?? 0) || 0;
                const moeda = String(tr.valor?.moeda ?? 'EUR');
                const d = tr.data ?? { day: 0, month: 0, year: 0 };
                const key = `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
                const existing = dailyMap.get(key);
                if (existing) {
                    existing.total += valor;
                } else {
                    dailyMap.set(key, { data: { dia: d.day ?? 0, mes: d.month ?? 0, ano: d.year ?? 0 }, total: valor, moeda });
                }
            };

            despesasConta.forEach(accumulateDaily);
            despesasCartao.forEach(accumulateDaily);

            const historicoDiario: IHistoricoDiario[] = Array.from(dailyMap.values())
                .sort((a, b) => {
                    const ta = new Date(a.data.ano, a.data.mes - 1, a.data.dia).getTime();
                    const tb = new Date(b.data.ano, b.data.mes - 1, b.data.dia).getTime();
                    return ta - tb;
                })
                .map(d => ({ data: d.data, total: { valor: d.total, moeda: d.moeda } }));

            const dto: IEstatisticasDTO = {
                cashflowMensal: {
                    totalIn: totalIn,
                    totalOut: totalOut,
                    netBalance: netBalance
                },
                categorias,
                historicoDiario
            };

            return Result.ok<IEstatisticasDTO>(dto);
        } catch (err) {
            this.logger.error('EstatisticasService.getEstatisticas error: %o', err);
            return Result.fail<IEstatisticasDTO>('Erro ao calcular estatísticas');
        }
    }
}

