import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, PanResponder, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R } from './theme';

const MIN = 0.35;
const MAX = 1.6;
const PASO = 0.2;

const distancia = (t) => {
  const [a, b] = t;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

const acotar = (v) => Math.min(MAX, Math.max(MIN, v));

/**
 * Permite achicar y agrandar el contenido con dos dedos.
 *
 * Se hace con PanResponder y no con una libreria de gestos porque
 * gesture-handler no esta en la build: agregarlo obligaria a recompilar.
 *
 * El gesto solo se toma cuando hay DOS dedos en pantalla. Con uno, el evento
 * pasa de largo y el scroll de abajo sigue funcionando normal.
 */
export default function Zoomable({ children }) {
  const [escala, setEscala] = useState(1);
  // El alto se mide en vez de recibirse: un valor fijo deja franjas vacias en
  // pantallas altas y corta el contenido en las chicas.
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });
  const escalaRef = useRef(1);
  const base = useRef(1);
  const distInicial = useRef(0);

  const aplicar = (v) => {
    const n = acotar(v);
    escalaRef.current = n;
    setEscala(n);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,

      // Con dos dedos el gesto se le saca al ScrollView de adentro: si no,
      // el scroll se lo queda y el pinch no llega a activarse nunca.
      onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length === 2,

      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) {
          base.current = escalaRef.current;
          distInicial.current = distancia(t);
        }
      },

      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length !== 2 || !distInicial.current) return;
        aplicar(base.current * (distancia(t) / distInicial.current));
      },

      onPanResponderRelease: () => { distInicial.current = 0; },
      onPanResponderTerminate: () => { distInicial.current = 0; },
    }),
  ).current;

  const pct = Math.round(escala * 100);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1, overflow: 'hidden' }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCaja({ ancho: width, alto: height });
        }}
        {...pan.panHandlers}
      >
        {/* El origen arriba a la izquierda evita que al achicar el contenido
            se corra fuera del area visible.
            Se agranda el lienzo en la proporcion inversa a la escala: asi,
            al achicar, entra mas contenido en vez de quedar una franja
            vacia a los costados. */}
        {caja.alto > 0 ? (
          <View style={[styles.lienzo, {
            transform: [{ scale: escala }],
            width: caja.ancho / escala,
            height: caja.alto / escala,
          }]}
          >
            {children}
          </View>
        ) : null}
      </View>

      <View style={styles.controles}>
        <Pressable
          style={styles.btn}
          onPress={() => aplicar(escalaRef.current - PASO)}
          disabled={escala <= MIN}
        >
          <MaterialIcons name="remove" size={19}
            color={escala <= MIN ? C.ink3 : C.navy} />
        </Pressable>

        <Pressable style={styles.pct} onPress={() => aplicar(1)}>
          <Text style={styles.pctTxt}>{pct}%</Text>
        </Pressable>

        <Pressable
          style={styles.btn}
          onPress={() => aplicar(escalaRef.current + PASO)}
          disabled={escala >= MAX}
        >
          <MaterialIcons name="add" size={19}
            color={escala >= MAX ? C.ink3 : C.navy} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lienzo: Platform.select({
    // transformOrigin existe desde RN 0.74. El fallback centra la escala,
    // que se ve raro pero no rompe nada.
    default: { transformOrigin: 'top left' },
  }),
  controles: {
    position: 'absolute', right: 14, bottom: 20,
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 22, borderWidth: 1, borderColor: C.line, overflow: 'hidden',
    shadowColor: '#072D40', shadowOpacity: 0.16, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  btn: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center' },
  pct: {
    paddingHorizontal: 10, height: 40, justifyContent: 'center',
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.lineSoft,
  },
  pctTxt: { fontSize: 12.5, fontWeight: '700', color: C.navy, minWidth: 38, textAlign: 'center' },
});
