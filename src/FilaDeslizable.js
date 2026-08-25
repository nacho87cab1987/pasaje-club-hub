import React, { useRef } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R } from './theme';

const UMBRAL = 72;   // cuanto hay que arrastrar para que dispare
const TOPE   = 96;   // hasta donde se deja arrastrar

/**
 * Fila que se desliza hacia la izquierda para revelar una accion.
 *
 * El gesto solo se toma cuando el movimiento es claramente horizontal: si no,
 * se roba el scroll de la lista y no se puede recorrer con el dedo.
 */
export default function FilaDeslizable({ children, onAccion, icono, texto, color = C.tealDeep }) {
  const x = useRef(new Animated.Value(0)).current;
  const abierto = useRef(false);

  const volver = () => {
    abierto.current = false;
    Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // No se reclama el gesto al tocar: eso mataria el onPress de la fila.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,

      onPanResponderMove: (_, g) => {
        // Solo hacia la izquierda, y con resistencia pasado el tope.
        const d = Math.min(0, g.dx);
        x.setValue(d < -TOPE ? -TOPE + (d + TOPE) * 0.2 : d);
      },

      onPanResponderRelease: (_, g) => {
        if (g.dx < -UMBRAL) {
          // Se completa la salida y despues se dispara: si se hace al reves,
          // la fila parece trabarse.
          Animated.timing(x, { toValue: -TOPE, duration: 90, useNativeDriver: true })
            .start(() => { onAccion && onAccion(); volver(); });
        } else {
          volver();
        }
      },
      onPanResponderTerminate: volver,
    }),
  ).current;

  const opacidad = x.interpolate({
    inputRange: [-UMBRAL, -20, 0],
    outputRange: [1, 0.35, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.fondo, { opacity: opacidad }]} pointerEvents="none">
        <MaterialIcons name={icono} size={21} color={color} />
        {texto ? <Text style={[s.txt, { color }]}>{texto}</Text> : null}
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative' },
  fondo: {
    position: 'absolute', right: 0, top: 0, bottom: 9,
    width: 96, alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: C.tealSoft, borderRadius: R.lg,
  },
  txt: { fontSize: 10.5, fontWeight: '700' },
});
