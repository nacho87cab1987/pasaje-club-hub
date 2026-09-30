import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { postventa } from '../api/client';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra } from '../theme';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function plata(n, moneda) {
  const s = moneda === 'USD' ? 'US$' : '$';
  return `${s} ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export default function SalidaScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await postventa.salida(id)); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  useEffect(() => {
    if (data) navigation.setOptions({ title: data.salida.destino || 'Salida' });
  }, [data, navigation]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const e = data.salida;
  const pax = data.pasajeros || [];
  const urgente = e.nivel === 'urgente';

  const llamar = () => {
    const tel = String(e.cliente_telefono || '').replace(/[^0-9+]/g, '');
    if (!tel) { Alert.alert('Sin teléfono', 'Este cliente no tiene teléfono cargado.'); return; }
    Linking.openURL(`https://wa.me/${tel.replace(/^\+/, '')}`);
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      <View style={[s.cab, sombra, urgente && { backgroundColor: '#9B2340' }]}>
        <Text style={s.cuenta}>
          {e.dias_para_salir > 0
            ? `Faltan ${e.dias_para_salir} días`
            : e.dias_para_salir === 0 ? 'Sale hoy' : 'Ya salió'}
        </Text>
        <Text style={s.destino}>{e.destino || 'Sin destino'}</Text>
        <Text style={s.fechas}>
          {fechaLarga(e.fecha_salida)}
          {e.fecha_regreso ? `  ·  vuelve el ${fechaLarga(e.fecha_regreso)}` : ''}
        </Text>
      </View>

      {/* Lo que falta va primero: es a lo que se entra a mirar. */}
      {e.faltan && e.faltan.length ? (
        <View style={s.faltan}>
          <View style={s.faltanTop}>
            <MaterialIcons name="error-outline" size={18} color="#9B2340" />
            <Text style={s.faltanTit}>Falta resolver</Text>
          </View>
          {e.faltan.map((f, i) => (
            <Text key={i} style={s.faltanItem}>· {f}</Text>
          ))}
        </View>
      ) : (
        <View style={s.listo}>
          <MaterialIcons name="check-circle" size={18} color="#1B5E3F" />
          <Text style={s.listoTxt}>Todo listo para viajar</Text>
        </View>
      )}

      <Text style={s.seccion}>EL VIAJE</Text>
      <Card>
        <Fila icono="person" titulo="Cliente" valor={e.cliente_nombre} />
        {e.aerolinea_nombre ? (
          <Fila icono="flight" titulo="Aerolínea" valor={e.aerolinea_nombre} />
        ) : null}
        {e.hotel_nombre_libre ? (
          <Fila icono="hotel" titulo="Hotel" valor={e.hotel_nombre_libre} />
        ) : null}
        <Fila icono="confirmation-number" titulo="Expediente" valor={e.codigo} />
        <Fila icono="payments" titulo="Total"
          valor={plata(e.monto_total, e.moneda)} ultima />
      </Card>

      <Text style={s.seccion}>
        PASAJEROS · {pax.length}{e.cant_pasajeros ? ` de ${e.cant_pasajeros}` : ''}
      </Text>
      <Card>
        {pax.length ? pax.map((p, i) => {
          const falta = !p.documento_numero || !p.fecha_nacimiento;
          return (
            <View key={p.id} style={[s.pax, i < pax.length - 1 && s.borde]}>
              <MaterialIcons
                name={falta ? 'error-outline' : 'check-circle'}
                size={18}
                color={falta ? '#9B2340' : '#1B5E3F'}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.paxN}>
                  {`${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre'}
                </Text>
                <Text style={s.paxD}>
                  {p.documento_numero
                    ? `${p.documento_tipo || 'doc'} ${p.documento_numero}`
                    : 'sin documento'}
                  {p.fecha_nacimiento ? '' : ' · sin fecha de nacimiento'}
                </Text>
              </View>
            </View>
          );
        }) : (
          <Text style={s.vacio}>No hay pasajeros cargados todavía.</Text>
        )}
      </Card>

      <View style={s.acciones}>
        {e.cliente_telefono ? (
          <Pressable style={s.accion} onPress={llamar}>
            <MaterialIcons name="chat" size={18} color="#fff" />
            <Text style={s.accionTxt}>Escribirle al cliente</Text>
          </Pressable>
        ) : null}
      </View>

      {e.vendedor_nombre ? (
        <Text style={s.pie}>Vendió {e.vendedor_nombre}</Text>
      ) : null}

      <Text style={s.nota}>
        Para cargar pasajeros o documentos, entrá desde el panel web.
      </Text>
    </ScrollView>
  );
}

function Fila({ icono, titulo, valor, ultima }) {
  return (
    <View style={[s.fila, !ultima && s.borde]}>
      <MaterialIcons name={icono} size={19} color={C.ink3} />
      <Text style={s.filaT}>{titulo}</Text>
      <Text style={s.filaV} numberOfLines={1}>{valor || '—'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  cab: { backgroundColor: C.navy, borderRadius: R.lg, padding: 17 },
  cuenta: { fontSize: 12, fontWeight: '700', color: C.teal, letterSpacing: 0.5 },
  destino: { fontSize: 21, fontWeight: '700', color: '#fff', marginTop: 5 },
  fechas: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 18 },
  faltan: { backgroundColor: '#FBE9ED', borderRadius: R.md, padding: 13, marginTop: 12 },
  faltanTop: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  faltanTit: { fontSize: 13.5, fontWeight: '700', color: '#9B2340' },
  faltanItem: { fontSize: 12.5, color: '#9B2340', lineHeight: 19 },
  listo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E1F5EE',
    borderRadius: R.md, padding: 13, marginTop: 12,
  },
  listoTxt: { fontSize: 13.5, fontWeight: '600', color: '#1B5E3F' },
  seccion: {
    fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3,
    marginTop: 20, marginBottom: 8,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  filaT: { fontSize: 13, color: C.ink3, width: 84 },
  filaV: { flex: 1, fontSize: 14, color: C.ink, fontWeight: '500', textAlign: 'right' },
  pax: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11 },
  paxN: { fontSize: 14, fontWeight: '600', color: C.ink },
  paxD: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  vacio: { fontSize: 13, color: C.ink3, textAlign: 'center', padding: 20 },
  acciones: { marginTop: 18 },
  accion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1B7F4C', borderRadius: R.md, paddingVertical: 14,
  },
  accionTxt: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 16 },
  nota: { fontSize: 11.5, color: C.ink3, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
