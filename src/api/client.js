// ============================================================================
// Cliente HTTP del hub
// ----------------------------------------------------------------------------
// En React Native NO hay CORS: no existe el preflight OPTIONS que obliga a
// usar text/plain y ?_token= en el navegador. Aca mandamos JSON y el token
// por header X-Token, que es lo correcto. Esa gimnasia queda solo para el
// panel web.
// ============================================================================

// Unico lugar donde vive el dominio. Todo lo demas se deriva de aca.
export const SITIO = 'https://pasajeclub.com';
export const API = `${SITIO}/socios/api`;

/**
 * Arma la URL de una imagen. El servidor devuelve rutas relativas al sitio
 * ('/socios/uploads/...'), pero si algun dia devolviera absolutas, esto las
 * deja pasar sin romper. Devuelve null si no hay imagen, para poder usarlo
 * directo en un ternario.
 */
export function imagenUrl(ruta) {
  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return SITIO + (ruta.startsWith('/') ? ruta : `/${ruta}`);
}

let _token = null;
let _onNoAutorizado = null;

export function setToken(t) { _token = t; }
export function getToken() { return _token; }

/** La app registra aca que hacer cuando el token vencio (7 dias de TTL). */
export function onNoAutorizado(fn) { _onNoAutorizado = fn; }

class ApiError extends Error {
  constructor(mensaje, status, data) {
    super(mensaje);
    this.status = status;
    this.data = data || {};
  }
}
export { ApiError };

async function request(archivo, action, { method = 'GET', body, params, timeout = 15000 } = {}) {
  const qs = new URLSearchParams({ action, ...(params || {}) }).toString();
  const url = `${API}/${archivo}?${qs}`;

  const headers = { Accept: 'application/json' };
  if (_token) headers['X-Token'] = _token;
  if (body) headers['Content-Type'] = 'application/json';

  // Sin esto, una conexion mala deja la pantalla cargando para siempre.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new ApiError('La conexion tardo demasiado', 0);
    throw new ApiError('No se pudo conectar. Revisa tu internet.', 0);
  }
  clearTimeout(timer);

  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    // Un HTML donde esperabamos JSON casi siempre es un error 500 de PHP o
    // una pagina de error del hosting. Mostrar el principio ayuda a ubicarlo.
    throw new ApiError('El servidor respondio algo inesperado', res.status, { crudo: texto.slice(0, 200) });
  }

  // Un 401 de una API de terceros (el CRM viejo, por ejemplo) significa que
  // ESA api rechazo el token, no que la sesion del hub haya vencido. Cerrar
  // sesion por eso deja a la persona afuera sin motivo.
  if (res.status === 401 && archivo.startsWith('hub_') && _onNoAutorizado) {
    _onNoAutorizado();
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.error || `Error ${res.status}`, res.status, data);
  }
  return data;
}

export const api = {
  get:  (archivo, action, params)       => request(archivo, action, { params }),
  post: (archivo, action, body, params) => request(archivo, action, { method: 'POST', body, params }),
};

// --- Atajos por endpoint ---------------------------------------------------

export const auth = {
  login:      (email, password) => api.post('hub_auth.php', 'login', { email, password }),
  me:         ()                => api.get('hub_auth.php', 'me'),
  diag:       ()                => api.get('hub_auth.php', 'diag'),
  registrarPush: (token, plataforma, modelo, app_version) =>
    api.post('hub_auth.php', 'notif_token', { token, plataforma, modelo, app_version }),
  logout:     (token)           => api.post('hub_auth.php', 'logout', { token }),
};

