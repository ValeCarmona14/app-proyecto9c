package com.fithabitos.ble;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.os.Build;
import android.os.ParcelUuid;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;

/**
 * Celular B (el que RECIBE).
 *
 * El plugin @capacitor-community/bluetooth-le solo sabe ser "central"
 * (buscar y conectarse). Para que otro celular nos encuentre y se conecte,
 * este celular tiene que ser "periférico": anunciarse y tener un servidor GATT.
 * Eso es lo que hace este plugin pequeño.
 *
 * Servicio  SERVICIO
 *   CANAL  (write)        el celular A escribe aquí los mensajes:
 *                         [1]+4 bytes tamaño+nombre = solicitud de conexión
 *                         [2]+datos = un pedazo de la metadata
 *                         [3]       = fin del envío
 *   ESTADO (read+notify)  aquí respondemos: 1 aceptado, 2 rechazado,
 *                         3 recibido completo, 4 error
 *
 * Eventos hacia la app (JS): "solicitud", "progreso", "recibido", "desconectado".
 */
@SuppressLint("MissingPermission")
@CapacitorPlugin(
    name = "PerifericoBle",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = { Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT }
        )
    }
)
public class PerifericoBlePlugin extends Plugin {

    // Deben ser IGUALES a los de src/app/services/ble/protocolo-ble.ts
    static final UUID SERVICIO = UUID.fromString("db27579f-0000-4b1d-9f3a-7c2e5d8a1f60");
    static final UUID CANAL = UUID.fromString("db27579f-0001-4b1d-9f3a-7c2e5d8a1f60");
    static final UUID ESTADO = UUID.fromString("db27579f-0002-4b1d-9f3a-7c2e5d8a1f60");
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    static final byte MSG_SOLICITUD = 1;
    static final byte MSG_PARTE = 2;
    static final byte MSG_FIN = 3;

    static final byte EST_ESPERANDO = 0;
    static final byte EST_ACEPTADO = 1;
    static final byte EST_RECHAZADO = 2;
    static final byte EST_RECIBIDO = 3;
    static final byte EST_ERROR = 4;

    /** Máximo que aceptamos recibir (la metadata + una miniatura caben de sobra). */
    static final int MAX_BYTES = 200 * 1024;
    /** Id de fabricante 0xFFFF: reservado para pruebas, sirve para mandar el nombre. */
    static final int FABRICANTE_PRUEBAS = 0xFFFF;

    private BluetoothGattServer servidor;
    private BluetoothLeAdvertiser anunciante;
    private AdvertiseCallback callbackAnuncio;
    private PluginCall llamadaIniciar;
    private byte[] nombreAnuncio = new byte[0];

    // Transferencia en curso
    private BluetoothDevice remitente;
    private String nombreRemitente = "";
    private ByteArrayOutputStream buffer;
    private int esperados = 0;
    private boolean aceptado = false;
    private boolean terminado = false;
    private byte estado = EST_ESPERANDO;

    // ==================== MÉTODOS QUE LLAMA LA APP ====================

