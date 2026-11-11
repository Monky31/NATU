document.getElementById('registroForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!username || !email || !password) {
        alert('Por favor, completa todos los campos.');
        return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
        alert('Por favor, escribe un correo electrónico válido (ejemplo: nombre@gmail.com).');
        return;
    }

    const userData = {
        username: username,
        email: email,
        password: password
    };

    localStorage.setItem('userData', JSON.stringify(userData));

    alert('Registro iniciado. Serás llevado al inicio de sesión.');
    window.location.href = 'Iniciar-Sesion.html';
});
