import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NatuHeader } from '../../components/natu-header/natu-header';

/** Términos y condiciones (port de Seguridad.html). */
@Component({
  imports: [RouterLink, NatuHeader],
  selector: 'app-seguridad',
  templateUrl: './seguridad.html',
})
export class Seguridad {}
