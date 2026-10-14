# WAESTUDIO

**Sistema inteligente de reservas para barberías | Aplicación web progresiva (PWA)**

> **Reserva tu cita en segundos. Sin complicaciones.**

**Aplicación:** [waestudio.netlify.app](https://waestudio.netlify.app)  
**Repositorio:** [github.com/Raphelofwar/waestudio](https://github.com/Raphelofwar/waestudio)  
**Creación y desarrollo:** [Raphelofwar](https://github.com/Raphelofwar)  
**Estado:** versión funcional, con pruebas realizadas en Netlify · Octubre de 2026

---

## ¿Qué es WAESTUDIO?

**WAESTUDIO** es una aplicación web de reservas diseñada para que los clientes de una barbería consulten horarios disponibles, elijan su servicio, informen cómo pagarán y obtengan un comprobante de su cita desde el teléfono.

El proyecto prioriza una experiencia **mobile-first**, rápida, clara y visualmente cuidada. Puede utilizarse en el navegador o instalarse en la pantalla de inicio como una PWA.

Su objetivo es resolver la **gestión de citas**, no sustituir un sistema administrativo o de contabilidad. Google Calendar es el calendario de referencia para la disponibilidad y el registro de reservas.

## Funcionalidades principales

### Agenda y reservas

- Consulta de disponibilidad real mediante **Google Calendar API**.
- Visualización de horarios disponibles para la fecha seleccionada.
- Bloqueo de franjas ocupadas y exclusión de horarios que ya pasaron.
- Validación de la duración del servicio y del horario de atención.
- Registro de la cita en Google Calendar con identificación de reserva.
- Liberación del horario cuando se elimina la cita del calendario.
- Comprobaciones de disponibilidad y mecanismo de bloqueo temporal para reducir el riesgo de reservas simultáneas o superpuestas.
- Mensajes de error cuando un horario deja de estar disponible.

### Servicios

| Servicio | Precio base | Duración | Disponibilidad |
| --- | ---: | ---: | --- |
| **Corte Esencial** | **USD 7** | **45 minutos** | Disponible |
| **Experiencia Premium** | **USD 10** | **75 minutos** | Próximamente |

*Experiencia Premium se muestra en el catálogo, pero actualmente está bloqueada tanto en la interfaz como en la API.*

### Métodos de pago

- **Pago Móvil:** muestra la información necesaria para pagar, calcula el equivalente en bolívares y solicita los datos de la operación y el comprobante correspondiente.
- **Efectivo:** permite indicar pago en dólares estadounidenses (USD) o bolívares (VES) directamente en el establecimiento.
- **Transferencia bancaria:** opción identificada como **Próximamente** y actualmente deshabilitada.

**Importante:** WAESTUDIO registra la modalidad de pago informada, pero **no valida transferencias, no comprueba automáticamente la recepción del dinero y no aprueba pagos**. Esa verificación corresponde al responsable del negocio.

### Tasa de cambio BCV

- Conversión de precios base en USD a su equivalente en VES.
- Consulta automática de la tasa BCV publicada por proveedores externos, entre ellos **DolarVZLA** y **bcv.today**.
- Actualización de la cotización en el proceso de pago, con comprobación antes de confirmar la reserva.
- Indicación de la tasa y de su fecha de vigencia cuando están disponibles.

### Comprobante digital

WAESTUDIO genera un comprobante visual en formato **PNG**, con identidad gráfica propia y los datos de la cita: código, cliente, contacto, servicio, fecha, hora, precio y forma de pago; cuando corresponde, también incluye la información reportada del Pago Móvil.

La pantalla final ofrece dos acciones:

1. **Descargar comprobante.**
2. **Enviar al barbero por WhatsApp.**

El envío se efectúa mediante la función de compartir del dispositivo. **No es un envío automático ni depende de WhatsApp Business API.**

### Aplicación instalable (PWA)

- Manifest de aplicación con nombre, iconos e identidad WAESTUDIO.
- Instalación desde navegadores compatibles, sin publicación obligatoria en una tienda de aplicaciones.
- Visualización independiente (*standalone*) al abrirla desde el acceso instalado.
- Service Worker con una estrategia de caché diseñada para evitar mostrar versiones antiguas de páginas y archivos de Next.js.

## Horarios configurados

| Parámetro | Configuración actual |
| --- | --- |
| Atención | Lunes a sábado |
| Apertura | 9:00 a. m. |
| Cierre | 6:00 p. m. |
| Domingo | Cerrado |
| Zona horaria | `America/Caracas` |

Los horarios ofrecidos dependen de las franjas admitidas, la duración del servicio, la hora actual y los eventos ocupados de Google Calendar. No se muestran todos los minutos del día como horarios reservables.

## Experiencia y diseño

La interfaz utiliza un lenguaje visual minimalista, enfocado en pantallas móviles.

| Uso | Color |
| --- | --- |
| Negro principal | `#090909` |
| Blanco cálido | `#f5f1e8` |
| Dorado | `#c5a66d` |

El recorrido de reserva está organizado en pasos, con prioridad en la claridad de la información y en la facilidad de uso desde el teléfono.

## Tecnologías utilizadas

| Tecnología | Aplicación en el proyecto |
| --- | --- |
| **Next.js 16** | Interfaz, rutas y API del servidor |
| **React 19** | Componentes y experiencia interactiva |
| **TypeScript** | Tipado y mantenimiento del código |
| **Tailwind CSS 4** | Estilos y diseño adaptable |
| **Material UI** | Componentes visuales e iconografía |
| **Google Calendar API** | Disponibilidad y registro de citas |
| **Google OAuth 2.0** | Autorización de acceso al calendario |
| **Netlify** | Alojamiento de la versión publicada |
| **Git y GitHub** | Control de versiones |
| **PWA / Service Worker** | Instalación y gestión de recursos |

**Persistencia de citas:** Google Calendar. **WAESTUDIO no utiliza Supabase ni una base de datos propia para almacenar las reservas.**

## Estructura principal

| Ruta | Responsabilidad |
| --- | --- |
| `app/page.tsx` | Interfaz principal y flujo de reserva |
| `app/api/availability/route.ts` | Disponibilidad y franjas reservables |
| `app/api/bookings/route.ts` | Validación y creación de reservas |
| `app/api/bcv/route.ts` | Consulta de la tasa BCV |
| `app/api/auth/google/` | Inicio de autorización con Google |
| `app/api/auth/google/callback/` | Retorno del proceso OAuth |
| `app/BookingTicket.tsx` | Comprobante de la reserva |
| `app/ServiceWorkerRegister.tsx` | Registro del Service Worker |
| `app/manifest.ts` | Configuración de la PWA |
| `public/sw.js` | Service Worker |
| `app/privacidad/` | Página de privacidad |

## Instalación para desarrollo

**Requisitos:** Node.js compatible con Next.js 16, npm y una configuración autorizada de Google Calendar.

En una terminal **CMD**:

1. Clonar el repositorio: `git clone https://github.com/Raphelofwar/waestudio.git`
2. Entrar en la carpeta: `cd waestudio`
3. Instalar dependencias: `npm ci`
4. Configurar de forma privada las variables de entorno necesarias.
5. Iniciar el entorno local: `npm run dev`
6. Abrir `http://localhost:3000`.

Para comprobar la compilación de producción: `npm run build`.

**La aplicación necesita credenciales válidas y autorización de Google Calendar para consultar disponibilidad y crear reservas.** Clonar el código por sí solo no habilita esa conexión.

## Variables de entorno

| Variable | Finalidad |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Identificador OAuth de Google |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth |
| `GOOGLE_REDIRECT_URI` | URI de retorno autorizada para OAuth |
| `GOOGLE_REFRESH_TOKEN` | Token que permite renovar la autorización |
| `GOOGLE_CALENDAR_ID` | Calendario que utiliza WAESTUDIO; si se omite, el servidor usa `primary` |

Las variables se configuran en el entorno local o en el administrador de variables del alojamiento, **nunca directamente en el repositorio público**. No publiques archivos `.env.local`, claves, tokens de actualización, capturas con secretos ni credenciales de clientes.

## Despliegue

**Sitio publicado:** [https://waestudio.netlify.app](https://waestudio.netlify.app)

La versión de pruebas y correcciones utilizada en Netlify está vinculada a la rama **`netlify-fix-locks`**. La rama **`main`** se ha conservado separada durante el proceso de migración; Vercel se utilizó previamente como entorno de despliegue y pruebas.

Los dos alojamientos no deben considerarse intercambiables sin comprobar sus respectivas versiones, variables de entorno y mecanismos de reserva. Para uso comercial, deben respetarse las condiciones y límites del proveedor de alojamiento contratado.

## Alcance y seguridad

- Las reservas y los datos asociados a ellas se gestionan mediante el calendario autorizado.
- El servidor valida servicio, fecha, hora, datos del cliente y modalidad de pago.
- El sistema verifica la disponibilidad antes de intentar registrar una cita.
- Las credenciales de Google deben permanecer del lado del servidor.
- Se aplican límites de tamaño y validaciones a los datos recibidos en la API de reservas.
- Existe una página de información de privacidad en `/privacidad`.
- **No incluye** panel administrativo, contabilidad, inventario, verificación bancaria automática ni pasarela de cobro.

Las comprobaciones de reservas simultáneas se realizaron sobre casos reales de prueba. Como en cualquier sistema conectado a servicios externos, deben mantenerse las pruebas y el monitoreo al cambiar el código o la infraestructura.

## Pruebas realizadas

Durante el despliegue en Netlify se verificaron:

- Acceso desde navegador y disponibilidad de instalación PWA.
- Consulta de horas libres y exclusión de horas ocupadas.
- Registro de una cita en Google Calendar.
- Liberación del horario después de eliminar la cita.
- Nueva reserva del mismo horario liberado.
- Rechazo de una segunda reserva concurrente en una prueba controlada.
- Consulta de tasa BCV y cálculo correspondiente.
- Generación y descarga del comprobante PNG.
- Compartir el comprobante mediante WhatsApp.
- Compilación de Next.js y publicación del proyecto.

Estos resultados describen las **pruebas realizadas**, no una garantía absoluta ante todos los escenarios posibles.

## Evolución prevista

La base de WAESTUDIO puede adaptarse en el futuro a otras barberías con identidad, servicios, tarifas, horarios, WhatsApp y calendario propios. Esa reutilización requiere aislar las configuraciones y credenciales de cada instalación.

Antes de la entrega definitiva al propietario del negocio, debe autorizarse su propia cuenta de Google Calendar y comprobarse la conexión sin depender de una cuenta personal del desarrollador.

## Autoría y derechos

**WAESTUDIO fue creado y desarrollado por [Raphelofwar](https://github.com/Raphelofwar).**

**© 2026 Raphelofwar. Todos los derechos reservados**, sin perjuicio de las licencias aplicables a las bibliotecas y otros componentes de terceros.

Este repositorio no incorpora una licencia abierta que conceda, por sí sola, permisos generales para copiar, redistribuir o comercializar el proyecto. La disponibilidad pública del código en GitHub no equivale a una autorización de explotación comercial por terceros.

---

**WAESTUDIO — Reserva tu cita en segundos. Sin complicaciones.**