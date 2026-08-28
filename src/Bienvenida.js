import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Image, Dimensions } from 'react-native';
import { C } from './theme';

/**
 * Pantalla de apertura.
 *
 * La animacion cubre la espera que ya existe -verificar la sesion y traer el
 * catalogo de modulos- en vez de agregarle tiempo. Por eso dura poco y avisa
 * cuando termina: si los datos llegan antes, no se hace esperar de gusto.
 */
export default function Bienvenida({ onTerminar }) {
  const escala = useRef(new Animated.Value(0.82)).current;
  const opacidad = useRef(new Animated.Value(0)).current;
  const brillo = useRef(new Animated.Value(0)).current;
  const salida = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Entra creciendo, con un rebote corto.
      Animated.parallel([
        Animated.timing(opacidad, {
          toValue: 1, duration: 320, useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.spring(escala, {
          toValue: 1, useNativeDriver: true, friction: 6, tension: 55,
        }),
      ]),
      // Un destello que cruza el logo.
      Animated.timing(brillo, {
        toValue: 1, duration: 620, useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.delay(120),
      // Se va hacia arriba, insinuando que abre la app.
      Animated.parallel([
        Animated.timing(salida, {
          toValue: 0, duration: 340, useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
        Animated.timing(escala, {
          toValue: 1.08, duration: 340, useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished && onTerminar) onTerminar();
    });
  }, []);

  const { width } = Dimensions.get('window');
  const anchoLogo = Math.min(240, width * 0.6);

  const desplazamiento = brillo.interpolate({
    inputRange: [0, 1],
    outputRange: [-anchoLogo, anchoLogo],
  });

  return (
    <Animated.View style={[s.fondo, { opacity: salida }]}>
      <Animated.View style={{ opacity: opacidad, transform: [{ scale: escala }] }}>
        <View style={{ width: anchoLogo, overflow: 'hidden' }}>
          <Image
            source={require('../assets/logo.png')}
            style={{ width: anchoLogo, height: anchoLogo * 0.42 }}
            resizeMode="contain"
          />
          {/* El destello: una franja clara que pasa por encima. */}
          <Animated.View
            pointerEvents="none"
            style={[s.brillo, {
              width: anchoLogo * 0.35,
              transform: [{ translateX: desplazamiento }, { rotate: '18deg' }],
            }]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fondo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.navyLogo || C.navy,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  brillo: {
    position: 'absolute', top: -30, bottom: -30,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
});