export const muro = {
  feed:        (params)            => api.get('hub_muro.php', 'feed', params),
  post:        (id)                => api.get('hub_muro.php', 'post', { id }),
  dondePublico:()                  => api.get('hub_muro.php', 'donde_publico'),
  publicar:    (datos)             => api.post('hub_muro.php', 'publicar', datos),
  reaccionar:  (post_id, emoji)    => api.post('hub_muro.php', 'reaccionar', { post_id, emoji }),
  comentar:    (post_id, cuerpo, padre_id) => api.post('hub_muro.php', 'comentar', { post_id, cuerpo, padre_id }),
  visto:       (post_ids)          => api.post('hub_muro.php', 'visto', { post_ids }),
  ocultar:     (post_id)           => api.post('hub_muro.php', 'ocultar', { post_id }),
  ocultarComentario: (comentario_id) => api.post('hub_muro.php', 'ocultar', { comentario_id }),
  fijar:       (post_id, fijar, hasta) => api.post('hub_muro.php', 'fijar', { post_id, fijar, hasta }),
};

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------
// Apunta a crm_conversaciones.php, la API que ya usa el panel de vendedoras.
// No duplicamos nada: mismas conversaciones, mismos estados, mismo envio a
// WhatsApp. Lo unico que cambia es que las acciones de admin y las de
// vendedor son distintas, y eso lo define la credencial con la que entraste.
export function crmApi(credencial) {
  let admin = credencial === 'admin';

  /**
   * crm_conversaciones.php tiene acciones separadas para vendedor y admin, y
   * cada una rechaza al otro con 401. Si la variante que elegimos no es la
   * correcta, probamos la otra y nos quedamos con esa: es preferible a
   * dejar la pantalla vacia por una credencial mal deducida.
   */
  async function llamar(base, metodo, datos, params) {
    const pedir = (esAdmin) => {
      const action = esAdmin ? `${base}_admin` : base;
      return metodo === 'POST'
        ? api.post('crm_conversaciones.php', action, datos, params)
        : api.get('crm_conversaciones.php', action, params);
    };
    try {
      return await pedir(admin);
    } catch (e) {
      if (e.status !== 401 && e.status !== 403) throw e;
      const r = await pedir(!admin);
      admin = !admin;
      return r;
    }
  }

  return {
    lista:     (params)        => llamar(admin ? 'list' : 'list', 'GET', null, params),
    get:       (id)            => llamar('get', 'GET', null, { id }),
    responder: (id, contenido, adjunto_ids) =>
      llamar('responder', 'POST', { id, contenido, adjunto_ids }),
    nota:      (id, contenido, adjunto_ids) =>
      api.post('crm_conversaciones.php', 'nota', { id, contenido, adjunto_ids }),
    leida:     (id)            => llamar('marcar_leida', 'POST', { id }),
    estado:    (id, estado, prioridad) => llamar('cambiar_estado', 'POST', { id, estado, prioridad }),

    // Estas dos son iguales para todos: no tienen variante _admin.
    // 'estados' es un catalogo de solo lectura y no tiene variante _admin:
    // depende del parche en crm_conversaciones.php que lo deja pasar con
    // cualquier credencial valida.
    catalogoEstados: ()        => api.get('crm_conversaciones.php', 'estados'),
    etiquetas:  ()             => api.get('crm_conversaciones.php', 'etiquetas'),
    plantillas: ()             => api.get('crm_conversaciones.php', 'plantillas_rapidas'),
    usoPlantilla: (id)         => api.post('crm_conversaciones.php', 'plantilla_rapida_usada', { id }),

    ponerEtiquetas: (id, etiquetas) =>
      llamar('actualizar_etiquetas', 'POST', { id, etiquetas }),
    editarCliente:  (id, datos) =>
      llamar('editar_datos_cliente', 'POST', { id, ...datos }),

    subirAdjunto: (asset, conversacionId, duracion) => subirAdjuntoCrm(asset, conversacionId, duracion),
  };
}

/** Sube un archivo al CRM y devuelve el id para adjuntarlo al mensaje. */
async function subirAdjuntoCrm(asset, conversacionId, duracion) {
  const form = new FormData();
  form.append('archivo', {
    uri: asset.uri,
    name: (asset.fileName || `foto_${Date.now()}.jpg`).replace(/\.(heic|heif)$/i, '.jpg'),
    type: asset.mimeType || 'image/jpeg',
  });

  const qs = duracion ? `&duracion=${Math.round(duracion)}` : '';
  const res = await fetch(`${API}/hub_crm_subir.php?conversacion_id=${conversacionId}${qs}`, {
    method: 'POST',
    headers: { 'X-Token': getToken(), Accept: 'application/json' },
    body: form,
  });
  const texto = await res.text();
  let data;
  try { data = JSON.parse(texto); }
  catch { throw new ApiError('Respuesta inesperada al subir', res.status, { crudo: texto.slice(0, 200) }); }
  if (!res.ok || data.ok === false) throw new ApiError(data.error || 'No se pudo subir', res.status, data);
  return data;
}

// Crear y administrar el catalogo de etiquetas. Va aparte de crmApi porque
// no tiene variantes de vendedor/admin: cualquiera con el modulo CRM puede.
export const etiquetasApi = {
  listar: ()               => api.get('crm_etiquetas_api.php', 'listar'),
  crear:  (nombre, color)  => api.post('crm_etiquetas_api.php', 'crear', { nombre, color }),
  editar: (id, datos)      => api.post('crm_etiquetas_api.php', 'editar', { id, ...datos }),
  borrar: (id)             => api.post('crm_etiquetas_api.php', 'borrar', { id }),
};

// La web de la Academia: las clases se ven ahi, con su reproductor y sus
// examenes. La app muestra el avance y lleva al lugar exacto.
export const ACADEMIA_WEB = 'https://academia.pasajeclub.com.ar';

export const academia = {
  misCursos:    ()   => api.get('hub_academia.php', 'mis_cursos'),
  curso:        (id) => api.get('hub_academia.php', 'curso', { id }),
  certificados: ()   => api.get('hub_academia.php', 'certificados'),
  resumen:      ()   => api.get('hub_academia.php', 'resumen'),
};

export const organigrama = {
  arbol:       ()    => api.get('hub_organigrama.php', 'arbol'),
  persona:     (id)  => api.get('hub_organigrama.php', 'persona', { id }),
  sueltos:     ()    => api.get('hub_organigrama.php', 'sueltos'),
  cambiarJefe: (persona_id, jefe_id) =>
    api.post('hub_organigrama.php', 'jefe', { persona_id, jefe_id }),
};

