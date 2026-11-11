# Configurar los correos (EmailJS)

El proyecto es HTML/CSS/JS puro, así que los correos se envían con **EmailJS**, un servicio gratuito que funciona desde el navegador.

Se usan dos plantillas:

1. **Inicio de sesión:** avisa al usuario cuando entra a su cuenta.
2. **Recuperación:** envía un código de 6 dígitos para cambiar la contraseña.

## Pasos

1. Entra a <https://www.emailjs.com/> y crea una cuenta gratis.
2. En **Email Services**, agrega tu servicio de correo (Gmail, Outlook, etc.) y conéctalo.
3. En **Email Templates**, crea la plantilla de **inicio de sesión**:

   - **To Email:** `{{to_email}}`
   - **To Name:** `{{to_name}}`
   - **Subject:** `Nuevo inicio de sesión en NATU`
   - **Body:**

     ```html
     Hola {{to_name}},

     Se inició sesión en tu cuenta de NATU (Simulador de Sismos) el {{login_time}}.

     {{message}}

     Si no fuiste tú, cambia tu contraseña de inmediato.
     ```

4. Crea una segunda plantilla para **recuperación de contraseña**:

   - **To Email:** `{{to_email}}`
   - **To Name:** `{{to_name}}`
   - **Subject:** `Código de recuperación - NATU`
   - **Body:**

     ```html
     Hola {{to_name}},

     Tu código de verificación es:

     {{verification_code}}

     Vence en {{expiry_minutes}} minutos.

     Si no solicitaste este cambio, ignora este correo.
     ```

5. En **Account → General**, copia tu **Public Key**.
6. Abre `script/EmailConfig.js` y reemplaza los cuatro valores:

   ```js
   const EMAILJS_CONFIG = {
       serviceId: 'service_xxxxxxx',
       templateId: 'template_xxxxxxx',
       recoveryTemplateId: 'template_xxxxxxx',
       publicKey: 'xxxxxxxxxxxxxxxxxxxx',
   };
   ```

7. Guarda y prueba:
   - Regístrate con un correo real.
   - Inicia sesión: debe llegar el aviso de inicio de sesión.
   - Ve a “¿Olvidaste tu contraseña?”, escribe el mismo correo y recibirás el código.

## Modo demostración

Mientras EmailJS no esté configurado, la página de recuperación muestra el código en pantalla para que el flujo se pueda probar. Cuando ya envíes correos reales, desactívalo en `script/Recuperar-Contrasena.js`:

```js
const MOSTRAR_CODIGO_SI_FALLA_EL_CORREO = false;
```

## Notas

- No uses la **Private Key** en el frontend: solo se necesitan los *Service ID*, los *Template ID* y la *Public Key*.
- El plan gratuito de EmailJS permite **200 correos al mes**.
- Si el correo no llega, revisa la carpeta de spam y que las plantillas tengan `{{to_email}}` en el campo **To Email**.
- La contraseña se guarda en `localStorage` porque es un proyecto académico; no lo uses en producción real.
- El código de recuperación vence a los **10 minutos** y permite **5 intentos**.
