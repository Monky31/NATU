import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NatuHeader } from '../../components/natu-header/natu-header';

/** Sismo devuelto por la API del USGS. */
interface SismoUSGS {
  properties: {
    mag: number | null;
    place?: string;
    time: number;
    url?: string;
    status?: string;
  };
  geometry?: { coordinates?: [number, number, number] } | null;
}

/** Noticia devuelta por rss2json (Google Noticias). */
interface NoticiaRSS {
  title?: string;
  link?: string;
  pubDate?: string;
}

interface RespuestaUSGS {
  features: SismoUSGS[];
}

interface RespuestaRSS {
  status: string;
  items: NoticiaRSS[];
}

const USGS_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const NOTICIAS_RSS =
  'https://news.google.com/rss/search?q=' +
  encodeURIComponent('(sismos OR temblor) Colombia when:14d') +
  '&hl=es-CO&gl=CO&ceid=CO:es';
const NOTICIAS_API =
  'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(NOTICIAS_RSS);

/** Cada cuánto se consulta (de forma ligera) si apareció un sismo más reciente. */
const REVISION_NUEVOS_MS = 5 * 60 * 1000;
/** Si no aparece nada nuevo, se recarga todo una vez al día. */
const ACTUALIZACION_COMPLETA_MS = 24 * 60 * 60 * 1000;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'vacio';

/**
 * Noticias sísmicas de Colombia (port de Noticias.html + script/Noticias.js).
 * - Sismos reales: API del USGS (EE. UU.).
 * - Noticias: RSS de Google Noticias convertido a JSON con rss2json.
 * No requiere claves de API.
 */
@Component({
  imports: [DecimalPipe, NatuHeader],
  selector: 'app-noticias',
  templateUrl: './noticias.html',
})
export class Noticias implements OnInit, OnDestroy {
  protected readonly sismos = signal<SismoUSGS[]>([]);
  protected readonly noticias = signal<NoticiaRSS[]>([]);
  protected readonly estadoSismos = signal<EstadoLista>('cargando');
  protected readonly estadoNoticias = signal<EstadoLista>('cargando');
  protected readonly ultimaActualizacion = signal('Cargando información...');
  protected readonly actualizando = signal(false);
  protected readonly avisoNuevoSismo = signal(false);

  private readonly http = inject(HttpClient);

  private sismoMasRecienteMostrado = 0;
  private ultimaActualizacionCompleta = 0;
  private intervaloRevision: ReturnType<typeof setInterval> | null = null;
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;
  private actualizandoBandera = false;

  ngOnInit(): void {
    document.body.classList.add('noticias-body');

    this.alCambiarVisibilidad = () => {
      if (!document.hidden) void this.revisarNovedades();
    };
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);

