// ============================================================================
// Estados de las conversaciones del CRM
// ----------------------------------------------------------------------------
// El catalogo lo define el servidor en crm_estados (accion ?action=estados).
// La app NO tiene su propia lista: si la tuviera, cada vez que agregues un
// estado habria que publicar una version nueva, y mientras tanto las
// conversaciones con ese estado se verian sin nombre ni color.
//
// De cada estado usamos lo que venga (nombre, color, orden) y completamos lo
// que falte con valores deducidos de la clave.
// ============================================================================

let CATALOGO = null;      // { key: {nom, corto, color, bg, icono, orden} }
let ORDEN = [];
let DEFECTO = null;

/**
 * Iconos por clave. Como no sabemos que claves va a haber, se buscan por
 * pedazos del nombre: 'venta_concretada' entra por 'concret'.
 */
const ICONOS = [
  [/nueva|consulta|entrant/i,        'fiber-new'],
  [/curso|cotizando|trabajand/i,     'edit-note'],
  [/enviad|presupuest|cotizacion_e/i,'send'],
  [/interes|caliente|hot/i,          'local-fire-department'],
  [/sin_?respuesta|frio|silenc/i,    'hourglass-disabled'],
  [/sin_?venta|perdid|descartad/i,   'cancel'],
  [/concretad|ganad|vendid|cerrad_?ok/i, 'check-circle'],
  [/archivad/i,                      'inventory-2'],
];

const COLORES = [
  [/nueva|consulta|entrant/i,        '#11BCB3'],
  [/curso|cotizando|trabajand/i,     '#0a8f88'],
  [/enviad|presupuest|cotizacion_e/i,'#185FA5'],
  [/interes|caliente|hot/i,          '#BA7517'],
  [/sin_?respuesta|frio|silenc/i,    '#8AA0AB'],
  [/sin_?venta|perdid|descartad/i,   '#e53935'],
  [/concretad|ganad|vendid/i,        '#2e7d32'],
  [/archivad/i,                      '#8AA0AB'],
];

function porPatron(tabla, clave, porDefecto) {
  for (const [re, valor] of tabla) if (re.test(clave)) return valor;
  return porDefecto;
}

/** Aclara un color hex para usarlo de fondo del chip. */
function suave(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#EEF3F5';
  const m = (i) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * 0.86);
  };
  return `#${[m(0), m(2), m(4)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Nombre legible a partir de la clave: 'venta_concretada' -> 'Venta concretada' */
function desdeClave(k) {
  const t = String(k || '').replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Version corta para los chips de filtro, que son angostos.
 * Se prueba, en orden: el nombre entero si ya es corto, la parte anterior a
 * " de ", y por ultimo la primera palabra si tiene cuerpo suficiente para
 * entenderse sola.
 *   "En curso de cotizacion"  -> "En curso"
 *   "Cotizacion enviada"      -> "Cotizacion"
 *   "Finalizados sin venta"   -> "Finalizados"
 */
function acortar(nombre) {
  const n = String(nombre || '').trim();
  if (n.length <= 16) return n;

  const sinDe = n.split(/\s+de\s+/i)[0].trim();
  if (sinDe.length <= 16) return sinDe;

  const primera = sinDe.split(/\s+/)[0];
  if (primera.length >= 6 && primera.length <= 16) return primera;

  return `${n.slice(0, 15)}…`;
}

/** Guarda el catalogo que devolvio el servidor. */
export function cargarEstados(respuesta) {
  const items = (respuesta && respuesta.items) || [];
  if (!items.length) return false;

  CATALOGO = {};
  ORDEN = [];
  DEFECTO = (respuesta && respuesta.default) || items[0].key;

  items.forEach((e, i) => {
    const k = e.key;
    const nom = e.nombre || e.label || e.titulo || desdeClave(k);
    const color = e.color || porPatron(COLORES, k, '#8AA0AB');
    CATALOGO[k] = {
      nom,
      corto: e.corto || acortar(nom),
      color,
      bg: e.bg || suave(color),
      icono: e.icono && /^[a-z-]+$/.test(e.icono) ? e.icono : porPatron(ICONOS, k, 'label'),
      orden: e.orden != null ? Number(e.orden) : i,
    };
    ORDEN.push(k);
  });

  ORDEN.sort((a, b) => CATALOGO[a].orden - CATALOGO[b].orden);
  return true;
}

export const hayCatalogo = () => !!CATALOGO;
export const estadoDefecto = () => DEFECTO;
export const ordenEstados = () => ORDEN.slice();

export function estadoDe(slug) {
  if (CATALOGO && CATALOGO[slug]) return CATALOGO[slug];
  // Todavia no llego el catalogo, o es un estado que el servidor no declara.
  const k = String(slug || '');
  const color = porPatron(COLORES, k, '#8AA0AB');
  return {
    nom: desdeClave(k) || '-',
    corto: acortar(desdeClave(k)) || '-',
    color,
    bg: suave(color),
    icono: porPatron(ICONOS, k, 'label'),
    orden: 99,
  };
}

/** Chips de filtro de la lista. */
export function filtros() {
  return [{ k: 'todas', nom: 'Todas' },
    ...ORDEN.map((k) => ({ k, nom: CATALOGO[k].corto }))];
}
