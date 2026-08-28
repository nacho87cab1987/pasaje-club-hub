import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Image, Dimensions, View } from 'react-native';
import { C } from './theme';

// ============================================================================
// CAMBIA ESTA PALABRA PARA PROBAR CADA UNA
//
//   'crecer'   El logo aparece creciendo desde el centro y se va hacia
//              adelante, como si entraras a la app. Es la mas sobria.
//
//   'cortina'  El fondo navy se abre hacia arriba y deja ver la app, con el
//              logo subiendo. La que mejor conecta con lo que viene despues.
//
//   'trazo'    El logo se dibuja de izquierda a derecha, como si lo pintaran.
//              La mas llamativa; se nota que hay una animacion.
//
//   'pulso'    El isotipo late una vez y el logo completo aparece alrededor.
//              La mas corta: no hace esperar.
// ============================================================================
const ANIMACION = 'trazo';

const PROPORCION = 528 / 300;

export default function Bienvenida({ onTerminar }) {
  const v = {
    opacidad: useRef(new Animated.Value(0)).current,
    escala:   useRef(new Animated.Value(1)).current,
    subir:    useRef(new Animated.Value(0)).current,
    ancho:    useRef(new Animated.Value(0)).current,
    salida:   useRef(new Animated.Value(1)).current,
    fondoY:   useRef(new Animated.Value(0)).current,
  };

  useEffect(() => {
    const listo = ({ finished }) => { if (finished && onTerminar) onTerminar(); };

    if (ANIMACION === 'crecer') {
      v.escala.setValue(0.86);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(v.opacidad, { toValue: 1, duration: 360, useNativeDriver: true,
            easing: Easing.out(Easing.quad) }),
          Animated.spring(v.escala, { toValue: 1, useNativeDriver: true, friction: 7, tension: 50 }),
        ]),
        Animated.delay(380),
        Animated.parallel([
          // Crece un poco mas al irse: da sensacion de entrar, no de cerrar.
          Animated.timing(v.escala, { toValue: 1.18, duration: 380, useNativeDriver: true,
            easing: Easing.in(Easing.quad) }),
          Animated.timing(v.salida, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
      ]).start(listo);

    } else if (ANIMACION === 'cortina') {
      const alto = Dimensions.get('window').height;
      Animated.sequence([
        Animated.parallel([
          Animated.timing(v.opacidad, { toValue: 1, duration: 340, useNativeDriver: true }),
          Animated.timing(v.subir, { toValue: 1, duration: 520, useNativeDriver: true,
            easing: Easing.out(Easing.cubic) }),
        ]),
        Animated.delay(300),
        // El fondo se va hacia arriba y descubre la app que ya esta abajo.
        Animated.timing(v.fondoY, { toValue: -alto, duration: 480, useNativeDriver: true,
          easing: Easing.in(Easing.cubic) }),
      ]).start(listo);

    } else if (ANIMACION === 'trazo') {
      Animated.sequence([
        Animated.timing(v.opacidad, { toValue: 1, duration: 180, useNativeDriver: true }),
        // El ancho no puede ir por el driver nativo: se anima en JS.
        Animated.timing(v.ancho, { toValue: 1, duration: 560, useNativeDriver: false,
          easing: Easing.inOut(Easing.cubic) }),
        Animated.delay(240),
        Animated.timing(v.salida, { toValue: 0, duration: 340, useNativeDriver: true }),
      ]).start(listo);

    } else {
      v.escala.setValue(0.7);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(v.opacidad, { toValue: 1, duration: 240, useNativeDriver: true }),
          Animated.spring(v.escala, { toValue: 1, useNativeDriver: true, friction: 4.5, tension: 90 }),
        ]),
        Animated.delay(280),
        Animated.timing(v.salida, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(listo);
    }
  }, []);

  const ancho = Math.min(230, Dimensions.get('window').width * 0.58);

  const desplazamiento = v.subir.interpolate({
    inputRange: [0, 1], outputRange: [26, 0],
  });

  const recorte = v.ancho.interpolate({
    inputRange: [0, 1], outputRange: [0, ancho],
  });

  const logo = (
    <Animated.Image
      source={require('../assets/logo.png')}
      resizeMode="contain"
      style={{ width: ancho, aspectRatio: PROPORCION }}
    />
  );

  return (
    <Animated.View
      style={[s.capa, {
        opacity: ANIMACION === 'cortina' ? 1 : v.salida,
        transform: [{ translateY: v.fondoY }],
      }]}
      pointerEvents="none"
    >
      {ANIMACION === 'trazo' ? (
        // Se revela recortando el ancho del contenedor, no escalando la
        // imagen: asi el logo no se deforma mientras aparece.
        <Animated.View style={{ width: recorte, overflow: 'hidden', opacity: v.opacidad }}>
          <View style={{ width: ancho }}>{logo}</View>
        </Animated.View>
      ) : (
        <Animated.View style={{
          opacity: v.opacidad,
          transform: [{ scale: v.escala }, { translateY: desplazamiento }],
        }}
        >
          {logo}
        </Animated.View>
      )}
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
    elevation: 999,
  },
});
