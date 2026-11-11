/* Página de noticias sísmicas:
   - Sismos reales: API del USGS (EE. UU.).
   - Noticias: RSS de Google Noticias convertido a JSON con rss2json.
   No requiere claves de API. */

const USGS_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const NOTICIAS_RSS =
    'https://news.google.com/rss/search?q=' +
    encodeURIComponent('(sismos OR temblor) Colombia when:14d') +
    '&hl=es-CO&gl=CO&ceid=CO:es';
const NOTICIAS_API =
    'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(NOTICIAS_RSS);

/* Cada cuánto se consulta (de forma ligera) si apareció un sismo más reciente. */
const REVISION_NUEVOS_MS = 5 * 60 * 1000;
/* Si no aparece nada nuevo, se recarga todo una vez al día. */
const ACTUALIZACION_COMPLETA_MS = 24 * 60 * 60 * 1000;

const sismosLista = document.getElementById('sismos-lista');
const noticiasLista = document.getElementById('noticias-lista');
const ultimaActualizacion = document.getElementById('ultima-actualizacion');
const actualizarBtn = document.getElementById('actualizar-btn');
const avisoNuevoSismo = document.getElementById('aviso-nuevo-sismo');

/* Estado del refresco automático. */
let sismoMasRecienteMostrado = 0;
let ultimaActualizacionCompleta = 0;

function escaparHtml(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (caracter) => {
        const mapa = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return mapa[caracter];
    });
}

function formatearFecha(ms) {
    return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota',
    }).format(new Date(ms));
}

function tiempoRelativo(ms) {
    const diferencia = Date.now() - ms;
    const minutos = Math.floor(diferencia / 60000);

    if (minutos < 1) return 'hace un momento';
    if (minutos < 60) return `hace ${minutos} min`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;

    const dias = Math.floor(horas / 24);
    if (dias < 30) return `hace ${dias} día${dias === 1 ? '' : 's'}`;

    return formatearFecha(ms);
}

function colorMagnitud(magnitud) {
    if (magnitud >= 6) return '#991b1b';
    if (magnitud >= 5) return '#dc2626';
    if (magnitud >= 4) return '#ea580c';
    return '#d97706';
}

function normalizarLugar(place) {
    return String(place ?? '')
        .replace(/^\d+\s*km\s*[A-Z]+\s*of\s*/i, '')
        .trim()
        .toLowerCase();
}

function mostrarErrorSismos() {
    sismosLista.innerHTML = `
        <div class="noticias-error">
            No se pudieron cargar los sismos en este momento.
            <a href="https://earthquake.usgs.gov/earthquakes/map/?extent=-4.5,-82,13.5,-66"
               target="_blank" rel="noopener noreferrer">Consultar directamente en USGS ↗</a>
        </div>
    `;
}

function mostrarErrorNoticias() {
    noticiasLista.innerHTML = `
        <div class="noticias-error">
            No se pudieron cargar las noticias en este momento.
            <a href="https://news.google.com/search?q=temblor%20Colombia&hl=es-CO&gl=CO&ceid=CO:es"
               target="_blank" rel="noopener noreferrer">Verlas en Google Noticias ↗</a>
        </div>
    `;
}

function renderizarSismos(sismos) {
    if (!sismos.length) {
        sismosLista.innerHTML = `
            <div class="noticias-vacio">
                No hay sismos de magnitud 3 o superior reportados para Colombia en los últimos 60 días.
                <a href="https://earthquake.usgs.gov/earthquakes/map/?extent=-4.5,-82,13.5,-66"
                   target="_blank" rel="noopener noreferrer">Ver el mapa del USGS ↗</a>
            </div>
        `;
        return;
    }

    sismosLista.innerHTML = sismos
        .map((sismo) => {
            const propiedades = sismo.properties;
            const profundidad = sismo.geometry?.coordinates?.[2];
            const magnitud = Number(propiedades.mag);
            const color = colorMagnitud(magnitud);
            const estado = propiedades.status === 'reviewed' ? 'Revisado' : 'Automático';
            const url = propiedades.url || 'https://earthquake.usgs.gov/earthquakes/map/';

            return `
                <article class="sismo-card" style="--sismo-color: ${color};">
                    <div class="sismo-top">
                        <div class="sismo-mag">${magnitud.toFixed(1)}</div>
                        <div>
                            <div class="sismo-place">${escaparHtml(propiedades.place || 'Lugar no disponible')}</div>
                            <div class="sismo-date">
                                ${formatearFecha(propiedades.time)} · ${tiempoRelativo(propiedades.time)}
                            </div>
                        </div>
                    </div>
                    <div class="sismo-meta">
                        <span class="sismo-pill">Profundidad: ${Number.isFinite(profundidad) ? Math.round(profundidad) : '?'} km</span>
                        <span class="sismo-pill">${estado}</span>
                    </div>
                    <a class="sismo-link" href="${escaparHtml(url)}" target="_blank" rel="noopener noreferrer">
                        Ver detalle en USGS ↗
                    </a>
                </article>
            `;
        })
        .join('');
}

