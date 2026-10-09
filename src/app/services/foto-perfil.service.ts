import { Injectable } from '@angular/core';
import { Camera, MediaResult, MediaTypeSelection } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { parse } from 'exifr';

/** Un dato de la metadata listo para mostrarse. */
export interface DatoMeta {
  etiqueta: string;
  valor: string;
  icono: string;
}

/** Foto elegida: los bytes ORIGINALES (con su EXIF) y lo que se sabe de ella. */
export interface FotoPerfil {
  bytes: Uint8Array;
  formato: string;         // jpeg, png, heic...
  dataUrl: string;         // para el <img>
  ancho: number;
  alto: number;
  /** Lo que leyó exifr, en crudo (todos los campos). */
  exif: Record<string, any> | null;
  /** Ruta dentro del teléfono (Directory.Data), cuando ya está guardada. */
  archivo?: string;
}

/** Resumen corto que se manda al API (columna foto_meta). */
export interface ResumenMeta {
  formato: string;
  tamano: number;
  resolucion: string;
  marca?: string;
  modelo?: string;
  fecha?: string;
  latitud?: number;
  longitud?: number;
}

const CARPETA = 'perfil';
const EXTENSIONES = ['jpg', 'png', 'webp', 'heic', 'gif'];

/**
 * Foto de perfil:
 *  - se toma con la cámara o se elige de la galería (@capacitor/camera)
 *  - se HOSPEDA en el teléfono con @capacitor/filesystem (Directory.Data)
 *  - su metadata (cámara, fecha, GPS, exposición...) se lee con exifr
 *    directamente del archivo guardado.
 */
@Injectable({ providedIn: 'root' })
export class FotoPerfilService {

  // ==================== ELEGIR ====================

  async tomarFoto(): Promise<FotoPerfil> {
    const r = await Camera.takePhoto({ quality: 92, correctOrientation: true, includeMetadata: true });
    return this.desdeResultado(r);
  }