    void this.actualizarTodo('inicial');
    this.intervaloRevision = setInterval(() => void this.revisarNovedades(), REVISION_NUEVOS_MS);
  }

  ngOnDestroy(): void {
    document.body.classList.remove('noticias-body');
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);

    if (this.intervaloRevision) clearInterval(this.intervaloRevision);
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
  }

  /* ================= Carga de sismos (USGS) ================= */

  private async cargarSismos(): Promise<boolean> {
    const inicio = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const fechaInicio = inicio.toISOString().slice(0, 10);

    const parametros = new URLSearchParams({
      format: 'geojson',
      starttime: fechaInicio,
      minmagnitude: '3',
      minlatitude: '-4.5',
      maxlatitude: '13.5',
      minlongitude: '-82',
      maxlongitude: '-66',
      orderby: 'time',
      limit: '500',
    });

    try {
      const datos = await firstValueFrom(
        this.http.get<RespuestaUSGS>(`${USGS_ENDPOINT}?${parametros.toString()}`),
      );

      const todos = (datos.features || []).filter((sismo) => {
        const lugar = String(sismo.properties?.place || '').toLowerCase();
        const magnitud = sismo.properties?.mag;
        return (
          lugar.includes('colombia') && magnitud != null && Number.isFinite(Number(magnitud))
        );
      });

      // Evita repetir muchas réplicas del mismo lugar.
      const vistos = new Set<string>();
      const relevantes: SismoUSGS[] = [];

      for (const sismo of todos) {
        const clave = this.normalizarLugar(sismo.properties.place);
        if (vistos.has(clave)) continue;

        vistos.add(clave);
        relevantes.push(sismo);

        if (relevantes.length >= 9) break;
      }

      this.sismos.set(relevantes);
      this.estadoSismos.set(relevantes.length ? 'ok' : 'vacio');

      // Se guarda el sismo más reciente conocido para detectar novedades.
      const masReciente = todos.reduce(
        (mayor, sismo) => Math.max(mayor, Number(sismo.properties?.time) || 0),
        0,
      );
      this.sismoMasRecienteMostrado = Math.max(this.sismoMasRecienteMostrado, masReciente);

      return true;
    } catch (error) {
      console.error('Error al cargar los sismos del USGS:', error);
      this.estadoSismos.set('error');
      return false;
    }
  }

  /** Consulta ligera: solo averigua el sismo más reciente de Colombia. */
  private async consultarSismoMasReciente(): Promise<number> {
    const parametros = new URLSearchParams({
      format: 'geojson',
      starttime: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      minmagnitude: '3',
      minlatitude: '-4.5',
      maxlatitude: '13.5',
      minlongitude: '-82',
      maxlongitude: '-66',
      orderby: 'time',
      limit: '100',
    });

    const datos = await firstValueFrom(
      this.http.get<RespuestaUSGS>(`${USGS_ENDPOINT}?${parametros.toString()}`),
    );

    return (datos.features || []).reduce((mayor, sismo) => {
      const lugar = String(sismo.properties?.place || '').toLowerCase();
      if (!lugar.includes('colombia')) return mayor;

      return Math.max(mayor, Number(sismo.properties?.time) || 0);
    }, 0);
  }

  /* ================= Carga de noticias (rss2json) ================= */

  private async cargarNoticias(): Promise<void> {
    try {
      const datos = await firstValueFrom(this.http.get<RespuestaRSS>(NOTICIAS_API));

      if (datos.status !== 'ok' || !Array.isArray(datos.items)) {
        throw new Error('El servicio de noticias no devolvió datos válidos');
      }

      const noticias = datos.items
        .slice()
        .sort(
          (a, b) =>
            this.parsearFechaNoticia(b.pubDate) - this.parsearFechaNoticia(a.pubDate),
        )
        .slice(0, 9);

      this.noticias.set(noticias);
      this.estadoNoticias.set(noticias.length ? 'ok' : 'vacio');
    } catch (error) {
      console.error('Error al cargar las noticias:', error);
      this.estadoNoticias.set('error');
    }
  }

  /* ================= Actualización automática ================= */

  protected async actualizarTodo(motivo: string): Promise<void> {
    if (this.actualizandoBandera) return;
    this.actualizandoBandera = true;
    this.actualizando.set(true);
    this.ultimaActualizacion.set('Consultando fuentes en tiempo real...');

    try {
      const [sismosOk] = await Promise.all([this.cargarSismos(), this.cargarNoticias()]);

      // Solo se cuenta como actualización completa si el USGS respondió bien.
      if (sismosOk) this.ultimaActualizacionCompleta = Date.now();

      const hora = new Intl.DateTimeFormat('es-CO', {
        timeStyle: 'short',
        timeZone: 'America/Bogota',
      }).format(new Date());

      this.ultimaActualizacion.set(
        `Última actualización: hoy a las ${hora}. ` +
          (sismosOk
            ? 'Se actualiza sola cuando aparece un sismo nuevo; si no, cada 24 horas.'
            : 'No se pudo consultar el USGS; se reintentará automáticamente.'),
      );

      if (motivo === 'nuevo') this.mostrarAvisoNuevoSismo();
    } finally {
      this.actualizando.set(false);
      this.actualizandoBandera = false;
    }
  }

  private async revisarNovedades(): Promise<void> {
    if (document.hidden || this.actualizandoBandera) return;

    try {
      const masReciente = await this.consultarSismoMasReciente();

      if (masReciente && masReciente > this.sismoMasRecienteMostrado) {
        await this.actualizarTodo('nuevo');
        return;
      }
    } catch (error) {
      console.warn('No se pudo revisar si hay sismos nuevos:', error);
    }

    if (Date.now() - this.ultimaActualizacionCompleta >= ACTUALIZACION_COMPLETA_MS) {
      await this.actualizarTodo('programada');
    }
  }

  private mostrarAvisoNuevoSismo(): void {
    this.avisoNuevoSismo.set(true);

    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => this.avisoNuevoSismo.set(false), 12000);
  }

  /* ================= Ayudantes para la vista ================= */

  protected formatearFecha(ms: number): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(ms));
  }

  protected tiempoRelativo(ms: number): string {
    const diferencia = Date.now() - ms;
    const minutos = Math.floor(diferencia / 60000);

    if (minutos < 1) return 'hace un momento';
    if (minutos < 60) return `hace ${minutos} min`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;

    const dias = Math.floor(horas / 24);
    if (dias < 30) return `hace ${dias} día${dias === 1 ? '' : 's'}`;

    return this.formatearFecha(ms);
  }

  protected colorMagnitud(magnitud: number | null): string {
    if (magnitud == null) return '#d97706';
    if (magnitud >= 6) return '#991b1b';
    if (magnitud >= 5) return '#dc2626';
    if (magnitud >= 4) return '#ea580c';
    return '#d97706';
  }

  protected separarTituloYFuente(titulo: string): { titulo: string; fuente: string } {
    const separador = titulo.lastIndexOf(' - ');
    if (separador === -1) return { titulo, fuente: 'Google Noticias' };

    return {
      titulo: titulo.slice(0, separador).trim(),
      fuente: titulo.slice(separador + 3).trim(),
    };
  }

  protected parsearFechaNoticia(pubDate?: string): number {
    const fecha = new Date(String(pubDate).replace(' ', 'T') + 'Z');
    const tiempo = fecha.getTime();
    return Number.isFinite(tiempo) ? tiempo : 0;
  }

  protected profundidad(sismo: SismoUSGS): string {
    const profundidad = sismo.geometry?.coordinates?.[2];
    return Number.isFinite(profundidad) ? `${Math.round(profundidad!)} km` : '? km';
  }

  protected urlSismo(sismo: SismoUSGS): string {
    return sismo.properties.url || 'https://earthquake.usgs.gov/earthquakes/map/';
  }

  private normalizarLugar(place?: string): string {
    return String(place ?? '')
      .replace(/^\d+\s*km\s*[A-Z]+\s*of\s*/i, '')
      .trim()
      .toLowerCase();
  }

  private alCambiarVisibilidad = () => {};
}
