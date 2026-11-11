document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    const savedUserData = localStorage.getItem('userData');

    if (!savedUserData) {
        alert('No hay usuarios registrados. Por favor, regístrate primero.');
        window.location.href = 'Registro.html';
        return;
    }

    const userData = JSON.parse(savedUserData);

    if (username !== userData.username || password !== userData.password) {
        alert('Usuario o contraseña incorrectos. Por favor, intenta de nuevo.');
        return;
    }

    localStorage.setItem('isLoggedIn', 'true');

    const boton = e.submitter;
    if (boton) {
        boton.disabled = true;
        boton.textContent = 'Enviando aviso...';
    }

    const resultado = await enviarNotificacionLogin(userData);

    let mensaje = 'Inicio de sesión iniciado. ¡Bienvenido de nuevo!';

    if (resultado.ok) {
        mensaje += `\n\n📧 Enviamos una notificación a ${userData.email}.`;
    } else if (resultado.reason === 'sin-correo') {
        mensaje += '\n\n⚠️ Tu cuenta no tiene un correo registrado, así que no se pudo enviar el aviso.';
    } else if (resultado.reason === 'no-configurado') {
        mensaje += '\n\n⚠️ El envío de correos aún no está configurado (script/EmailConfig.js).';
    } else {
        mensaje += '\n\n⚠️ No se pudo enviar el correo de notificación. Revisa la configuración de EmailJS.';
    }

    alert(mensaje);
    window.location.href = 'Mapa.html';
});
