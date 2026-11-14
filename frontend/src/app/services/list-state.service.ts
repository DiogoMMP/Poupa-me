import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Keeps the state of list screens (filters, pagination) while the user navigates inside the same
 * route group — the first URL segment, e.g. `transacoes` for `/transacoes` and `/transacoes/editar/1`.
 * Leaving the group (e.g. `/transacoes` → `/contas`) drops that group's state, and so does `clear()`
 * (called on logout). Kept in memory only: a page reload starts from the defaults.
 */
@Injectable({
  providedIn: 'root'
})
export class ListStateService {
  private router = inject(Router);
  private readonly groups = new Map<string, Map<string, unknown>>();

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.dropOtherGroups(ListStateService.groupOf(e.urlAfterRedirects)));
  }

  /**
   * Return a copy of the state saved for a list, or `undefined` when there is none.
   * @param group - route group (first URL segment) the list belongs to
   * @param key - identifies the list inside the group
   */
  get<T>(group: string, key: string): T | undefined {
    const value = this.groups.get(group)?.get(key);
    return value === undefined ? undefined : structuredClone(value as T);
  }

  /**
   * Save a copy of a list's state under its route group.
   * @param group - route group (first URL segment) the list belongs to
   * @param key - identifies the list inside the group
   * @param value - state to keep
   */
  set<T>(group: string, key: string, value: T): void {
    let entries = this.groups.get(group);
    if (!entries) {
      entries = new Map<string, unknown>();
      this.groups.set(group, entries);
    }
    entries.set(key, structuredClone(value));
  }

  /** Drop every saved state */
  clear(): void {
    this.groups.clear();
  }

  private dropOtherGroups(current: string): void {
    for (const group of [...this.groups.keys()]) {
      if (group !== current) this.groups.delete(group);
    }
  }

  /** First path segment of a URL, without query string or fragment (`/transacoes/editar/1?x=1` → `transacoes`) */
  private static groupOf(url: string): string {
    return url.split(/[?#]/)[0].split('/').filter(Boolean)[0] ?? '';
  }
}
