/* Flujo de recuperación de contraseña:
   1. El usuario escribe el correo con el que se registró.
   2. Se genera un código de 6 dígitos y se envía por EmailJS.
   3. El usuario ingresa el código y define una nueva contraseña.
   4. La contraseña se actualiza en localStorage. */

const CLAVE_RECUPERACION = 'recuperacionPassword';
const MINUTOS_EXPIRACION = 10;
const MAX_INTENTOS = 5;

/* Si EmailJS aún no está configurado, el código se muestra en pantalla para
   que el flujo se pueda probar. Cámbialo a false cuando ya envíes correos. */
const MOSTRAR_CODIGO_SI_FALLA_EL_CORREO = true;

const emailForm = document.getElementById('emailForm');
const resetForm = document.getElementById('resetForm');
const responseMessage = document.getElementById('responseMessage');
const resetIntro = document.getElementById('resetIntro');
const resendBtn = document.getElementById('resendBtn');
const changeEmailBtn = document.getElementById('changeEmailBtn');

function mostrarMensaje(tipo, texto) {
    responseMessage.className = `notification is-${tipo}`;
    responseMessage.textContent = texto;
    responseMessage.style.display = 'block';
}

function ocultarMensaje() {
    responseMessage.style.display = 'none';
    responseMessage.textContent = '';
}

function generarCodigo() {
    if (window.crypto && window.crypto.getRandomValues) {
        const valores = new Uint32Array(1);
        window.crypto.getRandomValues(valores);
        return String(valores[0] % 1000000).padStart(6, '0');
    }

    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

function guardarRecuperacion(email, codigo) {
    localStorage.setItem(
        CLAVE_RECUPERACION,
        JSON.stringify({
            email,
            codigo,
            intentos: 0,
            expira: Date.now() + MINUTOS_EXPIRACION * 60 * 1000,
        })
    );
}

function obtenerRecuperacion() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_RECUPERACION));
    } catch {
        return null;
    }
}

function mostrarPaso2(email) {
    emailForm.hidden = true;
    resetForm.hidden = false;
    resetIntro.textContent = `Escribe el código de 6 dígitos enviado a ${email}.`;
    document.getElementById('code').focus();
}

function mostrarPaso1() {
    resetForm.hidden = true;
    emailForm.hidden = false;
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('code').value = '';
    document.getElementById('email').focus();
}

async function solicitarCodigo(email, userData) {
    const codigo = generarCodigo();
    guardarRecuperacion(email, codigo);

    const resultado = await enviarCodigoRecuperacion(userData, codigo, MINUTOS_EXPIRACION);

    if (resultado.ok) {
        mostrarMensaje(
            'is-success',
            `Enviamos un código de verificación a ${email}. Revisa también la carpeta de spam.`
        );
    } else if (resultado.reason === 'no-configurado') {
        mostrarMensaje(
            'is-warning',
            `EmailJS aún no está configurado. Código de demostración: ${codigo}`
        );
    } else if (MOSTRAR_CODIGO_SI_FALLA_EL_CORREO) {
        mostrarMensaje(
            'is-warning',
            `No se pudo enviar el correo. Código de demostración: ${codigo}`
        );
    } else {
        mostrarMensaje(
            'is-danger',
            'No se pudo enviar el correo de verificación. Intenta de nuevo más tarde.'
        );
    }

    mostrarPaso2(email);
}

emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje();

    const email = document.getElementById('email').value.trim().toLowerCase();
    const guardado = localStorage.getItem('userData');

    if (!guardado) {
        mostrarMensaje(
            'is-danger',
            'No hay ningún usuario registrado. Primero crea una cuenta.'
        );
        return;
    }

    let userData;
    try {
        userData = JSON.parse(guardado);
    } catch {
        mostrarMensaje('is-danger', 'Los datos del usuario están dañados. Regístrate de nuevo.');
        return;
    }

    if (!userData.email) {
        mostrarMensaje(
            'is-danger',
            'Tu cuenta no tiene un correo registrado. Regístrate de nuevo con un correo válido.'
        );
        return;
    }

    if (email !== userData.email.trim().toLowerCase()) {
        mostrarMensaje(
            'is-danger',
            'Ese correo no coincide con el correo de la cuenta registrada.'
        );
        return;
    }

    const boton = emailForm.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Enviando código...';
    mostrarMensaje('is-info', 'Enviando código de verificación...');

    await solicitarCodigo(email, userData);

    boton.disabled = false;
    boton.textContent = 'Enviar código de verificación';
});

resetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    ocultarMensaje();

    const recuperacion = obtenerRecuperacion();

    if (!recuperacion) {
        mostrarMensaje('is-danger', 'Primero solicita un código de verificación.');
        mostrarPaso1();
        return;
    }

    if (Date.now() > recuperacion.expira) {
        localStorage.removeItem(CLAVE_RECUPERACION);
        mostrarMensaje('is-danger', 'El código expiró. Solicita uno nuevo.');
        mostrarPaso1();
        return;
    }

    const codigoIngresado = document.getElementById('code').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!/^\d{6}$/.test(codigoIngresado)) {
        mostrarMensaje('is-danger', 'El código debe tener exactamente 6 dígitos.');
        return;
    }

    if (codigoIngresado !== recuperacion.codigo) {
        recuperacion.intentos += 1;

        if (recuperacion.intentos >= MAX_INTENTOS) {
            localStorage.removeItem(CLAVE_RECUPERACION);
            mostrarMensaje(
                'is-danger',
                'Superaste el número de intentos. Solicita un código nuevo.'
            );
            mostrarPaso1();
            return;
        }

        localStorage.setItem(CLAVE_RECUPERACION, JSON.stringify(recuperacion));
        mostrarMensaje(
            'is-danger',
            `Código incorrecto. Te quedan ${MAX_INTENTOS - recuperacion.intentos} intentos.`
        );
        return;
    }

    if (password.length < 6) {
        mostrarMensaje('is-danger', 'La nueva contraseña debe tener al menos 6 caracteres.');
        return;
    }

    if (password !== confirmPassword) {
        mostrarMensaje('is-danger', 'Las contraseñas no coinciden.');
        return;
    }

    const guardado = localStorage.getItem('userData');
    if (!guardado) {
        mostrarMensaje('is-danger', 'No se encontró la cuenta registrada.');
        return;
    }

    let userData;
    try {
        userData = JSON.parse(guardado);
    } catch {
        mostrarMensaje('is-danger', 'Los datos del usuario están dañados. Regístrate de nuevo.');
        return;
    }

    userData.password = password;
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.removeItem(CLAVE_RECUPERACION);

    mostrarMensaje(
        'is-success',
        '✅ Contraseña actualizada correctamente. Serás llevado al inicio de sesión.'
    );

    setTimeout(() => {
        window.location.href = 'Iniciar-Sesion.html';
    }, 1800);
});

resendBtn.addEventListener('click', async () => {
    ocultarMensaje();
    const recuperacion = obtenerRecuperacion();

    if (!recuperacion) {
        mostrarMensaje('is-danger', 'Primero escribe tu correo y solicita un código.');
        mostrarPaso1();
        return;
    }

    const guardado = localStorage.getItem('userData');
    if (!guardado) {
        mostrarMensaje('is-danger', 'No se encontró la cuenta registrada.');
        return;
    }

    let userData;
    try {
        userData = JSON.parse(guardado);
    } catch {
        mostrarMensaje('is-danger', 'Los datos del usuario están dañados. Regístrate de nuevo.');
        return;
    }

    resendBtn.disabled = true;
    await solicitarCodigo(recuperacion.email, userData);
    resendBtn.disabled = false;
});

changeEmailBtn.addEventListener('click', () => {
    localStorage.removeItem(CLAVE_RECUPERACION);
    ocultarMensaje();
    mostrarPaso1();
});
