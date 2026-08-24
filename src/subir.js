// ============================================================================
// Subida de archivos
// ----------------------------------------------------------------------------
// React Native 0.86 dejo de aceptar el patron viejo de FormData con objetos
// { uri, name, type }: tira "Unsupported FormDataPart implementation". Era
// como subiamos las fotos del muro, los adjuntos del CRM y los documentos.
//
// La salida es expo-file-system, que sube el archivo de forma nativa sin
// pasar por FormData. Se deja igual el camino viejo como respaldo, por si el
// modulo no estuviera en la build: asi la app degrada en vez de romperse.
// ============================================================================

import { API, getToken, ApiError } from './api/client';

let FS = null;
try {
  // Desde SDK 54 la API vieja vive en /legacy; uploadAsync sigue ahi.
  FS = require('expo-file-system/legacy');
  if (!FS || !FS.uploadAsync) FS = require('expo-file-system');
} catch (e) {
  try { FS = require('expo-file-system'); } catch (e2) { FS = null; }
}

export const haySubidaNativa = !!(FS && FS.uploadAsync);

/**
 * Sube un archivo a un endpoint del hub.
 *
 * @param archivo  { uri, name, mimeType }
 * @param opciones { url, campo, params, extras }
 *   - campo:  nombre del campo del formulario ('archivo', 'foto'...)
 *   - params: van en la query string
 *   - extras: campos de texto que acompanan al archivo
 */
export async function subirArchivo(archivo, { url, campo = 'archivo', params, extras } = {}) {
  if (!archivo || !archivo.uri) throw new ApiError('No hay archivo para subir', 0);

  const qs = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  ).toString();
  const destino = `${API}/${url}${qs ? `?${qs}` : ''}`;

  const nombre = (archivo.name || archivo.fileName || `archivo_${Date.now()}`)
    // iOS entrega HEIC; el servidor recibe el JPG ya convertido por el picker,
    // asi que el nombre tiene que acompanar.
    .replace(/\.(heic|heif)$/i, '.jpg');

  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers['X-Token'] = token;

  let texto;
  let status = 0;

  if (haySubidaNativa) {
    const r = await FS.uploadAsync(destino, archivo.uri, {
      httpMethod: 'POST',
      uploadType: FS.FileSystemUploadType.MULTIPART,
      fieldName: campo,
      mimeType: archivo.mimeType || archivo.type || 'application/octet-stream',
      parameters: limpiarExtras(extras),
      headers,
    });
    texto = r.body;
    status = r.status;
  } else {
    // Respaldo: el camino viejo. Funciona en versiones anteriores de RN.
    const form = new FormData();
    form.append(campo, {
      uri: archivo.uri,
      name: nombre,
      type: archivo.mimeType || archivo.type || 'application/octet-stream',
    });
    Object.entries(limpiarExtras(extras)).forEach(([k, v]) => form.append(k, v));

    const res = await fetch(destino, { method: 'POST', headers, body: form });
    texto = await res.text();
    status = res.status;
  }

  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new ApiError('Respuesta inesperada del servidor', status, {
      crudo: String(texto || '').slice(0, 200),
    });
  }
  if (status >= 400 || data.ok === false) {
    throw new ApiError(data.error || 'No se pudo subir', status, data);
  }
  return data;
}

/** uploadAsync solo acepta texto en los parametros. */
function limpiarExtras(extras) {
  const r = {};
  Object.entries(extras || {}).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') r[k] = String(v);
  });
  return r;
}
