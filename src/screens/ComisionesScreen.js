import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { comisiones } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const plata = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

function nombreMes(p) {
  if (!p) return '';
  const [a, m] = String(p).split('-');
  return `${MESES[parseInt(m, 10) - 1]} ${a}`;
}

const ESTADO = {
  pendiente: { nom: 'Pendiente', color: '#BA7517', bg: '#FAEEDA' },
  aprobada:  { nom: 'Aprobada',  color: '#185FA5', bg: '#E6F1FB' },
  liquidada: { nom: 'Cobrada',   color: '#2e7d32', bg: '#E1F5EE' },
  anulada:   { nom: 'Anulada',   color: '#8AA0AB', bg: '#EEF3F5' },
};

export default function ComisionesScreen({ navigation }) {
  const [resumen, setResumen] = useState(null);
  const [items, setItems] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [error, setError] = useState(null);
  const [verPeriodos, setVerPeriodos] = useState(false);
  const [verLiq, setVerLiq] = useState(false);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [refrescando, setRefrescando] = useState(false);
  const [scope, setScope] = useState('mios');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const p = { ...(periodo ? { periodo } : {}), ...(scope === 'todos' ? { scope } : {}) };
      const [r, m, ps] = await Promise.all([
        comisiones.resumen(p),
        comisiones.mis(p),
        comisiones.periodos().catch(() => ({ items: [] })),
      ]);
      setResumen(r);
      setItems(m.items || []);
      setPeriodos(ps.items || []);
      if (!periodo) setPeriodo(r.periodo);
    } catch (e) { setError(e.message); setItems([]); }
  }, [periodo, scope]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const abrirLiquidaciones = async () => {
    try {
      const r = await comisiones.liquidaciones();
      setLiquidaciones(r.items || []);
      setVerLiq(true);
    } catch (e) { /* la hoja muestra el vacio */ }
  };

  if (error && !items?.length) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!resumen || items === null) return <Cargando texto="Calculando" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
          />
        )}
        ListHeaderComponent={(
          <>
            <View style={s.cabecera}>
              <Pressable style={s.selector} onPress={() => setVerPeriodos(true)}>
                <MaterialIcons name="calendar-month" size={17} color={C.tealDeep} />
                <Text style={s.selectorTxt}>{nombreMes(resumen.periodo)}</Text>
                <MaterialIcons name="expand-more" size={19} color={C.tealDeep} />
              </Pressable>

              {resumen.puede_ver_todo ? (
                <Pressable
                  style={[s.todo, scope === 'todos' && s.todoOn]}
                  onPress={() => setScope(scope === 'todos' ? 'mios' : 'todos')}
                >
                  <MaterialIcons
                    name={scope === 'todos' ? 'groups' : 'person'}
                    size={15}
                    color={scope === 'todos' ? '#fff' : C.ink2}
                  />
                  <Text style={[s.todoTxt, scope === 'todos' && { color: '#fff' }]}>
                    {scope === 'todos' ? 'Agencia' : 'Mias'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={[s.tarjeta, sombra]}>
              <Text style={s.grandeT}>
                {scope === 'todos' ? 'Comisiones de la agencia' : 'Comision del mes'}
              </Text>
              <Text style={s.grande}>{plata(resumen.del_periodo)}</Text>

              {/* Separar lo propio del override es lo que hace que el numero
                  se entienda: no es lo mismo vender que cobrar por el equipo. */}
              {resumen.por_equipo > 0 ? (
                <View style={s.desglose}>
                  <View style={s.desItem}>
                    <View style={[s.punto, { backgroundColor: C.teal }]} />
                    <Text style={s.desTxt}>Tus ventas {plata(resumen.propias)}</Text>
                  </View>
                  <View style={s.desItem}>
                    <View style={[s.punto, { backgroundColor: C.gold }]} />
                    <Text style={s.desTxt}>Por el equipo {plata(resumen.por_equipo)}</Text>
                  </View>
                </View>
              ) : null}

              <View style={s.sub}>
                <View style={s.subItem}>
                  <Text style={s.subN}>{plata(resumen.vendido_periodo)}</Text>
                  <Text style={s.subT}>vendiste</Text>
                </View>
                <View style={s.subSep} />
                <View style={s.subItem}>
                  <Text style={s.subN}>{resumen.operaciones}</Text>
                  <Text style={s.subT}>operaciones</Text>
                </View>
                {resumen.promedio_pct !== null ? (
                  <>
                    <View style={s.subSep} />
                    <View style={s.subItem}>
                      <Text style={s.subN}>{resumen.promedio_pct}%</Text>
                      <Text style={s.subT}>promedio</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </View>

            <View style={s.dos}>
              <View style={[s.chico, sombra]}>
                <MaterialIcons name="hourglass-top" size={18} color={C.warn} />
                <Text style={s.chicoN}>{plata(resumen.por_cobrar)}</Text>
                <Text style={s.chicoT}>por cobrar</Text>
              </View>
              <Pressable style={[s.chico, sombra]} onPress={abrirLiquidaciones}>
                <MaterialIcons name="check-circle" size={18} color={C.ok} />
                <Text style={s.chicoN}>{plata(resumen.cobrado_total)}</Text>
                <Text style={s.chicoT}>cobrado · ver</Text>
              </Pressable>
            </View>

            {resumen.es_supervisor ? (
              <Pressable style={s.equipo} onPress={() => navigation.navigate('Equipo')}>
                <MaterialIcons name="supervised-user-circle" size={19} color={C.tealDeep} />
                <Text style={s.equipoTxt}>Ver como viene tu equipo</Text>
                <MaterialIcons name="chevron-right" size={19} color={C.tealDeep} />
              </Pressable>
            ) : null}

            <Text style={s.seccion}>DETALLE</Text>
          </>
        )}
        ListEmptyComponent={(
          <Vacio icono="payments" titulo="Sin comisiones este mes"
            texto="Cuando se carguen ventas del periodo, aparecen aca." />
        )}
        renderItem={({ item }) => {
          const est = ESTADO[item.estado] || ESTADO.pendiente;
          const anulada = item.estado === 'anulada';
          return (
            <View style={[s.item, sombra, anulada && { opacity: 0.55 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.itemTop}>
                  <Text style={s.exp}>{item.expediente || 'Sin expediente'}</Text>
                  {item.vip ? (
                    <View style={s.vip}><Text style={s.vipTxt}>VIP</Text></View>
                  ) : null}
                  {item.del_equipo ? (
                    <View style={s.eq}><Text style={s.eqTxt}>EQUIPO</Text></View>
                  ) : null}
                </View>
                {item.vendedor ? (
                  <Text style={s.vend} numberOfLines={1}>{item.vendedor}</Text>
                ) : null}
                {item.cliente || item.destino ? (
                  <Text style={s.cli} numberOfLines={1}>
                    {[item.cliente, item.destino].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <Text style={s.venta}>
                  {plata(item.venta)} · {item.pct}%
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.monto, anulada && { textDecorationLine: 'line-through' }]}>
                  {plata(item.comision)}
                </Text>
                <View style={[s.estado, { backgroundColor: est.bg }]}>
                  <Text style={[s.estadoTxt, { color: est.color }]}>{est.nom}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      <Hoja visible={verPeriodos} onCerrar={() => setVerPeriodos(false)} titulo="Elegí el mes">
        {periodos.map((p) => (
          <Pressable
            key={p.periodo}
            style={[s.opcion, p.periodo === resumen.periodo && { backgroundColor: C.tealSoft }]}
            onPress={() => { setPeriodo(p.periodo); setVerPeriodos(false); }}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.opcionT}>{nombreMes(p.periodo)}</Text>
              <Text style={s.opcionS}>
                {p.operaciones} {p.operaciones === 1 ? 'operacion' : 'operaciones'}
                {p.sin_cobrar > 0 ? ` · ${p.sin_cobrar} sin cobrar` : ''}
              </Text>
            </View>
            <Text style={s.opcionM}>{plata(p.total)}</Text>
          </Pressable>
        ))}
      </Hoja>

      <Hoja visible={verLiq} onCerrar={() => setVerLiq(false)} titulo="Liquidaciones">
        {!liquidaciones.length ? (
          <Text style={s.vacio}>Todavia no hay liquidaciones registradas.</Text>
        ) : liquidaciones.map((l) => (
          <View key={l.id} style={s.liq}>
            <View style={{ flex: 1 }}>
              <Text style={s.opcionT}>{nombreMes(l.periodo) || `Liquidacion #${l.id}`}</Text>
              <Text style={s.opcionS}>
                {l.operaciones} {l.operaciones === 1 ? 'operacion' : 'operaciones'}
                {l.medio ? ` · ${l.medio}` : ''}
                {l.fecha ? ` · ${String(l.fecha).slice(8, 10)}/${String(l.fecha).slice(5, 7)}` : ''}
              </Text>
            </View>
            <Text style={s.opcionM}>{plata(l.total)}</Text>
          </View>
        ))}
      </Hoja>
    </View>
  );
}

function Hoja({ visible, onCerrar, titulo, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      {/* El contenedor con flex-end es lo que pega la hoja al borde de
          abajo. Sin el, la hoja se acomoda despues del fondo y queda
          empujada fuera de la pantalla. */}
      <View style={s.modalWrap}>
        <Pressable style={s.fondo} onPress={onCerrar} />
        <View style={s.hoja}>
        <View style={s.hojaTop}>
          <Text style={s.hojaTit}>{titulo}</Text>
          <Pressable onPress={onCerrar} hitSlop={10}>
            <MaterialIcons name="close" size={22} color={C.ink3} />
          </Pressable>
        </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  todo: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.line,
    backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8,
  },
  todoOn: { backgroundColor: C.navy, borderColor: C.navy },
  todoTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  vend: { fontSize: 11.5, color: C.tealDeep, fontWeight: '600', marginTop: 2 },
  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: C.tealSoft, borderRadius: 18, paddingHorizontal: 13,
    paddingVertical: 8,
  },
  selectorTxt: { fontSize: 13.5, fontWeight: '700', color: C.tealDeep },
  tarjeta: { backgroundColor: C.navy, borderRadius: R.lg, padding: 18 },
  grandeT: { fontSize: 12, color: '#A9CBD6', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  grande: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 4, letterSpacing: -0.8 },
  desglose: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  desItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  desTxt: { fontSize: 12, color: '#D6E6EC' },
  sub: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.13)',
  },
  subItem: { flex: 1, alignItems: 'center' },
  subN: { fontSize: 14, fontWeight: '700', color: C.teal },
  subT: { fontSize: 10.5, color: '#A9CBD6', marginTop: 2 },
  subSep: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.13)' },
  dos: { flexDirection: 'row', gap: 10, marginTop: 10 },
  chico: { flex: 1, backgroundColor: '#fff', borderRadius: R.md, padding: 14, alignItems: 'flex-start' },
  chicoN: { fontSize: 16, fontWeight: '700', color: C.ink, marginTop: 7 },
  chicoT: { fontSize: 11, color: C.ink3, marginTop: 2 },
  equipo: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.tealSoft,
    borderRadius: R.md, padding: 13, marginTop: 10,
  },
  equipoTxt: { flex: 1, fontSize: 13.5, fontWeight: '600', color: C.tealDeep },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 22, marginBottom: 9 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: R.md, padding: 12, marginBottom: 8,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exp: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  vip: { backgroundColor: '#FBF3C9', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  vipTxt: { fontSize: 9, fontWeight: '800', color: '#8A6D0B' },
  eq: { backgroundColor: '#EEF3F5', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  eqTxt: { fontSize: 9, fontWeight: '800', color: C.ink3 },
  cli: { fontSize: 12, color: C.ink2, marginTop: 3 },
  venta: { fontSize: 11.5, color: C.ink3, marginTop: 3 },
  monto: { fontSize: 15.5, fontWeight: '700', color: C.navy },
  estado: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginTop: 5 },
  estadoTxt: { fontSize: 9.5, fontWeight: '700' },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.4)' },
  hoja: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '76%' },
  hojaTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hojaTit: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  liq: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  opcionT: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  opcionS: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  opcionM: { fontSize: 14.5, fontWeight: '700', color: C.navy },
  vacio: { padding: 24, fontSize: 13.5, color: C.ink3, textAlign: 'center', lineHeight: 19 },
});
