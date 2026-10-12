import { DatoMeta } from '../foto-perfil.service';

/**
 * Protocolo para mandar la metadata de un celular a otro por Bluetooth LE.
 * Los UUID deben ser IGUALES a los de PerifericoBlePlugin.java (celular B).
 */
export const SERVICIO = 'db27579f-0000-4b1d-9f3a-7c2e5d8a1f60';
/** El celular A escribe aquí: solicitud, pedazos y fin. */
export const CANAL = 'db27579f-0001-4b1d-9f3a-7c2e5d8a1f60';
/** El celular B responde aquí (read + notify). */
export const ESTADO = 'db27579f-0002-4b1d-9f3a-7c2e5d8a1f60';

/** Id de fabricante "de pruebas" donde el celular B anuncia el nombre de la persona. */
export const FABRICANTE_PRUEBAS = 0xffff;

export const MSG = { SOLICITUD: 1, PARTE: 2, FIN: 3 } as const;
export const EST = { ESPERANDO: 0, ACEPTADO: 1, RECHAZADO: 2, RECIBIDO: 3, ERROR: 4 } as const;

/** Lo que viaja de un celular a otro (JSON en UTF-8). */
export interface PaqueteMeta {
  v: 1;
  de: string;
  enviado: string;                 // fecha ISO
  miniatura: string | null;        // data URL pequeñito de la foto
  principales: DatoMeta[];
  todos: { clave: string; valor: string }[];
  gps: { lat: number; lon: number } | null;
}

export function aBytes(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

export function deBytes(dv: DataView): string {
  return new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
}

/** Un mensaje = 1 byte de tipo + el cuerpo. */
export function mensaje(tipo: number, cuerpo: Uint8Array = new Uint8Array(0)): DataView {
  const m = new Uint8Array(cuerpo.length + 1);
  m[0] = tipo;
  m.set(cuerpo, 1);
  return new DataView(m.buffer);
}

/**
 * Cuerpo de la solicitud: 4 bytes con el tamaño total (big-endian) + el nombre en UTF-8.
 * Es binario y corto para que quepa en UNA escritura aunque el MTU sea el mínimo (23).
 */
export function cabeceraSolicitud(de: string, bytes: number, max: number): Uint8Array {
  const nombre = recortarUtf8(de, Math.max(0, max - 4));
  const c = new Uint8Array(4 + nombre.length);
  new DataView(c.buffer).setUint32(0, bytes);
  c.set(nombre, 4);
  return c;
}

/** Corta un texto a N bytes UTF-8 sin partir una letra (ni un emoji) a la mitad. */
export function recortarUtf8(texto: string, max: number): Uint8Array {
  let usados = 0;
  let salida = '';
  for (const letra of texto) {
    const n = aBytes(letra).length;
    if (usados + n > max) break;
    salida += letra;
    usados += n;
  }
  return aBytes(salida);
}

/** Revisa que lo recibido sí sea un paquete válido. */
export function esPaquete(x: any): x is PaqueteMeta {
  return !!x && x.v === 1 && typeof x.de === 'string' && Array.isArray(x.principales) && Array.isArray(x.todos);
}
