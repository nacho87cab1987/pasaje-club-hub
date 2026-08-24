import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R, sombra } from '../theme';

export function Avatar({ texto, tam = 40, fondo = C.tealSoft, color = C.tealDeep }) {
  return (
    <View style={[s.av, { width: tam, height: tam, borderRadius: tam / 2, backgroundColor: fondo }]}>
      <Text style={{ color, fontWeight: '700', fontSize: tam * 0.34 }}>{texto}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[s.card, sombra, style]}>{children}</View>;
}

export function Cargando({ texto = 'Cargando' }) {
  return (
    <View style={s.centro}>
      <ActivityIndicator color={C.teal} size="large" />
      <Text style={s.centroTxt}>{texto}</Text>
    </View>
  );
}

/** Estado de error con reintento. Un error sin salida es una pantalla muerta. */
export function ErrorBox({ mensaje, onReintentar }) {
  return (
    <View style={s.centro}>
      <MaterialIcons name="cloud-off" size={44} color={C.line} />
      <Text style={s.errTit}>No se pudo cargar</Text>
      <Text style={s.errMsg}>{mensaje}</Text>
      {onReintentar ? (
        <Pressable style={s.btn} onPress={onReintentar}>
          <Text style={s.btnTxt}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Vacio({ icono = 'inbox', titulo, texto }) {
  return (
    <View style={s.centro}>
      <MaterialIcons name={icono} size={44} color={C.line} />
      <Text style={s.errTit}>{titulo}</Text>
      {texto ? <Text style={s.errMsg}>{texto}</Text> : null}
    </View>
  );
}

export function Tag({ texto, tipo = 'cool' }) {
  const paleta = {
    ok:   { bg: C.okBg, fg: '#0F6E56' },
    warn: { bg: C.warnBg, fg: '#854F0B' },
    cool: { bg: C.tealSoft, fg: C.tealDeep },
    off:  { bg: C.lineSoft, fg: C.ink3 },
  }[tipo];
  return (
    <View style={[s.tag, { backgroundColor: paleta.bg }]}>
      <Text style={{ color: paleta.fg, fontSize: 11, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

export function Fila({ children, onPress, ultima }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={({ pressed } = {}) => [
        s.fila,
        !ultima && { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
        pressed && { backgroundColor: C.lineSoft },
      ]}
    >
      {children}
    </Comp>
  );
}

export function Boton({ texto, onPress, tipo = 'solido', icono, cargando, deshabilitado }) {
  const solido = tipo === 'solido';
  return (
    <Pressable
      onPress={deshabilitado || cargando ? undefined : onPress}
      style={({ pressed }) => [
        s.boton,
        solido ? { backgroundColor: C.navy } : { borderWidth: 1, borderColor: C.navy },
        (pressed || cargando) && { opacity: 0.75 },
        deshabilitado && { opacity: 0.45 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={solido ? '#fff' : C.navy} size="small" />
      ) : (
        <>
          {icono ? (
            <MaterialIcons name={icono} size={18} color={solido ? '#fff' : C.navy} style={{ marginRight: 6 }} />
          ) : null}
          <Text style={{ color: solido ? '#fff' : C.navy, fontWeight: '600', fontSize: 15 }}>{texto}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Seccion({ titulo }) {
  return <Text style={s.seccion}>{titulo.toUpperCase()}</Text>;
}

const s = StyleSheet.create({
  av: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: R.lg, overflow: 'hidden' },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 34, flex: 1 },
  centroTxt: { marginTop: 12, color: C.ink3, fontSize: 14 },
  errTit: { marginTop: 12, fontSize: 16, fontWeight: '600', color: C.ink2 },
  errMsg: { marginTop: 5, fontSize: 13.5, color: C.ink3, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 16, backgroundColor: C.navy, paddingHorizontal: 22, paddingVertical: 11, borderRadius: R.md },
  btnTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  boton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: R.md },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, color: C.ink3, marginTop: 20, marginBottom: 9 },
});
