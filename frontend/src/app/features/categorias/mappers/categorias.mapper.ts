import { CategoriasDTO, CategoriasAgrupadasDTO } from '../dto/categorias.dto';
import { CategoriaGrupoRef, CategoriasModel } from '../models/categorias.model';

/**
 * Mapper for Categorias - converts between DTO and Model
 */
export class CategoriasMapper {
  /**
   * Convert DTO to Model. O grupo só é conhecido quando vem da listagem agrupada; sem ele fica null.
   */
  static toModel(dto: CategoriasDTO, grupo: CategoriaGrupoRef | null = null): CategoriasModel {
    return {
      id: dto.id || '',
      nome: dto.nome,
      icon: dto.icon,
      grupoId: dto.grupoId ?? null,
      ordem: dto.ordem ?? 0,
      papel: dto.papel ?? null,
      grupo
    };
  }

  /**
   * Convert Model to DTO
   */
  static toDto(model: CategoriasModel): CategoriasDTO {
    return {
      id: model.id,
      nome: model.nome,
      icon: model.icon,
      grupoId: model.grupoId,
      ordem: model.ordem,
      papel: model.papel
    };
  }

  /**
   * Convert array of DTOs to array of Models
   */
  static toModelArray(dtos: CategoriasDTO[]): CategoriasModel[] {
    return dtos.map(dto => CategoriasMapper.toModel(dto));
  }

  /**
   * Achata a listagem agrupada numa lista de modelos, pela ordem dos grupos e, dentro de cada grupo, das categorias.
   * Cada modelo leva o seu grupo (`null` = "Sem grupo").
   */
  static fromAgrupadas(agrupadas: CategoriasAgrupadasDTO[]): CategoriasModel[] {
    return agrupadas.flatMap(({ grupo, categorias }) => {
      const ref: CategoriaGrupoRef | null = grupo ? { id: grupo.id, nome: grupo.nome, cor: grupo.cor } : null;
      return categorias.map(dto => CategoriasMapper.toModel(dto, ref));
    });
  }
}
