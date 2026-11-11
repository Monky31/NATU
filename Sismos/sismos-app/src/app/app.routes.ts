import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/inicio/inicio').then((m) => m.Inicio),
    title: 'NATU - Desastres Naturales',
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
    title: 'Registro Sismos - NATU',
  },
  {
    path: 'iniciar-sesion',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Iniciar Sesión - NATU',
  },
  {
    path: 'olvida-contrasena',
    loadComponent: () =>
      import('./pages/recuperar/recuperar').then((m) => m.RecuperarContrasena),
    title: 'Recuperar Contraseña - NATU',
  },
  {
    path: 'mapa',
    loadComponent: () => import('./pages/mapa/mapa').then((m) => m.Mapa),
    title: 'Mapa Interactivo de Colombia - NATU',
  },
  {
    path: 'noticias',
    loadComponent: () => import('./pages/noticias/noticias').then((m) => m.Noticias),
    title: 'Noticias Sísmicas de Colombia - NATU',
  },
  {
    path: 'informacion',
    loadComponent: () => import('./pages/informacion/informacion').then((m) => m.Informacion),
    title: 'Información sobre los Sismos - NATU',
  },
  {
    path: 'seguridad',
    loadComponent: () => import('./pages/seguridad/seguridad').then((m) => m.Seguridad),
    title: 'Términos y Condiciones - NATU',
  },
  {
    path: 'datos',
    loadComponent: () => import('./pages/datos/datos').then((m) => m.DatosGuardados),
    title: 'Datos guardados - NATU',
  },
  { path: '**', redirectTo: '' },
];
