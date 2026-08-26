import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { eventos } from '../api/client';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { TIPOS } from './EventosScreen';
import { C, R, sombra } from '../theme';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function EventoFormScreen({ route, navigation }) {
  const editando = route.params && route.params.id;

  const [f, setF] = useState({
    titulo: '', descripcion: '', tipo: 'capacitacion',
    fecha: hoy(), hora: '15:00', fechaFin: '', horaFin: '',
    todo_el_dia: false, modalidad: 'presencial', lugar: '', enlace: '',
    cupo: '', cierra: '', obligatorio: false,
  });
  const [alcance, setAlcance] = useState([]);
  const [opciones, setOpciones] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const o = await eventos.opciones();
      setOpciones(o);
      if (editando) {
        const r = await eventos.evento(editando);
        const e = r.evento;
        setF({
          titulo: e.titulo, descripcion: e.descripcion || '', tipo: e.tipo,
          fecha: String(e.inicio).slice(0, 10),
          hora: String(e.inicio).slice(11, 16),
          fechaFin: e.fin ? String(e.fin).slice(0, 10) : '',
          horaFin: e.fin ? String(e.fin).slice(11, 16) : '',
          todo_el_dia: e.todo_el_dia, modalidad: e.modalidad,
          lugar: e.lugar || '', enlace: e.enlace || '',
          cupo: e.cupo ? String(e.cupo) : '',
          cierra: e.cierra_el ? String(e.cierra_el).slice(0, 10) : '',
          obligatorio: e.obligatorio,
        });
        setAlcance(e.alcance || []);
      }
    } catch (e) { setError(e.message); }
  }, [editando]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    navigation.setOptions({ title: editando ? 'Editar evento' : 'Nuevo evento' });
  }, [editando, navigation]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const alternar = (scope, scope_id = 0) => {
    setAlcance((a) => {
      const existe = a.some((x) => x.scope === scope && Number(x.scope_id) === scope_id);
      if (existe) return a.filter((x) => !(x.scope === scope && Number(x.scope_id) === scope_id));
      // "Todos" reemplaza al resto: dejar ambos confunde sin cambiar nada.
      if (scope === 'todos') return [{ scope: 'todos', scope_id: 0 }];
      return [...a.filter((x) => x.scope !== 'todos'), { scope, scope_id }];
    });
  };

  const tiene = (scope, scope_id = 0) =>
    alcance.some((x) => x.scope === scope && Number(x.scope_id) === scope_id);

  const guardar = async (publicar) => {
    if (!f.titulo.trim()) { Alert.alert('Falta el titulo'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) { Alert.alert('La fecha no es valida', 'Usá el formato 2026-03-09'); return; }
    if (publicar && !alcance.length) {
      Alert.alert('Falta el alcance', 'Elegí para quién es el evento antes de publicarlo.');
      return;
    }

    setGuardando(true);
    try {
      const r = await eventos.guardar({
        ...(editando ? { id: editando } : {}),
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim(),
        tipo: f.tipo,
        inicio: `${f.fecha} ${f.todo_el_dia ? '00:00' : (f.hora || '00:00')}:00`,
        fin: f.fechaFin ? `${f.fechaFin} ${f.horaFin || '23:59'}:00` : '',
        todo_el_dia: f.todo_el_dia,
        modalidad: f.modalidad,
        lugar: f.lugar.trim(),
        enlace: f.enlace.trim(),
        cupo: Number(f.cupo) || 0,
        cierra_el: f.cierra ? `${f.cierra} 23:59:59` : '',
        obligatorio: f.obligatorio,
        alcance,
      });

      if (publicar) {
        const p = await eventos.publicar(r.evento_id);
        Alert.alert('Publicado',
          `Le avisamos a ${p.avisados} ${p.avisados === 1 ? 'persona' : 'personas'}.`,
          [{ text: 'Listo', onPress: () => navigation.goBack() }]);
      } else {
        Alert.alert('Guardado', 'Quedó en borrador. Nadie lo ve hasta que lo publiques.',
          [{ text: 'Listo', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally { setGuardando(false); }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!opciones) return <Cargando texto="Cargando" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

        <Card>
          <View style={s.campo}>
            <Text style={s.label}>Titulo</Text>
            <TextInput style={s.input} value={f.titulo} onChangeText={(t) => set('titulo', t)}
              placeholder="Capacitacion de producto Caribe" placeholderTextColor={C.ink3} />
          </View>
          <View style={[s.campo, s.borde]}>
            <Text style={s.label}>De que se trata</Text>
            <TextInput style={[s.input, { minHeight: 76, textAlignVertical: 'top' }]}
              value={f.descripcion} onChangeText={(t) => set('descripcion', t)}
              placeholder="Que se va a ver, que hay que llevar" placeholderTextColor={C.ink3} multiline />
          </View>
        </Card>

        <Text style={s.seccion}>TIPO</Text>
        <View style={s.tipos}>
          {Object.entries(TIPOS).map(([k, t]) => (
            <Pressable key={k} onPress={() => set('tipo', k)}
              style={[s.tipo, f.tipo === k && { backgroundColor: `${t.color}18`, borderColor: t.color }]}>
              <MaterialIcons name={t.icono} size={17} color={f.tipo === k ? t.color : C.ink3} />
              <Text style={[s.tipoTxt, f.tipo === k && { color: t.color, fontWeight: '700' }]}>
                {t.nom}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.seccion}>CUANDO</Text>
        <Card>
          <View style={s.fila}>
            <View style={{ flex: 1.4 }}>
              <Text style={s.label}>Fecha</Text>
              <TextInput style={s.input} value={f.fecha} onChangeText={(t) => set('fecha', t)}
                placeholder="2026-03-09" placeholderTextColor={C.ink3} />
            </View>
            {!f.todo_el_dia ? (
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Hora</Text>
                <TextInput style={s.input} value={f.hora} onChangeText={(t) => set('hora', t)}
                  placeholder="15:00" placeholderTextColor={C.ink3} />
              </View>
            ) : null}
          </View>
          <View style={[s.switchFila, s.borde]}>
            <Text style={s.switchTxt}>Dura todo el dia</Text>
            <Switch value={f.todo_el_dia} onValueChange={(v) => set('todo_el_dia', v)}
              trackColor={{ true: C.teal }} />
          </View>
        </Card>

        <Text style={s.seccion}>DONDE</Text>
        <View style={s.modalidades}>
          {[['presencial', 'place'], ['virtual', 'videocam'], ['hibrido', 'devices']].map(([k, ic]) => (
            <Pressable key={k} onPress={() => set('modalidad', k)}
              style={[s.modal, f.modalidad === k && s.modalOn]}>
              <MaterialIcons name={ic} size={16} color={f.modalidad === k ? C.navy : C.ink3} />
              <Text style={[s.modalTxt, f.modalidad === k && { color: C.navy, fontWeight: '700' }]}>
                {k === 'hibrido' ? 'Hibrido' : k[0].toUpperCase() + k.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Card>
          <View style={s.campo}>
            <Text style={s.label}>{f.modalidad === 'virtual' ? 'Plataforma' : 'Lugar'}</Text>
            <TextInput style={s.input} value={f.lugar} onChangeText={(t) => set('lugar', t)}
              placeholder={f.modalidad === 'virtual' ? 'Google Meet' : 'Oficina Cordoba'}
              placeholderTextColor={C.ink3} />
          </View>
          {f.modalidad !== 'presencial' ? (
            <View style={[s.campo, s.borde]}>
              <Text style={s.label}>Enlace</Text>
              <TextInput style={s.input} value={f.enlace} onChangeText={(t) => set('enlace', t)}
                placeholder="https://" placeholderTextColor={C.ink3} autoCapitalize="none" />
            </View>
          ) : null}
        </Card>

        <Text style={s.seccion}>INSCRIPCION</Text>
        <Card>
          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Cupo</Text>
              <TextInput style={s.input} value={f.cupo} onChangeText={(t) => set('cupo', t.replace(/\D/g, ''))}
                placeholder="Sin limite" placeholderTextColor={C.ink3} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1.4 }}>
              <Text style={s.label}>Cierra el</Text>
              <TextInput style={s.input} value={f.cierra} onChangeText={(t) => set('cierra', t)}
                placeholder="Opcional" placeholderTextColor={C.ink3} />
            </View>
          </View>
          {f.cupo ? (
            <Text style={s.ayuda}>
              Pasados los {f.cupo} lugares, los que se anoten quedan en lista de espera y
              entran solos si alguien se baja.
            </Text>
          ) : null}
          <View style={[s.switchFila, s.borde]}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTxt}>Asistencia obligatoria</Text>
              <Text style={s.switchSub}>No se van a poder bajar</Text>
            </View>
            <Switch value={f.obligatorio} onValueChange={(v) => set('obligatorio', v)}
              trackColor={{ true: C.teal }} />
          </View>
        </Card>

        <Text style={s.seccion}>PARA QUIEN</Text>
        <Card>
          <Pressable style={[s.opcion, tiene('todos') && s.opcionOn]} onPress={() => alternar('todos')}>
            <MaterialIcons name="groups" size={19} color={tiene('todos') ? C.tealDeep : C.ink3} />
            <Text style={s.opcionT}>Toda la empresa</Text>
            {tiene('todos') ? <MaterialIcons name="check" size={19} color={C.teal} /> : null}
          </Pressable>

          {!tiene('todos') ? (
            <>
              <Text style={s.subseccion}>POR AREA</Text>
              {opciones.areas.map((a) => (
                <Pressable key={a.id} style={[s.opcion, tiene('area', a.id) && s.opcionOn]}
                  onPress={() => alternar('area', a.id)}>
                  <View style={[s.punto, { backgroundColor: a.color || C.teal }]} />
                  <Text style={s.opcionT}>{a.nombre}</Text>
                  {tiene('area', a.id) ? <MaterialIcons name="check" size={19} color={C.teal} /> : null}
                </Pressable>
              ))}
            </>
          ) : null}
        </Card>
        {!alcance.length ? (
          <Text style={s.aviso}>Sin esto, el evento no lo ve nadie.</Text>
        ) : null}

        <View style={s.botones}>
          <Pressable style={s.borrador} onPress={() => guardar(false)} disabled={guardando}>
            <Text style={s.borradorTxt}>Guardar borrador</Text>
          </Pressable>
          <Pressable style={[s.publicar, !alcance.length && { opacity: 0.45 }]}
            onPress={() => guardar(true)} disabled={guardando}>
            <MaterialIcons name="send" size={17} color="#fff" />
            <Text style={s.publicarTxt}>Publicar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  campo: { paddingHorizontal: 14, paddingVertical: 11 },
  borde: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  fila: { flexDirection: 'row', gap: 11, paddingHorizontal: 14, paddingVertical: 11 },
  label: { fontSize: 12, fontWeight: '600', color: C.ink2, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 11,
    paddingVertical: 10, fontSize: 14.5, color: C.ink,
  },
  ayuda: { fontSize: 11.5, color: C.ink3, paddingHorizontal: 14, paddingBottom: 11, lineHeight: 16 },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  subseccion: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, color: C.ink3, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tipo: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.line, borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tipoTxt: { fontSize: 12.5, color: C.ink2 },
  modalidades: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  modal: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: R.md,
    paddingVertical: 10,
  },
  modalOn: { backgroundColor: C.tealSoft, borderColor: C.teal },
  modalTxt: { fontSize: 12.5, color: C.ink2 },
  switchFila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  switchTxt: { fontSize: 14, color: C.ink, fontWeight: '500' },
  switchSub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  opcionOn: { backgroundColor: C.tealSoft },
  opcionT: { flex: 1, fontSize: 14, color: C.ink },
  punto: { width: 11, height: 11, borderRadius: 6 },
  aviso: { fontSize: 12, color: C.warn, marginTop: 8, paddingHorizontal: 4, fontWeight: '600' },
  botones: { flexDirection: 'row', gap: 10, marginTop: 22 },
  borrador: {
    flex: 1, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: R.md, paddingVertical: 14, alignItems: 'center',
  },
  borradorTxt: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  publicar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 14,
  },
  publicarTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
