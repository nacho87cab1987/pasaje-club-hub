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

  // Las rutas de subidas van por hub_img.php y no directo al sitio: los
  // archivos viven bajo /socios/uploads/, y la carpeta esta cerrada por
  // .htaccess. Pedirlas por URL directa devolvia 404 o 403, que es por lo
  // que no se veian los adjuntos del chat.
  const limpia = String(ruta).replace(/^\/?(socios\/)?/, '');

  // Todo lo que vive en las carpetas del hub va por el entregador: la
  // carpeta esta cerrada por .htaccess y pedirla directo da 403.
  //
  // 'perfil/...' y 'muro/...' son las fotos que guarda hub_subir.php; el
  // resto de los adjuntos cuelga de 'uploads/'.
  if (limpia.startsWith('uploads/')
      || limpia.startsWith('perfil/')
      || limpia.startsWith('muro/')
      || limpia.startsWith('crm/')) {
    return `${API}/hub_img.php?f=${encodeURIComponent(limpia)}`;
  }

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
  // Los valores vacios se sacan: sin esto un parametro sin definir viaja
  // como la cadena "undefined" y el servidor lo toma como un filtro real.
  const limpio = {};
  for (const [k, v] of Object.entries({ action, ...(params || {}) })) {
    if (v !== null && v !== undefined && v !== '') limpio[k] = v;
  }
  const qs = new URLSearchParams(limpio).toString();
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
  post: (archivo, action, body, params, opts) =>
    request(archivo, action, { method: 'POST', body, params, ...(opts || {}) }),
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
    noLeida:   (id)            => llamar('marcar_no_leida', 'POST', { id }),
    // Para el admin: la lista completa de vendedoras. Un supervisor la
    // recibe dentro de la respuesta de list, pero el admin no.
    vendedores: ()             => api.get('crm_conversaciones.php', 'vendedores_admin'),
    // Derivar: el admin usa 'reasignar', la supervisora 'reasignar_equipo'.
    // llamar() reintenta con la variante correcta segun la credencial.
    transcribir: (adjunto_id) => llamar('transcribir', 'POST', { adjunto_id }),
    derivar:   (id, vendedor_id) =>
      llamar(admin ? 'reasignar' : 'reasignar_equipo', 'POST', { id, vendedor_id }),
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
  const { subirArchivo } = require('../subir');
  return subirArchivo(asset, {
    url: 'hub_crm_subir.php',
    campo: 'archivo',
    params: {
      conversacion_id: conversacionId,
      ...(duracion ? { duracion: Math.round(duracion) } : {}),
    },
  });
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

// Presupuestos: se arman en el panel web (es un editor de 3.500 lineas que
// en un telefono seria peor que abrir la web). Desde la app se listan, se
// comparten y se duplican, que es lo que se necesita estando afuera.
// Pasajito: la IA interna. El backend ya existe en el panel; la app solo
// consume sus endpoints de chat.
export const pasajito = {
  chats:        ()              => api.get('pasajito.php', 'chats'),
  mensajes:     (chat_id)       => api.get('pasajito.php', 'mensajes', { chat_id }),
  nuevoChat:    ()              => api.post('pasajito.php', 'nuevo_chat', {}),
  eliminarChat: (chat_id)       => api.post('pasajito.php', 'eliminar_chat', { chat_id }),
  // La respuesta puede tardar: el modelo consulta conocimiento, catalogo y
  // precios antes de contestar.
  enviar: (chat_id, mensaje, adjuntos) =>
    api.post('pasajito.php', 'enviar',
             { chat_id, mensaje, adjuntos: adjuntos || [] },
             null, { timeout: 120000 }),
};

