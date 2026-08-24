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

  const { data: token } = await Notifications.getDevicePushTokenAsync();
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
    case 'modulo':   return ['Apps', { slug: id }];
    default:         return ['Inicio', {}];
  }
}
