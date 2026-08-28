import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { encuestas } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

const ESTADO = {
  borrador: { nom: 'Borrador', color: '#8AA0AB', bg: '#EEF3F5' },
  abierta:  { nom: 'Abierta',  color: '#1B5E3F', bg: '#E1F5EE' },
  cerrada:  { nom: 'Cerrada',  color: '#8AA0AB', bg: '#EEF3F5' },
};

export default function EncuestasScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('mias');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await encuestas.listar()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  useEffect(() => {
    if (!data?.puede_crear) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('EncuestaForm')} hitSlop={10}
          style={{ marginRight: 4 }}>
          <MaterialIcons name="add-circle" size={24} color={C.navy} />
        </Pressable>
      ),
    });
  }, [navigation, data]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const lista = vista === 'mias'
    ? [...data.pendientes, ...data.respondidas]
    : data.todas;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {data.puede_crear ? (
        <View style={s.tabs}>
          {[
            { k: 'mias', n: `Para mí ${data.pendientes.length || ''}`.trim() },
            { k: 'todas', n: `Todas ${data.todas.length}` },
          ].map((t) => (
            <Pressable key={t.k} onPress={() => setVista(t.k)}
              style={[s.tab, vista === t.k && s.tabOn]}>
              <Text style={[s.tabTxt, vista === t.k && { color: C.navy, fontWeight: '700' }]}>
                {t.n}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={lista}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 8, paddingBottom: 30 }}
        refreshControl={(
          <RefreshControl refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
        )}
        ListEmptyComponent={(
          <Vacio icono="poll" titulo="Sin encuestas"
            texto={vista === 'mias'
              ? 'Cuando haya una para vos, aparece acá.'
              : 'Tocá el + para armar la primera.'} />
        )}
        renderItem={({ item }) => {
          const est = ESTADO[item.estado] || ESTADO.borrador;
          const pendiente = item.estado === 'abierta' && !item.respondi;
          return (
            <Pressable
              style={[s.item, sombra, pendiente && s.pendiente]}
              onPress={() => navigation.navigate(
                item.respondi || item.estado !== 'abierta' ? 'EncuestaResultados' : 'Encuesta',
                { id: item.id, titulo: item.titulo },
              )}
            >
              <View style={s.top}>
                <Text style={s.titulo} numberOfLines={2}>{item.titulo}</Text>
                <View style={[s.estado, { backgroundColor: est.bg }]}>
                  <Text style={[s.estadoTxt, { color: est.color }]}>{est.nom}</Text>
                </View>
              </View>

              {item.descripcion ? (
                <Text style={s.desc} numberOfLines={2}>{item.descripcion}</Text>
              ) : null}

              <View style={s.meta}>
                {item.anonima ? (
                  <View style={s.tag}>
                    <MaterialIcons name="visibility-off" size={12} color={C.tealDeep} />
                    <Text style={s.tagTxt}>Anónima</Text>
                  </View>
                ) : null}
                {item.obligatoria ? (
                  <View style={s.tag}>
                    <MaterialIcons name="priority-high" size={12} color={C.bordo} />
                    <Text style={[s.tagTxt, { color: C.bordo }]}>Obligatoria</Text>
                  </View>
                ) : null}
                <Text style={s.metaTxt}>
                  {item.preguntas} {item.preguntas === 1 ? 'pregunta' : 'preguntas'}
                </Text>
              </View>

              {vista === 'todas' || item.respondi ? (
                <>
                  <View style={s.barra}>
                    <View style={[s.barraLlena, { width: `${item.avance}%` }]} />
                  </View>
                  <Text style={s.avance}>
                    {item.respondieron} de {item.alcanzados} respondieron
                  </Text>
                </>
              ) : (
                <View style={s.responder}>
                  <MaterialIcons name="arrow-forward" size={15} color={C.teal} />
                  <Text style={s.responderTxt}>Responder</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tabs: {
    flexDirection: 'row', gap: 4, backgroundColor: '#fff', margin: 14, marginBottom: 6,
    padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  tabOn: { backgroundColor: C.tealSoft },
  tabTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  item: { backgroundColor: '#fff', borderRadius: R.lg, padding: 14, marginBottom: 9 },
  pendiente: { borderLeftWidth: 4, borderLeftColor: C.teal },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  titulo: { flex: 1, fontSize: 15.5, fontWeight: '700', color: C.ink, lineHeight: 21 },
  estado: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  estadoTxt: { fontSize: 10.5, fontWeight: '700' },
  desc: { fontSize: 13, color: C.ink3, marginTop: 5, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 9 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tagTxt: { fontSize: 11, fontWeight: '700', color: C.tealDeep },
  metaTxt: { fontSize: 11.5, color: C.ink3 },
  barra: { height: 5, borderRadius: 3, backgroundColor: C.lineSoft, marginTop: 11, overflow: 'hidden' },
  barraLlena: { height: 5, borderRadius: 3, backgroundColor: C.teal },
  avance: { fontSize: 11.5, color: C.ink3, marginTop: 5 },
  responder: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 11 },
  responderTxt: { fontSize: 13.5, fontWeight: '700', color: C.tealDeep },
});
