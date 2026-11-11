const map = L.map('map').setView([4.5709, -74.2973], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
}).addTo(map);

L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

const latDisplay = document.getElementById('lat');
const lngDisplay = document.getElementById('lng');
const magValue = document.getElementById('mag-value');
const depthValue = document.getElementById('depth-value');
const magLabel = document.getElementById('mag-label');
const depthType = document.getElementById('depth-type');
const magnitudeInput = document.getElementById('magnitude');
const depthInput = document.getElementById('depth');
const durationInput = document.getElementById('duration');
const simulateBtn = document.getElementById('simulate-btn');
const stopBtn = document.getElementById('stop-btn');

let epicentroMarker = null;
let epicentroCoords = null;
let simulationInterval = null;
let simulationTimeout = null;
let affectedAreaCircle = null;

/* ------------------------------------------------------------------
 * Escalas REALISTAS
 * El radio se calcula con una relación empírica de percepción/sacudida:
 *   R(km) ≈ 10^(0.4 · M - 0.3)
 * Es decir, crece de forma logarítmica (no exponencial), como en la
 * naturaleza. Además, a mayor profundidad, menor es la sacudida en
 * superficie, por lo que el radio se atenúa.
 * Ejemplos aproximados (profundidad 30 km):
 *   M 3.0 →  ~6 km      M 5.0 →  ~37 km
 *   M 4.0 →  ~15 km     M 6.0 →  ~94 km
 *   M 7.0 → ~235 km     M 8.0 → ~592 km
 * ------------------------------------------------------------------ */
function calcularRadioAfectadoKm(magnitude, depth) {
    const radioBaseKm = Math.pow(10, 0.4 * magnitude - 0.3);
    const factorProfundidad = Math.pow(15 / (15 + Math.max(0, depth)), 0.3);
    const radioKm = radioBaseKm * factorProfundidad;

    // Límites de seguridad para que el círculo siempre sea visible y útil.
    return Math.min(1200, Math.max(1, radioKm));
}

function clasificarProfundidad(depth) {
    if (depth < 70) return 'Superficial';
    if (depth < 300) return 'Intermedio';
    return 'Profundo';
}

function clasificarMagnitud(magnitude) {
    if (magnitude < 3) return 'Leve';
    if (magnitude < 4) return 'Menor';
    if (magnitude < 5) return 'Moderado';
    if (magnitude < 6) return 'Fuerte';
    if (magnitude < 7) return 'Muy fuerte';
    return 'Severo';
}

function obtenerEstiloSismico(magnitude) {
    if (magnitude < 3) {
        return { fillColor: '#fbbf24', strokeColor: '#d97706', fillOpacity: 0.28 };
    }
    if (magnitude < 4) {
        return { fillColor: '#f59e0b', strokeColor: '#d97706', fillOpacity: 0.32 };
    }
    if (magnitude < 5) {
        return { fillColor: '#fb923c', strokeColor: '#ea580c', fillOpacity: 0.36 };
    }
    if (magnitude < 6) {
        return { fillColor: '#f87171', strokeColor: '#dc2626', fillOpacity: 0.40 };
    }
    if (magnitude < 7) {
        return { fillColor: '#ef4444', strokeColor: '#b91c1c', fillOpacity: 0.44 };
    }
    return { fillColor: '#dc2626', strokeColor: '#7f1d1d', fillOpacity: 0.50 };
}

function formatearEnergia(magnitude) {
    // Energía sísmica aproximada: log10(E) = 1.5·M + 4.8 (julios)
    const julios = Math.pow(10, 1.5 * magnitude + 4.8);
    const toneladasTNT = julios / 4.184e9;

    if (toneladasTNT >= 1e6) return `${(toneladasTNT / 1e6).toFixed(1)} Mt de TNT`;
    if (toneladasTNT >= 1e3) return `${(toneladasTNT / 1e3).toFixed(1)} kt de TNT`;
    if (toneladasTNT >= 1) return `${toneladasTNT.toFixed(0)} t de TNT`;
    return `${(toneladasTNT * 1000).toFixed(0)} kg de TNT`;
}

function construirPopup(magnitude, depth, radioKm) {
    const lat = epicentroCoords.lat.toFixed(6);
    const lng = epicentroCoords.lng.toFixed(6);

    return `
        <b>📍 Epicentro del Sismo</b><br>
        Lat: ${lat}°<br>
        Lng: ${lng}°<br>
        <b>Magnitud:</b> ${magnitude.toFixed(1)} Richter (${clasificarMagnitud(magnitude)})<br>
        <b>Profundidad:</b> ${depth} km (${clasificarProfundidad(depth)})<br>
        <b>Radio afectado:</b> ${radioKm.toFixed(1)} km<br>
        <b>Energía liberada:</b> ${formatearEnergia(magnitude)}
    `;
}

