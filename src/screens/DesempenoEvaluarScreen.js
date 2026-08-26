import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { desempeno } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra } from '../theme';

const ESCALA = ['', 'Muy por debajo', 'Por debajo', 'Cumple', 'Supera', 'Sobresale'];
const plata = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

export default function DesempenoEvaluarScreen({ route, navigation }) {
  const { personaId, nombre } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [local, setLocal] = useState({ puntajes: {} });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await desempeno.evaluacion(personaId);
      setData(r);
      const m = {};
      r.eval.criterios.forEach((c) => { if (c.puntaje) m[c.id] = c.puntaje; });
      setLocal({
        puntajes: m,
        fortalezas: r.eval.fortalezas || '',
        a_mejorar: r.eval.a_mejorar || '',
        compromisos: r.eval.compromisos || '',
      });
    } catch (e) { setError(e.message); }
  }, [personaId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { navigation.setOptions({ title: nombre || 'Evaluar' }); }, [nombre, navigation]);

  const guardar = async (enviar) => {
    const puntajes = Object.entries(local.puntajes)
      .map(([criterio_id, puntaje]) => ({ criterio_id: Number(criterio_id), puntaje }));

    if (enviar && puntajes.length < data.eval.total) {
      Alert.alert('Faltan criterios',
        `Puntuaste ${puntajes.length} de ${data.eval.total}.`);
      return;
    }

    setGuardando(true);
    try {
      await desempeno.guardar({
        evaluacion_id: data.eval.id,
        puntajes,
        fortalezas: local.fortalezas,
        a_mejorar: local.a_mejorar,
        compromisos: local.compromisos,
      });
      if (enviar) {
        await desempeno.enviar(data.eval.id);
        vibrar(true);
        Alert.alert('Enviada', `La evaluacion de ${nombre} quedó registrada.`,
          [{ text: 'Listo', onPress: () => navigation.goBack() }]);
      } else {
        await cargar();
      }
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const { eval: ev, auto, metricas } = data;
  const editable = ev.editable;
  const puntuados = Object.keys(local.puntajes).length;

  const porTipo = { resultado: [], comportamiento: [] };
  ev.criterios.forEach((c) => porTipo[c.tipo].push(c));
  const autoPorId = {};
  if (auto) auto.criterios.forEach((c) => { autoPorId[c.id] = c.puntaje; });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

        {metricas.length ? (
          <>
            <Text style={s.seccion}>SUS NUMEROS DEL PERIODO</Text>
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

        {auto ? (
          <View style={s.autoAviso}>
            <MaterialIcons name="person" size={16} color={C.tealDeep} />
            <Text style={s.autoTxt}>
              Ella se puso {auto.puntaje}. Su nota aparece al lado de cada criterio.
            </Text>
          </View>
        ) : (
          <View style={s.autoAviso}>
            <MaterialIcons name="info-outline" size={16} color={C.ink3} />
            <Text style={[s.autoTxt, { color: C.ink3 }]}>
              Todavia no envió su autoevaluacion.
            </Text>
          </View>
        )}

        {['resultado', 'comportamiento'].map((tipo) => (
          porTipo[tipo].length ? (
            <View key={tipo}>
              <Text style={s.grupo}>
                {tipo === 'resultado' ? 'RESULTADOS' : 'COMPORTAMIENTO'}
              </Text>
              {porTipo[tipo].map((c) => {
                const mio = local.puntajes[c.id];
                const suyo = autoPorId[c.id];
                // La diferencia por criterio es mas util que la del promedio:
                // dice exactamente sobre que hay que hablar.
                const dif = mio && suyo ? mio - suyo : null;
                return (
                  <View key={c.id} style={[s.criterio, sombra]}>
                    <View style={s.critTop}>
                      <Text style={s.critN}>{c.nombre}</Text>
                      {suyo ? (
                        <View style={s.suyo}>
                          <Text style={s.suyoTxt}>ella: {suyo}</Text>
                        </View>
                      ) : null}
                    </View>
                    {c.descripcion ? <Text style={s.critD}>{c.descripcion}</Text> : null}

                    <View style={s.escala}>
                      {[1, 2, 3, 4, 5].map((n) => {
                        const sel = mio === n;
                        const esSuyo = suyo === n;
                        return (
                          <Pressable
                            key={n}
                            disabled={!editable}
                            onPress={() => { vibrar(); setLocal((l) => ({ ...l, puntajes: { ...l.puntajes, [c.id]: n } })); }}
                            style={[s.punto, sel && s.puntoOn,
                                    !sel && esSuyo && s.puntoSuyo,
                                    !editable && { opacity: 0.55 }]}
                          >
                            <Text style={[s.puntoN, sel && { color: '#fff' }]}>{n}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {mio ? (
                      <Text style={s.escalaTxt}>
                        {ESCALA[mio]}
                        {dif !== null && dif !== 0
                          ? ` · ${dif > 0 ? '+' : ''}${dif} respecto de ella` : ''}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null
        ))}

        <Text style={s.grupo}>DEVOLUCION</Text>
        <Card>
          {[
            ['fortalezas', 'Qué hace bien', 'Lo que hay que reconocerle'],
            ['a_mejorar', 'Qué puede mejorar', 'Concreto y accionable'],
            ['compromisos', 'Qué acuerdan para el próximo ciclo', 'Lo que se va a revisar la próxima'],
          ].map(([campo, label, ph], i) => (
            <View key={campo} style={[s.campo, i > 0 && { borderTopWidth: 1, borderTopColor: C.lineSoft }]}>
              <Text style={s.label}>{label}</Text>
              <TextInput
                style={s.input}
                value={local[campo]}
                onChangeText={(t) => setLocal((l) => ({ ...l, [campo]: t }))}
                placeholder={ph}
                placeholderTextColor={C.ink3}
                multiline
                editable={editable}
              />
            </View>
          ))}
        </Card>

        {editable ? (
          <View style={s.botones}>
            <Pressable style={s.guardar} onPress={() => guardar(false)} disabled={guardando}>
              <Text style={s.guardarTxt}>Guardar</Text>
            </Pressable>
            <Pressable
              style={[s.enviar, puntuados < ev.total && { opacity: 0.45 }]}
              onPress={() => guardar(true)}
              disabled={guardando}
            >
              <MaterialIcons name="send" size={17} color="#fff" />
              <Text style={s.enviarTxt}>Enviar ({puntuados}/{ev.total})</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.enviada}>
            <MaterialIcons name="check-circle" size={18} color={C.ok} />
            <Text style={s.enviadaTxt}>
              Enviada · promedio {ev.puntaje}
            </Text>
          </View>
        )}

        <Text style={s.pie}>
          Una vez enviada, la persona la puede ver y ya no se edita.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginBottom: 9 },
  metricas: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metrica: {
    backgroundColor: '#fff', borderRadius: R.md, paddingHorizontal: 13, paddingVertical: 11,
    minWidth: 104, flexGrow: 1,
  },
  metricaN: { fontSize: 17, fontWeight: '700', color: C.navy },
  metricaT: { fontSize: 10.5, color: C.ink3, marginTop: 2 },
  autoAviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.tealSoft,
    borderRadius: R.md, padding: 12, marginTop: 16,
  },
  autoTxt: { flex: 1, fontSize: 12.5, color: C.tealDeep, fontWeight: '600', lineHeight: 17 },
  grupo: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.tealDeep, marginTop: 20, marginBottom: 8 },
  criterio: { backgroundColor: '#fff', borderRadius: R.md, padding: 13, marginBottom: 9 },
  critTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  critN: { flex: 1, fontSize: 14.5, fontWeight: '600', color: C.ink },
  suyo: { backgroundColor: C.tealSoft, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  suyoTxt: { fontSize: 10.5, fontWeight: '700', color: C.tealDeep },
  critD: { fontSize: 12, color: C.ink3, marginTop: 3, lineHeight: 17 },
  escala: { flexDirection: 'row', gap: 7, marginTop: 11 },
  punto: {
    flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg,
  },
  puntoOn: { backgroundColor: C.navy, borderColor: C.navy },
  puntoSuyo: { borderColor: C.teal, borderWidth: 1.5, borderStyle: 'dashed' },
  puntoN: { fontSize: 15, fontWeight: '700', color: C.ink2 },
  escalaTxt: { fontSize: 11.5, color: C.tealDeep, marginTop: 7, fontWeight: '600', textAlign: 'center' },
  campo: { paddingHorizontal: 14, paddingVertical: 11 },
  label: { fontSize: 12, fontWeight: '600', color: C.ink2, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 11,
    paddingVertical: 10, fontSize: 14.5, color: C.ink, minHeight: 60, textAlignVertical: 'top',
  },
  botones: { flexDirection: 'row', gap: 10, marginTop: 20 },
  guardar: {
    flex: 1, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: R.md, paddingVertical: 14, alignItems: 'center',
  },
  guardarTxt: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  enviar: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 14,
  },
  enviarTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },
  enviada: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#E1F5EE', borderRadius: R.md, padding: 14, marginTop: 20,
  },
  enviadaTxt: { fontSize: 13.5, color: '#1B5E3F', fontWeight: '700' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
