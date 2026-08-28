// ============================================================================
// Notificaciones push
// ----------------------------------------------------------------------------
// Cada notificacion viaja con su `ruta` ('/post/482', '/persona/7'). Al tocarla
// la app navega ahi directo, en vez de abrir en la pantalla de inicio.
// Eso es el deep-linking: el destino se decide en el servidor al crear la
// notificacion, no en la app al recibirla.
// ============================================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { auth } from './api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Pide permiso, obtiene el token y lo registra en el servidor.
 * Devuelve el token o null si la persona no dio permiso.
 */
export async function registrarPush() {
  if (!Device.isDevice) return null; // el simulador no recibe push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#11BCB3',
    });
  }

  const { status: actual } = await Notifications.getPermissionsAsync();
  let status = actual;
  if (status !== 'granted') {
    const r = await Notifications.requestPermissionsAsync();
    status = r.status;
  }
  if (status !== 'granted') return null;

  // Token de Expo, no el nativo de APNs. El servidor le manda a Expo y Expo
  // se encarga de Apple y de Google: sin eso habria que manejar dos
  // protocolos y sus credenciales del lado del servidor.
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId
                 || Constants?.easConfig?.projectId;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token) return null;

  await auth.registrarPush(
    token,
    Platform.OS === 'ios' ? 'ios' : 'android',
    Device.modelName || null,
    '1.0.0'
  );
  return token;
}

/**
 * Conecta el toque de una notificacion con la navegacion.
 * Devuelve la funcion de limpieza para el useEffect.
 */
export function escucharToques(navegarA) {
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    const ruta = res?.notification?.request?.content?.data?.ruta;
    if (ruta) navegarA(ruta);
  });
  return () => sub.remove();
}

/**
 * Por que el push no esta andando. Cada motivo tiene una accion distinta,
 * asi que decir solo "no funciona" no alcanza.
 */
export async function diagnosticoPush() {
  if (!Device.isDevice) {
    return { listo: false, motivo: 'El simulador no recibe notificaciones.' };
  }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId
                 || Constants?.easConfig?.projectId;
  if (!projectId) {
    return { listo: false, motivo: 'Falta la configuracion del proyecto (projectId).' };
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'denied') {
    return { listo: false, permiso: status,
             motivo: 'Permiso denegado. Activalo en Ajustes del telefono.' };
  }
  if (status !== 'granted') {
    return { listo: false, permiso: status, motivo: 'Tocá para dar permiso.' };
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data
      ? { listo: true, permiso: status, token: String(data).slice(0, 28) + '...' }
      : { listo: false, permiso: status, motivo: 'No pude obtener el token.' };
  } catch (e) {
    return { listo: false, permiso: status, motivo: String(e.message || e).slice(0, 120) };
  }
}

/** Cuantas sin leer: es el numero del globito sobre el icono de la app. */
export async function ponerBadge(n) {
  try { await Notifications.setBadgeCountAsync(Math.max(0, n | 0)); }
  catch (e) { /* Android puede no soportarlo segun el launcher */ }
}

/**
 * Traduce la ruta del servidor a una pantalla de la app.
 * Si aparece una ruta que esta version no conoce (porque el servidor ya
 * empezo a mandar un modulo nuevo), cae en Inicio en vez de romper.
 */
export function rutaAPantalla(ruta) {
  const [, seccion, id] = (ruta || '').split('/');
  const n = id ? Number(id) : null;

  // Cada aviso lleva a la pantalla donde esta la cosa, no al modulo que la
  // contiene: si te avisan de un comentario y caes en el inicio, tenes que
  // buscarlo a mano y el aviso no sirvio de nada.
  switch (seccion) {
    case 'post':           return ['Post', { id: n }];
    case 'persona':        return ['Persona', { id: n }];
    case 'crm':            return ['CrmChat', { id: n }];
    case 'tarea':          return ['Tarea', { id: n }];
    case 'evento':         return ['Evento', { id: n }];
    case 'encuesta':       return ['Encuesta', { id: n }];
    case 'expediente':     return ['Expediente', { id: n }];
    case 'presupuesto':    return ['Presupuestos', {}];
    case 'reconocimiento': return ['Reconocimientos', {}];
    case 'documento':      return ['Documentos', {}];
    case 'desempeno':      return ['Desempeno', {}];
    case 'onboarding':     return ['Onboarding', {}];
    case 'comision':       return ['Comisiones', {}];
    case 'inicio':         return ['Inicio', {}];
    case 'modulo':         return ['Apps', { slug: id }];
    default:               return ['Inicio', {}];
  }
}
