import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { encuestas } from '../api/client';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra } from '../theme';

export default function EncuestaResultadosScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await encuestas.resultados(id)); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const menu = () => {
    Alert.alert(data.encuesta.titulo, null, [
      ...(data.encuesta.estado === 'abierta'
        ? [{ text: 'Cerrar encuesta', onPress: async () => {
              try { await encuestas.estado(id, 'cerrada'); cargar(); }
              catch (e) { Alert.alert('No se pudo', e.message); }
            } }]
        : []),
      { text: 'Eliminar', style: 'destructive', onPress: eliminar },
      { text: 'Cerrar', style: 'cancel' },
    ]);
  };

  const eliminar = async () => {
    try {
      await encuestas.eliminar(id);
      navigation.goBack();
    } catch (e) {
      // El servidor avisa cuando hay respuestas: se pide confirmacion.
      Alert.alert('Ojo', e.message, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar igual',
          style: 'destructive',
          onPress: async () => {
            try { await encuestas.eliminar(id, true); navigation.goBack(); }
            catch (x) { Alert.alert('No se pudo', x.message); }
          },
        },
      ]);
    }
  };

  useEffect(() => {
    if (!data) return;
    navigation.setOptions({
      title: 'Resultados',
      headerRight: () => (
        <Pressable onPress={menu} hitSlop={10} style={{ marginRight: 4 }}>
          <MaterialIcons name="more-vert" size={22} color={C.navy} />
        </Pressable>
      ),
    });
  }, [data, navigation]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      <View style={[s.cab, sombra]}>
        <Text style={s.titulo}>{data.encuesta.titulo}</Text>
        <View style={s.numeros}>
          <View style={s.dato}>
            <Text style={s.datoN}>{data.respondieron}</Text>
            <Text style={s.datoT}>respondieron</Text>
          </View>
          <View style={s.sep} />
          <View style={s.dato}>
            <Text style={s.datoN}>{data.avance}%</Text>
            <Text style={s.datoT}>de {data.alcanzados}</Text>
          </View>
        </View>
      </View>

      {/* Con pocas respuestas el anonimato se debilita: quien lea puede
          deducir quien dijo que. Conviene decirlo antes de sacar
          conclusiones. */}
      {data.pocas_respuestas ? (
        <View style={s.aviso}>
          <MaterialIcons name="info-outline" size={18} color="#854F0B" />
          <Text style={s.avisoTxt}>
            Con tan pocas respuestas se puede deducir quién dijo qué. Esperá a
            que conteste más gente antes de compartir estos resultados.
          </Text>
        </View>
      ) : null}

      {data.preguntas.map((p, i) => (
        <View key={p.id} style={{ marginTop: 18 }}>
          <Text style={s.pregunta}>{i + 1}. {p.texto}</Text>

          {p.tipo === 'escala' ? (
            <Card>
              <View style={{ padding: 14 }}>
                <View style={s.promedio}>
                  <Text style={s.promedioN}>{p.promedio ?? '—'}</Text>
                  <Text style={s.promedioT}>promedio sobre 5</Text>
                </View>
                {[5, 4, 3, 2, 1].map((n) => {
                  const cant = p.distribucion?.[n] || p.distribucion?.[String(n)] || 0;
                  const pct = p.respuestas > 0 ? Math.round((cant / p.respuestas) * 100) : 0;
                  return (
                    <View key={n} style={s.fila}>
                      <Text style={s.filaN}>{n}</Text>
                      <View style={s.barra}>
                        <View style={[s.barraLlena, { width: `${pct}%` }]} />
                      </View>
                      <Text style={s.filaC}>{cant}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : p.tipo === 'texto' ? (
            <Card>
              {p.textos.length ? p.textos.map((t, j) => (
                <View key={j} style={[s.texto, j < p.textos.length - 1 && s.borde]}>
                  <Text style={s.textoTxt}>{t}</Text>
                </View>
              )) : (
                <Text style={s.vacio}>Sin respuestas</Text>
              )}
            </Card>
          ) : (
            <Card>
              <View style={{ padding: 14 }}>
                {p.opciones.map((o) => (
                  <View key={o.texto} style={s.opcion}>
                    <View style={s.opcionTop}>
                      <Text style={s.opcionTxt}>{o.texto}</Text>
                      <Text style={s.opcionN}>{o.n} · {o.pct}%</Text>
                    </View>
                    <View style={s.barra}>
                      <View style={[s.barraLlena, { width: `${o.pct}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cab: { backgroundColor: C.navy, borderRadius: R.lg, padding: 16 },
  titulo: { fontSize: 16.5, fontWeight: '700', color: '#fff', lineHeight: 22 },
  numeros: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 13,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)',
  },
  dato: { flex: 1, alignItems: 'center' },
  datoN: { fontSize: 21, fontWeight: '700', color: C.teal },
  datoT: { fontSize: 11, color: '#A9CBD6', marginTop: 2 },
  sep: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.14)' },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#FAEEDA',
    borderRadius: R.md, padding: 13, marginTop: 12,
  },
  avisoTxt: { flex: 1, fontSize: 12.5, color: '#854F0B', lineHeight: 18 },
  pregunta: { fontSize: 14.5, fontWeight: '600', color: C.ink, marginBottom: 9, lineHeight: 20 },
  promedio: { alignItems: 'center', marginBottom: 14 },
  promedioN: { fontSize: 30, fontWeight: '700', color: C.navy },
  promedioT: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  filaN: { width: 14, fontSize: 12.5, fontWeight: '700', color: C.ink3 },
  filaC: { width: 24, fontSize: 12, color: C.ink3, textAlign: 'right' },
  barra: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.lineSoft, overflow: 'hidden' },
  barraLlena: { height: 8, borderRadius: 4, backgroundColor: C.teal },
  opcion: { marginBottom: 12 },
  opcionTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  opcionTxt: { flex: 1, fontSize: 13.5, color: C.ink },
  opcionN: { fontSize: 12, fontWeight: '700', color: C.tealDeep },
  texto: { paddingHorizontal: 14, paddingVertical: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  textoTxt: { fontSize: 14, color: C.ink, lineHeight: 20 },
  vacio: { padding: 20, fontSize: 13, color: C.ink3, textAlign: 'center' },
});
