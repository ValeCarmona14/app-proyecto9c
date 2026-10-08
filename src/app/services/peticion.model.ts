/** Datos de conexión que se guardan en el JSON de "Origen de datos". */
export interface Conexion {
  /** http o https */
  protocolo: 'http' | 'https';
  /** IP o nombre del servidor. Emulador: 10.0.2.2. Celular: la IP de tu PC. */
  ip: string;
  /** Puerto de Apache en XAMPP, donde viven las APIs en PHP. */
  puertoApi: number;
  /** Puerto de MySQL en XAMPP. Es informativo: la app no se conecta directo a MySQL. */
  puertoBd: number;
}

/** Todo lo que se sabe de una petición a la API: lo que se mandó y lo que regresó. */
export interface RegistroPeticion {
  fecha: string;                                  // ISO, ej. 2026-09-30T18:20:00.000Z
  metodo: string;                                 // GET, POST, ...
  url: string;                                    // URL completa
  destino: Conexion;                              // protocolo, IP, puertos usados
  cabecerasEnviadas: Record<string, string>;
  payload: any;                                   // cuerpo enviado (contraseñas ocultas)
  exito: boolean;                                 // true si el servidor respondió 2xx
  estadoHttp: number | null;                      // null = no hubo respuesta
  mensaje: string;                                // explicación del resultado
  cabecerasRespuesta: Record<string, string> | null;
  respuesta: any;                                 // cuerpo que regresó el servidor
  duracionMs: number;
}

/** El JSON completo que se guarda en el teléfono. */
export interface OrigenDatos {
  conexion: Conexion;
  ultimaPeticion: RegistroPeticion | null;
}

/** Error que lanza HttpService: trae el registro completo de la petición. */
export class PeticionError extends Error {
  constructor(public registro: RegistroPeticion) {
    super(registro.mensaje);
    this.name = 'PeticionError';
  }
}
