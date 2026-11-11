/* ============================================================
   PROTOTIPO: SISMÓGRAFO Y ALARMA SÍSMICA (Mapa.html)
   Demo interactiva del módulo físico del proyecto.
   Flujo: sensor -> ADC -> comparador -> biestable -> alarma
   ============================================================ */
(function () {
    'use strict';

    var seccion = document.getElementById('prototipo');
    var canvas = document.getElementById('proto-canvas');
    var svg = document.getElementById('proto-circuito');
    if (!seccion || !canvas || !svg) return;

    // ---------- Elementos del sismógrafo ----------
    var btnSismo = document.getElementById('proto-sismo');
    var btnReset = document.getElementById('proto-reset');
    var intensidadInput = document.getElementById('proto-intensidad');
    var intensidadVal = document.getElementById('proto-intensidad-val');
    var umbralInput = document.getElementById('proto-umbral');
    var umbralVal = document.getElementById('proto-umbral-val');
    var bitsInput = document.getElementById('proto-bits');
    var leds = document.getElementById('proto-leds');
    var picoOut = document.getElementById('proto-pico');
    var adcOut = document.getElementById('proto-adc');
    var comparadorOut = document.getElementById('proto-comparador');
    var latchOut = document.getElementById('proto-latch');
    var readoutLatch = document.getElementById('proto-readout-latch');
    var contadorOut = document.getElementById('proto-contador');

    // ---------- Elementos del lazo ----------
    var btnSerie = document.getElementById('proto-serie');
    var btnParalelo = document.getElementById('proto-paralelo');
    var sensorOut = document.getElementById('proto-sensor');
    var corrienteOut = document.getElementById('proto-corriente');
    var alarmaOut = document.getElementById('proto-alarma');
    var readoutAlarma = document.getElementById('proto-readout-alarma');
    var nota = document.getElementById('proto-nota');

    // ---------- Elementos del transistor ----------
    var senalOut = document.getElementById('proto-senal');
    var salidaOut = document.getElementById('proto-salida');
    var alarma2Out = document.getElementById('proto-alarma2');
    var colectorOut = document.getElementById('proto-colector');
    var readoutSalida = document.getElementById('proto-readout-salida');
    var readoutAlarma2 = document.getElementById('proto-readout-alarma2');
    var ledExterior = document.getElementById('proto-led-exterior');
    var ledInterior = document.getElementById('proto-led-interior');

    // ---------- Estado compartido ----------
    var modo = 'serie';
    var alarma = false;          // queda fijada hasta reiniciar
    var intensidad = parseFloat(intensidadInput.value);
    var umbral = parseFloat(umbralInput.value);
    var bits = parseInt(bitsInput.value, 10);
    if (isNaN(intensidad)) intensidad = 80;
    if (isNaN(umbral)) umbral = 2.5;
    if (isNaN(bits)) bits = 8;

    var amplitud = 0.5 + (intensidad / 100) * 4.2;
    var sismoInicio = -1;
    var senalActual = 0;
    var pico = 0;
    var picoSismo = 0;
    var disparos = 0;
    var muestras = [];
    var ultimoDom = 0;
    var tReloj = 0;
    var visible = true;

    var R_LED = 330;
    var R_BUZZER = 120;
    var VOLTAJE = 9;
    var VENTANA = 6;             // segundos visibles en el sismógrafo

    // ---------- Señal del sismógrafo ----------
    function valorSenal(t) {
        var ruido = 0.07 * Math.sin(2 * Math.PI * 0.7 * t)
                  + 0.05 * Math.sin(2 * Math.PI * 1.9 * t + 1.1)
                  + 0.03 * Math.sin(2 * Math.PI * 3.1 * t + 0.4);
        var valor = ruido;
        if (sismoInicio >= 0) {
            var d = t - sismoInicio;
            if (d >= 0 && d <= 4) {
                valor += amplitud * Math.exp(-d / 1.1) * Math.sin(2 * Math.PI * 1.6 * d);
            }
        }
        return valor;
    }

    function calcularPicoPaquete() {
        var maximo = 0;
        for (var d = 0; d <= 4; d += 0.005) {
            var v = Math.abs(amplitud * Math.exp(-d / 1.1) * Math.sin(2 * Math.PI * 1.6 * d));
            if (v > maximo) maximo = v;
        }
        return maximo;
    }

    function nivelEntero(v) {
        var niveles = Math.pow(2, bits);
        var paso = 10 / niveles;
        var n = Math.floor((v + 5) / paso + 0.5);
        return Math.min(niveles - 1, Math.max(0, n));
    }

    function binario(v) {
        var s = nivelEntero(v).toString(2);
        while (s.length < bits) s = '0' + s;
        return s;
    }

    // ---------- Dibujo del lazo ----------
    function cable(d) {
        return '<path d="' + d + '" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round"/>';
    }

    function bateria(x, yArriba) {
        return '<line x1="' + (x - 9) + '" y1="' + yArriba + '" x2="' + (x + 9) + '" y2="' + yArriba + '" stroke="#f59e0b" stroke-width="3"/>' +
               '<line x1="' + (x - 5) + '" y1="' + (yArriba + 12) + '" x2="' + (x + 5) + '" y2="' + (yArriba + 12) + '" stroke="#f59e0b" stroke-width="3"/>' +
               '<text x="' + (x + 14) + '" y="' + (yArriba + 5) + '" fill="#f59e0b" font-size="12" font-family="Segoe UI, sans-serif">+</text>';
    }

    function aviso(x, y, etiqueta, activo, ancho, alto) {
        var fill = activo ? 'rgba(244, 63, 94, 0.18)' : 'rgba(148, 163, 184, 0.14)';
        var stroke = activo ? '#f43f5e' : '#94a3b8';
        var color = activo ? '#dc2626' : '#64748b';
        return '<rect x="' + (x - ancho / 2) + '" y="' + (y - alto / 2) + '" width="' + ancho + '" height="' + alto + '" rx="6" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"/>' +
               '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" fill="' + color + '" font-size="10" font-weight="700" font-family="Segoe UI, sans-serif">' + etiqueta + '</text>';
    }

    function interruptorSensor() {
        var color = alarma ? '#f43f5e' : '#f59e0b';
        return '<circle cx="140" cy="50" r="3" fill="#f59e0b"/>' +
               '<circle cx="180" cy="50" r="3" fill="#f59e0b"/>' +
               '<line x1="140" y1="50" x2="' + (alarma ? 180 : 172) + '" y2="' + (alarma ? 50 : 32) + '" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/>' +
               '<text x="160" y="24" text-anchor="middle" fill="' + (alarma ? '#dc2626' : '#475569') + '" font-size="12" font-weight="700" font-family="Segoe UI, sans-serif">SENSOR</text>';
    }

    function dibujarLazo() {
        var activo = alarma;
        var html = '';
        var resistencia;

        if (modo === 'serie') {
            resistencia = R_LED + R_BUZZER;
        } else {
            resistencia = (R_LED * R_BUZZER) / (R_LED + R_BUZZER);
        }

        if (modo === 'serie') {
            html += cable('M60 50 H140');
            html += cable('M180 50 H252');
            html += cable('M308 50 H332');
            html += cable('M388 50 H460');
            html += cable('M460 50 V190');
            html += cable('M60 190 H460');
            html += cable('M60 50 V110');
            html += cable('M60 150 V190');
            html += bateria(60, 124);
            html += interruptorSensor();
            html += aviso(280, 50, 'LED', activo, 56, 22);
            html += aviso(360, 50, 'BUZZER', activo, 56, 22);
        } else {
            html += cable('M60 50 H140');
            html += cable('M180 50 H460');
            html += cable('M460 50 V190');
            html += cable('M60 190 H460');
            html += cable('M60 50 V110');
            html += cable('M60 150 V190');
            html += bateria(60, 124);
            html += interruptorSensor();
            html += cable('M320 50 V105');
            html += cable('M320 127 V190');
            html += cable('M400 50 V105');
            html += cable('M400 127 V190');
            html += aviso(320, 116, 'LED', activo, 56, 22);
            html += aviso(400, 116, 'BUZZER', activo, 56, 22);
        }

        svg.innerHTML = html;

        var corriente = activo ? VOLTAJE / resistencia : 0;
        sensorOut.textContent = activo ? '1 · SISMO' : '0 · REPOSO';
        corrienteOut.textContent = (corriente * 1000).toFixed(0) + ' mA';
        alarmaOut.textContent = activo ? 'ACTIVADA' : 'APAGADA';
        readoutAlarma.classList.toggle('alarm', activo);

        if (nota) {
            nota.innerHTML = modo === 'serie'
                ? 'El sismógrafo cierra el lazo al superar el umbral. En <strong>serie</strong>, sensor y avisos comparten el mismo camino.'
                : 'En <strong>paralelo</strong>, cada aviso tiene su propia rama: todos reciben el mismo voltaje y se activan juntos.';
        }
    }

    // ---------- Panel del transistor ----------
    function actualizarTransistor(conduce) {
        senalOut.textContent = (senalActual >= 0 ? '+' : '') + senalActual.toFixed(2) + ' V';
        salidaOut.textContent = conduce ? '1 · SATURACIÓN' : '0 · CORTE';
        colectorOut.textContent = conduce ? '20.0 mA' : '0.0 mA';
        readoutSalida.classList.toggle('alarm', conduce);
        alarma2Out.textContent = alarma ? 'ACTIVADA' : 'APAGADA';
        readoutAlarma2.classList.toggle('alarm', alarma);

        ledInterior.setAttribute('fill', conduce ? '#f43f5e' : '#cbd5e1');
        ledExterior.setAttribute('opacity', conduce ? '1' : '0');
    }

    // ---------- Alarma y reinicio ----------
    function fijarAlarma() {
        if (alarma) return;
        alarma = true;
        dibujarLazo();
        latchOut.textContent = 'ACTIVADA';
        readoutLatch.classList.add('alarm');
    }

    function reiniciar() {
        alarma = false;
        sismoInicio = -1;
        senalActual = 0;
        pico = 0;
        picoSismo = 0;
        disparos = 0;
        muestras = [];
        ultimoDom = 0;

        dibujarLazo();
        actualizarTransistor(false);

        picoOut.textContent = '0.00 V';
        adcOut.textContent = binario(0);
        comparadorOut.textContent = '0';
        contadorOut.textContent = '0';
        latchOut.textContent = 'DESACTIVADA';
        readoutLatch.classList.remove('alarm');
        actualizarLeds(0);
    }

    // ---------- LEDs del ADC ----------
    function construirLeds() {
        leds.innerHTML = '';
        for (var i = 0; i < bits; i++) {
            leds.appendChild(document.createElement('span'));
        }
    }

    function actualizarLeds(v) {
        var valor = binario(v);
        var hijos = leds.children;
        for (var i = 0; i < hijos.length; i++) {
            hijos[i].classList.toggle('on', valor.charAt(i) === '1');
        }
    }

    // ---------- Sismógrafo en canvas ----------
    function ajustarCanvas() {
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        if (!w || !h) return false;
        var ratio = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
            canvas.width = Math.round(w * ratio);
            canvas.height = Math.round(h * ratio);
        }
        var ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        return true;
    }

    function dibujarSismografo(t) {
        if (!ajustarCanvas()) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;

        ctx.clearRect(0, 0, w, h);

        // Rejilla
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
        ctx.lineWidth = 1;
        var pasoX = Math.max(50, w / 12);
        for (var x = 0; x <= w; x += pasoX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (var y = 0; y <= h; y += h / 6) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        var y0 = h / 2;
        var escala = (h / 2 - 10) / 5;

        // Línea cero
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(w, y0);
        ctx.stroke();

        // Umbral
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.75)';
        ctx.beginPath();
        ctx.moveTo(0, y0 - umbral * escala);
        ctx.lineTo(w, y0 - umbral * escala);
        ctx.moveTo(0, y0 + umbral * escala);
        ctx.lineTo(w, y0 + umbral * escala);
        ctx.stroke();
        ctx.restore();

        // Etiquetas
        ctx.font = '9px Segoe UI, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('+5 V', 6, 12);
        ctx.fillText('0 V', 6, y0 - 4);
        ctx.fillText('-5 V', 6, h - 5);
        ctx.fillStyle = 'rgba(248, 113, 113, 0.95)';
        ctx.fillText('umbral ' + umbral.toFixed(1) + ' V', w - 84, y0 - umbral * escala - 4);

        // Traza
        var t0 = t - VENTANA;
        ctx.beginPath();
        var primero = true;
        for (var i = 0; i < muestras.length; i++) {
            var m = muestras[i];
            if (m.t < t0) continue;
            var px = ((m.t - t0) / VENTANA) * w;
            var py = y0 - m.v * escala;
            if (primero) {
                ctx.moveTo(px, py);
                primero = false;
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.strokeStyle = alarma ? '#f87171' : '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = alarma ? 'rgba(248, 113, 113, 0.75)' : 'rgba(56, 189, 248, 0.55)';
        ctx.shadowBlur = alarma ? 7 : 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Punto actual
        if (muestras.length) {
            var ult = muestras[muestras.length - 1];
            var lx = ((ult.t - t0) / VENTANA) * w;
            var ly = y0 - ult.v * escala;
            ctx.beginPath();
            ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
            ctx.fillStyle = alarma ? '#f87171' : '#38bdf8';
            ctx.fill();
        }

        // Estado del sismo
        if (sismoInicio >= 0) {
            ctx.fillStyle = '#f87171';
            ctx.font = 'bold 10px Segoe UI, sans-serif';
            ctx.fillText('SISMO EN CURSO', w / 2 - 42, 14);
        }
    }

    // ---------- Bucle de simulación ----------
    function bucle(ms) {
        window.requestAnimationFrame(bucle);
        tReloj = ms / 1000;

        var t = tReloj;
        var v = valorSenal(t);
        senalActual = v;

        if (sismoInicio >= 0 && t - sismoInicio > 4.5) {
            sismoInicio = -1;
        }

        if (sismoInicio >= 0 || alarma) {
            if (Math.abs(v) > Math.abs(pico)) pico = v;
        }

        // Pico analítico: la alarma dispara aunque se pierdan frames.
        if (sismoInicio >= 0 && t - sismoInicio >= 0.15) {
            if (Math.abs(pico) < picoSismo) pico = picoSismo;
            if (picoSismo >= umbral && !alarma) fijarAlarma();
        }

        if (Math.abs(v) >= umbral) {
            disparos++;
            if (!alarma) fijarAlarma();
        }

        muestras.push({ t: t, v: v });
        while (muestras.length && muestras[0].t < t - VENTANA) {
            muestras.shift();
        }

        if (t - ultimoDom > 0.05) {
            ultimoDom = t;
            var conduce = Math.abs(v) >= umbral;
            actualizarTransistor(conduce);
            comparadorOut.textContent = conduce ? '1' : '0';
            adcOut.textContent = binario(v);
            picoOut.textContent = Math.abs(pico).toFixed(2) + ' V';
            contadorOut.textContent = String(disparos);
            latchOut.textContent = alarma ? 'ACTIVADA' : 'DESACTIVADA';
            readoutLatch.classList.toggle('alarm', alarma);
            actualizarLeds(v);
        }

        if (visible) dibujarSismografo(t);
    }

    // ---------- Controles ----------
    function cambiarModo(nuevo) {
        modo = nuevo;
        btnSerie.classList.toggle('active', modo === 'serie');
        btnParalelo.classList.toggle('active', modo === 'paralelo');
        dibujarLazo();
    }

    function lanzarSismo() {
        reiniciar();
        picoSismo = calcularPicoPaquete();
        sismoInicio = tReloj;
    }

    function actualizarIntensidad() {
        intensidad = parseFloat(intensidadInput.value);
        if (isNaN(intensidad)) intensidad = 0;
        intensidadVal.textContent = Math.round(intensidad) + ' %';
        amplitud = 0.5 + (intensidad / 100) * 4.2;
    }

    btnSerie.addEventListener('click', function () { cambiarModo('serie'); });
    btnParalelo.addEventListener('click', function () { cambiarModo('paralelo'); });
    btnSismo.addEventListener('click', lanzarSismo);
    btnReset.addEventListener('click', reiniciar);

    intensidadInput.addEventListener('input', function () {
        actualizarIntensidad();
        reiniciar();
    });

    umbralInput.addEventListener('input', function () {
        umbral = parseFloat(umbralInput.value);
        if (isNaN(umbral)) umbral = 2.5;
        umbralVal.textContent = umbral.toFixed(1) + ' V';
        reiniciar();
    });

    bitsInput.addEventListener('change', function () {
        bits = parseInt(bitsInput.value, 10) || 8;
        construirLeds();
        actualizarLeds(senalActual);
        adcOut.textContent = binario(senalActual);
    });

    // ---------- Enlace con el simulador del mapa ----------
    // Al simular un sismo en el mapa, el prototipo recibe la señal.
    function conectarMapa() {
        var mapSimular = document.getElementById('simulate-btn');
        if (!mapSimular) return;

        mapSimular.addEventListener('click', function () {
            // Mapalnit.js deshabilita el botón solo si la simulación inició
            // (es decir, si ya existe un epicentro marcado).
            if (!mapSimular.disabled) return;

            var magInput = document.getElementById('magnitude');
            var mag = magInput ? parseFloat(magInput.value) : 4.5;
            if (isNaN(mag)) mag = 4.5;

            var pct = Math.round(((mag - 2) / 4) * 100);
            pct = Math.max(15, Math.min(100, pct));
            intensidadInput.value = String(pct);
            actualizarIntensidad();
            lanzarSismo();
        });
    }

    if (document.readyState === 'complete') {
        conectarMapa();
    } else {
        window.addEventListener('load', conectarMapa);
    }

    // ---------- Pausa de dibujo cuando la sección no está visible ----------
    if ('IntersectionObserver' in window) {
        var observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (entrada) {
                visible = entrada.isIntersecting;
            });
        }, { threshold: 0.05 });
        observador.observe(seccion);
    }

    // ---------- Arranque ----------
    actualizarIntensidad();
    umbralVal.textContent = umbral.toFixed(1) + ' V';
    construirLeds();
    reiniciar();
    window.requestAnimationFrame(bucle);
})();