function updateAffectedArea() {
    if (!epicentroCoords) return;

    if (affectedAreaCircle) {
        map.removeLayer(affectedAreaCircle);
    }

    const magnitude = parseFloat(magnitudeInput.value);
    const depth = parseFloat(depthInput.value);
    const radioKm = calcularRadioAfectadoKm(magnitude, depth);
    const estilo = obtenerEstiloSismico(magnitude);

    affectedAreaCircle = L.circle(epicentroCoords, {
        radius: radioKm * 1000,
        color: estilo.strokeColor,
        fillColor: estilo.fillColor,
        fillOpacity: estilo.fillOpacity,
        weight: 2,
    }).addTo(map);

    if (epicentroMarker) {
        epicentroMarker.setPopupContent(construirPopup(magnitude, depth, radioKm));
    }
}

function actualizarEtiquetas() {
    const magnitude = parseFloat(magnitudeInput.value);
    const depth = parseFloat(depthInput.value);

    magValue.textContent = magnitude.toFixed(1);
    depthValue.textContent = depth;
    magLabel.textContent = clasificarMagnitud(magnitude);
    depthType.textContent = clasificarProfundidad(depth);
}

magnitudeInput.addEventListener('input', () => {
    actualizarEtiquetas();
    if (epicentroCoords) updateAffectedArea();
});

depthInput.addEventListener('input', () => {
    actualizarEtiquetas();
    if (epicentroCoords) updateAffectedArea();
});

map.on('mousemove', function (e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);

    latDisplay.textContent = lat + '°';
    lngDisplay.textContent = lng + '°';
});

map.on('mouseout', function () {
    latDisplay.textContent = '-';
    lngDisplay.textContent = '-';
});

map.on('click', function (e) {
    epicentroCoords = e.latlng;

    if (epicentroMarker) {
        map.removeLayer(epicentroMarker);
    }

    if (affectedAreaCircle) {
        map.removeLayer(affectedAreaCircle);
        affectedAreaCircle = null;
    }

    epicentroMarker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'epicentro-icon',
            html: '<div style="background: #f43f5e; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(244, 63, 94, 0.8);"></div>',
            iconSize: [20, 20]
        })
    }).addTo(map);

    updateAffectedArea();
    epicentroMarker.openPopup();
});

function createSeismicWave() {
    if (!epicentroCoords) return;

    const magnitude = parseFloat(magnitudeInput.value);
    const depth = parseFloat(depthInput.value);
    const radioKm = calcularRadioAfectadoKm(magnitude, depth);

    const point = map.latLngToContainerPoint(epicentroCoords);

    const wave = document.createElement('div');
    wave.className = 'seismic-wave';

    wave.style.left = point.x + 'px';
    wave.style.top = point.y + 'px';
    wave.style.transform = 'translate(-50%, -50%)';

    // El tamaño y la velocidad de la onda dependen de la magnitud real.
    const waveSize = Math.min(700, Math.max(160, radioKm * 4));
    const waveDuration = Math.max(1.2, 2.8 - magnitude * 0.15);
    wave.style.setProperty('--wave-size', waveSize + 'px');
    wave.style.animationDuration = waveDuration + 's';

    const mapContainer = document.getElementById('map');
    mapContainer.appendChild(wave);

    setTimeout(() => {
        wave.remove();
    }, waveDuration * 1000 + 400);
}

function simulateEarthquake() {
    if (!epicentroCoords) {
        alert('⚠️ Primero debes marcar un epicentro haciendo clic en el mapa');
        return;
    }

    const duration = parseInt(durationInput.value) * 1000;
    const magnitude = parseFloat(magnitudeInput.value);

    stopSimulation();

    const waveInterval = magnitude > 6 ? 300 : 500;

    createSeismicWave();

    simulationInterval = setInterval(createSeismicWave, waveInterval);

    simulationTimeout = setTimeout(() => {
        stopSimulation();
    }, duration);

    const mapElement = document.getElementById('map');
    mapElement.style.animation = `shake ${Math.max(0.22, 0.6 - magnitude * 0.04)}s infinite`;

    simulateBtn.disabled = true;
    simulateBtn.textContent = '🌋 Simulando...';
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }

    if (simulationTimeout) {
        clearTimeout(simulationTimeout);
        simulationTimeout = null;
    }

    const mapElement = document.getElementById('map');
    mapElement.style.animation = '';

    simulateBtn.disabled = false;
    simulateBtn.textContent = '🌋 Simular Sismo';
}

simulateBtn.addEventListener('click', simulateEarthquake);
stopBtn.addEventListener('click', stopSimulation);

const bogotaMarker = L.marker([4.7110, -74.0721]).addTo(map);
bogotaMarker.bindPopup('<b>Bogotá</b><br>Capital de Colombia');

/* Leyenda de magnitud */
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
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

legend.addTo(map);

actualizarEtiquetas();
