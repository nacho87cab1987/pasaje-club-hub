import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { desempeno } from '../api/client';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

const colorNota = (p) => {
  if (p === null || p === undefined) return C.ink3;
  if (p >= 4.2) return C.ok;
  if (p >= 3) return C.tealDeep;
  if (p >= 2) return C.warn;
  return C.bordo;
};

export default function DesempenoEquipoScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await desempeno.equipo()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  if (!data.hay_ciclo) {
    return <Vacio icono="insights" titulo="Sin ciclo abierto"
      texto="Cuando se abra un ciclo, vas a poder evaluar a tu equipo." />;
  }

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={data.items}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={(
        <RefreshControl refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
      )}
      ListEmptyComponent={(
        <Vacio icono="group" titulo="Sin gente a cargo"
          texto="Acá aparece el equipo que tenés que evaluar." />
      )}
      ListHeaderComponent={(
        <View style={[s.cab, sombra]}>
          <Text style={s.cicloN}>{data.ciclo.nombre}</Text>
          <Text style={s.cicloS}>
            {data.pendientes === 0
              ? 'Evaluaste a todo el equipo'
              : `Te faltan ${data.pendientes} de ${data.items.length}`}
          </Text>
        </View>
      )}
      renderItem={({ item }) => {
        const hecha = item.estado_jefe === 'enviada';
        // Una brecha grande merece que se note: ahi hay algo que hablar.
        const brechaFuerte = item.brecha !== null && Math.abs(item.brecha) >= 0.7;
        return (
          <Pressable
            style={[s.item, sombra]}
            onPress={() => navigation.navigate('DesempenoEvaluar', {
              personaId: item.id, nombre: item.nombre,
            })}
          >
            <Avatar persona={item} texto={iniciales(...String(item.nombre).split(' '))} tam={40} />

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.nombre} numberOfLines={1}>{item.nombre}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {[item.puesto, item.area].filter(Boolean).join(' · ') || 'Sin puesto'}
              </Text>

              <View style={s.estados}>
                <View style={[s.pill, hecha ? s.pillOk : s.pillPend]}>
                  <Text style={[s.pillTxt, { color: hecha ? '#1B5E3F' : '#854F0B' }]}>
                    {hecha ? 'Evaluada' : 'Te falta evaluarla'}
                  </Text>
                </View>
                {item.estado_auto === 'enviada' ? (
                  <Text style={s.auto}>auto {item.puntaje_auto}</Text>
                ) : (
                  <Text style={s.autoPend}>sin autoevaluar</Text>
                )}
              </View>

              {brechaFuerte ? (
                <View style={s.brecha}>
                  <MaterialIcons name="compare-arrows" size={12} color={C.bordo} />
                  <Text style={s.brechaTxt}>
                    {item.brecha > 0
                      ? `Se ve ${item.brecha.toFixed(1)} puntos mejor de lo que la ves`
                      : `Se ve ${Math.abs(item.brecha).toFixed(1)} puntos peor de lo que la ves`}
                  </Text>
                </View>
              ) : null}
            </View>

            {item.puntaje_jefe !== null ? (
              <View style={[s.nota, { backgroundColor: `${colorNota(item.puntaje_jefe)}18` }]}>
                <Text style={[s.notaN, { color: colorNota(item.puntaje_jefe) }]}>
                  {item.puntaje_jefe}
                </Text>
              </View>
            ) : (
              <MaterialIcons name="chevron-right" size={20} color={C.ink3} />
            )}
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  cab: { backgroundColor: C.navy, borderRadius: R.lg, padding: 15, marginBottom: 12 },
  cicloN: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cicloS: { fontSize: 12.5, color: '#A9CBD6', marginTop: 3 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 13, marginBottom: 9,
  },
  nombre: { fontSize: 15, fontWeight: '600', color: C.ink },
  sub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  estados: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  pill: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
  pillOk: { backgroundColor: '#E1F5EE' },
  pillPend: { backgroundColor: '#FAEEDA' },
  pillTxt: { fontSize: 10.5, fontWeight: '700' },
  auto: { fontSize: 11, color: C.tealDeep, fontWeight: '600' },
  autoPend: { fontSize: 11, color: C.ink3, fontStyle: 'italic' },
  brecha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  brechaTxt: { fontSize: 10.5, color: C.bordo, fontWeight: '600', flex: 1 },
  nota: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  notaN: { fontSize: 16, fontWeight: '700' },
});