  async elegirDeGaleria(): Promise<FotoPerfil> {
    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      includeMetadata: true,
      quality: 100,
    });
    if (!results.length) throw new Error('No elegiste ninguna foto.');
    return this.desdeResultado(results[0]);
  }

  /** Convierte lo que regresa la cámara en una FotoPerfil con su EXIF. */
  private async desdeResultado(r: MediaResult): Promise<FotoPerfil> {
    let bytes: Uint8Array;
    if (r.webPath) {
      // Leemos el archivo tal cual para no perder el EXIF
      bytes = new Uint8Array(await (await fetch(r.webPath)).arrayBuffer());
    } else if (r.thumbnail) {
      bytes = base64ABytes(r.thumbnail);
    } else {
      throw new Error('La cámara no regresó ninguna imagen.');
    }
    const formato = detectarFormato(bytes) ?? normalizarFormato(r.metadata?.format) ?? 'jpeg';
    const foto = await this.armar(bytes, formato);
    // Si exifr no encontró nada, usamos lo que dio el plugin de la cámara (Android/iOS)
    if (!foto.exif && r.metadata?.exif) {
      foto.exif = typeof r.metadata.exif === 'string' ? safeJson(r.metadata.exif) : r.metadata.exif;
    }
    return foto;
  }

  private async armar(bytes: Uint8Array, formato: string, archivo?: string): Promise<FotoPerfil> {
    const dataUrl = `data:image/${formato};base64,${bytesABase64(bytes)}`;
    const [exif, medidas] = await Promise.all([leerExif(bytes), medirImagen(dataUrl)]);
    return { bytes, formato, dataUrl, exif, archivo, ...medidas };
  }

  // ==================== GUARDAR EN EL TELÉFONO ====================

  private ruta(usuarioId: string, formato: string): string {
    const ext = formato === 'jpeg' ? 'jpg' : formato;
    return `${CARPETA}/foto_usuario_${usuarioId.replace(/[^a-z0-9_-]/gi, '_')}.${ext}`;
  }

  /** Escribe la foto (bytes originales) en el almacenamiento de la app. */
  async guardar(usuarioId: string, foto: FotoPerfil): Promise<FotoPerfil> {
    await this.borrar(usuarioId); // por si antes era .png y ahora .jpg
    const archivo = this.ruta(usuarioId, foto.formato);
    await Filesystem.writeFile({
      path: archivo,
      data: bytesABase64(foto.bytes),
      directory: Directory.Data,
      recursive: true,
    });
    return { ...foto, archivo };
  }

  /** Lee la foto guardada y vuelve a sacar su metadata del archivo. */
  async cargar(usuarioId: string): Promise<FotoPerfil | null> {
    for (const ext of EXTENSIONES) {
      const archivo = this.ruta(usuarioId, ext);
      try {
        const { data } = await Filesystem.readFile({ path: archivo, directory: Directory.Data });
        const bytes = typeof data === 'string' ? base64ABytes(data) : new Uint8Array(await data.arrayBuffer());
        return await this.armar(bytes, detectarFormato(bytes) ?? normalizarFormato(ext) ?? 'jpeg', archivo);
      } catch {
        /* no existe con esa extensión, probamos la siguiente */
      }
    }
    return null;
  }

  /** Solo la imagen (sin leer EXIF), para mostrarla chiquita en el encabezado. */
  async miniatura(usuarioId: string): Promise<string | null> {
    for (const ext of EXTENSIONES) {
      try {
        const { data } = await Filesystem.readFile({ path: this.ruta(usuarioId, ext), directory: Directory.Data });
        const bytes = typeof data === 'string' ? base64ABytes(data) : new Uint8Array(await data.arrayBuffer());
        return `data:image/${detectarFormato(bytes) ?? 'jpeg'};base64,${bytesABase64(bytes)}`;
      } catch { /* probamos la siguiente extensión */ }
    }
    return null;
  }

  async borrar(usuarioId: string): Promise<void> {
    for (const ext of EXTENSIONES) {
      try {
        await Filesystem.deleteFile({ path: this.ruta(usuarioId, ext), directory: Directory.Data });
      } catch { /* no existía */ }
    }
  }

  // ==================== METADATA PARA MOSTRAR ====================

  /** Los datos más importantes, en español y con unidades. */
  principales(foto: FotoPerfil): DatoMeta[] {
    const e = foto.exif ?? {};
    const d: DatoMeta[] = [];
    const add = (etiqueta: string, valor: any, icono: string) => {
      if (valor !== undefined && valor !== null && valor !== '') d.push({ etiqueta, valor: String(valor), icono });
    };

    const camara = [e['Make'], e['Model']].filter(Boolean).join(' ');
    add('Cámara', camara, 'camera-outline');
    add('Lente', e['LensModel'], 'aperture-outline');
    add('Tomada el', fecha(e['DateTimeOriginal'] ?? e['CreateDate'] ?? e['DateTime']), 'calendar-outline');
    add('Resolución', `${foto.ancho} × ${foto.alto} px`, 'resize-outline');
    add('Tamaño', tamano(foto.bytes.length), 'document-outline');
    add('Formato', foto.formato.toUpperCase(), 'image-outline');
    if (e['ExposureTime']) {
      add('Exposición', e['ExposureTime'] < 1 ? `1/${Math.round(1 / e['ExposureTime'])} s` : `${e['ExposureTime']} s`, 'timer-outline');
    }
    if (e['FNumber']) add('Apertura', `f/${redondear(e['FNumber'], 1)}`, 'aperture-outline');
    add('ISO', e['ISO'], 'sunny-outline');
    if (e['FocalLength']) add('Distancia focal', `${redondear(e['FocalLength'], 1)} mm`, 'scan-outline');
    add('Flash', typeof e['Flash'] === 'string' ? e['Flash'] : undefined, 'flash-outline');
    add('Software', e['Software'], 'code-slash-outline');
    if (typeof e['latitude'] === 'number' && typeof e['longitude'] === 'number') {
      add('Ubicación', `${redondear(e['latitude'], 5)}, ${redondear(e['longitude'], 5)}`, 'location-outline');
    }
    return d;
  }

  /** TODOS los campos que encontró exifr (para la sección "ver todo"). */
  todos(foto: FotoPerfil): { clave: string; valor: string }[] {
    if (!foto.exif) return [];
    return Object.entries(foto.exif)
      .map(([clave, v]) => ({ clave, valor: valorLegible(v) }))
      .filter(x => x.valor !== '')
      .sort((a, b) => a.clave.localeCompare(b.clave));
  }

  /** Coordenadas, si la foto las trae. */
  gps(foto: FotoPerfil): { lat: number; lon: number } | null {
    const e = foto.exif;
    return e && typeof e['latitude'] === 'number' && typeof e['longitude'] === 'number'
      ? { lat: e['latitude'], lon: e['longitude'] }
      : null;
  }

  /** Lo que se guarda en la base de datos (columna foto_meta). */
  resumen(foto: FotoPerfil): ResumenMeta {
    const e = foto.exif ?? {};
    const f = e['DateTimeOriginal'] ?? e['CreateDate'] ?? e['DateTime'];
    const g = this.gps(foto);
    return {
      formato: foto.formato,
      tamano: foto.bytes.length,
      resolucion: `${foto.ancho}x${foto.alto}`,
      ...(e['Make'] ? { marca: String(e['Make']) } : {}),
      ...(e['Model'] ? { modelo: String(e['Model']) } : {}),
      ...(f instanceof Date && !isNaN(+f) ? { fecha: f.toISOString() } : {}),
      ...(g ? { latitud: g.lat, longitud: g.lon } : {}),
    };
  }
}

