import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { gestion } from '../api/client';
import { Cargando, ErrorBox, Boton, Card, Avatar } from '../components/UI';
import { C, R, iniciales } from '../theme';

const PRIORIDADES = [
  { k: 'urgente', nom: 'Urgente', c: '#790F35', bg: '#F6E3EA' },
  { k: 'alta',    nom: 'Alta',    c: '#BA7517', bg: '#FAEEDA' },
  { k: 'normal',  nom: 'Normal',  c: C.ink2,    bg: C.lineSoft },
  { k: 'baja',    nom: 'Baja',    c: C.ink3,    bg: C.lineSoft },
];

function formatearFecha(txt, anterior) {
  const borrando = txt.length < anterior.length;
  const d = txt.replace(/\D/g, '').slice(0, 8);
  if (borrando && txt.endsWith('/')) return txt.slice(0, -1);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

const aVista = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

/** Atajos: la mayoria de las tareas vencen hoy, manana o el viernes. */
function atajosFecha() {
  const hoy = new Date();
  const suma = (n) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + n);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const alViernes = (5 - hoy.getDay() + 7) % 7 || 7;
  return [
    { nom: 'Hoy', v: suma(0) },
    { nom: 'Manana', v: suma(1) },
    { nom: 'Viernes', v: suma(alViernes) },
    { nom: 'En 2 semanas', v: suma(14) },
  ];
}

