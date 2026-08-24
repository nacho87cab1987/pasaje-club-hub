import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { expedientes } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

const ESTADO = {
  borrador:  { nom: 'Borrador',  color: '#8AA0AB', bg: '#EEF3F5' },
  pendiente: { nom: 'Pendiente', color: '#BA7517', bg: '#FAEEDA' },
  emitido:   { nom: 'Emitido',   color: '#2e7d32', bg: '#E1F5EE' },
  cancelado: { nom: 'Cancelado', color: '#e53935', bg: '#FCEBEB' },
};

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fecha(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).split('-');
  return d ? `${parseInt(d, 10)} ${MESES[parseInt(m, 10) - 1]}` : iso;
}

const plata = (n, mon) =>
  `${mon || 'USD'} ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export default function ExpedientesScreen({ navigation, route }) {
  // Cuando se llega desde Mi equipo, se ven los de esa vendedora.
  const deVendedor = route.params && route.params.vendedorId;

  const [items, setItems] = useState(null);
  const [estados, setEstados] = useState({});
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [scope, setScope] = useState('mios');
  const [veTodo, setVeTodo] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async (busqueda) => {
    setError(null);
    try {
      const r = deVendedor
        ? await expedientes.de(deVendedor, { q: busqueda, estado: filtro })
        : await expedientes.mis({ q: busqueda, estado: filtro, scope });
      setItems(r.items || []);
      setEstados(r.estados || {});
      setVeTodo(!!r.puede_ver_todo);
    } catch (e) { setError(e.message); setItems([]); }
  }, [deVendedor, filtro, scope]);

  useEffect(() => {
    if (route.params?.nombre) navigation.setOptions({ title: route.params.nombre });
  }, [navigation, route.params]);

  useEffect(() => {
    const t = setTimeout(() => cargar(q.trim()), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, cargar]);

  if (error && !items?.length) return <ErrorBox mensaje={error} onReintentar={() => cargar(q.trim())} />;
  if (items === null) return <Cargando texto="Cargando expedientes" />;

  const chips = [
    { k: 'todos', n: 'Todos', c: Object.values(estados).reduce((a, b) => a + b, 0) },
    ...Object.entries(ESTADO)
      .filter(([k]) => estados[k])
      .map(([k, v]) => ({ k, n: v.nom, c: estados[k] })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.buscador}>
        <MaterialIcons name="search" size={20} color={C.ink3} />
        <TextInput
          style={s.input} value={q} onChangeText={setQ}
          placeholder="Cliente, destino o codigo" placeholderTextColor={C.ink3}
        />
        {q ? <MaterialIcons name="close" size={19} color={C.ink3} onPress={() => setQ('')} /> : null}
      </View>

      {veTodo && !deVendedor ? (
        <View style={s.scopes}>
          {[{ k: 'mios', n: 'Mios' }, { k: 'todos', n: 'Toda la agencia' }].map((o) => (
            <Pressable key={o.k} onPress={() => setScope(o.k)}
              style={[s.scope, scope === o.k && s.scopeOn]}>
              <Text style={[s.scopeTxt, scope === o.k && { color: C.navy, fontWeight: '700' }]}>
                {o.n}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={chips}
        keyExtractor={(c) => c.k}
        style={{ maxHeight: 46 }}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 7, alignItems: 'center' }}
        renderItem={({ item }) => (
          <Pressable onPress={() => setFiltro(item.k)}
            style={[s.chip, filtro === item.k && s.chipOn]}>
            <Text style={[s.chipTxt, filtro === item.k && { color: '#fff' }]}>
              {item.n} {item.c}
            </Text>
          </Pressable>
        )}
      />

      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 30 }}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(q.trim()); setRefrescando(false); }}
          />
        )}
        ListEmptyComponent={(
          <Vacio
            icono="folder-off"
            titulo={q ? 'Sin resultados' : 'Sin expedientes'}
            texto={q ? `Nada coincide con "${q}".` : 'Los expedientes se crean desde el panel web.'}
          />
        )}
        renderItem={({ item }) => {
          const est = ESTADO[item.estado] || ESTADO.borrador;
          // Una opcion que vence en 3 dias o menos es lo mas urgente que
          // puede tener un expediente: si vence, se cae la reserva.
          const urgente = item.opcion_dias !== null && item.opcion_dias <= 3
                       && item.estado !== 'cancelado';
          return (
            <Pressable
              style={[s.item, sombra, urgente && s.urgente]}
              onPress={() => navigation.navigate('Expediente', { id: item.id, codigo: item.codigo })}
            >
              <View style={s.top}>
                <Text style={s.cliente} numberOfLines={1}>{item.cliente}</Text>
                <View style={[s.estado, { backgroundColor: est.bg }]}>
                  <Text style={[s.estadoTxt, { color: est.color }]}>{est.nom}</Text>
                </View>
              </View>

              <Text style={s.destino} numberOfLines={1}>
                {item.destino}
                {item.codigo ? ` · ${item.codigo}` : ''}
                {item.vendedor ? ` · ${item.vendedor}` : ''}
              </Text>

              <View style={s.meta}>
                {item.fecha_salida ? (
                  <View style={s.metaItem}>
                    <MaterialIcons name="flight-takeoff" size={13} color={C.ink3} />
                    <Text style={s.metaTxt}>
                      {fecha(item.fecha_salida)}
                      {item.dias_para_salir >= 0 && item.dias_para_salir <= 30
                        ? ` · en ${item.dias_para_salir}d` : ''}
                    </Text>
                  </View>
                ) : null}
                {item.pasajeros ? (
                  <View style={s.metaItem}>
                    <MaterialIcons name="person" size={13} color={C.ink3} />
                    <Text style={s.metaTxt}>{item.pasajeros}</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.plata}>
                <Text style={s.total}>{plata(item.total, item.moneda)}</Text>
                {item.saldo > 0 ? (
                  <Text style={s.saldo}>saldo {plata(item.saldo, item.moneda)}</Text>
                ) : (
                  <Text style={s.pagado}>pagado</Text>
                )}
              </View>

              {urgente ? (
                <View style={s.alerta}>
                  <MaterialIcons name="schedule" size={13} color="#fff" />
                  <Text style={s.alertaTxt}>
                    {item.opcion_dias < 0 ? 'Opcion vencida'
                      : item.opcion_dias === 0 ? 'La opcion vence hoy'
                      : `La opcion vence en ${item.opcion_dias} ${item.opcion_dias === 1 ? 'dia' : 'dias'}`}
                  </Text>
                </View>
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
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    margin: 14, marginBottom: 8, paddingHorizontal: 13, height: 44,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  scopes: {
    flexDirection: 'row', gap: 4, backgroundColor: '#fff', marginHorizontal: 14,
    marginBottom: 8, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  scope: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  scopeOn: { backgroundColor: C.tealSoft },
  scopeTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  chip: {
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  item: { backgroundColor: '#fff', borderRadius: R.lg, padding: 13, marginBottom: 9, overflow: 'hidden' },
  urgente: { borderWidth: 1.5, borderColor: '#F0C0CC' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cliente: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink },
  estado: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  estadoTxt: { fontSize: 10.5, fontWeight: '700' },
  destino: { fontSize: 12.5, color: C.ink2, marginTop: 3 },
  meta: { flexDirection: 'row', gap: 13, marginTop: 7 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 11.5, color: C.ink3 },
  plata: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 8 },
  total: { fontSize: 15, fontWeight: '700', color: C.navy },
  saldo: { fontSize: 12, color: C.bordo, fontWeight: '600' },
  pagado: { fontSize: 12, color: C.ok, fontWeight: '600' },
  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bordo,
    marginHorizontal: -13, marginBottom: -13, marginTop: 10,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  alertaTxt: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
});
