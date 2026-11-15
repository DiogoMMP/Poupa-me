import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';
import {SugestaoCategoriaDTO} from './dto/ia-categorizacao.dto';

@Injectable({providedIn: 'root'})
export class IaCategorizacaoService {
  private apiUrl = `${environment.apiBaseUrl}/ia-categorizacao`;

  constructor(private http: HttpClient) {
  }

  /**
   * Pede uma sugestão de categoria para a descrição. Com `tipo`, só são sugeridas categorias que aparecem no select
   * desse tipo (o mesmo filtro de `CategoriasService.getAll`). Emite `null` quando não há sugestão (resposta 204).
   */
  sugerir(descricao: string, tipo?: 'Entrada' | 'Saída'): Observable<SugestaoCategoriaDTO | null> {
    let params = new HttpParams().set('description', descricao);
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<SugestaoCategoriaDTO | null>(`${this.apiUrl}/sugerir`, { params, withCredentials: true });
  }
}
