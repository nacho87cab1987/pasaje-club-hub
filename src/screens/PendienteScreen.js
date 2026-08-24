import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R, icono } from '../theme';

/**
 * Un modulo habilitado en el servidor que esta version de la app todavia no
 * dibuja. Mostrarlo asi es mejor que ocultarlo: la persona entiende que le
 * corresponde y que esta en camino, en vez de creer que le falta un permiso.
 */
export default function PendienteScreen({ route, navigation }) {
  const m = route.params?.modulo || {};

  useEffect(() => {
    if (m.nombre) navigation.setOptions({ title: m.nombre });
  }, [m, navigation]);

  return (
    <View style={s.wrap}>
      <View style={[s.bx, { backgroundColor: m.color_fondo || C.tealSoft }]}>
        <MaterialIcons name={icono(m.icono)} size={38} color={m.color || C.tealDeep} />
      </View>
      <Text style={s.tit}>{m.nombre || 'Modulo'}</Text>
      <Text style={s.txt}>
        Ya lo tenes habilitado. La pantalla esta en construccion y va a aparecer
        en una proxima actualizacion.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 34 },
  bx: { width: 78, height: 78, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tit: { fontSize: 19, fontWeight: '700', color: C.ink, marginTop: 18, letterSpacing: -0.3 },
  txt: { fontSize: 14, color: C.ink2, textAlign: 'center', marginTop: 8, lineHeight: 21, maxWidth: 300 },
});
