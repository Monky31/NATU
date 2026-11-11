/* ============================================================
   PUENTE CELULAR -> DIAPOSITIVA 8 (PROYECTO NATU)
   Servidor local con HTTP y WebSockets de baja latencia.

   - Sirve todo el proyecto (incluida Expo.html).
   - El celular envía su acelerómetro vía WebSocket en tiempo real.
   - La Diapositiva 8 recibe el movimiento instantáneamente y
     controla el sismógrafo, transistor y lazo de alarma.
   - Detecta la IP local Wi-Fi para vincular el celular fácilmente.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const INICIO = '/Exposicion/Expo11-18-2025/Expo.html';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

let ultimo = { v: 0, t: 0 };
const sseClientes = new Set();

// Obtener la dirección IP local de la máquina en la red Wi-Fi
function obtenerIpLocal() {
    const interfaces = os.networkInterfaces();
    for (const nombre of Object.keys(interfaces)) {
        for (const red of interfaces[nombre]) {
            if (red.family === 'IPv4' && !red.internal) {
                return red.address;
            }
        }
    }
    return 'localhost';
}

function cabecerasCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function manejarHttp(req, res) {
    const parsed = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const ruta = decodeURIComponent(parsed.pathname);

    cabecerasCors(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Endpoint de información (IP local y estado para la Diapositiva 8)
    if (ruta === '/api/info') {
        const ip = obtenerIpLocal();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            ip: ip,
            port: PORT,
            urlMovil: `http://${ip}:${PORT}/sensor/control.html`,
            urlExpo: `http://${ip}:${PORT}/`
        }));
        return;
    }

    // Endpoint POST de compatibilidad
    if (ruta === '/api/motion' && req.method === 'POST') {
        let cuerpo = '';
        req.on('data', trozo => {
            cuerpo += trozo;
            if (cuerpo.length > 20000) req.destroy();
        });
        req.on('end', () => {
            try {
                const datos = JSON.parse(cuerpo);
                if (typeof datos.v === 'number' && isFinite(datos.v)) {
                    ultimo = {
                        tipo: 'motion',
                        v: Math.max(0, Math.min(5, datos.v)),
                        t: Date.now()
                    };
                    retransmitir(ultimo);
                }
            } catch (e) {}
            res.writeHead(204);
            res.end();
        });
        return;
    }

    // Endpoint SSE de compatibilidad
    if (ruta === '/api/stream') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        res.write(': conectado\n\n');
        sseClientes.add(res);
        req.on('close', () => sseClientes.delete(res));
        return;
    }

    // Servir archivos estáticos
    let relativa = ruta === '/' ? INICIO : ruta;
    const archivo = path.resolve(ROOT, '.' + relativa);

    if (archivo !== ROOT && !archivo.startsWith(ROOT + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 · acceso no permitido');
        return;
    }

    fs.stat(archivo, (error, info) => {
        if (error || !info.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 · archivo no encontrado: ' + relativa);
            return;
        }

        const extension = path.extname(archivo).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[extension] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        fs.createReadStream(archivo).pipe(res);
    });
}

const servidor = http.createServer(manejarHttp);

// Servidor WebSocket montado sobre el servidor HTTP
const wss = new WebSocket.Server({ server: servidor });

function retransmitir(data, origenWs = null) {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);

    // Retransmitir a clientes WebSocket (como la Diapositiva 8)
    wss.clients.forEach(client => {
        if (client !== origenWs && client.readyState === WebSocket.OPEN) {
            try {
                client.send(jsonStr);
            } catch (e) {}
        }
    });

    // Retransmitir a clientes SSE si los hubiera
    if (sseClientes.size > 0) {
        const sseData = 'data: ' + jsonStr + '\n\n';
        for (const cliente of sseClientes) {
            try {
                cliente.write(sseData);
            } catch (e) {
                sseClientes.delete(cliente);
            }
        }
    }
}

wss.on('connection', (ws, req) => {
    // Enviar el último estado conocido al nuevo cliente
    if (ultimo.t > 0) {
        try {
            ws.send(JSON.stringify(ultimo));
        } catch (e) {}
    }

    ws.on('message', (mensaje) => {
        try {
            const data = JSON.parse(mensaje);
            if (data && typeof data.v === 'number') {
                ultimo = {
                    tipo: 'motion',
                    v: Math.max(0, Math.min(5, data.v)),
                    t: Date.now()
                };
                retransmitir(ultimo, ws);
            }
        } catch (e) {}
    });
});

servidor.listen(PORT, '0.0.0.0', () => {
    const ipLocal = obtenerIpLocal();
    console.log('');
    console.log('  ======================================================');
    console.log('  🚀 SERVIDOR NATU · SISMÓGRAFO Y DIAPOSITIVA 8');
    console.log('  ======================================================');
    console.log('');
    console.log('  🖥️  Presentación en PC:');
    console.log(`      http://localhost:${PORT}/`);
    console.log('');
    console.log('  📱  Control Móvil (Abre esto en el navegador del celular):');
    console.log(`      http://${ipLocal}:${PORT}/sensor/control.html`);
    console.log('');
    console.log('  * Nota: Asegúrate de que el celular esté conectado al mismo Wi-Fi.');
    console.log('  ======================================================');
    console.log('');
});
