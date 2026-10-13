import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

/** Una foto editada guardada en el teléfono. */
export interface FotoEditada {
  nombre: string;          // editada_2026-10-12_21-50-30.jpg
  ruta: string;            // FitHabitos/editada_….jpg (relativa a la carpeta)
  carpeta: Directory;
  uri: string;             // ruta completa: file:///storage/emulated/0/Documents/FitHabitos/…
  rutaLegible: string;     // "Documentos/FitHabitos/…" o "Almacenamiento de la app/FitHabitos/…"
  fecha: Date;
  tamano: number;          // bytes
  src?: string;            // para el <img>
}

const CARPETA = 'FitHabitos';

/**
 * Guarda las fotos que salen del PhotoEditor SDK en una ruta LOCAL del teléfono.
 *
 * Primero intenta Documentos/FitHabitos (carpeta pública: la ves en "Archivos").
 * Si el teléfono no lo permite (Android 10 o anterior), usa el almacenamiento
 * privado de la app, que siempre funciona.
 */
@Injectable({ providedIn: 'root' })
export class FotosEditadasService {
  private readonly lugares: Directory[] = [Directory.Documents, Directory.Data];

  /** Guarda un data URL (lo que exporta el editor) y regresa dónde quedó. */
  async guardar(dataUrl: string): Promise<FotoEditada> {
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const nombre = `editada_${marcaDeTiempo(new Date())}.${ext}`;
    const ruta = `${CARPETA}/${nombre}`;
    const datos = dataUrl.slice(dataUrl.indexOf(',') + 1);

    let ultimoError: unknown = null;
    for (const carpeta of this.lugares) {
      try {
        if (carpeta === Directory.Documents) await this.pedirPermiso();
        await Filesystem.writeFile({ path: ruta, data: datos, directory: carpeta, recursive: true });
        const { uri } = await Filesystem.getUri({ path: ruta, directory: carpeta });
        return {
          nombre, ruta, carpeta, uri,
          rutaLegible: `${nombreCarpeta(carpeta)}/${ruta}`,
          fecha: new Date(),
          tamano: Math.floor((datos.length * 3) / 4),
          src: dataUrl,
        };
      } catch (e) {
        ultimoError = e; // probamos el siguiente lugar
      }
    }
    throw new Error('No se pudo guardar la foto en el teléfono: ' + ((ultimoError as any)?.message ?? ultimoError));
  }

  /** Las fotos editadas, de la más nueva a la más vieja. */
  async listar(max = 24): Promise<FotoEditada[]> {
    const todas: FotoEditada[] = [];
    for (const carpeta of this.lugares) {
      try {
        const { files } = await Filesystem.readdir({ path: CARPETA, directory: carpeta });
        for (const f of files) {
          if (f.type !== 'file' || !/\.(jpe?g|png)$/i.test(f.name)) continue;
          const ruta = `${CARPETA}/${f.name}`;
          const uri = f.uri || (await Filesystem.getUri({ path: ruta, directory: carpeta })).uri;
          todas.push({
            nombre: f.name, ruta, carpeta, uri,
            rutaLegible: `${nombreCarpeta(carpeta)}/${ruta}`,
            fecha: new Date(Number(f.mtime) || Date.now()),
            tamano: Number(f.size) || 0,
          });
        }
      } catch {
        /* esa carpeta todavía no existe */
      }
    }
    todas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    const recientes = todas.slice(0, max);
    await Promise.all(recientes.map(async f => (f.src = await this.vistaPrevia(f))));
    return recientes;
  }

  async borrar(f: FotoEditada): Promise<void> {
    await Filesystem.deleteFile({ path: f.ruta, directory: f.carpeta });
  }

  /** Lee la foto guardada para volver a editarla. */
  async leerComoDataUrl(f: FotoEditada): Promise<string> {
    const { data } = await Filesystem.readFile({ path: f.ruta, directory: f.carpeta });
    const tipo = /\.png$/i.test(f.nombre) ? 'image/png' : 'image/jpeg';
    if (typeof data === 'string') return `data:${tipo};base64,${data}`;
    return await blobADataUrl(data);
  }

  /** En el celular se carga directo del archivo; en el navegador hay que leerlo. */
  private async vistaPrevia(f: FotoEditada): Promise<string> {
    if (Capacitor.isNativePlatform()) return Capacitor.convertFileSrc(f.uri);
    try { return await this.leerComoDataUrl(f); } catch { return ''; }
  }

  /** Android 10 o anterior pide permiso para escribir en Documentos. */
  private async pedirPermiso() {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      const p = await Filesystem.checkPermissions();
      if (p.publicStorage !== 'granted') await Filesystem.requestPermissions();
    } catch { /* en Android 11+ no hace falta */ }
  }
}

function nombreCarpeta(c: Directory): string {
  return c === Directory.Documents ? 'Documentos' : 'Almacenamiento de la app';
}

function marcaDeTiempo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function blobADataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}
