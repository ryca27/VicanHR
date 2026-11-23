import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'expay', renderMode: RenderMode.Client },
  { path: 'expay/employee', renderMode: RenderMode.Client },
  { path: 'payroll/loans', renderMode: RenderMode.Client },
  { path: 'payroll/thirteenth-month', renderMode: RenderMode.Client },
  { path: 'payroll/drafts', renderMode: RenderMode.Client },
  { path: 'payroll/drafts/:id', renderMode: RenderMode.Client },
  { path: 'attendance/:id', renderMode: RenderMode.Client },
  {
    path: 'cutoff/:id',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