export const eventos = {
  listar:     ()   => api.get('hub_eventos.php', 'listar'),
  evento:     (id) => api.get('hub_eventos.php', 'evento', { id }),
  opciones:   ()   => api.get('hub_eventos.php', 'opciones'),
  anotarse:   (evento_id) => api.post('hub_eventos.php', 'anotarse', { evento_id }),
  bajarme:    (evento_id) => api.post('hub_eventos.php', 'bajarme', { evento_id }),
  guardar:    (datos)     => api.post('hub_eventos.php', 'guardar', datos),
  publicar:   (evento_id) => api.post('hub_eventos.php', 'publicar', { evento_id }),
  cancelar:   (evento_id, motivo) => api.post('hub_eventos.php', 'cancelar', { evento_id, motivo }),
  asistencia: (evento_id, asistencias) =>
    api.post('hub_eventos.php', 'asistencia', { evento_id, asistencias }),
  eliminar: (evento_id) => api.post('hub_eventos.php', 'eliminar', { evento_id }),
};

export const encuestas = {
  listar:     ()        => api.get('hub_encuestas.php', 'listar'),
  encuesta:   (id)      => api.get('hub_encuestas.php', 'encuesta', { id }),
  resultados: (id)      => api.get('hub_encuestas.php', 'resultados', { id }),
  responder:  (encuesta_id, respuestas) =>
    api.post('hub_encuestas.php', 'responder', { encuesta_id, respuestas }),
  guardar:    (datos)   => api.post('hub_encuestas.php', 'guardar', datos),
  estado:     (encuesta_id, estado) =>
    api.post('hub_encuestas.php', 'estado', { encuesta_id, estado }),
  eliminar:   (encuesta_id, confirmar) =>
    api.post('hub_encuestas.php', 'eliminar', { encuesta_id, confirmar }),
};

export const reconocimientos = {
  muro:    ()      => api.get('hub_reconocimientos.php', 'muro'),
  mios:    ()      => api.get('hub_reconocimientos.php', 'mios'),
  persona: (persona_id) => api.get('hub_reconocimientos.php', 'persona', { persona_id }),
  valores: ()      => api.get('hub_reconocimientos.php', 'valores'),
  resumen: ()      => api.get('hub_reconocimientos.php', 'resumen'),
  crear:   (datos) => api.post('hub_reconocimientos.php', 'crear', datos),
  editar:  (datos) => api.post('hub_reconocimientos.php', 'editar', datos),
  borrar:  (id)    => api.post('hub_reconocimientos.php', 'borrar', { id }),
};

export const desempeno = {
  ciclos:     ()        => api.get('hub_desempeno.php', 'ciclos'),
  mia:        (params)  => api.get('hub_desempeno.php', 'mia', params),
  equipo:     (params)  => api.get('hub_desempeno.php', 'equipo', params),
  evaluacion: (persona_id, params) =>
    api.get('hub_desempeno.php', 'evaluacion', { persona_id, ...(params || {}) }),
  ficha:      (persona_id) => api.get('hub_desempeno.php', 'ficha', { persona_id }),
  guardar:    (datos)   => api.post('hub_desempeno.php', 'guardar', datos),
  enviar:     (evaluacion_id) => api.post('hub_desempeno.php', 'enviar', { evaluacion_id }),
};

export const ventas = {
  resumen:   (params) => api.get('hub_ventas.php', 'resumen', params),
  evolucion: (params) => api.get('hub_ventas.php', 'evolucion', params),
  ranking:   (params) => api.get('hub_ventas.php', 'ranking', params),
  alertas:   (params) => api.get('hub_ventas.php', 'alertas', params),
};

export const onboarding = {
  mio:        ()        => api.get('hub_onboarding.php', 'mio'),
  persona:    (persona_id) => api.get('hub_onboarding.php', 'persona', { persona_id }),
  gente:      ()        => api.get('hub_onboarding.php', 'gente'),
  plantillas: ()        => api.get('hub_onboarding.php', 'plantillas'),
  marcar:     (paso_id, hecho) => api.post('hub_onboarding.php', 'marcar', { paso_id, hecho }),
  asignar:    (persona_id, datos) => api.post('hub_onboarding.php', 'asignar', { persona_id, ...(datos || {}) }),
};

