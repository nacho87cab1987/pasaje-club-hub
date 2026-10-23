import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { grupales } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

// El mismo semáforo que Postventa: dos pantallas del mismo módulo no
// pueden usar colores distintos para decir lo mismo.
const NIVELES = {
  urgente: { n: 'Urgente',   color: '#9B2340', fondo: '#FBE9ED' },
  pronto:  { n: 'Apurar',    color: '#8A6A12', fondo: '#FAF3DF' },
  futuro:  { n: 'En plazo',  color: '#5F6B72', fondo: '#EEF2F4' },
  ok:      { n: 'Cobrada',   color: '#1B5E3F', fondo: '#E1F5EE' },
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fecha(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function plata(n, moneda) {
  const sim = (moneda || 'USD') === 'ARS' ? '$' : 'USD';
  return `${sim} ${new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0))}`;
}

export default function GrupalesScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await grupales.listado()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando grupales" />;

  const items = filtro === 'todas'
    ? data.grupales
    : data.grupales.filter((x) => x.nivel === filtro);

  const r = data.resumen;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Lo que falta cobrar, arriba de todo: es el número por el que
          se abre esta pantalla. */}
      <View style={[s.cabecera, sombra]}>
        <Text style={s.cabeceraT}>Por cobrar</Text>
        <Text style={s.cabeceraN}>{plata(r.por_cobrar, 'USD')}</Text>
        <Text style={s.cabeceraD}>
          {r.deudores} {r.deudores === 1 ? 'expediente' : 'expedientes'} con saldo
          {' · '}{r.pasajeros} pasajeros en {r.grupales}{' '}
          {r.grupales === 1 ? 'salida' : 'salidas'}
        </Text>
      </View>

      <View style={s.resumen}>
        {[
          { k: 'todas',   n: 'Todas',    v: r.grupales, color: C.navy },
          { k: 'urgente', n: 'Urgente',  v: r.urgente,  color: NIVELES.urgente.color },
          { k: 'pronto',  n: 'Apurar',   v: r.pronto,   color: NIVELES.pronto.color },
          { k: 'ok',      n: 'Cobradas', v: r.ok,       color: NIVELES.ok.color },
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
        data={items}
        keyExtractor={(x) => x.clave}
        contentContainerStyle={{ padding: 14, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando}
            tintColor={C.teal}
            onRefresh={async () => {
              setRefrescando(true); await cargar(); setRefrescando(false);
            }}
          />
        )}
        ListEmptyComponent={(
          <Vacio
            icono="groups"
            titulo="Sin grupales"
            texto={filtro === 'todas'
              ? 'No hay salidas grupales próximas.'
              : 'Ninguna grupal en este estado.'}
          />
        )}
        renderItem={({ item }) => {
          const n = NIVELES[item.nivel] || NIVELES.futuro;

          return (
            <Pressable
              style={[s.grupal, sombra, { borderLeftColor: n.color }]}
              onPress={() => navigation.navigate('Grupal', {
                clave: item.clave, destino: item.destino,
              })}
            >
              <View style={s.top}>
                <View style={{ flex: 1 }}>
                  <Text style={s.destino} numberOfLines={1}>{item.destino}</Text>
                  <Text style={s.fecha}>{fecha(item.fecha_salida)}</Text>
                </View>

                <View style={[s.dias, { backgroundColor: n.fondo }]}>
                  <Text style={[s.diasN, { color: n.color }]}>{item.dias_para_salir}</Text>
                  <Text style={[s.diasT, { color: n.color }]}>días</Text>
                </View>
              </View>

              {/* La barra de cobranza: de un vistazo se ve cuánto entró */}
              <View style={s.barra}>
                <View style={[s.barraLlena, {
                  width: `${Math.min(100, item.porcentaje)}%`,
                  backgroundColor: item.deben === 0 ? NIVELES.ok.color : C.teal,
                }]} />
              </View>

              <View style={s.cifras}>
                <Text style={s.cobrado}>
                  {plata(item.pagado, item.moneda)}
                  <Text style={s.deTotal}> de {plata(item.total, item.moneda)}</Text>
                </Text>
                <Text style={s.porcentaje}>{item.porcentaje}%</Text>
              </View>

              {item.deben > 0 ? (
                <View style={[s.aviso, { backgroundColor: n.fondo }]}>
                  <MaterialIcons name="account-balance-wallet" size={14} color={n.color} />
                  <Text style={[s.avisoTxt, { color: n.color }]}>
                    Faltan {plata(item.saldo, item.moneda)} · {item.deben}{' '}
                    {item.deben === 1 ? 'expediente' : 'expedientes'} con saldo
                  </Text>
                </View>
              ) : (
                <View style={s.listo}>
                  <MaterialIcons name="check-circle" size={14} color={NIVELES.ok.color} />
                  <Text style={s.listoTxt}>Cobrada por completo</Text>
                </View>
              )}

              <Text style={s.meta}>
                {item.pasajeros} {item.pasajeros === 1 ? 'pasajero' : 'pasajeros'}
                {item.vendedores.length ? ` · ${item.vendedores.join(', ')}` : ''}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  cabecera: {
    backgroundColor: C.navy, borderRadius: R.lg,
    margin: 14, marginBottom: 10, padding: 16,
  },
  cabeceraT: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  cabeceraN: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 2 },
  cabeceraD: { fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 5 },

  resumen: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingBottom: 8 },
  chip: {
    flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: R.md,
    paddingVertical: 9, borderWidth: 1, borderColor: C.line,
  },
  chipN: { fontSize: 17, fontWeight: '700' },
  chipT: { fontSize: 10.5, color: C.ink3, marginTop: 1 },

  grupal: {
    backgroundColor: '#fff', borderRadius: R.lg, padding: 13,
    marginBottom: 9, borderLeftWidth: 4,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destino: { fontSize: 15.5, fontWeight: '700', color: C.ink },
  fecha: { fontSize: 12.5, color: C.ink2, marginTop: 2 },
  dias: { alignItems: 'center', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  diasN: { fontSize: 15, fontWeight: '700' },
  diasT: { fontSize: 9.5 },

  barra: {
    height: 6, borderRadius: 3, backgroundColor: '#EEF2F4',
    marginTop: 12, overflow: 'hidden',
  },
  barraLlena: { height: '100%', borderRadius: 3 },

  cifras: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginTop: 6,
  },
  cobrado: { fontSize: 13, fontWeight: '700', color: C.ink },
  deTotal: { fontSize: 12, fontWeight: '400', color: C.ink3 },
  porcentaje: { fontSize: 12.5, fontWeight: '700', color: C.ink2 },

  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: R.sm, padding: 9, marginTop: 10,
  },
  avisoTxt: { flex: 1, fontSize: 11.5, fontWeight: '500' },
  listo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  listoTxt: { fontSize: 11.5, color: '#1B5E3F', fontWeight: '600' },

  meta: { fontSize: 11, color: C.ink3, marginTop: 8 },
});
