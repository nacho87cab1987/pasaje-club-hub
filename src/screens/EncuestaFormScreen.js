import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, StyleSheet, Pressable, Alert, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { encuestas, admin } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Card, Cargando } from '../components/UI';
import { C, R, sombra } from '../theme';

const TIPOS = [
  { k: 'escala',   n: 'Escala 1 a 5', i: 'linear-scale' },
  { k: 'si_no',    n: 'Sí o no',      i: 'rule' },
  { k: 'opciones', n: 'Elegir una',   i: 'radio-button-checked' },
  { k: 'multiple', n: 'Varias',       i: 'check-box' },
  { k: 'texto',    n: 'Respuesta abierta', i: 'notes' },
];

export default function EncuestaFormScreen({ navigation, route }) {
  const editId = route.params?.id || 0;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [anonima, setAnonima] = useState(true);
  const [obligatoria, setObligatoria] = useState(false);
  const [preguntas, setPreguntas] = useState([]);
  const [alcance, setAlcance] = useState([{ scope: 'todos', scope_id: 0 }]);
  const [areas, setAreas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(!editId);

  const cargar = useCallback(async () => {
    try {
      const c = await admin.catalogos().catch(() => ({ areas: [] }));
      setAreas(c.areas || []);
      if (editId) {
        const d = await encuestas.encuesta(editId);
        setTitulo(d.encuesta.titulo);
        setDescripcion(d.encuesta.descripcion || '');
        setAnonima(!!d.encuesta.anonima);
        setObligatoria(!!d.encuesta.obligatoria);
        setPreguntas(d.preguntas.map((p) => ({
          texto: p.texto, tipo: p.tipo, obligatoria: p.obligatoria,
          opciones: (p.opciones || []).map((o) => o.texto),
        })));
        setAlcance(d.alcance || []);
      }
      setListo(true);
    } catch (e) { Alert.alert('No se pudo cargar', e.message); }
  }, [editId]);

  useEffect(() => { cargar(); }, [cargar]);

  const agregarPregunta = () => {
    vibrar();
    setPreguntas((p) => [...p, { texto: '', tipo: 'escala', obligatoria: true, opciones: [] }]);
  };

  const cambiar = (i, campo, valor) => {
    setPreguntas((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  };

  const guardar = async (abrir) => {
    if (titulo.trim().length < 3) { Alert.alert('Falta el título'); return; }
    const validas = preguntas.filter((p) => p.texto.trim());
    if (!validas.length) { Alert.alert('Agregá al menos una pregunta'); return; }

    // Elegir una o varias sin opciones no se puede contestar.
    const sinOpciones = validas.find(
      (p) => ['opciones', 'multiple'].includes(p.tipo)
        && (p.opciones || []).filter((o) => String(o).trim()).length < 2,
    );
    if (sinOpciones) {
      Alert.alert('Faltan opciones',
        `"${sinOpciones.texto.slice(0, 40)}" necesita al menos dos opciones.`);
      return;
    }

    setGuardando(true);
    try {
      const r = await encuestas.guardar({
        id: editId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        anonima, obligatoria,
        preguntas: validas.map((p) => ({
          ...p, opciones: (p.opciones || []).filter((o) => String(o).trim()),
        })),
        alcance,
      });
      if (abrir) await encuestas.estado(r.id, 'abierta');
      vibrar(true);
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo guardar', e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!listo) return <Cargando texto="Cargando" />;

  const todos = alcance.some((a) => a.scope === 'todos');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <Text style={s.label}>Título</Text>
        <TextInput style={s.input} value={titulo} onChangeText={setTitulo}
          placeholder="Ej: Clima laboral · segundo semestre"
          placeholderTextColor={C.ink3} />

        <Text style={s.label}>Descripción</Text>
        <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={descripcion} onChangeText={setDescripcion} multiline
          placeholder="Para qué es y cuánto lleva" placeholderTextColor={C.ink3} />

        <Card>
          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.filaT}>Anónima</Text>
              <Text style={s.filaS}>
                No se guarda quién respondió qué. Es lo que hace que la gente
                conteste en serio.
              </Text>
            </View>
            <Switch value={anonima} onValueChange={setAnonima}
              trackColor={{ true: C.teal }} />
          </View>
          <View style={[s.fila, { borderTopWidth: 1, borderTopColor: C.lineSoft }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.filaT}>Obligatoria</Text>
              <Text style={s.filaS}>Se avisa distinto y se insiste.</Text>
            </View>
            <Switch value={obligatoria} onValueChange={setObligatoria}
              trackColor={{ true: C.teal }} />
          </View>
        </Card>

        <Text style={s.label}>¿A quiénes?</Text>
        <View style={s.chips}>
          <Pressable
            style={[s.chip, todos && s.chipOn]}
            onPress={() => setAlcance([{ scope: 'todos', scope_id: 0 }])}
          >
            <Text style={[s.chipTxt, todos && { color: '#fff' }]}>Todos</Text>
          </Pressable>
          {areas.map((a) => {
            const on = alcance.some((x) => x.scope === 'area' && x.scope_id === a.id);
            return (
              <Pressable
                key={a.id}
                style={[s.chip, on && s.chipOn]}
                onPress={() => setAlcance((prev) => {
                  const sinTodos = prev.filter((x) => x.scope !== 'todos');
                  return on
                    ? sinTodos.filter((x) => !(x.scope === 'area' && x.scope_id === a.id))
                    : [...sinTodos, { scope: 'area', scope_id: a.id }];
                })}
              >
                <Text style={[s.chipTxt, on && { color: '#fff' }]}>{a.nombre}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>Preguntas</Text>
        {preguntas.map((p, i) => (
          <View key={i} style={[s.pregunta, sombra]}>
            <View style={s.pregTop}>
              <Text style={s.pregN}>{i + 1}</Text>
              <Pressable onPress={() => setPreguntas(preguntas.filter((_, j) => j !== i))}
                hitSlop={8}>
                <MaterialIcons name="close" size={19} color={C.ink3} />
              </Pressable>
            </View>

            <TextInput
              style={s.pregInput}
              value={p.texto}
              onChangeText={(t) => cambiar(i, 'texto', t)}
              placeholder="Escribí la pregunta"
              placeholderTextColor={C.ink3}
              multiline
            />

            <View style={s.tipos}>
              {TIPOS.map((t) => (
                <Pressable key={t.k}
                  style={[s.tipo, p.tipo === t.k && s.tipoOn]}
                  onPress={() => { vibrar(); cambiar(i, 'tipo', t.k); }}>
                  <MaterialIcons name={t.i} size={14}
                    color={p.tipo === t.k ? C.navy : C.ink3} />
                  <Text style={[s.tipoTxt, p.tipo === t.k && { color: C.navy, fontWeight: '700' }]}>
                    {t.n}
                  </Text>
                </Pressable>
              ))}
            </View>

            {['opciones', 'multiple'].includes(p.tipo) ? (
              <View style={{ marginTop: 10 }}>
                {(p.opciones || []).map((o, j) => (
                  <View key={j} style={s.opcionFila}>
                    <TextInput
                      style={s.opcionInput}
                      value={o}
                      onChangeText={(t) => cambiar(i, 'opciones',
                        p.opciones.map((x, k) => (k === j ? t : x)))}
                      placeholder={`Opción ${j + 1}`}
                      placeholderTextColor={C.ink3}
                    />
                    <Pressable onPress={() => cambiar(i, 'opciones',
                      p.opciones.filter((_, k) => k !== j))} hitSlop={8}>
                      <MaterialIcons name="close" size={17} color={C.ink3} />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  style={s.masOpcion}
                  onPress={() => cambiar(i, 'opciones', [...(p.opciones || []), ''])}
                >
                  <MaterialIcons name="add" size={16} color={C.tealDeep} />
                  <Text style={s.masOpcionTxt}>Agregar opción</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable style={s.oblig} onPress={() => cambiar(i, 'obligatoria', !p.obligatoria)}>
              <MaterialIcons
                name={p.obligatoria ? 'check-box' : 'check-box-outline-blank'}
                size={19} color={p.obligatoria ? C.teal : C.ink3}
              />
              <Text style={s.obligTxt}>Obligatoria</Text>
            </Pressable>
          </View>
        ))}

        <Pressable style={s.agregar} onPress={agregarPregunta}>
          <MaterialIcons name="add" size={20} color={C.tealDeep} />
          <Text style={s.agregarTxt}>Agregar pregunta</Text>
        </Pressable>

        <View style={s.botones}>
          <Pressable style={s.borrador} onPress={() => guardar(false)} disabled={guardando}>
            <Text style={s.borradorTxt}>Guardar borrador</Text>
          </Pressable>
          <Pressable style={s.publicar} onPress={() => guardar(true)} disabled={guardando}>
            <MaterialIcons name="send" size={17} color="#fff" />
            <Text style={s.publicarTxt}>Abrir y avisar</Text>
          </Pressable>
        </View>

        <Text style={s.pie}>
          Al abrirla le llega un aviso a todos los que alcanza. Después no se
          pueden cambiar las preguntas.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: C.ink2, marginTop: 18, marginBottom: 7, letterSpacing: 0.3 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 13,
    paddingVertical: 12, fontSize: 15, color: C.ink, backgroundColor: '#fff',
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  filaT: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  filaS: { fontSize: 11.5, color: C.ink3, marginTop: 2, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  pregunta: { backgroundColor: '#fff', borderRadius: R.lg, padding: 13, marginBottom: 10 },
  pregTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pregN: { fontSize: 11, fontWeight: '800', color: C.ink3, letterSpacing: 1 },
  pregInput: {
    fontSize: 15, color: C.ink, marginTop: 6, borderBottomWidth: 1,
    borderBottomColor: C.line, paddingVertical: 8, minHeight: 40,
  },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  tipo: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1,
    borderColor: C.line, borderRadius: 13, paddingHorizontal: 9, paddingVertical: 6,
  },
  tipoOn: { backgroundColor: C.tealSoft, borderColor: C.teal },
  tipoTxt: { fontSize: 11, color: C.ink3 },
  opcionFila: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  opcionInput: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: R.sm,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: C.ink,
  },
  masOpcion: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  masOpcionTxt: { fontSize: 12.5, fontWeight: '600', color: C.tealDeep },
  oblig: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11 },
  obligTxt: { fontSize: 12.5, color: C.ink2 },
  agregar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.tealSoft, borderRadius: R.md, paddingVertical: 14,
  },
  agregarTxt: { fontSize: 14, fontWeight: '700', color: C.tealDeep },
  botones: { flexDirection: 'row', gap: 10, marginTop: 20 },
  borrador: {
    flex: 1, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: R.md, paddingVertical: 14, alignItems: 'center',
  },
  borradorTxt: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  publicar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 14,
  },
  publicarTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
