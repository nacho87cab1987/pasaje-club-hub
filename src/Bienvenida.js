import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Image, Dimensions } from 'react-native';
import { C } from './theme';

/**
 * Pantalla de apertura.
 *
 * Deliberadamente simple: una capa que cubre todo, el logo centrado, entra y
 * se va. La version anterior tenia un destello con capas superpuestas y
 * recortes, y bastaba que una medida no cerrara para que quedara todo
 * desacomodado. Menos piezas, menos formas de romperse.
 *
 * La proporcion del logo se respeta con aspectRatio en vez de calcular el
 * alto a mano: asi no se deforma si algun dia se cambia la imagen.
 */
const PROPORCION = 528 / 300;   // el logo actual

export default function Bienvenida({ onTerminar }) {
  const opacidad = useRef(new Animated.Value(0)).current;
  const escala = useRef(new Animated.Value(0.86)).current;
  const salida = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacidad, {
          toValue: 1, duration: 380, useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.spring(escala, {
          toValue: 1, useNativeDriver: true, friction: 7, tension: 50,
        }),
      ]),
      Animated.delay(450),
      Animated.timing(salida, {
        toValue: 0, duration: 320, useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]).start(({ finished }) => {
      if (finished && onTerminar) onTerminar();
    });
  }, []);

  const ancho = Math.min(230, Dimensions.get('window').width * 0.58);

  return (
    <Animated.View
      style={[s.capa, { opacity: salida }]}
      // Mientras se ve, no deja tocar lo de abajo; al desaparecer tampoco
      // bloquea nada porque se desmonta.
      pointerEvents="none"
    >
      <Animated.Image
        source={require('../assets/logo.png')}
        resizeMode="contain"
        style={{
          width: ancho,
          aspectRatio: PROPORCION,
          opacity: opacidad,
          transform: [{ scale: escala }],
        }}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  capa: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.navyLogo || C.navy,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,   // en Android el zIndex solo no alcanza
  },
});
