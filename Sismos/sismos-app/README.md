# sismos-app

Frontend del proyecto **NATU (ABP Sismos)** hecho con **Angular 22**.

## Ejecutar

```bash
npm install
npm start
```

Abre `http://localhost:4200` en el navegador.

## Ver los usuarios y contraseñas guardados

Los datos se guardan en el **localStorage** del navegador (no hay servidor).
Tienes tres formas de verlos:

1. **Dentro de la app:** entra a `http://localhost:4200/datos`.
2. **DevTools:** presiona `F12` → pestaña *Application* → *Local Storage* →
   `http://localhost:4200` → clave `usuarios`.
3. **Consola (F12 → Console):**

```js
JSON.parse(localStorage.getItem('usuarios'))
```

Toda la documentación detallada está en [**GUIA.md**](./GUIA.md).
