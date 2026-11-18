import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, AppState,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { pulso } from '../api/client';
import { Cargando, ErrorBox } from '../components/UI';
import { C, R, sombra } from '../theme';

const FMT = new Intl.NumberFormat('es-AR');
const n = (x) => FMT.format(Math.round(Number(x) || 0));

/** Cuánto subió o bajó contra el mismo momento de ayer. */
function variacion(hoy, antes) {
  const a = Number(hoy) || 0;
  const b = Number(antes) || 0;
  if (!b) return null;
  return Math.round(((a - b) / b) * 100);
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Hoy", "Ayer", o el día escrito cuando se fue más atrás. */
function nombreDia(iso) {
  if (!iso) return 'Hoy';

  const d = new Date(`${iso}T12:00:00`);
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);

  const dias = Math.round((hoy - d) / 86400000);
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `${DIAS[d.getDay()]} ${d.getDate()}`;

  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function tituloDe(rango, data) {
  if (rango === 'mes') return 'El mes';
  if (rango === 'semana') return 'La semana';
  return data && data.es_hoy === false ? 'El pulso' : 'El pulso de hoy';
}


export default function PulsoScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [rango, setRango] = useState('dia');
  // null = hoy. Al moverse con las flechas queda una fecha fija.
  const [fecha, setFecha] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const timer = useRef(null);

  const cargar = useCallback(async (silencioso) => {
    if (!silencioso) setError(null);
    try {
      setData(await pulso.tablero(rango, fecha));
      setError(null);
    } catch (e) {
      // Con datos viejos en pantalla no se muestra el error: mejor números
      // de hace un minuto que un cartel rojo en el medio de una reunión.
      if (!silencioso) setError(e.message);
    }
  }, [rango, fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  // Se refresca solo, como el monitor de la oficina. Pero solo con la app
  // abierta: en segundo plano gastaría batería sin que nadie lo mire.
  useEffect(() => {
    const arrancar = () => {
      pararTimer();
      timer.current = setInterval(() => cargar(true), 45000);
    };
    const pararTimer = () => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    };

    arrancar();
    const sub = AppState.addEventListener('change', (e) => {
      if (e === 'active') { cargar(true); arrancar(); } else pararTimer();
    });

    return () => { pararTimer(); sub.remove(); };
  }, [cargar]);

  /**
   * Mueve un día para atrás o para adelante.
   *
   * No se puede pasar de hoy: los números de mañana no existen todavía, y un
   * tablero vacío parece un error del sistema.
   */
  const mover = (paso) => {
    const base = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
    base.setDate(base.getDate() + paso);

    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);

    if (base > hoy) { setFecha(null); return; }

    const iso = base.toISOString().slice(0, 10);
    const hoyIso = hoy.toISOString().slice(0, 10);
    setFecha(iso === hoyIso ? null : iso);
  };

  if (error && !data) return <ErrorBox mensaje={error} onReintentar={() => cargar()} />;
  if (!data) return <Cargando texto="Tomando el pulso" />;

  const v = data.vivo || {};
  const E = v.expedientes || {};
  const P = v.presupuestos || {};
  const CR = v.crm || {};
  const J = v.pasajito || {};
  const W = v.web || {};
  const OM = v.omuni;
  const ranking = (v.ranking && v.ranking.items) || [];

  const contra = rango === 'dia' ? 'que ayer a esta hora' : 'que el período anterior';

  const kpis = [
    {
      k: 'venta', l: 'Vendido', v: E.venta_usd, prefijo: 'USD ', grande: true,
      pie: E.ticket_usd ? `ticket ${n(E.ticket_usd)}` : '',
    },
    {
      k: 'exp', l: 'Expedientes', v: E.hoy,
      var: variacion(E.hoy, E.ayer_misma_hora),
      pie: Number(E.grupales) > 0 ? `${E.grupales} grupales` : '',
    },
    {
      k: 'presu', l: 'Presupuestos', v: P.hoy,
      var: variacion(P.hoy, P.ayer_misma_hora),
      pie: Number(P.aprobados) > 0 ? `${P.aprobados} aprobados` : '',
    },
    {
      k: 'crm', l: 'CRM propio', v: CR.hoy,
      var: variacion(CR.hoy, CR.ayer_misma_hora),
      pie: Number(CR.sin_responder) > 0 ? `${CR.sin_responder} sin responder` : '',
      alerta: Number(CR.sin_responder) > 0,
    },
    {
      k: 'omuni', l: 'Omuni', v: OM ? OM.casos : 0,
      var: OM ? variacion(OM.casos, OM.antes) : null,
      pie: OM
        ? (Number(OM.en_espera_total) > 0 ? `${OM.en_espera_total} esperando` : 'al día')
        : 'sin sincronizar',
      // Un lead esperando es más grave que un mensaje sin leer: hay alguien
      // del otro lado que escribió y nadie lo tomó.
      alerta: !!(OM && Number(OM.en_espera_total) > 0),
    },
    {
      k: 'web', l: 'Visitas', v: W.visitas,
      var: variacion(W.visitas, W.ayer_misma_hora),
      pie: W.personas ? `${n(W.personas)} personas` : '',
    },
    {
      k: 'pasa', l: 'Pasajito',
      v: (Number(J.interno_hoy) || 0) + (Number(J.publico_hoy) || 0),
      pie: `${Number(J.interno_hoy) || 0} int · ${Number(J.publico_hoy) || 0} web`,
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={(
        <RefreshControl refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
      )}
    >
      <View style={s.cab}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>{tituloDe(rango, data)}</Text>
          <Text style={s.hora}>
            {data.hora ? `actualizado ${data.hora}` : ''}
            {error ? ' · sin conexión' : ''}
          </Text>
        </View>
        <View style={[s.latido, error && { backgroundColor: '#B03A5B' }]} />
      </View>

      {/* Las flechas solo cuando se mira un día: en semana o mes el
          servidor devuelve el período completo y moverse de a uno no
          significaría nada. */}
      {rango === 'dia' ? (
        <View style={s.navDia}>
          <Pressable style={s.flecha} onPress={() => mover(-1)} hitSlop={8}>
            <MaterialIcons name="chevron-left" size={24} color={C.ink2} />
          </Pressable>

          <Pressable style={s.diaCentro} onPress={() => setFecha(null)}>
            <Text style={s.diaT}>{nombreDia(fecha)}</Text>
            {fecha ? <Text style={s.volverHoy}>tocá para volver a hoy</Text> : null}
          </Pressable>

          <Pressable
            style={[s.flecha, !fecha && s.flechaOff]}
            onPress={() => mover(1)}
            disabled={!fecha}
            hitSlop={8}
          >
            <MaterialIcons name="chevron-right" size={24}
              color={fecha ? C.ink2 : C.line} />
          </Pressable>
        </View>
      ) : null}

      <View style={s.rangos}>
        {[
          { k: 'dia', n: 'Hoy' },
          { k: 'semana', n: 'Semana' },
          { k: 'mes', n: 'Mes' },
        ].map((o) => (
          <Pressable
            key={o.k}
            style={[s.rango, rango === o.k && s.rangoOn]}
            onPress={() => { setRango(o.k); setFecha(null); }}
          >
            <Text style={[s.rangoT, rango === o.k && { color: C.navy, fontWeight: '700' }]}>
              {o.n}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.grilla}>
        {kpis.map((x) => (
          <View
            key={x.k}
            style={[
              s.kpi, sombra,
              x.grande && s.kpiGrande,
              x.alerta && { borderColor: '#B03A5B', borderWidth: 1.5 },
            ]}
          >
            <Text style={[s.kpiV, x.grande && s.kpiVGrande]}>
              {x.prefijo ? <Text style={s.kpiPre}>{x.prefijo}</Text> : null}
              {n(x.v)}
            </Text>
            <Text style={[s.kpiL, x.grande && { color: 'rgba(255,255,255,0.65)' }]}>
              {x.l}
            </Text>
            {x.var !== null && x.var !== undefined ? (
              <Text style={[s.kpiVar, x.var < 0 && { color: '#B03A5B' }]}>
                {x.var >= 0 ? '▲' : '▼'} {Math.abs(x.var)}% {contra}
              </Text>
            ) : null}
            {x.pie ? (
              <Text style={[
                s.kpiPie,
                x.grande && { color: 'rgba(255,255,255,0.6)' },
                x.alerta && { color: '#B03A5B', fontWeight: '600' },
              ]}>
                {x.pie}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {ranking.length ? (
        <>
          <Text style={s.seccion}>QUIÉN VENDIÓ</Text>
          <View style={[s.caja, sombra]}>
            {ranking.slice(0, 8).map((x, i) => (
              <View key={x.id || i} style={[s.fila, i < Math.min(8, ranking.length) - 1 && s.borde]}>
                <Text style={s.puesto}>{i + 1}</Text>
                <Text style={s.quien} numberOfLines={1}>{x.nombre}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.cuanto}>USD {n(x.venta_usd || x.venta)}</Text>
                  {x.expedientes ? (
                    <Text style={s.cuantos}>{x.expedientes} exp.</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {v.mes ? (
        <>
          <Text style={s.seccion}>EL MES</Text>
          <View style={[s.caja, sombra, { padding: 16 }]}>
            <View style={s.mesFila}>
              <View>
                <Text style={s.mesT}>Vendido</Text>
                <Text style={s.mesN}>USD {n(v.mes.venta_usd)}</Text>
              </View>
              <View>
                <Text style={s.mesT}>Expedientes</Text>
                <Text style={s.mesN}>{n(v.mes.expedientes)}</Text>
              </View>
            </View>
          </View>
        </>
      ) : null}

      {Number(v.salen_incompletos) > 0 || Number(v.incidencias_abiertas) > 0
        || Number(v.sin_costo) > 0 ? (
        <>
          <Text style={s.seccion}>PARA MIRAR</Text>
          <View style={[s.caja, sombra]}>
            {Number(v.salen_incompletos) > 0 ? (
              <Aviso n={v.salen_incompletos} t="salidas con algo sin cargar" />
            ) : null}
            {Number(v.incidencias_abiertas) > 0 ? (
              <Aviso n={v.incidencias_abiertas} t="incidencias abiertas" />
            ) : null}
            {Number(v.sin_costo) > 0 ? (
              <Aviso n={v.sin_costo} t="expedientes sin costo cargado" />
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Aviso({ n: cuantas, t }) {
  return (
    <View style={s.aviso}>
      <MaterialIcons name="error-outline" size={17} color="#B03A5B" />
      <Text style={s.avisoT}>
        <Text style={{ fontWeight: '700' }}>{cuantas}</Text> {t}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  cab: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  titulo: { fontSize: 22, fontWeight: '700', color: C.ink },
  hora: { fontSize: 11.5, color: C.ink3, marginTop: 3 },
  latido: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.teal },

  navDia: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: R.md, marginBottom: 12, borderWidth: 1, borderColor: C.line,
  },
  flecha: { padding: 11 },
  flechaOff: { opacity: 0.4 },
  diaCentro: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  diaT: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  volverHoy: { fontSize: 10.5, color: C.tealDeep, marginTop: 1 },

  rangos: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: R.md,
    padding: 4, marginBottom: 14, borderWidth: 1, borderColor: C.line,
  },
  rango: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: R.sm },
  rangoOn: { backgroundColor: C.navy },
  rangoT: { fontSize: 13, color: C.ink3 },

  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  kpi: {
    width: '48%', backgroundColor: '#fff', borderRadius: R.md, padding: 14,
    borderWidth: 0, borderColor: 'transparent',
  },
  // La venta ocupa el ancho entero y en el navy de la marca: es el numero
  // que uno busca primero al abrir la pantalla.
  kpiGrande: { width: '100%', backgroundColor: C.navy },
  kpiV: { fontSize: 26, fontWeight: '700', color: C.navy },
  kpiVGrande: { fontSize: 38, color: '#fff' },
  kpiPre: { fontSize: 17, color: C.teal, fontWeight: '600' },
  kpiL: { fontSize: 12, color: C.ink3, marginTop: 3 },
  kpiVar: { fontSize: 11, color: '#1B5E3F', marginTop: 5 },
  kpiPie: { fontSize: 11, color: C.ink3, marginTop: 3 },

  seccion: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.1,
    color: C.ink3, marginTop: 22, marginBottom: 9,
  },
  caja: { backgroundColor: '#fff', borderRadius: R.md },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  puesto: { width: 22, fontSize: 13, fontWeight: '700', color: C.ink3, textAlign: 'center' },
  quien: { flex: 1, fontSize: 14, color: C.ink },
  cuanto: { fontSize: 14, fontWeight: '700', color: C.tealDeep },
  cuantos: { fontSize: 10.5, color: C.ink3, marginTop: 1 },

  mesFila: { flexDirection: 'row', justifyContent: 'space-between' },
  mesT: { fontSize: 11.5, color: C.ink3 },
  mesN: { fontSize: 20, fontWeight: '700', color: C.navy, marginTop: 3 },

  aviso: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13 },
  avisoT: { flex: 1, fontSize: 13, color: C.ink2 },
});