// ==================== AYUDANTES ====================

/** Lee el EXIF con exifr. Regresa null si la imagen no trae metadata. */
async function leerExif(bytes: Uint8Array): Promise<Record<string, any> | null> {
  try {
    const r = await parse(bytes, {
      tiff: true, exif: true, gps: true, ifd1: false, interop: false,
      xmp: true, iptc: true, icc: false, jfif: true, ihdr: true,
      mergeOutput: true, translateValues: true, reviveValues: true, sanitize: true,
    });
    return r && Object.keys(r).length ? r : null;
  } catch {
    return null;
  }
}

function medirImagen(src: string): Promise<{ ancho: number; alto: number }> {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => res({ ancho: 0, alto: 0 });
    img.src = src;
  });
}

/** Reconoce el formato por los primeros bytes del archivo. */
function detectarFormato(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  const txt = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (txt(0, 4) === 'RIFF' && txt(8, 4) === 'WEBP') return 'webp';
  if (txt(4, 4) === 'ftyp' && /hei|mif/.test(txt(8, 4))) return 'heic';
  return null;
}

function normalizarFormato(f?: string): string | null {
  if (!f) return null;
  const x = f.toLowerCase().replace('image/', '');
  return x === 'jpg' ? 'jpeg' : x;
}

function bytesABase64(bytes: Uint8Array): string {
  let bin = '';
  const PASO = 0x8000; // por partes, para fotos grandes
  for (let i = 0; i < bytes.length; i += PASO) {
    bin += String.fromCharCode(...bytes.subarray(i, i + PASO));
  }
  return btoa(bin);
}

function base64ABytes(b64: string): Uint8Array {
  const limpio = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
  const bin = atob(limpio);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeJson(t: string): Record<string, any> | null {
  try { return JSON.parse(t); } catch { return null; }
}

function fecha(v: any): string | undefined {
  if (v instanceof Date && !isNaN(+v)) {
    return v.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  }
  return v ? String(v) : undefined;
}

function tamano(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function redondear(n: number, dec: number): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

function valorLegible(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isNaN(+v) ? '' : v.toLocaleString('es-MX');
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) return ''; // datos binarios (miniaturas, etc.)
  if (Array.isArray(v)) return v.length > 8 ? `${v.slice(0, 8).join(', ')}…` : v.join(', ');
  if (typeof v === 'number') return String(redondear(v, 6));
  if (typeof v === 'object') {
    const t = JSON.stringify(v);
    return t.length > 120 ? t.slice(0, 120) + '…' : t;
  }
  return String(v);
}
