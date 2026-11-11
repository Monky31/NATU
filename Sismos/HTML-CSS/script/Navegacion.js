/* Navegación común: volver, inicio y cerrar sesión */

(function () {
    const PAGINA_INICIO = 'Sismos.html';

    function volverAtras() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = PAGINA_INICIO;
        }
    }

    function cerrarSesion() {
        localStorage.removeItem('isLoggedIn');
        window.location.href = PAGINA_INICIO;
    }

    function agregarBotonCerrarSesion() {
        if (localStorage.getItem('isLoggedIn') !== 'true') return;

        document.querySelectorAll('[data-nav-autologout]').forEach((lugar) => {
            if (lugar.querySelector('[data-nav="logout"]')) return;

            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'nav-btn nav-btn-danger';
            boton.dataset.nav = 'logout';
            boton.textContent = 'Cerrar sesión';

            lugar.appendChild(boton);
        });
    }

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;

        const boton = event.target.closest('[data-nav]');
        if (!boton) return;

        if (boton.dataset.nav === 'back') {
            event.preventDefault();
            volverAtras();
        } else if (boton.dataset.nav === 'logout') {
            event.preventDefault();
            cerrarSesion();
        }
    });

    agregarBotonCerrarSesion();
})();
