import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({ providedIn: 'root' })
export class FitnessStorageService {
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {}

  /** Crea (una sola vez) la instancia de almacenamiento. */
  private async init(): Promise<Storage> {
    if (!this._storage) {
      this._storage = await this.storage.create();
    }
    return this._storage;
  }

  /** Lee un valor; si no existe devuelve el valor por defecto. */
  async get<T>(clave: string, porDefecto: T): Promise<T> {
    const s = await this.init();
    const valor = await s.get(clave);
    return valor ?? porDefecto;
  }

  /** Guarda un valor. */
  async set(clave: string, valor: any): Promise<void> {
    const s = await this.init();
    await s.set(clave, valor);
  }
}
