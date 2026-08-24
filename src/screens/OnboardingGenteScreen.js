import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { onboarding } from '../api/client';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

export default function OnboardingGenteScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await onboarding.gente()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const asignar = async (p) => {
    Alert.alert('Asignar onboarding', `Se le asigna la lista de bienvenida a ${p.nombre}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Asignar',
        onPress: async () => {
          try { await onboarding.asignar(p.id); await cargar(); }
          catch (e) { Alert.alert('No se pudo', e.message); }
        },
      },
    ]);
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  // Quien esta en curso primero: es donde hay algo que hacer.
  const enCurso = data.items.filter((p) => p.asignado && !p.completado);
  const resto = data.items.filter((p) => !p.asignado || p.completado);

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={[...enCurso, ...resto]}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
      ListEmptyComponent={(
        <Vacio icono="group" titulo="Sin gente a cargo"
          texto="Acá aparece el onboarding de tu equipo." />
      )}
      ListHeaderComponent={enCurso.length ? (
        <Text style={s.encabezado}>
          {enCurso.length} {enCurso.length === 1 ? 'persona' : 'personas'} en onboarding
        </Text>
      ) : null}
      renderItem={({ item }) => (
        <Pressable
          style={[s.item, sombra]}
          onPress={() => (item.asignado
            ? navigation.navigate('Onboarding', { personaId: item.id, nombre: item.nombre })
            : data.puede_asignar ? asignar(item) : null)}
        >
          <Avatar texto={iniciales(...String(item.nombre).split(' '))} tam={40} />

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.nombre} numberOfLines={1}>{item.nombre}</Text>
            <Text style={s.sub} numberOfLines={1}>
              {[item.puesto, item.area].filter(Boolean).join(' · ') || 'Sin puesto'}
            </Text>

            {item.asignado ? (
              <>
                <View style={s.barra}>
                  <View style={[s.barraLlena, { width: `${item.avance}%` },
                                item.completado && { backgroundColor: C.ok }]} />
                </View>
                <View style={s.meta}>
                  <Text style={s.metaTxt}>{item.hechos}/{item.total}</Text>
                  {item.dias !== null ? <Text style={s.metaTxt}>· dia {item.dias}</Text> : null}
                  {item.vencidos > 0 ? (
                    <Text style={s.atrasado}>· {item.vencidos} atrasados</Text>
                  ) : null}
                </View>
              </>
            ) : (
              <Text style={s.sinAsignar}>
                {data.puede_asignar ? 'Tocá para asignarle la bienvenida' : 'Sin onboarding'}
              </Text>
            )}
          </View>

          {item.completado ? (
            <MaterialIcons name="check-circle" size={22} color={C.ok} />
          ) : item.asignado ? (
            <Text style={s.pct}>{item.avance}%</Text>
          ) : (
            <MaterialIcons name="add-circle-outline" size={21} color={C.ink3} />
          )}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  encabezado: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginBottom: 10 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 13, marginBottom: 9,
  },
  nombre: { fontSize: 15, fontWeight: '600', color: C.ink },
  sub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  barra: { height: 5, borderRadius: 3, backgroundColor: C.lineSoft, marginTop: 8, overflow: 'hidden' },
  barraLlena: { height: 5, borderRadius: 3, backgroundColor: C.teal },
  meta: { flexDirection: 'row', gap: 5, marginTop: 5 },
  metaTxt: { fontSize: 11, color: C.ink3 },
  atrasado: { fontSize: 11, color: C.bordo, fontWeight: '700' },
  sinAsignar: { fontSize: 12, color: C.ink3, marginTop: 6, fontStyle: 'italic' },
  pct: { fontSize: 15, fontWeight: '700', color: C.tealDeep },
});
