# 🌿 NATU — Frontend en Angular

Frontend del proyecto **ABP Sismos** migrado de HTML/CSS/JS puro a **Angular 22**.

## ▶️ Cómo ejecutarlo

```bash
cd sismos-app
npm install      # solo la primera vez
npm start        # abre http://localhost:4200
```

## 📄 Páginas (rutas)

| Ruta                | Página                                            |
| ------------------- | ------------------------------------------------- |
| `/`                 | Inicio (antes `Sismos.html`)                      |
| `/registro`        | Registro (antes `Registro.html`)                  |
| `/iniciar-sesion`  | Iniciar sesión (antes `Iniciar-Sesion.html`)      |
| `/olvida-contrasena` | Recuperar contraseña (antes `Olvida-Contraseña.html`) |
| `/mapa`            | Simulador de sismos con Leaflet (antes `Mapa.html`) |
| `/noticias`        | Sismos y noticias en tiempo real (antes `Noticias.html`) |
| `/informacion`     | Guía educativa (antes `Informacion.html`)         |
| `/seguridad`       | Términos y condiciones (antes `Seguridad.html`)   |
| `/datos`           | **NUEVO: panel para ver los usuarios y contraseñas guardados** |

## 🗄️ Dónde están los datos (la "base de datos")

Esta aplicación **no usa un servidor ni una base de datos real** (igual que la
versión original en HTML). Guarda la información en el **localStorage del
navegador**, que funciona como una pequeña base de datos local:

| Clave                   | Qué contiene                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| `usuarios`              | Lista de usuarios registrados (usuario, correo, contraseña y fecha) |
| `userData`              | Usuario único de la versión anterior en HTML (se migra automáticamente) |
| `isLoggedIn`            | `"true"` cuando hay sesión iniciada                               |
| `recuperacionPassword` | Código temporal para recuperar la contraseña                      |

> 🆕 A diferencia de la versión HTML (que solo guardaba **un** usuario y lo
> sobrescribía), ahora se guarda una **lista** de usuarios y se evitan
> registros duplicados.

## 🔍 Cómo ver los datos guardados (usuario y contraseña)

### Opción 1 — Dentro de la aplicación (la más fácil)

Inicia el servidor, regístrate y entra a **`http://localhost:4200/datos`**.
Ahí puedes:

- Ver la tabla de **usuarios registrados** con su **correo** y **contraseña**
  (botón 👁️ para mostrar/ocultar).
- Ver el **contenido crudo del localStorage** (todas las claves en JSON).
- Eliminar usuarios o borrar todo.

### Opción 2 — Con las herramientas del navegador (DevTools)

1. Abre la app en Chrome/Edge y presiona **F12** (o clic derecho → *Inspeccionar*).
2. Ve a la pestaña **Application** (en algunas versiones en español: *Aplicación*).
3. En el menú lateral: **Storage → Local Storage → http://localhost:4200**.
4. Haz clic en la fila `usuarios`: en la columna *Value* aparece el JSON con
   cada usuario y su contraseña.

### Opción 3 — Por consola

Abre la pestaña **Console** (F12) y escribe:

```js
// Usuarios registrados en formato legible
JSON.parse(localStorage.getItem('usuarios'))

// La clave de la versión anterior en HTML
localStorage.getItem('userData')

// ¿Hay sesión iniciada?
localStorage.getItem('isLoggedIn')

// Ver todo lo guardado
localStorage

// Borrar todo
localStorage.clear()
```

> ⚠️ **Importante (educativo):** guardar contraseñas en texto plano en el
> navegador no es seguro. En un sistema real las contraseñas se **cifran en un
> servidor** (con hash + salt) y jamás se pueden recuperar; por eso ninguna web
> seria te puede "mostrar" tu contraseña.

## 📧 Configurar los correos (EmailJS)

El aviso de inicio de sesión y el código de recuperación se envían con
[EmailJS](https://www.emailjs.com/). Edita
`src/app/services/email-config.ts` y reemplaza `TU_SERVICE_ID`,
`TU_TEMPLATE_ID`, `TU_RECOVERY_TEMPLATE_ID` y `TU_PUBLIC_KEY` siguiendo los
pasos comentados en ese mismo archivo.

Mientras no esté configurado, la app funciona igual: en la recuperación de
contraseña el código de 6 dígitos se **muestra en pantalla** como código de
demostración.

## 🗂️ Estructura del proyecto

```
src/app/
├── components/natu-header/     Encabezado compartido (logo, Volver, Cerrar sesión)
├── models/usuario.ts            Interfaz Usuario y tipos
├── pages/
│   ├── inicio/                  Página principal
│   ├── registro/                Registro de usuarios
│   ├── login/                   Inicio de sesión
│   ├── recuperar/               Olvidé mi contraseña (2 pasos)
│   ├── mapa/                    Simulador de sismos (Leaflet)
│   ├── noticias/                USGS + Google Noticias (HttpClient)
│   ├── informacion/             Guía educativa
│   ├── seguridad/               Términos y condiciones
│   └── datos/                   Panel de datos guardados (localStorage)
├── services/
│   ├── auth.service.ts          Registro, login, sesión, recuperación
│   ├── email.service.ts         Envío de correos con EmailJS
│   └── email-config.ts          Configuración de EmailJS
├── app.routes.ts                Rutas de la aplicación
└── app.config.ts                Proveedores globales (router, HttpClient)
```

## 🧱 Cambios respecto a la versión en HTML

- Cada página HTML pasó a ser un **componente Angular** con su ruta.
- Los scripts (`Registro.js`, `Iniciar-Sesion.js`, `Navegacion.js`,
  `Recuperar-Contrasena.js`, `Mapalnit.js`, `Noticias.js`, `EmailConfig.js`)
  se convirtieron en **servicios y componentes TypeScript**.
- Los `alert()` se reemplazaron por mensajes en pantalla (notificaciones Bulma).
- Leaflet y EmailJS ahora se instalan con **npm** en lugar de CDN.
- Los estilos originales (`Sismos1.css`, `Navegacion.css`, `SMapa.css`,
  `Informacion.css`, `Noticias.css`) se conservan en `src/styles/`.
- La imagen de fondo (`Sismos.jpg`) vive en `public/`.