export const comisiones = {
  resumen:       (params) => api.get('hub_comisiones.php', 'resumen', params),
  mis:           (params) => api.get('hub_comisiones.php', 'mis', params),
  periodos:      ()       => api.get('hub_comisiones.php', 'periodos'),
  liquidaciones: (id)     => api.get('hub_comisiones.php', 'liquidaciones', id ? { id } : {}),
  equipo:        (params) => api.get('hub_comisiones.php', 'equipo', params),
};

export const expedientes = {
  mis:     (params) => api.get('hub_expedientes.php', 'mis', params),
  de:      (vendedor_id, params) => api.get('hub_expedientes.php', 'de', { vendedor_id, ...(params || {}) }),
  detalle: (id)     => api.get('hub_expedientes.php', 'detalle', { id }),
  equipo:  ()       => api.get('hub_expedientes.php', 'equipo'),
  resumen: ()       => api.get('hub_expedientes.php', 'resumen'),
};

export const presupuestos = {
  listar:      (params)   => api.get('presupuestos.php', 'list', params),
  get:         (id)       => api.get('presupuestos.php', 'get', { id }),
  publicar:    (id)       => api.post('presupuestos.php', 'publicar', { id }),
  despublicar: (id)       => api.post('presupuestos.php', 'despublicar', { id }),
  duplicar:    (id)       => api.post('presupuestos.php', 'duplicar', { id }),
};

export const notificaciones = {
  listar: ()   => api.get('hub_push.php', 'listar'),
  leidas: (id) => api.post('hub_push.php', 'leidas', id ? { id } : {}),
  probar: ()   => api.post('hub_push.php', 'probar', {}),
  estado: ()   => api.get('hub_push.php', 'estado'),
};

export const organigrama = {
  arbol:       ()    => api.get('hub_organigrama.php', 'arbol'),
  persona:     (id)  => api.get('hub_organigrama.php', 'persona', { id }),
  sueltos:     ()    => api.get('hub_organigrama.php', 'sueltos'),
  cambiarJefe: (persona_id, jefe_id) =>
    api.post('hub_organigrama.php', 'jefe', { persona_id, jefe_id }),
  // Jefas adicionales: se suman a la principal, no la reemplazan.
  jefeExtra: (persona_id, jefe_id, motivo) =>
    api.post('hub_organigrama.php', 'jefe_extra', { persona_id, jefe_id, motivo }),
  quitarJefeExtra: (persona_id, jefe_id) =>
    api.post('hub_organigrama.php', 'quitar_jefe_extra', { persona_id, jefe_id }),
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
  const { subirArchivo } = require('../subir');
  return subirArchivo(archivo, {
    url: 'hub_documentos.php',
    campo: 'archivo',
    params: { action: 'subir' },
    // Van como campos del formulario, no en la URL: la descripcion puede
    // ser larga y algunos servidores recortan las query strings.
    extras: datos,
  });
}

export const gestion = {
  subtarea:     (parent_id, titulo) =>
    api.post('hub_gestion.php', 'subtarea', { parent_id, titulo }),
  deExpediente: (expediente_id) =>
    api.get('hub_gestion.php', 'de_expediente', { expediente_id }),
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
  cambiarPerfil: (persona_id, perfil_id) =>
    api.post('hub_admin.php', 'cambiar_perfil', { persona_id, perfil_id }),
  guardarArea:   (datos) => api.post('hub_admin.php', 'guardar_area', datos),
  guardarPuesto: (datos) => api.post('hub_admin.php', 'guardar_puesto', datos),
  bajaCatalogo:  (tipo, id) => api.post('hub_admin.php', 'baja_catalogo', { tipo, id }),
  eliminar:      (persona_id) => api.post('hub_admin.php', 'eliminar', { persona_id }),
  estado:     (persona_id, estado) => api.post('hub_admin.php', 'estado', { persona_id, estado }),
  auditoria:  (limit = 50)  => api.get('hub_admin.php', 'auditoria', { limit }),
};
