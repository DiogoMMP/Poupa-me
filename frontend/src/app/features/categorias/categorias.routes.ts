import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/listar/categorias-listar.component').then(m => m.CategoriasListComponent)
  },

  {
    path: 'criar',
    loadComponent: () => import('./components/criar/categorias-criar.component').then(m => m.CategoriasCriarComponent)
  },

  // redirect bare 'update' to list to avoid intermediate pages
  { path: 'editar', redirectTo: '', pathMatch: 'full' },
  {
    path: 'editar/:id',
    loadComponent: () => import('./components/editar/categorias-editar.component').then(m => m.CategoriasEditarComponent)
  },

  // Grupos de categorias: só Admin (como a rota pai em app.routes.ts), declarado em cada rota como as outras features
  {
    path: 'grupos/criar',
    loadComponent: () => import('./components/grupos-criar/grupos-criar.component').then(m => m.GruposCriarComponent),
    data: { allowedRoles: ['Admin'] }
  },
  { path: 'grupos/editar', redirectTo: '', pathMatch: 'full' },
  {
    path: 'grupos/editar/:id',
    loadComponent: () => import('./components/grupos-editar/grupos-editar.component').then(m => m.GruposEditarComponent),
    data: { allowedRoles: ['Admin'] }
  }
];
