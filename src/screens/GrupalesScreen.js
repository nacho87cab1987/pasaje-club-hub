import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { grupales } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function plata(n, moneda) {
  const s = moneda === 'ARS' ? '$' : 'US$';
  return `${s} ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
}

export function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export default function GrupalesScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('proximas');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await grupales.lista();
      setItems(r.items || []);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!items) return <Cargando texto="Cargando salidas" />;

  // Las que ya salieron se separan: siguen importando porque puede quedar
  // plata por cobrar, pero no compiten por atención con las que vienen.
  const proximas = items.filter((x) => !x.ya_salio);
  const pasadas = items.filter((x) => x.ya_salio);
  const lista = filtro === 'proximas' ? proximas : pasadas;

  const deudaProximas = proximas.reduce((a, x) => a + (x.falta || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {deudaProximas > 0 ? (
        <View style={s.alerta}>
          <Text style={s.alertaN}>{plata(deudaProximas)}</Text>
          <Text style={s.alertaT}>por cobrar en las salidas que vienen</Text>
        </View>
      ) : null}

      <View style={s.tabs}>
        {[
          { k: 'proximas', n: `Próximas (${proximas.length})` },
          { k: 'pasadas', n: `Ya salieron (${pasadas.length})` },
        ].map((o) => (
          <Pressable
            key={o.k}
            style={[s.tab, filtro === o.k && s.tabOn]}
            onPress={() => setFiltro(o.k)}
          >
            <Text style={[s.tabT, filtro === o.k && { color: C.navy, fontWeight: '700' }]}>
              {o.n}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={lista}
        keyExtractor={(x) => x.fecha_salida}
        contentContainerStyle={{ padding: 14, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={(
          <RefreshControl refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
        )}
        ListEmptyComponent={(
          <Vacio icono="groups" titulo="Sin salidas"
            texto={filtro === 'proximas'
              ? 'No hay salidas grupales programadas.'
              : 'Todavía no salió ningún grupo.'} />
        )}
        renderItem={({ item }) => {
          const debe = item.falta > 0.5;
          return (
            <Pressable
              style={[s.card, sombra, debe && { borderLeftColor: '#9B2340' }]}
              onPress={() => navigation.navigate('Grupal', {
                fecha: item.fecha_salida, nombre: item.nombre,
              })}
            >
              <View style={s.top}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nombre} numberOfLines={1}>{item.nombre}</Text>
                  <Text style={s.fecha}>
                    {fechaCorta(item.fecha_salida)}
                    {!item.ya_salio && item.dias >= 0
                      ? ` · faltan ${item.dias} días`
                      : ''}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.ink3} />
              </View>

              <View style={s.datos}>
                <Dato n={item.pasajeros} t="pasajeros" />
                <Dato n={item.expedientes} t="expedientes" />
              </View>

              {debe ? (
                <View style={s.deuda}>
                  <MaterialIcons name="schedule" size={14} color="#9B2340" />
                  <Text style={s.deudaT}>
                    Falta cobrar {plata(item.falta)} de {plata(item.venta)}
                  </Text>
                </View>
              ) : (
                <View style={s.pago}>
                  <MaterialIcons name="check-circle" size={14} color="#1B5E3F" />
                  <Text style={s.pagoT}>Todo cobrado</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function Dato({ n, t }) {
  return (
    <View style={s.dato}>
      <Text style={s.datoN}>{n}</Text>
      <Text style={s.datoT}>{t}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  alerta: {
    backgroundColor: '#FBE9ED', margin: 14, marginBottom: 8,
    borderRadius: R.md, padding: 14, alignItems: 'center',
  },
  alertaN: { fontSize: 24, fontWeight: '700', color: '#9B2340' },
  alertaT: { fontSize: 12.5, color: '#9B2340', marginTop: 2 },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff', margin: 14, marginTop: 6,
    marginBottom: 4, borderRadius: R.md, padding: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: R.sm },
  tabOn: { backgroundColor: C.tealSoft },
  tabT: { fontSize: 13, color: C.ink3 },
  card: {
    backgroundColor: '#fff', borderRadius: R.lg, padding: 14,
    marginBottom: 9, borderLeftWidth: 4, borderLeftColor: '#1B5E3F',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombre: { fontSize: 15.5, fontWeight: '700', color: C.ink },
  fecha: { fontSize: 12.5, color: C.ink3, marginTop: 2 },
  datos: { flexDirection: 'row', gap: 26, marginTop: 11 },
  dato: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  datoN: { fontSize: 17, fontWeight: '700', color: C.navy },
  datoT: { fontSize: 11.5, color: C.ink3 },
  deuda: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11,
    backgroundColor: '#FBE9ED', borderRadius: R.sm, padding: 9,
  },
  deudaT: { fontSize: 12, color: '#9B2340', fontWeight: '600' },
  pago: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  pagoT: { fontSize: 12, color: '#1B5E3F', fontWeight: '600' },
});
