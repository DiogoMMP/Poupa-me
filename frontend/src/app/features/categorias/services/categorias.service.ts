import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, map} from 'rxjs';
import {environment} from '../../../../environments/environment';
import {CategoriasAgrupadasDTO, CategoriasDTO, CategoriasInputDTO} from '../dto/categorias.dto';
import {CategoriasModel} from '../models/categorias.model';
import {CategoriasMapper} from '../mappers/categorias.mapper';

@Injectable({providedIn: 'root'})
export class CategoriasService {
  private apiUrl = `${environment.apiBaseUrl}/categoria`;

  constructor(private http: HttpClient) {
  }

  /**
   * Categorias agrupadas pelos grupos ativos, pela ordem definida pelo Admin (formato do `GET /categoria`).
   */
  getAgrupadas(): Observable<CategoriasAgrupadasDTO[]> {
    return this.http.get<CategoriasAgrupadasDTO[]>(this.apiUrl, {withCredentials: true});
  }

  /**
   * Lista achatada pela ordem dos grupos, para os selects. Com `tipo`, só ficam os grupos desse tipo ou `Ambos`;
   * as categorias sem grupo aparecem sempre. `incluirId` mantém essa categoria mesmo que o grupo seja de outro tipo
   * (p.ex. a categoria atual de uma transação a editar), no seu grupo.
   */
  getAll(tipo?: 'Entrada' | 'Saída', incluirId?: string): Observable<CategoriasModel[]> {
    const mostraGrupo = (a: CategoriasAgrupadasDTO) =>
      !tipo || !a.grupo || a.grupo.tipo === tipo || a.grupo.tipo === 'Ambos';

    return this.getAgrupadas().pipe(
      map(agrupadas => CategoriasMapper.fromAgrupadas(
        agrupadas.map(a => mostraGrupo(a)
          ? a
          : {...a, categorias: a.categorias.filter(c => !!incluirId && c.id === incluirId)})
      ))
    );
  }

  getById(id: string): Observable<CategoriasDTO> {
    return this.http.get<CategoriasDTO>(`${this.apiUrl}/${id}`, {withCredentials: true});
  }

  create(dto: CategoriasInputDTO): Observable<CategoriasDTO> {
    return this.http.post<CategoriasDTO>(this.apiUrl, dto, {withCredentials: true});
  }

  update(id: string, dto: CategoriasInputDTO): Observable<CategoriasDTO> {
    return this.http.put<CategoriasDTO>(`${this.apiUrl}/${id}`, dto, {withCredentials: true});
  }

  /**
   * Grava a nova ordem das categorias de um grupo (`null` = "Sem grupo"). A lista tem de ter todas as categorias
   * ativas desse grupo.
   */
  reordenar(grupoId: string | null, ids: string[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/ordem`, {grupoId, ids}, {withCredentials: true});
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, {withCredentials: true});
  }
}
