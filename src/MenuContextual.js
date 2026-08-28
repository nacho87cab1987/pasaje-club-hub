import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions, Animated,
  Vibration, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R } from './theme';

// expo-haptics da el golpecito seco de iOS. Si no esta en la build, se cae a
// Vibration, que es parte del nucleo de React Native y siempre existe: la
// diferencia se siente, pero nunca queda sin respuesta al dedo.
let Haptics = null;
let motivoHaptics = 'no intentado';
try {
  Haptics = require('expo-haptics');
  motivoHaptics = Haptics && Haptics.impactAsync ? 'disponible' : 'cargado sin impactAsync';
} catch (e) {
  Haptics = null;
  motivoHaptics = 'no instalado: ' + String(e.message || e).slice(0, 60);
}

/** Que paso con la vibracion. Se usa desde el diagnostico del perfil. */
export function estadoVibracion() {
  return {
    haptics: motivoHaptics,
    ultimo: ultimoIntento,
    plataforma: Platform.OS,
  };
}

let ultimoIntento = 'todavia no se uso';

export function vibrar(fuerte = false) {
  // 1. Lo mejor: el motor haptico. Da el golpe seco de iOS.
  if (Haptics) {
    try {
      if (Haptics.impactAsync && Haptics.ImpactFeedbackStyle) {
        Haptics.impactAsync(
          fuerte ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
        );
        ultimoIntento = 'haptics.impactAsync';
        return;
      }
      if (Haptics.selectionAsync) {
        Haptics.selectionAsync();
        ultimoIntento = 'haptics.selectionAsync';
        return;
      }
    } catch (e) {
      ultimoIntento = 'haptics fallo: ' + String(e.message || e).slice(0, 50);
    }
  }

  // 2. Respaldo: el vibrador comun.
  //
  // En iOS, Vibration.vibrate() ignora la duracion y dispara la vibracion
  // completa del sistema. No es sutil, pero se siente. Solo queda muda si el
  // telefono tiene la vibracion apagada en Ajustes.
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(fuerte ? 25 : 12);
    } else {
      Vibration.vibrate();
    }
    ultimoIntento = 'Vibration.vibrate';
  } catch (e) {
    ultimoIntento = 'Vibration fallo: ' + String(e.message || e).slice(0, 50);
  }
}

const ANCHO_MENU = 232;

/**
 * Menu que aparece donde esta el dedo, como el de iOS.
 *
 * Se posiciona con las coordenadas del toque y se acomoda solo si quedaria
 * fuera de la pantalla: cerca del borde inferior sube, cerca del derecho se
 * corre a la izquierda.
 */
