# Pura Gracia Radio — Preview API

Este directorio se despliega como un proyecto Vercel independiente. No forma parte del servicio de producción `pg-radio-webhook`.

## Configuración de Vercel

Importar el repositorio `arios71/puragracia-radio-preview` como un proyecto nuevo y configurar **Root Directory** como:

`vercel-preview-api`

Añadir estas variables de entorno en Vercel (Production y Preview, si se usarán ambos entornos):

- `RADIOBOSS_API_URL`: `https://c23.radioboss.fm/api/info/296`
- `RADIOBOSS_API_KEY`: la clave privada de la API de RadioBOSS. No incluirla en el repositorio ni compartirla públicamente.

Después de desplegar, la función estará disponible en:

`/api/radioboss-nowplaying`

CORS permite el origen de GitHub Pages `https://arios71.github.io` y responde a las solicitudes OPTIONS de preflight.

## Seguridad

La clave se añade únicamente como variable de entorno privada de Vercel. La función no devuelve la clave ni la registra.
