import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl, TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { postventa } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

// El semáforo. El orden importa: es el de urgencia, no el alfabético.
const NIVELES = {
  urgente: { n: 'Urgente',   color: '#9B2340', fondo: '#FBE9ED' },
  pronto:  { n: 'Este mes',  color: '#8A6A12', fondo: '#FAF3DF' },
  futuro:  { n: 'Más lejos', color: '#5F6B72', fondo: '#EEF2F4' },
  ok:      { n: 'Lista',     color: '#1B5E3F', fondo: '#E1F5EE' },
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fecha(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function nombreMes(clave) {
  const [a, m] = String(clave).split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
}

export default function PostventaScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await postventa.agenda({ q: busqueda })); }
    catch (e) { setError(e.message); }
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando salidas" />;

  const items = filtro === 'todas'
    ? data.items
    : data.items.filter((x) => x.nivel === filtro);

  // Las salidas se agrupan por mes: así se lee como un calendario y no como
  // una lista larga sin referencias.
  const filas = [];
  let mesActual = null;
  items.forEach((x) => {
    const mes = String(x.fecha_salida).slice(0, 7);
    if (mes !== mesActual) {
      mesActual = mes;
      filas.push({ tipo: 'mes', clave: mes });
    }
    filas.push({ tipo: 'salida', ...x });
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.buscador}>
        <MaterialIcons name="search" size={19} color={C.ink3} />
        <TextInput
          style={s.buscadorInput}
          value={q}
          onChangeText={setQ}
          placeholder="Cliente, destino o código"
          placeholderTextColor={C.ink3}
        />
        {q ? (
          <MaterialIcons name="close" size={18} color={C.ink3} onPress={() => setQ('')} />
        ) : null}
      </View>

      {/* El resumen es tocable: es la forma más rápida de ir a lo urgente. */}
      <View style={s.resumen}>
        {[
          { k: 'todas', n: 'Todas', v: data.resumen.total, color: C.navy },
          { k: 'urgente', n: 'Urgente', v: data.resumen.urgente, color: NIVELES.urgente.color },
          { k: 'pronto', n: 'Este mes', v: data.resumen.pronto, color: NIVELES.pronto.color },
          { k: 'ok', n: 'Listas', v: data.resumen.ok, color: NIVELES.ok.color },
        ].map((x) => (
          <Pressable
            key={x.k}
            style={[s.chip, filtro === x.k && { backgroundColor: C.navy }]}
            onPress={() => setFiltro(x.k)}
          >
            <Text style={[s.chipN, filtro === x.k ? { color: '#fff' } : { color: x.color }]}>
              {x.v}
            </Text>
            <Text style={[s.chipT, filtro === x.k && { color: 'rgba(255,255,255,0.8)' }]}>
              {x.n}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filas}
        keyExtractor={(x, i) => (x.tipo === 'mes' ? `m-${x.clave}` : `s-${x.id}-${i}`)}
        contentContainerStyle={{ padding: 14, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={(
          <RefreshControl refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
        )}
        ListEmptyComponent={(
          <Vacio icono="flight-takeoff" titulo="Sin salidas"
            texto={filtro === 'todas'
              ? 'No hay viajes programados en los próximos 90 días.'
              : 'Ninguna salida en este estado.'} />
        )}
        renderItem={({ item }) => {
          if (item.tipo === 'mes') {
            return <Text style={s.mes}>{nombreMes(item.clave)}</Text>;
          }

          const n = NIVELES[item.nivel] || NIVELES.futuro;
          return (
            <Pressable
              style={[s.salida, sombra, { borderLeftColor: n.color }]}
              onPress={() => navigation.navigate('Salida', { id: item.id })}
            >
              <View style={s.top}>
                <View style={s.dia}>
                  <Text style={s.diaN}>{new Date(String(item.fecha_salida).replace(' ', 'T')).getDate()}</Text>
                  <Text style={s.diaM}>
                    {MESES[new Date(String(item.fecha_salida).replace(' ', 'T')).getMonth()].slice(0, 3)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.destino} numberOfLines={1}>
                    {item.destino || 'Sin destino'}
                  </Text>
                  <Text style={s.cliente} numberOfLines={1}>{item.cliente_nombre}</Text>
                  <Text style={s.meta}>
                    {item.cant_pasajeros || 0} {item.cant_pasajeros === 1 ? 'pasajero' : 'pasajeros'}
                    {item.aerolinea_nombre ? ` · ${item.aerolinea_nombre}` : ''}
                  </Text>
                </View>

                <View style={[s.dias, { backgroundColor: n.fondo }]}>
                  <Text style={[s.diasN, { color: n.color }]}>{item.dias_para_salir}</Text>
                  <Text style={[s.diasT, { color: n.color }]}>días</Text>
                </View>
              </View>

              {item.faltan && item.faltan.length ? (
                <View style={[s.faltan, { backgroundColor: n.fondo }]}>
                  <MaterialIcons name="error-outline" size={14} color={n.color} />
                  <Text style={[s.faltanTxt, { color: n.color }]}>
                    {item.faltan.join(' · ')}
                  </Text>
                </View>
              ) : (
                <View style={s.listo}>
                  <MaterialIcons name="check-circle" size={14} color={NIVELES.ok.color} />
                  <Text style={s.listoTxt}>Todo listo para viajar</Text>
                </View>
              )}

              {data.ve_todos && item.vendedor_nombre ? (
                <Text style={s.vendedora}>{item.vendedor_nombre}</Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff',
    margin: 14, marginBottom: 8, paddingHorizontal: 13, height: 44,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  buscadorInput: { flex: 1, fontSize: 14.5, color: C.ink },
  resumen: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingBottom: 8 },
  chip: {
    flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: R.md,
    paddingVertical: 9, borderWidth: 1, borderColor: C.line,
  },
  chipN: { fontSize: 17, fontWeight: '700' },
  chipT: { fontSize: 10.5, color: C.ink3, marginTop: 1 },
  mes: {
    fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: C.ink3,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 8, marginLeft: 2,
  },
  salida: {
    backgroundColor: '#fff', borderRadius: R.lg, padding: 13,
    marginBottom: 9, borderLeftWidth: 4,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dia: { alignItems: 'center', width: 38 },
  diaN: { fontSize: 20, fontWeight: '700', color: C.navy, lineHeight: 23 },
  diaM: { fontSize: 10, color: C.ink3, textTransform: 'uppercase' },
  destino: { fontSize: 15, fontWeight: '700', color: C.ink },
  cliente: { fontSize: 13, color: C.ink2, marginTop: 1 },
  meta: { fontSize: 11.5, color: C.ink3, marginTop: 3 },
  dias: { alignItems: 'center', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  diasN: { fontSize: 15, fontWeight: '700' },
  diasT: { fontSize: 9.5 },
  faltan: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderRadius: R.sm, padding: 9, marginTop: 10,
  },
  faltanTxt: { flex: 1, fontSize: 11.5, lineHeight: 16, fontWeight: '500' },
  listo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  listoTxt: { fontSize: 11.5, color: '#1B5E3F', fontWeight: '600' },
  vendedora: { fontSize: 11, color: C.ink3, marginTop: 8 },
});