export default function MenuContextual({ visible, x, y, titulo, subtitulo, opciones, onCerrar }) {
  const { width, height } = Dimensions.get('window');
  const escala = useRef(new Animated.Value(0.88)).current;
  const opacidad = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      escala.setValue(0.88);
      opacidad.setValue(0);
      Animated.parallel([
        Animated.spring(escala, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }),
        Animated.timing(opacidad, { toValue: 1, duration: 110, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const alto = 54 + (opciones || []).length * 50 + (titulo ? 44 : 0);

  // Debajo del dedo, salvo que no entre: ahi va arriba.
  const arriba = y + alto + 30 > height;
  const top = arriba ? Math.max(60, y - alto - 14) : y + 14;
  const left = Math.min(Math.max(14, x - ANCHO_MENU / 2), width - ANCHO_MENU - 14);

  const elegir = (o) => {
    onCerrar();
    // Se cierra primero: si la accion abre otra pantalla, el menu no queda
    // colgado encima.
    setTimeout(() => o.onPress && o.onPress(), 60);
  };

  // Sin Modal a proposito.
  //
  // Un Modal obliga a la pantalla de abajo a recalcular su layout al abrirse,
  // y una lista larga -como el chat- pierde la posicion del scroll y salta al
  // principio. Como capa absoluta dentro de la misma pantalla, nada de lo que
  // hay debajo se vuelve a medir.
  return (
    <View style={s.contenedor} pointerEvents="box-none">
      <Pressable style={s.fondo} onPress={onCerrar}>
        <Animated.View style={{ opacity: opacidad, flex: 1 }} pointerEvents="box-none">
          <Animated.View
            style={[
              s.menu,
              { top, left, width: ANCHO_MENU },
              { transform: [{ scale: escala }] },
            ]}
          >
            {titulo ? (
              <View style={s.cab}>
                <Text style={s.cabT} numberOfLines={1}>{titulo}</Text>
                {subtitulo ? (
                  <Text style={s.cabS} numberOfLines={1}>{subtitulo}</Text>
                ) : null}
              </View>
            ) : null}

            {(opciones || []).map((o, i) => (
              <Pressable
                key={o.texto}
                style={({ pressed }) => [
                  s.opcion,
                  i < opciones.length - 1 && s.borde,
                  pressed && { backgroundColor: C.lineSoft },
                ]}
                onPress={() => elegir(o)}
              >
                <Text style={[s.opcionT, o.destructivo && { color: C.bordo }]}>
                  {o.texto}
                </Text>
                {o.icono ? (
                  <MaterialIcons
                    name={o.icono}
                    size={19}
                    color={o.destructivo ? C.bordo : C.ink2}
                  />
                ) : null}
              </Pressable>
            ))}
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/**
 * Guarda donde toco el dedo. onLongPress no trae las coordenadas, asi que
 * hay que tomarlas en onPressIn, que si las tiene.
 */
export function usarPosicionToque() {
  const pos = useRef({ x: 0, y: 0 });
  const [menu, setMenu] = useState(null);

  const alTocar = (e) => {
    const n = e && e.nativeEvent;
    if (n) pos.current = { x: n.pageX, y: n.pageY };
  };

  const abrir = (datos) => {
    vibrar();
    setMenu({ ...datos, x: pos.current.x, y: pos.current.y });
  };

  return { alTocar, abrir, menu, cerrar: () => setMenu(null) };
}

const s = StyleSheet.create({
  contenedor: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 900, elevation: 900,
  },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.28)' },
  menu: {
    position: 'absolute', backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#072D40', shadowOpacity: 0.22, shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  cab: {
    paddingHorizontal: 15, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.bg,
  },
  cabT: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  cabS: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 15, height: 50,
  },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  opcionT: { fontSize: 15, color: C.ink },
});


// ----------------------------------------------------------------------------

/**
 * El mismo menu, pero manejado por referencia en vez de por estado.
 *
 * Abrir el menu con useState obliga a redibujar TODA la pantalla, y en una
 * pantalla con una lista larga -el chat- eso hace que la lista se reacomode y
 * pierda la posicion del scroll.
 *
 * Con este, el estado vive adentro del propio menu: la pantalla no se entera
 * de que se abrio y no se vuelve a dibujar.
 *
 * Se usa asi:
 *   const menu = useRef(null);
 *   <Pressable onPressIn={(e) => menu.current.marcar(e)}
 *              onPress={() => menu.current.abrir({ titulo, opciones })} />
 *   <MenuAnclado ref={menu} />
 */
export const MenuAnclado = forwardRef((props, ref) => {
  const [datos, setDatos] = useState(null);
  const pos = useRef({ x: 0, y: 0 });

  useImperativeHandle(ref, () => ({
    // Guarda donde toco el dedo. onPress no trae coordenadas; onPressIn si.
    marcar: (e) => {
      const n = e && e.nativeEvent;
      if (n) pos.current = { x: n.pageX, y: n.pageY };
    },
    abrir: (d) => {
      vibrar();
      setDatos({ ...d, x: pos.current.x, y: pos.current.y });
    },
    cerrar: () => setDatos(null),
  }), []);

  return (
    <MenuContextual
      visible={!!datos}
      x={datos && datos.x}
      y={datos && datos.y}
      titulo={datos && datos.titulo}
      subtitulo={datos && datos.subtitulo}
      opciones={datos && datos.opciones}
      onCerrar={() => setDatos(null)}
    />
  );
});
