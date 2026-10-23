import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl,
  Linking, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { grupales } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { plata } from './GrupalesScreen';
import { C, R, sombra } from '../theme';

const NIVELES = {
  urgente: { color: '#9B2340', fondo: '#FBE9ED' },
  pronto:  { color: '#8A6A12', fondo: '#FAF3DF' },
  futuro:  { color: '#5F6B72', fondo: '#EEF2F4' },
  ok:      { color: '#1B5E3F', fondo: '#E1F5EE' },
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fecha(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Hace cuánto se le escribió, en palabras. */
function haceCuanto(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace(' ', 'T'));
  if (isNaN(+d)) return null;

  const dias = Math.floor((Date.now() - +d) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`;
}

export default function GrupalScreen({ route, navigation }) {
  const { clave, destino } = route.params || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [soloDeudores, setSoloDeudores] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await grupales.grupal(clave)); }
    catch (e) { setError(e.message); }
  }, [clave]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (destino) navigation.setOptions({ title: destino });
  }, [destino, navigation]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando grupal" />;

  const g = data.grupal;
  const items = soloDeudores
    ? data.items.filter((x) => !x.cuenta.cancelado)
    : data.items;

  /**
   * Abre WhatsApp con el mensaje escrito y registra que se le avisó.
   *
   * El mensaje lo manda la persona, no el sistema: una cobranza la
   * cobra alguien. Lo que se guarda acá es la fecha, para que la
   * próxima vez se sepa si ya le escribieron ayer.
   */
  async function recordar(item) {
    const tel = String(item.telefono || '').replace(/\D/g, '');
    if (!tel) {
      Alert.alert('Sin teléfono', `${item.cliente} no tiene teléfono cargado.`);
      return;
    }

    const nombre = String(item.cliente || '').trim().split(/\s+/)[0] || '';
    const texto =
      `Hola ${nombre}! Te escribo por tu viaje a ${g.destino} del ` +
      `${fecha(g.fecha_salida)}.\n\n` +
      `Te queda un saldo de ${plata(item.cuenta.saldo, item.moneda)}. ` +
      `Cualquier duda con el pago, escribime por acá.`;

    const numero = tel.length <= 10 ? `54${tel}` : tel;
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

    try {
      await Linking.openURL(url);
      // Se registra después de abrir: si WhatsApp no abrió, no
      // tiene sentido anotar que se le avisó.
      await grupales.recordar({
        expediente_id: item.id,
        via: 'whatsapp',
        saldo: item.cuenta.saldo,
        moneda: item.moneda,
      });
      cargar();
    } catch (e) {
      Alert.alert('No pudimos abrir WhatsApp', String(e.message || e));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.cabecera, sombra]}>
        <Text style={s.cabeceraD}>{fecha(g.fecha_salida)}</Text>

        <View style={s.barra}>
          <View style={[s.barraLlena, {
            width: `${Math.min(100, g.porcentaje)}%`,
            backgroundColor: g.saldo <= 0 ? NIVELES.ok.color : C.teal,
          }]} />
        </View>

        <View style={s.cifras}>
          <View>
            <Text style={s.cifraT}>Cobrado</Text>
            <Text style={s.cifraN}>{plata(g.pagado, g.moneda)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.cifraT}>Falta</Text>
            <Text style={[s.cifraN, g.saldo > 0 && { color: '#FFD4DD' }]}>
              {plata(g.saldo, g.moneda)}
            </Text>
          </View>
        </View>

        <Text style={s.cabeceraM}>
          {g.pasajeros} pasajeros · {g.expedientes}{' '}
          {g.expedientes === 1 ? 'expediente' : 'expedientes'} · faltan{' '}
          {g.dias_para_salir} días
        </Text>
      </View>

      <View style={s.filtros}>
        {[
          { k: true,  n: `Deben (${data.items.filter((x) => !x.cuenta.cancelado).length})` },
          { k: false, n: `Todos (${data.items.length})` },
        ].map((x) => (
          <Pressable
            key={String(x.k)}
            style={[s.filtro, soloDeudores === x.k && { backgroundColor: C.navy }]}
            onPress={() => setSoloDeudores(x.k)}
          >
            <Text style={[s.filtroT, soloDeudores === x.k && { color: '#fff' }]}>
              {x.n}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(x) => String(x.id)}
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
            icono="check-circle"
            titulo="Nadie debe"
            texto="Todos los expedientes de esta grupal están cobrados."
          />
        )}
        renderItem={({ item }) => {
          const n = NIVELES[item.nivel] || NIVELES.futuro;
          const debe = !item.cuenta.cancelado;
          const avisado = haceCuanto(item.ultimo_recordatorio);

          return (
            <View style={[s.exp, sombra, debe && { borderLeftWidth: 4, borderLeftColor: n.color }]}>
              <View style={s.expTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cliente} numberOfLines={1}>{item.cliente}</Text>
                  <Text style={s.codigo}>
                    {item.codigo} · {item.cant_pasajeros}{' '}
                    {item.cant_pasajeros === 1 ? 'pasajero' : 'pasajeros'}
                  </Text>
                </View>

                {debe ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.saldo, { color: n.color }]}>
                      {plata(item.cuenta.saldo, item.moneda)}
                    </Text>
                    <Text style={s.saldoT}>{item.cuenta.porcentaje}% pago</Text>
                  </View>
                ) : (
                  <MaterialIcons name="check-circle" size={22} color={NIVELES.ok.color} />
                )}
              </View>

              {item.pasajeros.length > 1 ? (
                <Text style={s.pax} numberOfLines={2}>
                  {item.pasajeros.map((p) => p.nombre).join(' · ')}
                </Text>
              ) : null}

              {debe ? (
                <View style={s.acciones}>
                  <Pressable style={s.wa} onPress={() => recordar(item)}>
                    <MaterialIcons name="chat" size={15} color="#fff" />
                    <Text style={s.waTxt}>
                      {avisado ? 'Volver a escribirle' : 'Escribirle'}
                    </Text>
                  </Pressable>

                  {avisado ? (
                    <Text style={s.avisado}>Le escribiste {avisado}</Text>
                  ) : (
                    <Text style={s.sinAvisar}>Sin recordatorios</Text>
                  )}
                </View>
              ) : null}

              {item.vendedor ? (
                <Text style={s.vendedora}>{item.vendedor}</Text>
              ) : null}
            </View>
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
  cabeceraD: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)' },
  barra: {
    height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 12, overflow: 'hidden',
  },
  barraLlena: { height: '100%', borderRadius: 4 },
  cifras: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 },
  cifraT: { fontSize: 10.5, color: 'rgba(255,255,255,0.65)' },
  cifraN: { fontSize: 19, fontWeight: '700', color: '#fff', marginTop: 1 },
  cabeceraM: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 11 },

  filtros: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingBottom: 8 },
  filtro: {
    flex: 1, alignItems: 'center', backgroundColor: '#fff',
    borderRadius: R.md, paddingVertical: 9,
    borderWidth: 1, borderColor: C.line,
  },
  filtroT: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },

  exp: { backgroundColor: '#fff', borderRadius: R.lg, padding: 13, marginBottom: 9 },
  expTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cliente: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  codigo: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  saldo: { fontSize: 15, fontWeight: '700' },
  saldoT: { fontSize: 10.5, color: C.ink3, marginTop: 1 },

  pax: { fontSize: 11.5, color: C.ink2, marginTop: 8, lineHeight: 16 },

  acciones: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11,
  },
  wa: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#25D366', borderRadius: R.md,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  waTxt: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  avisado: { flex: 1, fontSize: 11, color: C.ink3 },
  sinAvisar: { flex: 1, fontSize: 11, color: '#9B2340', fontWeight: '600' },

  vendedora: { fontSize: 11, color: C.ink3, marginTop: 8 },
});
