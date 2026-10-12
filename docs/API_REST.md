# API REST de FitHábitos — hábitos

La app Ionic se conecta a una API REST en PHP + MySQL (XAMPP) para administrar los hábitos del usuario.

## Endpoints

Base: `http://<IP>:8080/fithabitos_api/v1/index.php`
(la IP sale de la pantalla **Origen de datos**; en el emulador es `10.0.2.2`)

| Método | Ruta | Qué hace | Respuesta OK |
|---|---|---|---|
| GET | `/habitos` | Lista los hábitos del usuario | 200 + arreglo |
| GET | `/habitos/{id}` | Un hábito | 200 |
| POST | `/habitos` | Crea un hábito | **201** + hábito con su `id` |
| PUT | `/habitos/{id}` | Reemplaza el hábito completo | 200 |
| PATCH | `/habitos/{id}` | Cambia solo los campos enviados (ej. `{ "activo": false }`) | 200 |
| DELETE | `/habitos/{id}` | Elimina el hábito | 200 |

Cabeceras que manda la app: `Accept: application/json`, `Content-Type: application/json` y `X-Usuario-Id` (usuario con sesión iniciada).

Todas las respuestas usan el mismo sobre:

```json
{ "ok": true,  "data": { "id": 3, "nombre": "Tomar agua", "categoria": "hidratacion", "metaDiaria": 8, "unidad": "vasos", "icono": "water-outline", "color": "#3a86ff", "activo": true } }
{ "ok": false, "error": "La meta diaria debe ser un número entre 1 y 10000." }
```

### Códigos de error

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos o JSON mal formado |
| 401 | Falta la cabecera `X-Usuario-Id` |
| 404 | El hábito no existe (o es de otro usuario) |
| 405 | Método no permitido |
| 500 | Error de MySQL (ej. no se importó `fh_habitos.sql`) |
| 0 (app) | El servidor no respondió: XAMPP apagado, IP incorrecta o firewall |

## Cómo está hecho en Angular

```
HabitosPage  ──>  FitHabitosApiService (HttpClient)  ──>  interceptores  ──>  API PHP  ──>  MySQL
```

- **`services/fithabitos-api.service.ts`**: servicio Angular con un método por endpoint (`listarHabitos`, `obtenerHabito`, `crearHabito`, `editarHabito`, `actualizarHabitoParcial`, `eliminarHabito`). Abre el sobre `{ ok, data, error }`, reintenta los GET si falla la red o el servidor (1 s y luego 2 s) y traduce los errores a mensajes en español.
- **`services/auth.interceptor.ts`**: agrega el token si existe y manda al login si la API responde 401.
- **`services/loading.interceptor.ts` + `loading.service.ts`**: muestran un `ion-loading` durante cada petición, con un texto según la acción ("Guardando hábito…", "Eliminando hábito…"). Si salen varias peticiones a la vez se muestra uno solo.
- **`services/api.interceptor.ts`**: arma la URL con la IP guardada, agrega las cabeceras, corta la petición a los 10 s y guarda el registro (cabeceras, payload, estado HTTP y respuesta) para la modal de error.
- **`habitos/habitos.page.ts`**: pantalla con la lista y las acciones. Avisa de cada respuesta con un toast y de cada error con un toast rojo con el botón **Ver detalle**. Si la lista no carga, muestra una tarjeta de error con **Reintentar**.

## Instalación de la API

1. Copia la carpeta `fithabitos_api` a `C:\xampp\htdocs\`.
2. En phpMyAdmin, dentro de `tab1_db`, importa `fithabitos_api/fh_habitos.sql`.
3. Prueba en el navegador de la PC: `http://localhost:8080/fithabitos_api/v1/index.php/habitos`. Debe responder `{"ok":false,"error":"Falta la cabecera X-Usuario-Id..."}`. Eso confirma que la API está viva, porque el navegador no manda esa cabecera.
