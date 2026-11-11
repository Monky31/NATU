import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NatuHeader } from '../../components/natu-header/natu-header';

/** Página de inicio (port de Sismos.html). */
@Component({
  imports: [RouterLink, NatuHeader],
  selector: 'app-inicio',
  templateUrl: './inicio.html',
})
export class Inicio {}
