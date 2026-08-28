import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { expedientes, gestion } from '../api/client';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra } from '../theme';

const ESTADO = {
  borrador:  { nom: 'Borrador',  color: '#8AA0AB', bg: '#EEF3F5' },
  pendiente: { nom: 'Pendiente', color: '#BA7517', bg: '#FAEEDA' },
  emitido:   { nom: 'Emitido',   color: '#2e7d32', bg: '#E1F5EE' },
  cancelado: { nom: 'Cancelado', color: '#e53935', bg: '#FCEBEB' },
};
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
  'agosto','septiembre','octubre','noviembre','diciembre'];

function fechaLarga(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).split('-');
  return d ? `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]}` : iso;
}
const plata = (n, mon) =>
  `${mon || 'USD'} ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export default function ExpedienteScreen({ route, navigation }) {
  const { id } = route.params;
  const [e, setE] = useState(null);
  const [error, setError] = useState(null);
  const [tareas, setTareas] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await expedientes.detalle(id);
      setE(r.expediente);
      // Las tareas del expediente: que hay pendiente de este viaje.
      gestion.deExpediente(id).then(setTareas).catch(() => setTareas(null));
    } catch (x) { setError(x.message); }
  }, [id]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  useEffect(() => {
    if (e) navigation.setOptions({ title: e.codigo || 'Expediente' });
  }, [e, navigation]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!e) return <Cargando texto="Abriendo expediente" />;

  const est = ESTADO[e.estado] || ESTADO.borrador;
  const pct = e.total > 0 ? Math.min(100, Math.round((e.pagado / e.total) * 100)) : 0;
  const urgente = e.opcion_dias !== null && e.opcion_dias <= 3 && e.estado !== 'cancelado';

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 34 }}>
      {urgente ? (
        <View style={s.alerta}>
          <MaterialIcons name="schedule" size={19} color="#fff" />
          <Text style={s.alertaTxt}>
            {e.opcion_dias < 0 ? 'La opcion esta vencida'
              : e.opcion_dias === 0 ? 'La opcion vence hoy'
              : `La opcion vence en ${e.opcion_dias} ${e.opcion_dias === 1 ? 'dia' : 'dias'}`}
          </Text>
        </View>
      ) : null}

      <Card>
        <View style={{ padding: 15 }}>
          <View style={s.top}>
            <Text style={s.cliente}>{e.cliente}</Text>
            <View style={[s.estado, { backgroundColor: est.bg }]}>
              <Text style={[s.estadoTxt, { color: est.color }]}>{est.nom}</Text>
            </View>
          </View>
          <Text style={s.destino}>{e.destino}</Text>

          <View style={s.codigos}>
            {e.codigo ? <Text style={s.codigo}>{e.codigo}</Text> : null}
            {e.codigo_savia ? <Text style={s.codigo}>Savia {e.codigo_savia}</Text> : null}
            {e.vendedor ? <Text style={s.codigo}>{e.vendedor}</Text> : null}
          </View>
        </View>

        {e.fecha_salida ? (
          <View style={s.fechas}>
            <View style={s.fecha}>
              <MaterialIcons name="flight-takeoff" size={17} color={C.tealDeep} />
              <View>
                <Text style={s.fechaT}>Salida</Text>
                <Text style={s.fechaV}>{fechaLarga(e.fecha_salida)}</Text>
              </View>
            </View>
            {e.fecha_regreso ? (
              <View style={s.fecha}>
                <MaterialIcons name="flight-land" size={17} color={C.ink3} />
                <View>
                  <Text style={s.fechaT}>Regreso</Text>
                  <Text style={s.fechaV}>{fechaLarga(e.fecha_regreso)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Text style={s.seccion}>PAGOS</Text>
      <Card>
        <View style={{ padding: 15 }}>
          <View style={s.montos}>
            <View>
              <Text style={s.montoT}>Total</Text>
              <Text style={s.montoV}>{plata(e.total, e.moneda)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.montoT}>{e.saldo > 0 ? 'Saldo' : 'Pagado'}</Text>
              <Text style={[s.montoV, { color: e.saldo > 0 ? C.bordo : C.ok }]}>
                {plata(e.saldo > 0 ? e.saldo : e.total, e.moneda)}
              </Text>
            </View>
          </View>

          <View style={s.barra}>
            <View style={[s.barraLlena, { width: `${pct}%` }, pct >= 100 && { backgroundColor: C.ok }]} />
          </View>
          <Text style={s.pct}>{pct}% cobrado</Text>
        </View>

        {e.pagos.map((p, i) => (
          <View key={p.id} style={[s.pago, i < e.pagos.length - 1 && s.borde]}>
            <MaterialIcons
              name={p.estado === 'aprobado' ? 'check-circle' : 'pending'}
              size={18}
              color={p.estado === 'aprobado' ? C.ok : C.warn}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.pagoM}>{plata(p.monto, p.moneda)}</Text>
              <Text style={s.pagoD}>
                {p.medio || 'Pago'}
                {p.creado ? ` · ${String(p.creado).slice(8, 10)}/${String(p.creado).slice(5, 7)}` : ''}
              </Text>
            </View>
            {p.estado !== 'aprobado' ? (
              <Text style={s.pagoE}>{p.estado}</Text>
            ) : null}
          </View>
        ))}
      </Card>

      {e.lista_pasajeros.length ? (
        <>
          <Text style={s.seccion}>
            PASAJEROS · {e.lista_pasajeros.length}
          </Text>
          <Card>
            {e.lista_pasajeros.map((p, i) => (
              <View key={p.id} style={[s.pax, i < e.lista_pasajeros.length - 1 && s.borde]}>
                <MaterialIcons
                  name={p.pasaporte ? 'badge' : 'person-outline'}
                  size={18}
                  color={p.pasaporte ? C.tealDeep : C.ink3}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.paxN}>
                    {[p.nombre, p.apellido].filter(Boolean).join(' ') || 'Pasajero sin nombre'}
                  </Text>
                  <Text style={s.paxD}>
                    {p.documento ? `DNI ${p.documento}` : 'Sin documento'}
                    {p.pasaporte ? ` · Pasaporte ${p.pasaporte}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
          {!e.pasaporte_ok ? (
            <Text style={s.aviso}>Faltan datos de pasaporte para emitir.</Text>
          ) : null}
        </>
      ) : null}

      {e.servicios && e.servicios.length ? (
        <>
          <Text style={s.seccion}>SERVICIOS</Text>
          <Card>
            {e.servicios.map((x, i) => (
              <View key={x.id} style={[s.serv, i < e.servicios.length - 1 && s.borde]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.servD}>{x.descripcion || x.tipo}</Text>
                  {x.proveedor ? <Text style={s.servP}>{x.proveedor}</Text> : null}
                </View>
                {x.monto ? <Text style={s.servM}>{plata(x.monto, x.moneda)}</Text> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {tareas && tareas.items && tareas.items.length ? (
        <>
          <Text style={s.seccion}>
            TAREAS · {tareas.pendientes} {tareas.pendientes === 1 ? 'pendiente' : 'pendientes'}
          </Text>
          <Card>
            {tareas.items.map((t, i) => (
              <Pressable
                key={t.id}
                style={[s.tarea, i < tareas.items.length - 1 && s.borde]}
                onPress={() => navigation.navigate('Tarea', { id: t.id })}
              >
                <MaterialIcons
                  name={t.completada ? 'check-circle' : 'radio-button-unchecked'}
                  size={19}
                  color={t.completada ? C.ok : C.ink3}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[s.tareaT, t.completada && s.tareaHecha]} numberOfLines={2}>
                    {t.titulo}
                  </Text>
                  {t.fecha_vencimiento && !t.completada ? (
                    <Text style={s.tareaV}>
                      vence {fechaLarga(t.fecha_vencimiento)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <Text style={s.pie}>
        Para cargar pagos, pasajeros o servicios, entra desde el panel web.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.bordo,
    borderRadius: R.md, padding: 13, marginBottom: 12,
  },
  alertaTxt: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cliente: { flex: 1, fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  estado: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  estadoTxt: { fontSize: 11, fontWeight: '700' },
  destino: { fontSize: 15, color: C.ink2, marginTop: 3 },
  codigos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  codigo: { fontSize: 11.5, color: C.ink3 },
  fechas: {
    flexDirection: 'row', gap: 20, paddingHorizontal: 15, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: C.lineSoft, backgroundColor: C.bg,
  },
  fecha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fechaT: { fontSize: 10.5, color: C.ink3, textTransform: 'uppercase', fontWeight: '600' },
  fechaV: { fontSize: 13, color: C.ink, fontWeight: '500' },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  montos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  montoT: { fontSize: 11, color: C.ink3, textTransform: 'uppercase', fontWeight: '600' },
  montoV: { fontSize: 19, fontWeight: '700', color: C.navy, marginTop: 2 },
  barra: { height: 7, borderRadius: 4, backgroundColor: C.lineSoft, marginTop: 13, overflow: 'hidden' },
  barraLlena: { height: 7, borderRadius: 4, backgroundColor: C.teal },
  pct: { fontSize: 11.5, color: C.ink3, marginTop: 6 },
  pago: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 11 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  pagoM: { fontSize: 14, fontWeight: '600', color: C.ink },
  pagoD: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  pagoE: { fontSize: 11, color: C.warn, fontWeight: '700', textTransform: 'uppercase' },
  pax: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 11 },
  paxN: { fontSize: 14, fontWeight: '600', color: C.ink },
  paxD: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  serv: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 11 },
  servD: { fontSize: 14, color: C.ink },
  servP: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  servM: { fontSize: 13.5, fontWeight: '600', color: C.navy },
  tarea: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 12 },
  tareaT: { fontSize: 14, color: C.ink, lineHeight: 19 },
  tareaHecha: { textDecorationLine: 'line-through', color: C.ink3 },
  tareaV: { fontSize: 11.5, color: C.warn, marginTop: 2, fontWeight: '600' },
  aviso: { fontSize: 12.5, color: C.warn, marginTop: 8, paddingHorizontal: 4, fontWeight: '600' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 20, lineHeight: 17 },
});
