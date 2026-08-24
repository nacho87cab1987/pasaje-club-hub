import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { expedientes } from '../api/client';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

const plata = (n) => `USD ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export default function EquipoScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await expedientes.equipo()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando tu equipo" />;

  if (!data.es_supervisor) {
    return (
      <Vacio
        icono="supervised-user-circle"
        titulo="No tenes equipo asignado"
        texto="Esta pantalla es para quienes supervisan vendedoras. Si deberias ver un equipo, avisale a administracion."
      />
    );
  }

  // El maximo del mes define la escala de las barras: comparar contra el
  // mejor del equipo dice mas que un numero suelto.
  const tope = Math.max(...data.items.map((v) => v.vendido_mes), 1);

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={data.items}
      keyExtractor={(v) => String(v.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
      ListHeaderComponent={(
        <View style={[s.totales, sombra]}>
          <View style={s.dato}>
            <Text style={s.datoN}>{plata(data.total_mes)}</Text>
            <Text style={s.datoT}>vendido este mes</Text>
          </View>
          <View style={s.sep} />
          <View style={s.dato}>
            <Text style={s.datoN}>{data.expedientes_mes}</Text>
            <Text style={s.datoT}>expedientes</Text>
          </View>
        </View>
      )}
      renderItem={({ item }) => (
        <Pressable
          style={[s.item, sombra]}
          onPress={() => navigation.navigate('Expedientes', {
            vendedorId: item.id, nombre: item.nombre,
          })}
        >
          <View style={s.top}>
            <Avatar
              texto={iniciales(...String(item.nombre).split(' '))}
              tam={40}
              fondo={item.soy_yo ? C.navy : C.tealSoft}
              color={item.soy_yo ? C.teal : C.tealDeep}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.nombre} numberOfLines={1}>
                {item.nombre}{item.soy_yo ? ' · vos' : ''}
              </Text>
              <Text style={s.sub}>
                {item.del_mes} {item.del_mes === 1 ? 'expediente' : 'expedientes'} este mes
              </Text>
            </View>
            <Text style={s.monto}>{plata(item.vendido_mes)}</Text>
          </View>

          <View style={s.barra}>
            <View style={[s.barraLlena, { width: `${(item.vendido_mes / tope) * 100}%` }]} />
          </View>

          <View style={s.pills}>
            {item.pendientes > 0 ? (
              <View style={[s.pill, { backgroundColor: '#FAEEDA' }]}>
                <Text style={[s.pillTxt, { color: '#BA7517' }]}>{item.pendientes} pendientes</Text>
              </View>
            ) : null}
            {item.emitidos > 0 ? (
              <View style={[s.pill, { backgroundColor: '#E1F5EE' }]}>
                <Text style={[s.pillTxt, { color: '#2e7d32' }]}>{item.emitidos} emitidos</Text>
              </View>
            ) : null}
            {item.borradores > 0 ? (
              <View style={[s.pill, { backgroundColor: C.lineSoft }]}>
                <Text style={[s.pillTxt, { color: C.ink3 }]}>{item.borradores} borradores</Text>
              </View>
            ) : null}
            {/* Lo unico que exige accion hoy: una opcion que vence se cae. */}
            {item.por_vencer > 0 ? (
              <View style={[s.pill, { backgroundColor: C.bordo }]}>
                <MaterialIcons name="schedule" size={11} color="#fff" />
                <Text style={[s.pillTxt, { color: '#fff' }]}>
                  {item.por_vencer} por vencer
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  totales: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.navy,
    borderRadius: R.lg, paddingVertical: 16, marginBottom: 13,
  },
  dato: { flex: 1, alignItems: 'center' },
  datoN: { fontSize: 19, fontWeight: '700', color: C.teal },
  datoT: { fontSize: 11, color: '#A9CBD6', marginTop: 3 },
  sep: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  item: { backgroundColor: '#fff', borderRadius: R.lg, padding: 13, marginBottom: 9 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  nombre: { fontSize: 15, fontWeight: '600', color: C.ink },
  sub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  monto: { fontSize: 15, fontWeight: '700', color: C.navy },
  barra: { height: 5, borderRadius: 3, backgroundColor: C.lineSoft, marginTop: 11, overflow: 'hidden' },
  barraLlena: { height: 5, borderRadius: 3, backgroundColor: C.teal },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 11, paddingHorizontal: 8, paddingVertical: 4,
  },
  pillTxt: { fontSize: 10.5, fontWeight: '700' },
});