export default function TareaFormScreen({ route, navigation }) {
  const editar = route.params && route.params.tarea;
  const [tablero, setTablero] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [titulo, setTitulo] = useState(editar ? editar.titulo : '');
  const [descripcion, setDescripcion] = useState(editar ? (editar.descripcion || '') : '');
  const [prioridad, setPrioridad] = useState(editar ? editar.prioridad : 'normal');
  const [vence, setVence] = useState(editar ? aVista(editar.vence) : '');
  const [listaId, setListaId] = useState(editar ? editar.lista_id : null);
  const [asignados, setAsignados] = useState(
    editar && editar.asignados ? editar.asignados.map((a) => a.id) : [],
  );

  useEffect(() => {
    navigation.setOptions({ title: editar ? 'Editar tarea' : 'Nueva tarea' });
    (async () => {
      try {
        const t = await gestion.tablero();
        setTablero(t);
        if (!editar && !listaId) {
          // Preseleccionamos la primera lista de un espacio donde sea
          // miembro: es donde va a caer casi siempre.
          const mio = t.espacios.find((e) => e.soy_miembro && e.listas.length);
          const alguno = mio || t.espacios.find((e) => e.listas.length);
          if (alguno) setListaId(alguno.listas[0].id);
          if (t.yo) setAsignados([t.yo]);
        }
      } catch (e) { setError(e.message); }
    })();
  }, []);

  const guardar = async () => {
    if (!titulo.trim()) { Alert.alert('Falta el titulo', 'Escribi que hay que hacer.'); return; }
    if (!listaId) { Alert.alert('Falta la lista', 'Elegi en que espacio y lista va.'); return; }
    if (vence && vence.length !== 10) { Alert.alert('Fecha incompleta', 'Escribila como DD/MM/AAAA.'); return; }

    setGuardando(true);
    try {
      if (editar) {
        await gestion.editar({
          tarea_id: editar.id,
          titulo: titulo.trim(),
          descripcion,
          prioridad,
          fecha_vencimiento: vence,
          lista_id: listaId,
        });
        await gestion.asignar(editar.id, asignados);
      } else {
        await gestion.crear({
          titulo: titulo.trim(),
          descripcion,
          prioridad,
          fecha_vencimiento: vence,
          lista_id: listaId,
          asignados,
        });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo guardar', e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} />;
  if (!tablero) return <Cargando texto="Cargando" />;

  const conListas = tablero.espacios.filter((e) => e.listas.length);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <Card>
          <TextInput
            style={s.titulo}
            value={titulo}
            onChangeText={setTitulo}
            placeholder="¿Que hay que hacer?"
            placeholderTextColor={C.ink3}
            autoFocus={!editar}
            multiline
          />
          <TextInput
            style={s.desc}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Detalle (opcional)"
            placeholderTextColor={C.ink3}
            multiline
            textAlignVertical="top"
          />
        </Card>

        <Text style={s.seccion}>DONDE VA</Text>
        {conListas.map((e) => (
          <View key={e.id} style={{ marginBottom: 9 }}>
            <View style={s.espacioTit}>
              <View style={[s.punto, { backgroundColor: e.color || C.ink3 }]} />
              <Text style={s.espacioNom}>{e.nombre}</Text>
              {e.soy_miembro ? <Text style={s.miembro}>sos miembro</Text> : null}
            </View>
            <View style={s.chips}>
              {e.listas.map((l) => (
                <Pressable key={l.id} onPress={() => setListaId(l.id)}
                  style={[s.chip, listaId === l.id && s.chipOn]}>
                  <Text style={[s.chipTxt, listaId === l.id && { color: '#fff' }]}>{l.nombre}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={s.seccion}>PRIORIDAD</Text>
        <View style={s.chips}>
          {PRIORIDADES.map((p) => (
            <Pressable key={p.k} onPress={() => setPrioridad(p.k)}
              style={[s.chip, prioridad === p.k && { backgroundColor: p.bg, borderColor: p.c }]}>
              <Text style={[s.chipTxt, prioridad === p.k && { color: p.c, fontWeight: '700' }]}>
                {p.nom}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.seccion}>PARA CUANDO</Text>
        <TextInput
          style={s.fecha}
          value={vence}
          onChangeText={(t) => setVence(formatearFecha(t, vence))}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={C.ink3}
          keyboardType="number-pad"
          maxLength={10}
        />
        <View style={[s.chips, { marginTop: 8 }]}>
          {atajosFecha().map((a) => (
            <Pressable key={a.nom} onPress={() => setVence(a.v)}
              style={[s.chip, vence === a.v && s.chipOn]}>
              <Text style={[s.chipTxt, vence === a.v && { color: '#fff' }]}>{a.nom}</Text>
            </Pressable>
          ))}
          {vence ? (
            <Pressable onPress={() => setVence('')} style={s.chip}>
              <MaterialIcons name="close" size={14} color={C.ink3} />
            </Pressable>
          ) : null}
        </View>

        <Text style={s.seccion}>QUIEN LA HACE</Text>
        <Card>
          {tablero.gente.map((g, i) => {
            const sel = asignados.includes(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => setAsignados(sel ? asignados.filter((x) => x !== g.id) : [...asignados, g.id])}
                style={[s.persona, i < tablero.gente.length - 1 && s.borde, sel && { backgroundColor: C.tealSoft }]}
              >
                <MaterialIcons
                  name={sel ? 'check-box' : 'check-box-outline-blank'}
                  size={21}
                  color={sel ? C.teal : C.ink3}
                />
                <Avatar texto={iniciales(...String(g.nombre).split(' '))} tam={30}
                  fondo={g.color || C.tealSoft} color="#fff" />
                <Text style={s.personaNom}>{g.nombre}</Text>
                {g.id === tablero.yo ? <Text style={s.vos}>vos</Text> : null}
              </Pressable>
            );
          })}
        </Card>
        {!asignados.length ? (
          <Text style={s.aviso}>Si no elegis a nadie, queda a tu nombre.</Text>
        ) : null}

        <View style={{ marginTop: 22 }}>
          <Boton
            texto={editar ? 'Guardar cambios' : 'Crear tarea'}
            onPress={guardar}
            cargando={guardando}
            icono="check"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  titulo: {
    fontSize: 17, fontWeight: '600', color: C.ink, paddingHorizontal: 14,
    paddingTop: 14, paddingBottom: 8, lineHeight: 23,
  },
  desc: {
    fontSize: 14.5, lineHeight: 20, color: C.ink2, paddingHorizontal: 14,
    paddingBottom: 14, minHeight: 70,
  },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  espacioTit: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingHorizontal: 2 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  espacioNom: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  miembro: { fontSize: 10.5, color: C.tealDeep, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  fecha: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, backgroundColor: '#fff',
    paddingHorizontal: 14, height: 46, fontSize: 15.5, color: C.ink,
  },
  persona: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  personaNom: { flex: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  vos: { fontSize: 10.5, fontWeight: '700', color: C.tealDeep },
  aviso: { fontSize: 12, color: C.ink3, marginTop: 8, paddingHorizontal: 2 },
});
