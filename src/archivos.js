// ============================================================================
// Abrir archivos
// ----------------------------------------------------------------------------
// Linking.openURL no sirve para esto: el dominio pasajeclub.com esta asociado
// a la app del panel de socios, asi que iOS intercepta el link y se lo manda
// a esa app en vez de abrir el archivo. La pantalla queda en blanco.
//
// Se baja el archivo y se abre el menu del sistema, que ademas es lo que uno
// quiere: guardarlo en Archivos, mandarlo por WhatsApp, imprimirlo.
// ============================================================================

import { Alert, Linking, Platform, Clipboard, Share } from 'react-native';

let FS = null;
try {
  FS = require('expo-file-system/legacy');
  if (!FS || !FS.downloadAsync) FS = require('expo-file-system');
} catch (e) {
  try { FS = require('expo-file-system'); } catch (e2) { FS = null; }
}

let Sharing = null;
try { Sharing = require('expo-sharing'); } catch (e) { Sharing = null; }

let WebBrowser = null;
try { WebBrowser = require('expo-web-browser'); } catch (e) { WebBrowser = null; }

/**
 * Los links universales se asocian a UN dominio. La app del panel de socios
 * esta asociada a uno de los dos, asi que pidiendo el archivo por el otro
 * iOS no lo intercepta y lo abre el visor.
 *
 * Los dos dominios apuntan al mismo servidor: el archivo es el mismo.
 */
function dominioAlternativo(url) {
  const u = String(url);
  if (u.includes('pasajeclub.com.ar')) return u.replace('pasajeclub.com.ar', 'pasajeclub.com');
  if (u.includes('pasajeclub.com')) return u.replace('pasajeclub.com', 'pasajeclub.com.ar');
  return null;
}

/** Nombre de archivo seguro para el sistema de archivos. */
function nombreSeguro(nombre, url) {
  let n = String(nombre || '').trim();
  if (!n) {
    const m = String(url).match(/([^/?=]+\.[a-z0-9]{2,5})(?:[?&]|$)/i);
    n = m ? m[1] : `archivo_${Date.now()}`;
  }
  return n.replace(/[^\w\s.\-]/g, '_').slice(0, 90);
}

/**
 * Abre un archivo remoto. Devuelve como se resolvio, para poder avisar
 * distinto segun el caso.
 */
export async function abrirArchivo(url, nombre) {
  if (!url) return 'sin_url';

  // 1. Bajarlo y abrir el menu del sistema. Es el camino que funciona
  //    siempre y el unico que permite guardar el archivo.
  if (FS && FS.downloadAsync && Sharing) {
    try {
      const disponible = await Sharing.isAvailableAsync();
      if (disponible) {
        const destino = `${FS.cacheDirectory}${nombreSeguro(nombre, url)}`;
        const r = await FS.downloadAsync(url, destino);
        if (r && r.status === 200 && r.uri) {
          await Sharing.shareAsync(r.uri, {
            dialogTitle: nombre || 'Archivo',
            UTI: 'public.item',
          });
          return 'compartido';
        }
      }
    } catch (e) {
      // Sigue al proximo camino.
    }
  }

  // 2. Navegador dentro de la app. No pasa por los links universales, asi
  //    que no lo intercepta la otra app.
  if (WebBrowser && WebBrowser.openBrowserAsync) {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: 'pageSheet',
        enableBarCollapsing: true,
      });
      return 'navegador';
    } catch (e) { /* sigue */ }
  }

  // 3. El otro dominio. Sin los modulos nativos, esta es la unica forma de
  //    esquivar que la app de socios se quede con el link.
  const alterna = dominioAlternativo(url);
  if (alterna) {
    try {
      await Linking.openURL(alterna);
      return 'dominio_alterno';
    } catch (e) { /* sigue */ }
  }

  // 4. Ultimo recurso. Puede terminar abriendo la otra app.
  try {
    await Linking.openURL(url);
    return 'sistema';
  } catch (e) {
    Alert.alert('No se pudo abrir', 'Proba de nuevo en un momento.');
    return 'error';
  }
}


/**
 * Cuando abrir no funciona. Deja el link a mano para pegarlo donde sea.
 */
export async function compartirLink(url, nombre) {
  try {
    await Share.share({ message: `${nombre || 'Archivo'}\n${url}`, url });
  } catch (e) {
    try {
      Clipboard.setString(url);
      Alert.alert('Link copiado', 'Pegalo en el navegador para abrirlo.');
    } catch (e2) {
      Alert.alert('El link', url);
    }
  }
}

/** Que caminos hay disponibles. Para diagnosticar si algo no abre. */
export function estadoArchivos() {
  return {
    descarga: !!(FS && FS.downloadAsync),
    compartir: !!Sharing,
    navegador: !!(WebBrowser && WebBrowser.openBrowserAsync),
    plataforma: Platform.OS,
  };
}
