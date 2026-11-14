import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../../environments/environment';
import {GrupoCategoriaDTO, GrupoCategoriaInputDTO} from '../dto/categorias.dto';

@Injectable({providedIn: 'root'})
export class GruposCategoriaService {
  private apiUrl = `${environment.apiBaseUrl}/grupo-categoria`;

  constructor(private http: HttpClient) {
  }

  /** Grupos ativos, pela ordem definida pelo Admin. */
  getAll(): Observable<GrupoCategoriaDTO[]> {
    return this.http.get<GrupoCategoriaDTO[]>(this.apiUrl, {withCredentials: true});
  }

  getById(id: string): Observable<GrupoCategoriaDTO> {
    return this.http.get<GrupoCategoriaDTO>(`${this.apiUrl}/${id}`, {withCredentials: true});
  }

  create(dto: GrupoCategoriaInputDTO): Observable<GrupoCategoriaDTO> {
    return this.http.post<GrupoCategoriaDTO>(this.apiUrl, dto, {withCredentials: true});
  }

  update(id: string, dto: GrupoCategoriaInputDTO): Observable<GrupoCategoriaDTO> {
    return this.http.put<GrupoCategoriaDTO>(`${this.apiUrl}/${id}`, dto, {withCredentials: true});
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, {withCredentials: true});
  }

  /** Grava a nova ordem dos grupos. A lista tem de ter todos os grupos ativos. */
  reordenar(ids: string[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/ordem`, {ids}, {withCredentials: true});
  }
}