export const documentos = {
  carpetas:      ()             => api.get('hub_documentos.php', 'carpetas'),
  listar:        (carpeta_id, q)=> api.get('hub_documentos.php', 'listar',
                                     { carpeta_id, ...(q ? { q } : {}) }),
  documento:     (id)           => api.get('hub_documentos.php', 'documento', { id }),
  destinatarios: ()             => api.get('hub_documentos.php', 'destinatarios'),
  confirmar:     (documento_id) => api.post('hub_documentos.php', 'confirmar', { documento_id }),
  acceso:        (documento_id, acceso) => api.post('hub_documentos.php', 'acceso', { documento_id, acceso }),
  borrar:        (documento_id) => api.post('hub_documentos.php', 'borrar', { documento_id }),
};

/**
 * URL para abrir un documento. El token va en la query porque el visor de
 * PDF del sistema abre la URL por su cuenta y no manda headers.
 * Cada descarga se valida del lado del servidor: un recibo de sueldo no
 * puede tener URL publica.
 */
export function urlDocumento(id) {
  return `${API}/hub_doc_bajar.php?id=${id}&_token=${encodeURIComponent(getToken() || '')}`;
}

/** Sube un documento con sus metadatos. */
export async function subirDocumento(archivo, datos) {
  const form = new FormData();
  form.append('archivo', {
    uri: archivo.uri,
    name: archivo.name || `doc_${Date.now()}`,
    type: archivo.mimeType || 'application/octet-stream',
  });
  Object.entries(datos).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') form.append(k, String(v));
  });

  const res = await fetch(`${API}/hub_documentos.php?action=subir`, {
    method: 'POST',
    headers: { 'X-Token': getToken(), Accept: 'application/json' },
    body: form,
  });
  const texto = await res.text();
  let data;
  try { data = JSON.parse(texto); }
  catch { throw new ApiError('Respuesta inesperada al subir', res.status, { crudo: texto.slice(0, 200) }); }
  if (!res.ok || data.ok === false) throw new ApiError(data.error || 'No se pudo subir', res.status, data);
  return data;
}

export const gestion = {
  misTareas: (params)      => api.get('hub_gestion.php', 'mis_tareas', params),
  tarea:     (id)          => api.get('hub_gestion.php', 'tarea', { id }),
  espacios:  ()            => api.get('hub_gestion.php', 'espacios'),
  resumen:   ()            => api.get('hub_gestion.php', 'resumen'),
  completar: (tarea_id, completada) => api.post('hub_gestion.php', 'completar', { tarea_id, completada }),
  comentar:  (tarea_id, texto)      => api.post('hub_gestion.php', 'comentar', { tarea_id, texto }),
  tablero:   ()            => api.get('hub_gestion.php', 'tablero'),
  crear:     (datos)       => api.post('hub_gestion.php', 'crear', datos),
  editar:    (datos)       => api.post('hub_gestion.php', 'editar', datos),
  asignar:   (tarea_id, asignados) => api.post('hub_gestion.php', 'asignar', { tarea_id, asignados }),
  eliminar:  (tarea_id)    => api.post('hub_gestion.php', 'eliminar', { tarea_id }),
};

export const perfil = {
  mio:        ()        => api.get('hub_perfil.php', 'mi_perfil'),
  guardar:    (datos)   => api.post('hub_perfil.php', 'guardar', datos),
  campos:     (valores) => api.post('hub_perfil.php', 'campos', { valores }),
  cumples:    (dias=60) => api.get('hub_perfil.php', 'cumples', { dias }),
  pendientes: ()        => api.get('hub_perfil.php', 'pendientes'),
  cambiarClave: (actual, nueva) => api.post('hub_perfil.php', 'cambiar_clave', { actual, nueva }),
};

export const admin = {
  catalogos:  ()            => api.get('hub_admin.php', 'catalogos'),
  personas:   (params)      => api.get('hub_admin.php', 'personas', params),
  persona:    (id)          => api.get('hub_admin.php', 'persona', { id }),
  setModulo:  (persona_id, modulo, permitido, motivo) =>
    api.post('hub_admin.php', 'set_modulo', { persona_id, modulo, permitido, motivo }),
  setPermiso: (persona_id, permiso, permitido) =>
    api.post('hub_admin.php', 'set_permiso', { persona_id, permiso, permitido }),
  crearPersona: (datos)     => api.post('hub_admin.php', 'crear_persona', datos),
  candidatos: ()            => api.get('hub_admin.php', 'candidatos'),
  resetClave: (persona_id, entrega) => api.post('hub_admin.php', 'reset_clave', { persona_id, entrega }),
  actualizar:   (datos)     => api.post('hub_admin.php', 'actualizar', datos),
  estado:     (persona_id, estado) => api.post('hub_admin.php', 'estado', { persona_id, estado }),
  auditoria:  (limit = 50)  => api.get('hub_admin.php', 'auditoria', { limit }),
};