    /** Abre el servidor GATT y empieza a anunciarse. Opciones: { nombre: "Ana" } */
    @PluginMethod
    public void iniciar(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "permisosRespondidos");
            return;
        }
        arrancar(call);
    }

    @PermissionCallback
    private void permisosRespondidos(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            arrancar(call);
        } else {
            call.reject("Sin permiso de Bluetooth. Dalo en Ajustes > Apps > FitHábitos > Permisos > Dispositivos cercanos.");
        }
    }

    /** Respuesta del usuario a la solicitud. Opciones: { aceptar: true|false } */
    @PluginMethod
    public void responder(PluginCall call) {
        if (servidor == null || remitente == null) {
            call.reject("Ya no hay ninguna solicitud pendiente.");
            return;
        }
        aceptado = Boolean.TRUE.equals(call.getBoolean("aceptar", false));
        notificar(aceptado ? EST_ACEPTADO : EST_RECHAZADO);
        call.resolve();
    }

    /** Deja de anunciarse y cierra todo. */
    @PluginMethod
    public void detener(PluginCall call) {
        detenerTodo();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        detenerTodo();
        super.handleOnDestroy();
    }

    // ==================== ARRANQUE ====================

    private void arrancar(PluginCall call) {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adaptador = manager == null ? null : manager.getAdapter();
        if (adaptador == null) {
            call.reject("Este dispositivo no tiene Bluetooth.");
            return;
        }
        if (!adaptador.isEnabled()) {
            call.reject("Activa el Bluetooth para poder recibir.");
            return;
        }
        BluetoothLeAdvertiser anun = adaptador.getBluetoothLeAdvertiser();
        if (anun == null) {
            call.reject("Este celular no puede anunciarse por Bluetooth LE (no soporta el modo periférico).");
            return;
        }

        detenerTodo();
        nombreAnuncio = recortarUtf8(call.getString("nombre", ""), 20);
        anunciante = anun;
        llamadaIniciar = call;

        servidor = manager.openGattServer(getContext(), callbackGatt);
        if (servidor == null) {
            llamadaIniciar = null;
            call.reject("No se pudo abrir el servidor Bluetooth.");
            return;
        }

        BluetoothGattService servicio = new BluetoothGattService(SERVICIO, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        BluetoothGattCharacteristic canal = new BluetoothGattCharacteristic(
            CANAL,
            BluetoothGattCharacteristic.PROPERTY_WRITE,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        );
        BluetoothGattCharacteristic est = new BluetoothGattCharacteristic(
            ESTADO,
            BluetoothGattCharacteristic.PROPERTY_READ | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        );
        est.addDescriptor(new BluetoothGattDescriptor(
            CCCD,
            BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE
        ));
        servicio.addCharacteristic(canal);
        servicio.addCharacteristic(est);
        // Cuando el servicio queda registrado (onServiceAdded) empezamos a anunciarnos
        servidor.addService(servicio);
    }

    private void anunciarse(boolean conNombre) {
        if (anunciante == null) return;
        AdvertiseSettings ajustes = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0)
            .build();
        // Paquete principal: solo el servicio, así el celular A nos filtra
        AdvertiseData datos = new AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(new ParcelUuid(SERVICIO))
            .build();
        // Respuesta al escaneo: el nombre de la persona (no el del celular)
        AdvertiseData.Builder respuesta = new AdvertiseData.Builder().setIncludeDeviceName(false);
        if (conNombre && nombreAnuncio.length > 0) {
            respuesta.addManufacturerData(FABRICANTE_PRUEBAS, nombreAnuncio);
        }

        callbackAnuncio = new AdvertiseCallback() {
            @Override
            public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                if (llamadaIniciar != null) {
                    llamadaIniciar.resolve();
                    llamadaIniciar = null;
                }
            }

            @Override
            public void onStartFailure(int errorCode) {
                if (errorCode == ADVERTISE_FAILED_DATA_TOO_LARGE && conNombre) {
                    anunciarse(false); // el nombre no cupo: nos anunciamos sin él
                    return;
                }
                if (errorCode == ADVERTISE_FAILED_ALREADY_STARTED) {
                    onStartSuccess(null);
                    return;
                }
                if (llamadaIniciar != null) {
                    llamadaIniciar.reject("No se pudo anunciar por Bluetooth (código " + errorCode + ").");
                    llamadaIniciar = null;
                }
                detenerTodo();
            }
        };
        anunciante.startAdvertising(ajustes, datos, respuesta.build(), callbackAnuncio);
    }

    // ==================== SERVIDOR GATT ====================

    private final BluetoothGattServerCallback callbackGatt = new BluetoothGattServerCallback() {

        @Override
        public void onServiceAdded(int status, BluetoothGattService service) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                anunciarse(true);
            } else if (llamadaIniciar != null) {
                llamadaIniciar.reject("No se pudo registrar el servicio Bluetooth (código " + status + ").");
                llamadaIniciar = null;
                detenerTodo();
            }
        }

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED && esElRemitente(device)) {
                if (!terminado) {
                    JSObject ev = new JSObject();
                    ev.put("de", nombreRemitente);
                    ev.put("aceptado", aceptado);
                    notifyListeners("desconectado", ev);
                }
                reiniciarTransferencia();
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                                                 BluetoothGattCharacteristic characteristic,
                                                 boolean preparedWrite, boolean responseNeeded,
                                                 int offset, byte[] value) {
            boolean ok = CANAL.equals(characteristic.getUuid()) && !preparedWrite && offset == 0
                && procesar(device, value);
            if (responseNeeded && servidor != null) {
                servidor.sendResponse(device, requestId,
                    ok ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_FAILURE, 0, null);
            }
        }

        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset,
                                                BluetoothGattCharacteristic characteristic) {
            if (servidor == null) return;
            if (ESTADO.equals(characteristic.getUuid())) {
                byte valor = esElRemitente(device) ? estado : EST_ESPERANDO;
                servidor.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, new byte[] { valor });
            } else {
                servidor.sendResponse(device, requestId, BluetoothGatt.GATT_READ_NOT_PERMITTED, 0, null);
            }
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId,
                                             BluetoothGattDescriptor descriptor, boolean preparedWrite,
                                             boolean responseNeeded, int offset, byte[] value) {
            // El celular A se suscribe a las notificaciones de ESTADO
            if (responseNeeded && servidor != null) {
                boolean ok = CCCD.equals(descriptor.getUuid());
                servidor.sendResponse(device, requestId,
                    ok ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_FAILURE, 0, null);
            }
        }

        @Override
        public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int offset,
                                            BluetoothGattDescriptor descriptor) {
            if (servidor != null) {
                servidor.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0,
                    BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            }
        }
    };

    // ==================== PROTOCOLO ====================

    /** Procesa un mensaje del celular A. Devuelve false si hay que rechazarlo. */
    private boolean procesar(BluetoothDevice device, byte[] valor) {
        if (valor == null || valor.length == 0) return false;
        byte tipo = valor[0];
        byte[] cuerpo = Arrays.copyOfRange(valor, 1, valor.length);

        if (tipo == MSG_SOLICITUD) {
            // Solo una transferencia a la vez
            if (remitente != null && !esElRemitente(device) && !terminado) return false;
            try {
                // 4 bytes con el tamaño total + el nombre de quien envía (UTF-8)
                if (cuerpo.length < 4) return false;
                int bytes = ByteBuffer.wrap(cuerpo, 0, 4).getInt();
                if (bytes <= 0 || bytes > MAX_BYTES) return false;
                String de = new String(cuerpo, 4, cuerpo.length - 4, StandardCharsets.UTF_8).trim();
                remitente = device;
                nombreRemitente = de.isEmpty() ? "Alguien" : de;
                esperados = bytes;
                buffer = new ByteArrayOutputStream(bytes);
                aceptado = false;
                terminado = false;
                estado = EST_ESPERANDO;

                JSObject ev = new JSObject();
                ev.put("de", nombreRemitente);
                ev.put("bytes", bytes);
                ev.put("dispositivo", device.getAddress());
                notifyListeners("solicitud", ev);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        if (!esElRemitente(device) || !aceptado || buffer == null) return false;

        if (tipo == MSG_PARTE) {
            if (buffer.size() + cuerpo.length > esperados) return false;
            buffer.write(cuerpo, 0, cuerpo.length);
            JSObject ev = new JSObject();
            ev.put("recibidos", buffer.size());
            ev.put("total", esperados);
            notifyListeners("progreso", ev);
            return true;
        }

        if (tipo == MSG_FIN) {
            if (buffer.size() != esperados) {
                notificar(EST_ERROR);
                return false;
            }
            terminado = true;
            JSObject ev = new JSObject();
            ev.put("de", nombreRemitente);
            ev.put("datos", new String(buffer.toByteArray(), StandardCharsets.UTF_8));
            notifyListeners("recibido", ev);
            notificar(EST_RECIBIDO);
            return true;
        }
        return false;
    }

    /** Cambia ESTADO y avisa al celular A. */
    private void notificar(byte valor) {
        estado = valor;
        if (servidor == null || remitente == null) return;
        BluetoothGattService s = servidor.getService(SERVICIO);
        BluetoothGattCharacteristic c = s == null ? null : s.getCharacteristic(ESTADO);
        if (c == null) return;
        byte[] dato = new byte[] { valor };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            servidor.notifyCharacteristicChanged(remitente, c, false, dato);
        } else {
            c.setValue(dato);
            servidor.notifyCharacteristicChanged(remitente, c, false);
        }
    }

    // ==================== AYUDANTES ====================

    private boolean esElRemitente(BluetoothDevice device) {
        return remitente != null && device != null && remitente.getAddress().equals(device.getAddress());
    }

    private void reiniciarTransferencia() {
        remitente = null;
        nombreRemitente = "";
        buffer = null;
        esperados = 0;
        aceptado = false;
        terminado = false;
        estado = EST_ESPERANDO;
    }

    private void detenerTodo() {
        try {
            if (anunciante != null && callbackAnuncio != null) anunciante.stopAdvertising(callbackAnuncio);
        } catch (Exception ignored) { }
        callbackAnuncio = null;
        anunciante = null;
        try {
            if (servidor != null) {
                if (remitente != null) servidor.cancelConnection(remitente);
                servidor.clearServices();
                servidor.close();
            }
        } catch (Exception ignored) { }
        servidor = null;
        if (llamadaIniciar != null) {
            llamadaIniciar.reject("Se detuvo antes de empezar.");
            llamadaIniciar = null;
        }
        reiniciarTransferencia();
    }

    /** Corta un texto a N bytes UTF-8 sin partir una letra a la mitad. */
    private static byte[] recortarUtf8(String texto, int max) {
        if (texto == null) return new byte[0];
        StringBuilder sb = new StringBuilder();
        int usados = 0;
        for (int i = 0; i < texto.length(); ) {
            int cp = texto.codePointAt(i);
            String letra = new String(Character.toChars(cp));
            int n = letra.getBytes(StandardCharsets.UTF_8).length;
            if (usados + n > max) break;
            sb.append(letra);
            usados += n;
            i += Character.charCount(cp);
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }
}
