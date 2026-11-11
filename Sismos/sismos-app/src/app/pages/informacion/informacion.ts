import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NatuHeader } from '../../components/natu-header/natu-header';

/**
 * Guía educativa sobre sismos (port de Informacion.html).
 * El contenido es estático; los enlaces del índice usan fragmentos
 * (#que-es, #magnitud, ...) que hacen scroll a cada sección.
 */
@Component({
  imports: [RouterLink, NatuHeader],
  selector: 'app-informacion',
  templateUrl: './informacion.html',
})
export class Informacion implements OnInit, OnDestroy {
  /** La clase .info-body (fondo claro y encabezado fijo) vive en el body. */
  ngOnInit(): void {
    document.body.classList.add('info-body');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('info-body');
  }
}
