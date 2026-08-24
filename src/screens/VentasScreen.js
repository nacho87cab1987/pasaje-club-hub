import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ventas } from '../api/client';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra } from '../theme';

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const plata = (n) => `USD ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const corto = (n) => {
  const x = Number(n || 0);
  if (x >= 1000000) return `${(x / 1000000).toFixed(1)}M`;
  if (x >= 1000) return `${Math.round(x / 1000)}k`;
  return String(Math.round(x));
};

export default function VentasScreen({ navigation }) {
  const [scope, setScope] = useState('mio');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [r, e, k, a] = await Promise.all([
        ventas.resumen({ scope }),
        ventas.evolucion({ scope }).catch(() => ({ items: [] })),
        ventas.ranking({ scope }).catch(() => ({ items: [] })),
        ventas.alertas({ scope }).catch(() => ({ items: [] })),
      ]);
      setData({ resumen: r, evolucion: e.items || [], ranking: k.items || [], alertas: a.items || [] });
    } catch (x) { setError(x.message); }
  }, [scope]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Calculando" />;

  const { resumen: r, evolucion, ranking, alertas } = data;
  const varV = r.variacion.vendido;
  const tope = Math.max(...evolucion.map((x) => x.vendido), 1);

  const opciones = [{ k: 'mio', n: 'Mio' }];
  if (r.puede_equipo) opciones.push({ k: 'equipo', n: 'Mi equipo' });
  if (r.puede_todos) opciones.push({ k: 'todos', n: 'Agencia' });

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 34 }}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
    >
      {opciones.length > 1 ? (
        <View style={s.scopes}>
          {opciones.map((o) => (
            <Pressable key={o.k} onPress={() => setScope(o.k)}
              style={[s.scope, scope === o.k && s.scopeOn]}>
              <Text style={[s.scopeTxt, scope === o.k && { color: C.navy, fontWeight: '700' }]}>
                {o.n}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[s.hero, sombra]}>
        <Text style={s.heroT}>VENDIDO ESTE MES</Text>
        <Text style={s.heroN}>{plata(r.mes.vendido)}</Text>

        {/* Comparado al mismo dia del mes pasado, no contra el mes completo:
            sino en el dia 5 siempre parece que venis mal. */}
        {varV !== null ? (
          <View style={s.varFila}>
            <MaterialIcons
              name={varV >= 0 ? 'trending-up' : 'trending-down'}
              size={17}
              color={varV >= 0 ? C.teal : '#F08A9E'}
            />
            <Text style={[s.varTxt, { color: varV >= 0 ? C.teal : '#F08A9E' }]}>
              {varV >= 0 ? '+' : ''}{varV}%
            </Text>
            <Text style={s.varSub}>vs. el dia {r.dia_del_mes} del mes pasado</Text>
          </View>
        ) : (
          <Text style={s.varSub}>Primer mes con ventas</Text>
        )}

        <View style={s.chicos}>
          <View style={s.chico}>
            <Text style={s.chicoN}>{r.mes.operaciones}</Text>
            <Text style={s.chicoT}>expedientes</Text>
          </View>
          <View style={s.sep} />
          <View style={s.chico}>
            <Text style={s.chicoN}>{corto(r.mes.ticket)}</Text>
            <Text style={s.chicoT}>ticket promedio</Text>
          </View>
          <View style={s.sep} />
          <View style={s.chico}>
            <Text style={s.chicoN}>{corto(r.mes.comision)}</Text>
            <Text style={s.chicoT}>comision</Text>
          </View>
        </View>
      </View>

      {alertas.length ? (
        <>
          <Text style={s.seccion}>PARA HOY</Text>
          {alertas.slice(0, 5).map((a, i) => (
            <Pressable
              key={`${a.tipo}-${a.expediente_id}-${i}`}
              style={[s.alerta, sombra, a.urgencia === 'alta' && s.alertaAlta]}
              onPress={() => navigation.navigate('Expediente', { id: a.expediente_id, codigo: a.codigo })}
            >
              <MaterialIcons
                name={a.tipo === 'opcion' ? 'schedule' : 'payments'}
                size={19}
                color={a.urgencia === 'alta' ? C.bordo : C.warn}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.alertaT, a.urgencia === 'alta' && { color: C.bordo }]}>
                  {a.titulo}
                </Text>
                <Text style={s.alertaD} numberOfLines={1}>{a.detalle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={19} color={C.ink3} />
            </Pressable>
          ))}
          {alertas.length > 5 ? (
            <Text style={s.mas}>y {alertas.length - 5} mas</Text>
          ) : null}
        </>
      ) : null}

      {evolucion.length ? (
        <>
          <Text style={s.seccion}>ULTIMOS 6 MESES</Text>
          <Card>
            <View style={s.grafico}>
              {evolucion.map((x) => (
                <View key={x.periodo} style={s.col}>
                  <Text style={s.colN}>{corto(x.vendido)}</Text>
                  <View style={s.colBase}>
                    <View
                      style={[
                        s.colBarra,
                        { height: `${Math.max(3, (x.vendido / tope) * 100)}%` },
                        // El mes en curso va rayado: esta incompleto y si se
                        // dibuja igual que los otros parece una caida.
                        x.en_curso && { backgroundColor: C.tealSoft, borderWidth: 1.5,
                                        borderColor: C.teal, borderStyle: 'dashed' },
                      ]}
                    />
                  </View>
                  <Text style={[s.colM, x.en_curso && { color: C.tealDeep, fontWeight: '700' }]}>
                    {MESES[x.mes - 1]}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {ranking.length > 1 ? (
        <>
          <Text style={s.seccion}>
            {scope === 'todos' ? 'LA AGENCIA ESTE MES' : 'TU EQUIPO ESTE MES'}
          </Text>
          <Card>
            {ranking.map((v, i) => (
              <View key={v.id} style={[s.rank, i < ranking.length - 1 && s.borde,
                                       v.soy_yo && { backgroundColor: C.tealSoft }]}>
                <Text style={[s.puesto, v.puesto === 1 && { color: C.gold }]}>
                  {v.puesto}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rankN} numberOfLines={1}>
                    {v.nombre}{v.soy_yo ? ' · vos' : ''}
                  </Text>
                  <Text style={s.rankO}>
                    {v.operaciones} {v.operaciones === 1 ? 'expediente' : 'expedientes'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.rankV}>{plata(v.vendido)}</Text>
                  {v.variacion !== null ? (
                    <Text style={[s.rankVar,
                                  { color: v.variacion >= 0 ? C.ok : C.bordo }]}>
                      {v.variacion >= 0 ? '+' : ''}{v.variacion}%
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <View style={s.accesos}>
        <Pressable style={[s.acceso, sombra]} onPress={() => navigation.navigate('Expedientes')}>
          <MaterialIcons name="folder-special" size={20} color={C.tealDeep} />
          <Text style={s.accesoT}>Expedientes</Text>
        </Pressable>
        <Pressable style={[s.acceso, sombra]} onPress={() => navigation.navigate('Comisiones')}>
          <MaterialIcons name="payments" size={20} color={C.tealDeep} />
          <Text style={s.accesoT}>Comisiones</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scopes: {
    flexDirection: 'row', gap: 4, backgroundColor: '#fff', marginBottom: 12,
    padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  scope: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  scopeOn: { backgroundColor: C.tealSoft },
  scopeTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  hero: { backgroundColor: C.navy, borderRadius: R.lg, padding: 18 },
  heroT: { fontSize: 11, color: '#A9CBD6', fontWeight: '700', letterSpacing: 1 },
  heroN: { fontSize: 30, fontWeight: '700', color: '#fff', marginTop: 5, letterSpacing: -0.8 },
  varFila: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  varTxt: { fontSize: 14, fontWeight: '700' },
  varSub: { fontSize: 11.5, color: '#A9CBD6', marginTop: 6 },
  chicos: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.13)',
  },
  chico: { flex: 1, alignItems: 'center' },
  chicoN: { fontSize: 15, fontWeight: '700', color: C.teal },
  chicoT: { fontSize: 10, color: '#A9CBD6', marginTop: 2 },
  sep: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.13)' },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 22, marginBottom: 9 },
  alerta: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderRadius: R.md, padding: 12, marginBottom: 8,
  },
  alertaAlta: { borderLeftWidth: 3, borderLeftColor: C.bordo },
  alertaT: { fontSize: 13.5, fontWeight: '600', color: C.ink },
  alertaD: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  mas: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 2 },
  grafico: { flexDirection: 'row', alignItems: 'flex-end', height: 150, padding: 14, gap: 6 },
  col: { flex: 1, alignItems: 'center', height: '100%' },
  colN: { fontSize: 9.5, color: C.ink3, marginBottom: 4, fontWeight: '600' },
  colBase: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  colBarra: { width: '100%', backgroundColor: C.teal, borderRadius: 5, minHeight: 4 },
  colM: { fontSize: 10, color: C.ink3, marginTop: 6, textTransform: 'uppercase' },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  puesto: { fontSize: 15, fontWeight: '700', color: C.ink3, width: 18 },
  rankN: { fontSize: 14, fontWeight: '600', color: C.ink },
  rankO: { fontSize: 11, color: C.ink3, marginTop: 1 },
  rankV: { fontSize: 13.5, fontWeight: '700', color: C.navy },
  rankVar: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  accesos: { flexDirection: 'row', gap: 10, marginTop: 20 },
  acceso: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#fff', borderRadius: R.md, paddingVertical: 14,
  },
  accesoT: { fontSize: 13.5, fontWeight: '600', color: C.ink },
});
