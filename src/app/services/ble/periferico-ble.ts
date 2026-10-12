import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

/**
 * Plugin NATIVO propio (android/app/src/main/java/com/fithabitos/ble/PerifericoBlePlugin.java).
 * Hace que el celular B se anuncie por Bluetooth LE y reciba la conexión,
 * porque @capacitor-community/bluetooth-le solo puede buscar y conectarse (rol central).
 */
export interface SolicitudBle { de: string; bytes: number; dispositivo: string; }
export interface ProgresoBle { recibidos: number; total: number; }
export interface RecibidoBle { de: string; datos: string; }
export interface DesconectadoBle { de: string; aceptado: boolean; }

export interface PerifericoBlePlugin {
  /** Abre el servidor GATT y se anuncia con el nombre de la persona. */
  iniciar(opciones: { nombre: string }): Promise<void>;
  /** Respuesta del usuario a la solicitud de conexión. */
  responder(opciones: { aceptar: boolean }): Promise<void>;
  /** Deja de anunciarse y cierra la conexión. */
  detener(): Promise<void>;

  addListener(evento: 'solicitud', fn: (e: SolicitudBle) => void): Promise<PluginListenerHandle>;
  addListener(evento: 'progreso', fn: (e: ProgresoBle) => void): Promise<PluginListenerHandle>;
  addListener(evento: 'recibido', fn: (e: RecibidoBle) => void): Promise<PluginListenerHandle>;
  addListener(evento: 'desconectado', fn: (e: DesconectadoBle) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const PerifericoBle = registerPlugin<PerifericoBlePlugin>('PerifericoBle');