async function cargarSismos() {
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
        const respuesta = await fetch(`${USGS_ENDPOINT}?${parametros.toString()}`);
        if (!respuesta.ok) throw new Error(`USGS respondió ${respuesta.status}`);

        const datos = await respuesta.json();
        const sismos = (datos.features || [])
            .filter((sismo) => {
                const lugar = String(sismo.properties?.place || '').toLowerCase();
                const magnitud = sismo.properties?.mag;
                return lugar.includes('colombia') && magnitud != null && Number.isFinite(Number(magnitud));
            })
            .sort((a, b) => b.properties.mag - a.properties.mag);

        // Evita repetir muchas réplicas del mismo lugar.
        const vistos = new Set();
        const relevantes = [];

        for (const sismo of sismos) {
            const clave = normalizarLugar(sismo.properties.place);
            if (vistos.has(clave)) continue;

            vistos.add(clave);
            relevantes.push(sismo);

            if (relevantes.length >= 9) break;
        }

        renderizarSismos(relevantes);

        // Se guarda el sismo más reciente conocido para detectar novedades.
        const masReciente = sismos.reduce(
            (mayor, sismo) => Math.max(mayor, Number(sismo.properties?.time) || 0),
            0
        );

        sismoMasRecienteMostrado = Math.max(sismoMasRecienteMostrado, masReciente);

        return { ok: true, masReciente };
    } catch (error) {
        console.error('Error al cargar los sismos del USGS:', error);
        mostrarErrorSismos();
        return { ok: false, masReciente: 0 };
    }
}

/* Consulta ligera: solo averigua el sismo más reciente de Colombia.
   No vuelve a pintar la página, únicamente sirve para saber si hay algo nuevo. */
async function consultarSismoMasReciente() {
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

    const respuesta = await fetch(`${USGS_ENDPOINT}?${parametros.toString()}`);
    if (!respuesta.ok) throw new Error(`USGS respondió ${respuesta.status}`);

    const datos = await respuesta.json();

    return (datos.features || []).reduce((mayor, sismo) => {
        const lugar = String(sismo.properties?.place || '').toLowerCase();
        if (!lugar.includes('colombia')) return mayor;

        return Math.max(mayor, Number(sismo.properties?.time) || 0);
    }, 0);
}

function separarTituloYFuente(titulo) {
    const separador = titulo.lastIndexOf(' - ');
    if (separador === -1) return { titulo, fuente: 'Google Noticias' };

    return {
        titulo: titulo.slice(0, separador).trim(),
        fuente: titulo.slice(separador + 3).trim(),
    };
}

function parsearFechaNoticia(pubDate) {
    return new Date(String(pubDate).replace(' ', 'T') + 'Z');
}

function renderizarNoticias(noticias) {
    if (!noticias.length) {
        noticiasLista.innerHTML = `
            <div class="noticias-vacio">
                No hay noticias recientes disponibles.
                <a href="https://news.google.com/search?q=temblor%20Colombia&hl=es-CO&gl=CO&ceid=CO:es"
                   target="_blank" rel="noopener noreferrer">Buscar en Google Noticias ↗</a>
            </div>
        `;
        return;
    }

    noticiasLista.innerHTML = noticias
        .map((noticia) => {
            const { titulo, fuente } = separarTituloYFuente(noticia.title || 'Noticia sin título');
            const fecha = parsearFechaNoticia(noticia.pubDate);
            const timestamp = fecha.getTime();
            const fechaTexto = Number.isFinite(timestamp)
                ? `${formatearFecha(timestamp)} · ${tiempoRelativo(timestamp)}`
                : 'Fecha no disponible';

            return `
                <article class="noticia-card">
                    <div class="noticia-source">${escaparHtml(fuente)}</div>
                    <h3>${escaparHtml(titulo)}</h3>
                    <p class="noticia-date">${fechaTexto}</p>
                    <a class="noticia-link" href="${escaparHtml(noticia.link)}" target="_blank" rel="noopener noreferrer">
                        Leer noticia completa ↗
                    </a>
                </article>
            `;
        })
        .join('');
}

