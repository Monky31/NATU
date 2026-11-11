import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { AuthService } from '../../services/auth.service';

/**
 * Mapa interactivo de Colombia (port de Mapa.html + script/Mapalnit.js).
 * Leaflet ahora se instala como paquete npm en lugar de cargarse por CDN.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-mapa',
  templateUrl: './mapa.html',
  styleUrl: './mapa.css',
})
export class Mapa implements AfterViewInit, OnDestroy {
  protected readonly lat = signal('-');
  protected readonly lng = signal('-');
  protected readonly magnitude = signal(4.5);
  protected readonly depth = signal(30);
  protected readonly duration = signal(10);
  protected readonly magLabel = signal('Moderado');
  protected readonly depthType = signal('Superficial');
  protected readonly simulando = signal(false);
  protected readonly alerta = signal('');

  private readonly mapaDiv = viewChild.required<ElementRef<HTMLDivElement>>('mapaDiv');

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private mapa!: L.Map;
  private epicentroMarker: L.Marker | null = null;
  private epicentroCoords: L.LatLng | null = null;
  private areaAfectada: L.Circle | null = null;
  private intervaloSimulacion: ReturnType<typeof setInterval> | null = null;
  private timeoutSimulacion: ReturnType<typeof setTimeout> | null = null;
  private temporizadorAlerta: ReturnType<typeof setTimeout> | null = null;

  /* ------------------------------------------------------------------
   * Ciclo de vida: crear y destruir el mapa
   * ------------------------------------------------------------------ */

  ngAfterViewInit(): void {
    this.mapa = L.map(this.divMapa()).setView([4.5709, -74.2973], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.mapa);

    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.mapa);

    this.mapa.on('mousemove', (e: L.LeafletMouseEvent) => {
      this.lat.set(e.latlng.lat.toFixed(6) + '°');
      this.lng.set(e.latlng.lng.toFixed(6) + '°');
    });

    this.mapa.on('mouseout', () => {
      this.lat.set('-');
      this.lng.set('-');
    });

    this.mapa.on('click', (e: L.LeafletMouseEvent) => this.marcarEpicentro(e.latlng));

    this.crearMarcadorBogota();
    this.crearLeyenda();
  }

  ngOnDestroy(): void {
    this.detenerSimulacion();

    if (this.temporizadorAlerta) {
      clearTimeout(this.temporizadorAlerta);
    }

    if (this.mapa) {
      this.mapa.remove();
    }
  }

  /* ------------------------------------------------------------------
   * Escalas REALISTAS (idénticas al original)
   * R(km) ≈ 10^(0.4 · M - 0.3), atenuada por la profundidad.
   * ------------------------------------------------------------------ */

  private calcularRadioAfectadoKm(magnitude: number, depth: number): number {
    const radioBaseKm = Math.pow(10, 0.4 * magnitude - 0.3);
    const factorProfundidad = Math.pow(15 / (15 + Math.max(0, depth)), 0.3);
    const radioKm = radioBaseKm * factorProfundidad;

    // Límites de seguridad para que el círculo siempre sea visible y útil.
    return Math.min(1200, Math.max(1, radioKm));
  }

  private clasificarProfundidad(depth: number): string {
    if (depth < 70) return 'Superficial';
    if (depth < 300) return 'Intermedio';
    return 'Profundo';
  }

  private clasificarMagnitud(magnitude: number): string {
    if (magnitude < 3) return 'Leve';
    if (magnitude < 4) return 'Menor';
    if (magnitude < 5) return 'Moderado';
    if (magnitude < 6) return 'Fuerte';
    if (magnitude < 7) return 'Muy fuerte';
    return 'Severo';
  }

  private obtenerEstiloSismico(magnitude: number): {
    fillColor: string;
    strokeColor: string;
    fillOpacity: number;
  } {
    if (magnitude < 3) return { fillColor: '#fbbf24', strokeColor: '#d97706', fillOpacity: 0.28 };
    if (magnitude < 4) return { fillColor: '#f59e0b', strokeColor: '#d97706', fillOpacity: 0.32 };
    if (magnitude < 5) return { fillColor: '#fb923c', strokeColor: '#ea580c', fillOpacity: 0.36 };
    if (magnitude < 6) return { fillColor: '#f87171', strokeColor: '#dc2626', fillOpacity: 0.4 };
    if (magnitude < 7) return { fillColor: '#ef4444', strokeColor: '#b91c1c', fillOpacity: 0.44 };
    return { fillColor: '#dc2626', strokeColor: '#7f1d1d', fillOpacity: 0.5 };
  }

  private formatearEnergia(magnitude: number): string {
    // Energía sísmica aproximada: log10(E) = 1.5·M + 4.8 (julios)
    const julios = Math.pow(10, 1.5 * magnitude + 4.8);
    const toneladasTNT = julios / 4.184e9;

    if (toneladasTNT >= 1e6) return `${(toneladasTNT / 1e6).toFixed(1)} Mt de TNT`;
    if (toneladasTNT >= 1e3) return `${(toneladasTNT / 1e3).toFixed(1)} kt de TNT`;
    if (toneladasTNT >= 1) return `${toneladasTNT.toFixed(0)} t de TNT`;
    return `${(toneladasTNT * 1000).toFixed(0)} kg de TNT`;
  }

  private construirPopup(magnitude: number, depth: number, radioKm: number): string {
    const lat = this.epicentroCoords!.lat.toFixed(6);
    const lng = this.epicentroCoords!.lng.toFixed(6);

    return `
      <b>📍 Epicentro del Sismo</b><br>
      Lat: ${lat}°<br>
      Lng: ${lng}°<br>
      <b>Magnitud:</b> ${magnitude.toFixed(1)} Richter (${this.clasificarMagnitud(magnitude)})<br>
      <b>Profundidad:</b> ${depth} km (${this.clasificarProfundidad(depth)})<br>
      <b>Radio afectado:</b> ${radioKm.toFixed(1)} km<br>
      <b>Energía liberada:</b> ${this.formatearEnergia(magnitude)}
    `;
  }

  /* ------------------------------------------------------------------
   * Interacción con los controles
   * ------------------------------------------------------------------ */

  protected cambiarMagnitud(evento: Event): void {
    const valor = parseFloat((evento.target as HTMLInputElement).value);
    this.magnitude.set(valor);
    this.actualizarEtiquetas();

    if (this.epicentroCoords) this.actualizarAreaAfectada();
  }

  protected cambiarProfundidad(evento: Event): void {
    const valor = parseFloat((evento.target as HTMLInputElement).value);
    this.depth.set(valor);
    this.actualizarEtiquetas();

    if (this.epicentroCoords) this.actualizarAreaAfectada();
  }

  protected cambiarDuracion(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.duration.set(Number.isFinite(valor) && valor > 0 ? valor : 10);
  }

  private actualizarEtiquetas(): void {
    this.magLabel.set(this.clasificarMagnitud(this.magnitude()));
    this.depthType.set(this.clasificarProfundidad(this.depth()));
  }

  /* ------------------------------------------------------------------
   * Epicentro y área afectada
   * ------------------------------------------------------------------ */

  private marcarEpicentro(coords: L.LatLng): void {
    this.epicentroCoords = coords;

    if (this.epicentroMarker) {
      this.mapa.removeLayer(this.epicentroMarker);
    }

    if (this.areaAfectada) {
      this.mapa.removeLayer(this.areaAfectada);
      this.areaAfectada = null;
    }

    this.epicentroMarker = L.marker(coords, {
      icon: L.divIcon({
        className: 'epicentro-icon',
        html: '<div style="background: #f43f5e; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(244, 63, 94, 0.8);"></div>',
        iconSize: [20, 20],
      }),
    }).addTo(this.mapa);

    this.actualizarAreaAfectada();
    this.epicentroMarker.openPopup();
  }

  private actualizarAreaAfectada(): void {
    if (!this.epicentroCoords) return;

    if (this.areaAfectada) {
      this.mapa.removeLayer(this.areaAfectada);
    }

    const magnitude = this.magnitude();
    const depth = this.depth();
    const radioKm = this.calcularRadioAfectadoKm(magnitude, depth);
    const estilo = this.obtenerEstiloSismico(magnitude);

    this.areaAfectada = L.circle(this.epicentroCoords, {
      radius: radioKm * 1000,
      color: estilo.strokeColor,
      fillColor: estilo.fillColor,
      fillOpacity: estilo.fillOpacity,
      weight: 2,
    }).addTo(this.mapa);

    if (this.epicentroMarker) {
      this.epicentroMarker.setPopupContent(this.construirPopup(magnitude, depth, radioKm));
    }
  }

  /* ------------------------------------------------------------------
   * Simulación de sismos
   * ------------------------------------------------------------------ */

  protected simularSismo(): void {
    if (!this.epicentroCoords) {
      this.alerta.set('⚠️ Primero debes marcar un epicentro haciendo clic en el mapa');
      this.temporizadorAlerta = setTimeout(() => this.alerta.set(''), 3000);
      return;
    }

    const duration = this.duration() * 1000;
    const magnitude = this.magnitude();

    this.detenerSimulacion();

    const intervaloOnda = magnitude > 6 ? 300 : 500;

    this.crearOndaSismica();
    this.intervaloSimulacion = setInterval(() => this.crearOndaSismica(), intervaloOnda);

    this.timeoutSimulacion = setTimeout(() => this.detenerSimulacion(), duration);

    const elementoMapa = this.divMapa();
    elementoMapa.style.animation = `shake ${Math.max(0.22, 0.6 - magnitude * 0.04)}s infinite`;

    this.simulando.set(true);
  }

  protected detenerSimulacion(): void {
    if (this.intervaloSimulacion) {
      clearInterval(this.intervaloSimulacion);
      this.intervaloSimulacion = null;
    }

    if (this.timeoutSimulacion) {
      clearTimeout(this.timeoutSimulacion);
      this.timeoutSimulacion = null;
    }

    const elementoMapa = this.divMapa();
    elementoMapa.style.animation = '';

    this.simulando.set(false);
  }

  /** Onda expansiva visual (div creado en tiempo real dentro del mapa). */
  private crearOndaSismica(): void {
    if (!this.epicentroCoords) return;

    const magnitude = this.magnitude();
    const depth = this.depth();
    const radioKm = this.calcularRadioAfectadoKm(magnitude, depth);

    const punto = this.mapa.latLngToContainerPoint(this.epicentroCoords);

    const onda = document.createElement('div');
    onda.className = 'seismic-wave';

    onda.style.left = punto.x + 'px';
    onda.style.top = punto.y + 'px';
    onda.style.transform = 'translate(-50%, -50%)';

    // El tamaño y la velocidad de la onda dependen de la magnitud real.
    const tamanoOnda = Math.min(700, Math.max(160, radioKm * 4));
    const duracionOnda = Math.max(1.2, 2.8 - magnitude * 0.15);
    onda.style.setProperty('--wave-size', tamanoOnda + 'px');
    onda.style.animationDuration = duracionOnda + 's';

    const contenedor = this.divMapa();
    contenedor.appendChild(onda);

    setTimeout(() => onda.remove(), duracionOnda * 1000 + 400);
  }

  /* ------------------------------------------------------------------
   * Elementos fijos del mapa
   * ------------------------------------------------------------------ */

  private crearMarcadorBogota(): void {
    // Ícono personalizado (el ícono por defecto de Leaflet no funciona bien
    // con empaquetadores como esbuild/Vite).
    const marcador = L.marker([4.711, -74.0721], {
      icon: L.divIcon({
        className: 'ciudad-icon',
        html: '<div style="background: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37, 99, 235, 0.8);"></div>',
        iconSize: [14, 14],
      }),
    }).addTo(this.mapa);

    marcador.bindPopup('<b>Bogotá</b><br>Capital de Colombia');
  }

  /** Leyenda de magnitud (esquina inferior derecha). */
  private crearLeyenda(): void {
    const legend = new L.Control({ position: 'bottomright' });

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <h4>Magnitud</h4>
        <div><i style="background:#fbbf24"></i> &lt; 3.0 · Leve</div>
        <div><i style="background:#f59e0b"></i> 3.0 – 3.9 · Menor</div>
        <div><i style="background:#fb923c"></i> 4.0 – 4.9 · Moderado</div>
        <div><i style="background:#f87171"></i> 5.0 – 5.9 · Fuerte</div>
        <div><i style="background:#ef4444"></i> 6.0 – 6.9 · Muy fuerte</div>
        <div><i style="background:#dc2626"></i> ≥ 7.0 · Severo</div>
      `;
      return div;
    };

    legend.addTo(this.mapa);
  }

  /* ------------------------------------------------------------------
   * Navegación
   * ------------------------------------------------------------------ */

  protected volver(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigateByUrl('/');
    }
  }

  protected cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/');
  }

  /** Referencia al div del mapa. */
  private divMapa(): HTMLDivElement {
    return this.mapaDiv().nativeElement;
  }
}
