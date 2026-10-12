/**
 * Modelos de intercambio con la API REST de FitHábitos.
 * Coinciden 1 a 1 con el "Modelo JSON de intercambio" del documento.
 */

/** Sobre común de todas las respuestas de la API. */
export interface ApiResp<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type Objetivo = 'bienestar' | 'bajar_peso' | 'ganar_musculo' | 'resistencia';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  pesoKg?: number;
  alturaCm?: number;
  objetivo?: Objetivo;
  metaDiariaHabitos?: number;
  creadoEn?: string;
}

export interface Habito {
  id: number;
  nombre: string;
  descripcion?: string;
  categoria: 'hidratacion' | 'ejercicio' | 'alimentacion' | 'mental' | 'sueno';
  metaDiaria: number;
  unidad: string;
  icono: string;
  color: string;
  activo: boolean;
  /** Fecha de la última modificación (la pone el servidor). */
  actualizado?: string;
}

/** Lo que se manda al crear o editar un hábito (sin id). */
export type HabitoNuevo = Omit<Habito, 'id' | 'actualizado'>;

export interface Ejercicio {
  nombre: string;
  series: number;
  repeticiones: number;
  pesoKg?: number;
  hecho: boolean;
}

export interface Diario {
  texto: string;
  animo: string;
}

export type TipoRegistro = 'habitos' | 'entreno' | 'diario';

/** Contenido de un registro según su tipo. */
export interface ContenidoPorTipo {
  habitos: Record<string, boolean>; // { "12": true, "13": false }
  entreno: Ejercicio[];
  diario: Diario;
}

export interface RegistroDia<K extends TipoRegistro = TipoRegistro> {
  fecha: string; // AAAA-MM-DD
  tipo: K;
  contenido: ContenidoPorTipo[K];
  actualizado: number; // milisegundos
}

export interface LoginResp {
  token: string;
  expira: string; // ISO 8601
  usuario: Usuario;
}

export interface RegistroCuenta {
  nombre: string;
  email: string;
  password: string;
}

export interface SyncPeticion {
  desde: number;
  registros: RegistroDia[];
}

export interface SyncResp {
  ahora: number;
  registros: RegistroDia[];
}

/** Error ya traducido para mostrarlo en un toast. */
export interface ErrorApi {
  status: number; // 0 = sin conexión
  mensaje: string;
}
