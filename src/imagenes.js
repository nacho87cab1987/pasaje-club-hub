// ============================================================================
// Elegir y subir imagenes
// ----------------------------------------------------------------------------
// La subida va como multipart, no como JSON: mandar una foto en base64 la
// infla un 33% y obliga al servidor a decodificarla en memoria.
// El multipart lo arma subirArchivo(), que usa la subida nativa de
// expo-file-system porque RN 0.86 rompio el FormData con { uri }.
// ============================================================================

import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { subirArchivo } from './subir';

/**
 * Abre la galeria (o la camara) y devuelve las imagenes elegidas.
 * Ya vienen comprimidas y en JPG: el servidor las vuelve a procesar igual,
 * pero subir 12 MB de una foto de iPhone por datos moviles es una espera
 * innecesaria.
 */
export async function elegirImagenes({
  camara = false, maximo = 4, conVideo = false, soloVideo = false,
} = {}) {
  const permiso = camara
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permiso.granted) {
    Alert.alert(
      camara ? 'Sin acceso a la camara' : 'Sin acceso a las fotos',
      'Podes habilitarlo desde los ajustes del telefono.',
    );
    return [];
  }

  // Un tipo por vez y no una lista mixta.
  //
  // Pedir imagenes y videos juntos hacia que la app se cerrara al abrir la
  // galeria. El camino de solo imagenes es el que viene funcionando en el
  // muro desde el principio, asi que se lo respeta y el video se pide aparte.
  const tipos = soloVideo ? ['videos'] : ['images'];

  const opciones = {
    mediaTypes: tipos,
    quality: 0.75,
    exif: false,          // no mandamos ubicacion ni datos del dispositivo
    // Un minuto alcanza para un saludo o un brindis, y evita videos de
    // 200 MB que no van a llegar a subir.
    ...(soloVideo ? { videoMaxDuration: 60 } : {}),
  };

  // Nunca menos de uno: un limite en cero o negativo se comporta distinto
  // segun la plataforma.
  const tope = Math.max(1, maximo);

  const r = camara
    ? await ImagePicker.launchCameraAsync(opciones)
    : await ImagePicker.launchImageLibraryAsync({
        ...opciones,
        allowsMultipleSelection: !soloVideo,
        selectionLimit: tope,
      });

  if (r.canceled) return [];
  return (r.assets || []).slice(0, tope);
}

/**
 * Sube un asset y devuelve { url, miniatura_url, ancho, alto }.
 * destino: 'muro' o 'perfil'. Con 'perfil' el servidor la aplica sola.
 */
export async function subirImagen(asset, destino = 'muro', alProgresar) {
  if (alProgresar) alProgresar(0);

  // El picker marca los videos; van por otra accion porque no se
  // redimensionan ni se les genera miniatura.
  const esVideo = asset.type === 'video'
    || /\.(mp4|mov|m4v|webm)$/i.test(asset.fileName || asset.uri || '');

  if (esVideo) {
    const r = await subirArchivo(asset, {
      url: 'hub_subir.php',
      campo: 'archivo',
      params: { action: 'video' },
    });
    if (alProgresar) alProgresar(1);
    return { ...r, tipo: 'video' };
  }

  // La subida va por el helper: RN 0.86 rechaza el FormData con { uri }.
  const data = await subirArchivo(asset, {
    url: 'hub_subir.php',
    campo: 'archivo',
    params: { action: 'imagen', destino },
  });

  if (alProgresar) alProgresar(1);
  return data;
}

/** Sube varias en serie y devuelve las que salieron bien. */
export async function subirVarias(assets, destino = 'muro', alProgresar) {
  const listas = [];
  for (let i = 0; i < assets.length; i++) {
    if (alProgresar) alProgresar(i, assets.length);
    try {
      listas.push(await subirImagen(assets[i], destino));
    } catch (e) {
      // Una foto que falla no debe tirar abajo las otras tres.
      Alert.alert('Una imagen no se pudo subir', e.message);
    }
  }
  if (alProgresar) alProgresar(assets.length, assets.length);
  return listas;
}