async function cargarNoticias() {
    try {
        const respuesta = await fetch(NOTICIAS_API);
        if (!respuesta.ok) throw new Error(`Servicio de noticias respondió ${respuesta.status}`);

        const datos = await respuesta.json();
        if (datos.status !== 'ok' || !Array.isArray(datos.items)) {
            throw new Error('El servicio de noticias no devolvió datos válidos');
        }

        const noticias = datos.items
            .slice()
            .sort((a, b) => parsearFechaNoticia(b.pubDate) - parsearFechaNoticia(a.pubDate))
            .slice(0, 9);

        renderizarNoticias(noticias);
    } catch (error) {
        console.error('Error al cargar las noticias:', error);
        mostrarErrorNoticias();
    }
}

let actualizando = false;

function mostrarAvisoNuevoSismo() {
    if (!avisoNuevoSismo) return;

    avisoNuevoSismo.textContent =
        '🆕 Se detectó un sismo más reciente. La información se actualizó automáticamente.';
    avisoNuevoSismo.hidden = false;

    clearTimeout(mostrarAvisoNuevoSismo.temporizador);
    mostrarAvisoNuevoSismo.temporizador = setTimeout(() => {
        avisoNuevoSismo.hidden = true;
    }, 12000);
}

async function actualizarTodo({ motivo = 'manual' } = {}) {
    if (actualizando) return;
    actualizando = true;

    actualizarBtn.disabled = true;
    actualizarBtn.textContent = 'Actualizando...';
    ultimaActualizacion.textContent = 'Consultando fuentes en tiempo real...';

    try {
        const resultados = await Promise.allSettled([cargarSismos(), cargarNoticias()]);

        const sismosOk =
            resultados[0].status === 'fulfilled' && resultados[0].value?.ok;

        // Solo se cuenta como actualización completa si el USGS respondió bien.
        // Así, si falla la conexión, se reintenta en la siguiente revisión.
        if (sismosOk) ultimaActualizacionCompleta = Date.now();

        const hora = new Intl.DateTimeFormat('es-CO', {
            timeStyle: 'short',
            timeZone: 'America/Bogota',
        }).format(new Date());

        ultimaActualizacion.textContent =
            `Última actualización: hoy a las ${hora}. ` +
            (sismosOk
                ? 'Se actualiza sola cuando aparece un sismo nuevo; si no, cada 24 horas.'
                : 'No se pudo consultar el USGS; se reintentará automáticamente.');

        if (motivo === 'nuevo') mostrarAvisoNuevoSismo();
    } finally {
        actualizarBtn.disabled = false;
        actualizarBtn.textContent = '🔄 Actualizar ahora';
        actualizando = false;
    }
}

/* Revisa si hay sismos nuevos. Si los hay, recarga la página.
   Si no, solo hace la recarga completa cuando ya pasaron 24 horas. */
async function revisarNovedades() {
    if (document.hidden || actualizando) return;

    try {
        const masReciente = await consultarSismoMasReciente();

        if (masReciente && masReciente > sismoMasRecienteMostrado) {
            await actualizarTodo({ motivo: 'nuevo' });
            return;
        }
    } catch (error) {
        console.warn('No se pudo revisar si hay sismos nuevos:', error);
    }

    if (Date.now() - ultimaActualizacionCompleta >= ACTUALIZACION_COMPLETA_MS) {
        await actualizarTodo({ motivo: 'programada' });
    }
}

actualizarBtn.addEventListener('click', () => actualizarTodo({ motivo: 'manual' }));

actualizarTodo({ motivo: 'inicial' });
setInterval(revisarNovedades, REVISION_NUEVOS_MS);

// Al volver a la pestaña, revisa de inmediato si hubo novedades.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) revisarNovedades();
});
