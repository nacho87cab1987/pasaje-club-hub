import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { encuestas } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Cargando, ErrorBox } from '../components/UI';
import { C, R, sombra } from '../theme';

const ESCALA = ['', 'Muy mal', 'Mal', 'Bien', 'Muy bien', 'Excelente'];

export default function EncuestaScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [resp, setResp] = useState({});
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await encuestas.encuesta(id)); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (data) navigation.setOptions({ title: data.encuesta.titulo });
  }, [data, navigation]);

  const contestar = (pid, valor) => {
    vibrar();
    setResp((r) => ({ ...r, [pid]: valor }));
  };

  const alternarMultiple = (pid, oid) => {
    vibrar();
    setResp((r) => {
      const actual = r[pid]?.opciones || [];
      const nuevo = actual.includes(oid)
        ? actual.filter((x) => x !== oid)
        : [...actual, oid];
      return { ...r, [pid]: { opciones: nuevo } };
    });
  };

  const enviar = async () => {
    const faltan = data.preguntas.filter((p) => {
      if (!p.obligatoria) return false;
      const r = resp[p.id];
      if (r === undefined || r === null) return true;
      if (typeof r === 'object') return !(r.opciones || []).length && !r.texto;
      return String(r).trim() === '';
    });

    if (faltan.length) {
      Alert.alert('Falta contestar',
        `Te queda${faltan.length > 1 ? 'n' : ''} ${faltan.length} pregunta${faltan.length > 1 ? 's' : ''} obligatoria${faltan.length > 1 ? 's' : ''}.`);
      return;
    }

    const respuestas = data.preguntas.map((p) => {
      const r = resp[p.id];
      if (r === undefined) return null;
      if (p.tipo === 'escala') return { pregunta_id: p.id, valor: r };
      if (p.tipo === 'texto') return { pregunta_id: p.id, texto: String(r) };
      if (p.tipo === 'multiple') return { pregunta_id: p.id, opciones: r.opciones || [] };
      return { pregunta_id: p.id, opcion_id: r };
    }).filter(Boolean);

    setEnviando(true);
    try {
      await encuestas.responder(id, respuestas);
      vibrar(true);
      Alert.alert('Gracias', data.encuesta.anonima
        ? 'Tu respuesta quedó registrada de forma anónima.'
        : 'Tu respuesta quedó registrada.',
      [{ text: 'Listo', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('No se pudo enviar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const { encuesta: e, preguntas } = data;
  const contestadas = preguntas.filter((p) => resp[p.id] !== undefined).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {e.descripcion ? (
          <View style={[s.intro, sombra]}>
            <Text style={s.introTxt}>{e.descripcion}</Text>
          </View>
        ) : null}

        {e.anonima ? (
          <View style={s.anonima}>
            <MaterialIcons name="visibility-off" size={18} color={C.tealDeep} />
            <Text style={s.anonimaTxt}>
              Es anónima. Guardamos que respondiste, pero no qué respondiste:
              nadie puede saber cuál de todas es la tuya.
            </Text>
          </View>
        ) : null}

        {preguntas.map((p, i) => (
          <View key={p.id} style={[s.pregunta, sombra]}>
            <Text style={s.numero}>{i + 1} de {preguntas.length}</Text>
            <Text style={s.texto}>
              {p.texto}
              {p.obligatoria ? <Text style={{ color: C.bordo }}> *</Text> : null}
            </Text>
            {p.ayuda ? <Text style={s.ayuda}>{p.ayuda}</Text> : null}

            {p.tipo === 'escala' ? (
              <>
                <View style={s.escala}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => contestar(p.id, n)}
                      style={[s.punto, resp[p.id] === n && s.puntoOn]}
                    >
                      <Text style={[s.puntoN, resp[p.id] === n && { color: '#fff' }]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
                {resp[p.id] ? (
                  <Text style={s.escalaTxt}>{ESCALA[resp[p.id]]}</Text>
                ) : null}
              </>
            ) : p.tipo === 'texto' ? (
              <TextInput
                style={s.input}
                value={resp[p.id] || ''}
                onChangeText={(t) => setResp((r) => ({ ...r, [p.id]: t }))}
                placeholder="Escribí lo que quieras"
                placeholderTextColor={C.ink3}
                multiline
              />
            ) : p.tipo === 'multiple' ? (
              p.opciones.map((o) => {
                const marcada = (resp[p.id]?.opciones || []).includes(o.id);
                return (
                  <Pressable key={o.id} style={[s.opcion, marcada && s.opcionOn]}
                    onPress={() => alternarMultiple(p.id, o.id)}>
                    <MaterialIcons
                      name={marcada ? 'check-box' : 'check-box-outline-blank'}
                      size={21} color={marcada ? C.teal : C.ink3}
                    />
                    <Text style={s.opcionTxt}>{o.texto}</Text>
                  </Pressable>
                );
              })
            ) : (
              p.opciones.map((o) => (
                <Pressable key={o.id} style={[s.opcion, resp[p.id] === o.id && s.opcionOn]}
                  onPress={() => contestar(p.id, o.id)}>
                  <MaterialIcons
                    name={resp[p.id] === o.id ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={21} color={resp[p.id] === o.id ? C.teal : C.ink3}
                  />
                  <Text style={s.opcionTxt}>{o.texto}</Text>
                </Pressable>
              ))
            )}
          </View>
        ))}

        <Pressable
          style={[s.enviar, enviando && { opacity: 0.5 }]}
          onPress={enviar}
          disabled={enviando}
        >
          <Text style={s.enviarTxt}>
            Enviar {contestadas < preguntas.length ? `(${contestadas}/${preguntas.length})` : ''}
          </Text>
        </Pressable>

        <Text style={s.pie}>Una vez enviada no se puede cambiar.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  intro: { backgroundColor: '#fff', borderRadius: R.md, padding: 14 },
  introTxt: { fontSize: 14, color: C.ink2, lineHeight: 20 },
  anonima: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: C.tealSoft,
    borderRadius: R.md, padding: 13, marginTop: 10,
  },
  anonimaTxt: { flex: 1, fontSize: 12.5, color: C.tealDeep, lineHeight: 18, fontWeight: '500' },
  pregunta: { backgroundColor: '#fff', borderRadius: R.lg, padding: 15, marginTop: 12 },
  numero: { fontSize: 10.5, fontWeight: '700', color: C.ink3, letterSpacing: 0.8, marginBottom: 6 },
  texto: { fontSize: 15.5, fontWeight: '600', color: C.ink, lineHeight: 21 },
  ayuda: { fontSize: 12.5, color: C.ink3, marginTop: 4, lineHeight: 17 },
  escala: { flexDirection: 'row', gap: 8, marginTop: 13 },
  punto: {
    flex: 1, height: 46, borderRadius: 11, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg,
  },
  puntoOn: { backgroundColor: C.navy, borderColor: C.navy },
  puntoN: { fontSize: 16, fontWeight: '700', color: C.ink2 },
  escalaTxt: { fontSize: 12.5, color: C.tealDeep, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    paddingHorizontal: 11, borderRadius: R.sm, marginTop: 7, borderWidth: 1, borderColor: C.line,
  },
  opcionOn: { backgroundColor: C.tealSoft, borderColor: C.teal },
  opcionTxt: { flex: 1, fontSize: 14.5, color: C.ink },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12,
    fontSize: 15, color: C.ink, minHeight: 90, textAlignVertical: 'top', marginTop: 11,
  },
  enviar: {
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 16,
    alignItems: 'center', marginTop: 22,
  },
  enviarTxt: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 12 },
});
