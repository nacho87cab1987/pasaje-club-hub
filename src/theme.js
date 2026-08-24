// Identidad de marca Pasaje Club.
export const C = {
  navy: '#072D40',
  // El navy del archivo del logo. Difiere del de marca en un punto de verde,
  // pero cuando el logo va sobre fondo liso hay que usar este exacto: con el
  // otro se nota el recuadro.
  navyLogo: '#072E40',
  navy2: '#0B3F58',
  navy3: '#15556F',
  teal: '#11BCB3',
  tealSoft: '#E4F7F6',
  tealDeep: '#0A7F7A',
  cream: '#F0EDE8',
  bordo: '#790F35',
  gold: '#D7CA4A',

  bg: '#EEF3F5',
  card: '#FFFFFF',
  line: '#DCE6E9',
  lineSoft: '#EAF0F2',

  ink: '#0E2430',
  ink2: '#4A6472',
  ink3: '#8AA0AB',

  ok: '#1D9E75',
  okBg: '#E1F5EE',
  warn: '#BA7517',
  warnBg: '#FAEEDA',
};

export const R = { sm: 8, md: 12, lg: 14, xl: 18 };

export const sombra = {
  shadowColor: '#072D40',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

/**
 * La base guarda los iconos con nombre de Material Symbols ('account_tree').
 * @expo/vector-icons usa MaterialIcons, que los nombra con guion medio.
 * Unos pocos no existen en ese set y se mapean a mano.
 */
const EXCEPCIONES = {
  target: 'track-changes',
  ballot: 'how-to-vote',
  checklist: 'fact-check',
};

export function icono(nombre) {
  if (!nombre) return 'apps';
  if (EXCEPCIONES[nombre]) return EXCEPCIONES[nombre];
  return nombre.replace(/_/g, '-');
}

/** Iniciales para el avatar cuando no hay foto. */
export function iniciales(nombre, apellido) {
  const a = (nombre || '').trim()[0] || '';
  const b = (apellido || '').trim()[0] || '';
  return (a + b).toUpperCase() || '?';
}
