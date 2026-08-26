import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert,
  RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { desempeno } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Cargando, ErrorBox, Vacio, Card } from '../components/UI';
import { C, R, sombra } from '../theme';

const ESCALA = [
  { n: 1, t: 'Muy por debajo' },
  { n: 2, t: 'Por debajo' },
  { n: 3, t: 'Cumple' },
  { n: 4, t: 'Supera' },
  { n: 5, t: 'Sobresale' },
];

const plata = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

const colorNota = (p) => {
  if (p === null || p === undefined) return C.ink3;
  if (p >= 4.2) return C.ok;
  if (p >= 3) return C.tealDeep;
  if (p >= 2) return C.warn;
  return C.bordo;
};

export default function DesempenoScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [local, setLocal] = useState({});

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await desempeno.mia();
      setData(r);
      if (r.auto) {
        const m = {};
        r.auto.criterios.forEach((c) => { if (c.puntaje) m[c.id] = c.puntaje; });
        setLocal({
          puntajes: m,
          fortalezas: r.auto.fortalezas || '',
          a_mejorar: r.auto.a_mejorar || '',
        });
      }
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('DesempenoEquipo')} hitSlop={10}
          style={{ marginRight: 4 }}>
          <MaterialIcons name="groups" size={22} color={C.navy} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const puntuar = (criterioId, valor) => {
    vibrar();
    setLocal((l) => ({ ...l, puntajes: { ...l.puntajes, [criterioId]: valor } }));
  };

  const guardar = async (enviar) => {
    const auto = data.auto;
    const puntajes = Object.entries(local.puntajes || {})
      .map(([criterio_id, puntaje]) => ({ criterio_id: Number(criterio_id), puntaje }));

    if (enviar && puntajes.length < auto.total) {
      Alert.alert(
        'Faltan criterios',
        `Puntuaste ${puntajes.length} de ${auto.total}. Completá todos antes de enviar.`,
      );
      return;
    }

    setGuardando(true);
    try {
      await desempeno.guardar({
        evaluacion_id: auto.id,
        puntajes,
        fortalezas: local.fortalezas,
        a_mejorar: local.a_mejorar,
      });
      if (enviar) {
        await desempeno.enviar(auto.id);
        vibrar(true);
        Alert.alert('Enviada', 'Tu autoevaluacion quedó registrada.');
      }
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  if (!data.hay_ciclo) {
    return (
      <Vacio
        icono="insights"
        titulo="Sin evaluacion abierta"
        texto="Cuando se abra un ciclo de evaluacion, vas a poder completar la tuya acá."
      />
    );
  }

  const { auto, jefe, metricas, ciclo } = data;
  const editable = auto.editable;
  const puntuados = Object.keys(local.puntajes || {}).length;

  const porTipo = { resultado: [], comportamiento: [] };
  auto.criterios.forEach((c) => porTipo[c.tipo].push(c));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={(
          <RefreshControl refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
        )}
      >
        <View style={[s.cab, sombra]}>
          <Text style={s.cicloN}>{ciclo.nombre}</Text>
          <Text style={s.cicloF}>
            {String(ciclo.desde).slice(8, 10)}/{String(ciclo.desde).slice(5, 7)}
            {' al '}
            {String(ciclo.hasta).slice(8, 10)}/{String(ciclo.hasta).slice(5, 7)}
          </Text>
          {ciclo.vence_el && editable ? (
            <Text style={s.vence}>Se puede cargar hasta el {String(ciclo.vence_el).slice(8, 10)}/{String(ciclo.vence_el).slice(5, 7)}</Text>
          ) : null}
        </View>

        {/* Los numeros primero: puntuarse sin verlos es adivinar. */}
        {metricas.length ? (
          <>
            <Text style={s.seccion}>TUS NUMEROS DEL PERIODO</Text>
            <View style={s.metricas}>
              {metricas.map((m) => (
                <View key={m.clave} style={[s.metrica, sombra]}>
                  <Text style={s.metricaN}>{plata(m.valor)}</Text>
                  <Text style={s.metricaT}>{m.etiqueta}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {jefe ? (
          <>
            <Text style={s.seccion}>LA EVALUACION DE TU JEFA</Text>
            <View style={[s.jefeCard, sombra]}>
              <View style={[s.nota, { backgroundColor: `${colorNota(jefe.puntaje)}18` }]}>
                <Text style={[s.notaN, { color: colorNota(jefe.puntaje) }]}>{jefe.puntaje}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.jefeT}>Ya te evaluaron</Text>
                <Text style={s.jefeS}>
                  Resultados {jefe.puntaje_resultados} · Comportamiento {jefe.puntaje_comportamiento}
                </Text>
                {auto.puntaje !== null ? (
                  <Text style={s.brecha}>
                    Vos te pusiste {auto.puntaje}
                    {Math.abs(auto.puntaje - jefe.puntaje) >= 0.5
                      ? auto.puntaje > jefe.puntaje ? ' · te ves mejor de lo que te ven'
                        : ' · te ves peor de lo que te ven'
                      : ' · miradas parecidas'}
                  </Text>
                ) : null}
              </View>
            </View>

            {jefe.fortalezas || jefe.a_mejorar || jefe.compromisos ? (
              <View style={[s.devolucion, sombra]}>
                {[['Lo que hacés bien', jefe.fortalezas],
                  ['Para mejorar', jefe.a_mejorar],
                  ['Lo que acordaron', jefe.compromisos]].map(([t, v]) => (
                    v ? (
                      <View key={t} style={s.devItem}>
                        <Text style={s.devT}>{t}</Text>
                        <Text style={s.devV}>{v}</Text>
                      </View>
                    ) : null
                  ))}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={s.seccionFila}>
          <Text style={s.seccion}>TU AUTOEVALUACION</Text>
          <Text style={s.progreso}>{puntuados}/{auto.total}</Text>
        </View>

        {!editable ? (
          <View style={s.enviada}>
            <MaterialIcons name="check-circle" size={18} color={C.ok} />
            <Text style={s.enviadaTxt}>
              {auto.estado === 'enviada' ? 'Ya la enviaste' : 'El ciclo esta cerrado'}
              {auto.puntaje !== null ? ` · promedio ${auto.puntaje}` : ''}
            </Text>
          </View>
        ) : null}

        {['resultado', 'comportamiento'].map((tipo) => (
          porTipo[tipo].length ? (
            <View key={tipo}>
              <Text style={s.grupo}>
                {tipo === 'resultado' ? 'RESULTADOS' : 'COMPORTAMIENTO'}
              </Text>
              {porTipo[tipo].map((c) => (
                <View key={c.id} style={[s.criterio, sombra]}>
                  <Text style={s.critN}>{c.nombre}</Text>
                  {c.descripcion ? (
                    <Text style={s.critD}>{c.descripcion}</Text>
                  ) : null}
                  <View style={s.escala}>
                    {ESCALA.map((e) => {
                      const sel = (local.puntajes || {})[c.id] === e.n;
                      return (
                        <Pressable
                          key={e.n}
                          disabled={!editable}
                          onPress={() => puntuar(c.id, e.n)}
                          style={[s.punto, sel && s.puntoOn, !editable && { opacity: 0.55 }]}
                        >
                          <Text style={[s.puntoN, sel && { color: '#fff' }]}>{e.n}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {(local.puntajes || {})[c.id] ? (
                    <Text style={s.escalaTxt}>
                      {ESCALA.find((e) => e.n === local.puntajes[c.id]).t}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null
        ))}

        <Text style={s.grupo}>EN TUS PALABRAS</Text>
        <Card>
          <View style={s.campo}>
            <Text style={s.label}>En qué sentís que estás bien</Text>
            <TextInput
              style={s.input}
              value={local.fortalezas}
              onChangeText={(t) => setLocal((l) => ({ ...l, fortalezas: t }))}
              placeholder="Lo que hacés bien"
              placeholderTextColor={C.ink3}
              multiline
              editable={editable}
            />
          </View>
          <View style={[s.campo, { borderTopWidth: 1, borderTopColor: C.lineSoft }]}>
            <Text style={s.label}>Qué te gustaría mejorar</Text>
            <TextInput
              style={s.input}
              value={local.a_mejorar}
              onChangeText={(t) => setLocal((l) => ({ ...l, a_mejorar: t }))}
              placeholder="Dónde ves que podés crecer"
              placeholderTextColor={C.ink3}
              multiline
              editable={editable}
            />
          </View>
        </Card>

        {editable ? (
          <View style={s.botones}>
            <Pressable style={s.guardar} onPress={() => guardar(false)} disabled={guardando}>
              <Text style={s.guardarTxt}>Guardar borrador</Text>
            </Pressable>
            <Pressable
              style={[s.enviar, puntuados < auto.total && { opacity: 0.45 }]}
              onPress={() => guardar(true)}
              disabled={guardando}
            >
              <MaterialIcons name="send" size={17} color="#fff" />
              <Text style={s.enviarTxt}>Enviar</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={s.pie}>
          Una vez enviada no se puede cambiar. Tu jefa la ve al evaluarte.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cab: { backgroundColor: C.navy, borderRadius: R.lg, padding: 16 },
  cicloN: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cicloF: { fontSize: 12.5, color: '#A9CBD6', marginTop: 3 },
  vence: { fontSize: 11.5, color: C.teal, marginTop: 7, fontWeight: '600' },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 22, marginBottom: 9 },
  seccionFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progreso: { fontSize: 12, fontWeight: '700', color: C.tealDeep, marginTop: 22, marginBottom: 9 },
  metricas: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metrica: {
    backgroundColor: '#fff', borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 11,
    minWidth: 104, flexGrow: 1,
  },
  metricaN: { fontSize: 17, fontWeight: '700', color: C.navy },
  metricaT: { fontSize: 10.5, color: C.ink3, marginTop: 2 },
  jefeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 13,
  },
  nota: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  notaN: { fontSize: 18, fontWeight: '700' },
  jefeT: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  jefeS: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  brecha: { fontSize: 11.5, color: C.tealDeep, marginTop: 4, fontWeight: '600' },
  devolucion: { backgroundColor: '#fff', borderRadius: R.md, padding: 14, marginTop: 9 },
  devItem: { marginBottom: 11 },
  devT: { fontSize: 11, fontWeight: '700', color: C.tealDeep, letterSpacing: 0.5, marginBottom: 3 },
  devV: { fontSize: 13.5, color: C.ink, lineHeight: 19 },
  enviada: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E1F5EE',
    borderRadius: R.md, padding: 12, marginBottom: 4,
  },
  enviadaTxt: { fontSize: 13, color: '#1B5E3F', fontWeight: '600' },
  grupo: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.tealDeep, marginTop: 16, marginBottom: 8 },
  criterio: { backgroundColor: '#fff', borderRadius: R.md, padding: 13, marginBottom: 9 },
  critN: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  critD: { fontSize: 12, color: C.ink3, marginTop: 3, lineHeight: 17 },
  escala: { flexDirection: 'row', gap: 7, marginTop: 11 },
  punto: {
    flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg,
  },
  puntoOn: { backgroundColor: C.navy, borderColor: C.navy },
  puntoN: { fontSize: 15, fontWeight: '700', color: C.ink2 },
  escalaTxt: { fontSize: 11.5, color: C.tealDeep, marginTop: 7, fontWeight: '600', textAlign: 'center' },
  campo: { paddingHorizontal: 14, paddingVertical: 11 },
  label: { fontSize: 12, fontWeight: '600', color: C.ink2, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 11,
    paddingVertical: 10, fontSize: 14.5, color: C.ink, minHeight: 64, textAlignVertical: 'top',
  },
  botones: { flexDirection: 'row', gap: 10, marginTop: 20 },
  guardar: {
    flex: 1, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: R.md, paddingVertical: 14, alignItems: 'center',
  },
  guardarTxt: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  enviar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 14,
  },
  enviarTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
