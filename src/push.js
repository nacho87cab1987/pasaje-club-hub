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
  switch (seccion) {
    case 'post':     return ['Inicio', { postId: id }];
    case 'persona':  return ['Personas', { personaId: id }];
    case 'crm':      return ['CRM', { conversacionId: id }];
    case 'tarea':    return ['Tarea', { id }];
    case 'documento':return ['Documentos', {}];
    case 'modulo':   return ['Apps', { slug: id }];
    default:         return ['Inicio', {}];
  }
}
