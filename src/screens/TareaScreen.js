import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { gestion } from '../api/client';
import MenuContextual, { usarPosicionToque, vibrar } from '../MenuContextual';
import { Card, Avatar, Cargando, ErrorBox, Tag } from '../components/UI';
import { C, R, iniciales } from '../theme';

function fechaLarga(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function cuando(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function TareaScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const ctx = usarPosicionToque();
  const [nuevaSub, setNuevaSub] = useState('');
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await gestion.tarea(id)); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  const agregarSub = async () => {
    const t = nuevaSub.trim();
    if (!t) return;
    setNuevaSub('');
    try {
      await gestion.subtarea(id, t);
      vibrar();
      await cargar();
    } catch (e) { Alert.alert('No se pudo', e.message); }
  };

  const completarSub = async (x) => {
    vibrar();
    try {
      await gestion.completar(x.id, !x.completada);
      await cargar();
    } catch (e) { Alert.alert('No se pudo', e.message); }
  };

  const menu = () => {
    const t = data.tarea;
    ctx.abrir({
      titulo: t.titulo,
      subtitulo: t.lista || t.tablero || null,
      opciones: [
        {
          texto: t.completada ? 'Marcar sin terminar' : 'Marcar terminada',
          icono: t.completada ? 'radio-button-unchecked' : 'check-circle',
          onPress: completar,
        },
        {
          texto: 'Editar',
          icono: 'edit',
          onPress: () => navigation.navigate('TareaForm', { tarea: t }),
        },
        {
          texto: 'Eliminar',
          icono: 'delete-outline',
          destructivo: true,
          onPress: () => Alert.alert(
            'Eliminar tarea',
            'Se borra tambien en gestion. No se puede deshacer.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                  try { await gestion.eliminar(id); navigation.goBack(); }
                  catch (e) { Alert.alert('No se pudo', e.message); }
                },
              },
            ],
          ),
        },
      ],
    });
  };

  useEffect(() => {
    if (!data) return;
    navigation.setOptions({
      title: data.tarea.espacio || 'Tarea',
      headerRight: () => (
        <Pressable onPress={menu} onPressIn={ctx.alTocar} hitSlop={10}>
          <MaterialIcons name="more-vert" size={22} color={C.navy} />
        </Pressable>
      ),
    });
  }, [data, navigation]);

  const completar = async () => {
    setMarcando(true);
    try {
      const r = await gestion.completar(id, !data.tarea.completada);
      setData((d) => ({ ...d, tarea: { ...d.tarea, completada: r.completada } }));
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally {
      setMarcando(false);
    }
  };

  const comentar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      await gestion.comentar(id, t);
      setTexto('');
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo comentar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Abriendo tarea" />;

  const t = data.tarea;
  const vencida = t.dias !== null && t.dias < 0 && !t.completada;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
        <Card>
          <View style={s.cab}>
            <Pressable onPress={completar} hitSlop={10} disabled={marcando}>
              {marcando
                ? <ActivityIndicator size="small" color={C.teal} />
                : (
                  <MaterialIcons
                    name={t.completada ? 'check-circle' : 'radio-button-unchecked'}
                    size={26}
                    color={t.completada ? C.ok : C.ink3}
                  />
                )}
            </Pressable>
            <Text style={[s.titulo, t.completada && s.tachado]}>{t.titulo}</Text>
          </View>

          <View style={s.tags}>
            {t.estado ? <Tag texto={t.estado} tipo="cool" /> : null}
            {t.prioridad !== 'normal' && t.prioridad !== 'baja'
              ? <Tag texto={t.prioridad} tipo={t.prioridad === 'urgente' ? 'warn' : 'warn'} /> : null}
            {t.lista ? <Text style={s.lista}>{t.lista}</Text> : null}
          </View>

          {t.vence ? (
            <View style={[s.fila, vencida && { backgroundColor: '#F6E3EA' }]}>
              <MaterialIcons name="event" size={18} color={vencida ? C.bordo : C.tealDeep} />
              <Text style={[s.filaTxt, vencida && { color: C.bordo, fontWeight: '600' }]}>
                {vencida ? 'Vencio el ' : 'Vence el '}{fechaLarga(t.vence)}
              </Text>
            </View>
          ) : null}

          {t.descripcion ? (
            <View style={s.desc}>
              <Text style={s.descTxt}>{t.descripcion}</Text>
            </View>
          ) : null}
        </Card>

        {t.asignados && t.asignados.length ? (
          <>
            <Text style={s.seccion}>QUIENES LA TIENEN</Text>
            <Card>
              {t.asignados.map((a, i) => (
                <View key={a.id} style={[s.persona, i < t.asignados.length - 1 && s.borde]}>
                  <Avatar persona={a}
                    texto={iniciales(...String(a.nombre).split(' '))}
                    tam={34}
                    fondo={a.color || C.tealSoft}
                    color="#fff"
                  />
                  <Text style={s.personaNom}>{a.nombre}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {data.expediente ? (
          <Pressable
            style={[s.expediente, sombra]}
            onPress={() => navigation.navigate('Expediente', {
              id: data.expediente.id, codigo: data.expediente.codigo,
            })}
          >
            <MaterialIcons name="folder-special" size={20} color={C.tealDeep} />
            <View style={{ flex: 1 }}>
              <Text style={s.expT}>{data.expediente.cliente_nombre}</Text>
              <Text style={s.expS}>
                {[data.expediente.codigo, data.expediente.destino].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={19} color={C.ink3} />
          </Pressable>
        ) : null}

        {data.subtareas ? (
          <>
            <View style={s.seccionFila}>
              <Text style={s.seccion}>SUBTAREAS</Text>
              {data.subtareas.length ? (
                <Text style={s.avance}>
                  {data.sub_hechas || 0}/{data.subtareas.length}
                </Text>
              ) : null}
            </View>

            <Card>
              {data.subtareas.map((x, i) => (
                <Pressable
                  key={x.id}
                  style={[s.sub, i < data.subtareas.length - 1 && s.borde]}
                  onPress={() => completarSub(x)}
                >
                  <MaterialIcons
                    name={x.completada ? 'check-circle' : 'radio-button-unchecked'}
                    size={21}
                    color={x.completada ? C.ok : C.ink3}
                  />
                  <Text style={[s.subTxt, x.completada && s.subHecha]} numberOfLines={2}>
                    {x.titulo}
                  </Text>
                </Pressable>
              ))}

              {/* Agregar al vuelo, sin abrir otra pantalla: una subtarea se
                  anota mientras se lee la tarea madre. */}
              <View style={[s.sub, data.subtareas.length ? s.bordeArriba : null]}>
                <MaterialIcons name="add" size={20} color={C.tealDeep} />
                <TextInput
                  style={s.subInput}
                  value={nuevaSub}
                  onChangeText={setNuevaSub}
                  placeholder="Agregar un paso"
                  placeholderTextColor={C.ink3}
                  onSubmitEditing={agregarSub}
                  returnKeyType="done"
                />
              </View>
            </Card>
          </>
        ) : null}

        <Text style={s.seccion}>COMENTARIOS</Text>
        {data.comentarios.length === 0 ? (
          <Text style={s.vacio}>Todavia no hay comentarios.</Text>
        ) : (
          data.comentarios.map((c) => (
            <View key={c.id} style={s.com}>
              <Avatar
                texto={iniciales(...String(c.autor || '?').split(' '))}
                tam={32}
                fondo={c.color || C.tealSoft}
                color="#fff"
              />
              <View style={{ flex: 1 }}>
                <View style={s.comBurbuja}>
                  <Text style={s.comAutor}>{c.autor || 'Alguien'}</Text>
                  <Text style={s.comTxt}>{c.texto}</Text>
                </View>
                <Text style={s.comHora}>{cuando(c.creado)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={s.barra}>
        <TextInput
          style={s.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribi un comentario"
          placeholderTextColor={C.ink3}
          multiline
        />
        <Pressable
          onPress={comentar}
          disabled={!texto.trim() || enviando}
          style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.4 }]}
        >
          {enviando ? <ActivityIndicator color="#fff" size="small" />
                    : <MaterialIcons name="send" size={19} color="#fff" />}
        </Pressable>
      </View>

      <MenuContextual
        visible={!!ctx.menu}
        x={ctx.menu && ctx.menu.x}
        y={ctx.menu && ctx.menu.y}
        titulo={ctx.menu && ctx.menu.titulo}
        subtitulo={ctx.menu && ctx.menu.subtitulo}
        opciones={ctx.menu && ctx.menu.opciones}
        onCerrar={ctx.cerrar}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cab: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15, paddingBottom: 10 },
  titulo: { flex: 1, fontSize: 17, fontWeight: '700', color: C.ink, lineHeight: 23, letterSpacing: -0.2 },
  tachado: { textDecorationLine: 'line-through', color: C.ink3, fontWeight: '400' },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', paddingHorizontal: 15, paddingBottom: 12 },
  lista: { fontSize: 11.5, color: C.ink3 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 15, paddingVertical: 11, backgroundColor: C.bg,
  },
  filaTxt: { fontSize: 13.5, color: C.ink2 },
  desc: { paddingHorizontal: 15, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.lineSoft },
  descTxt: { fontSize: 14.5, lineHeight: 21, color: C.ink2 },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  persona: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11 },
  seccionFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avance: { fontSize: 12, fontWeight: '700', color: C.tealDeep },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  subTxt: { flex: 1, fontSize: 14.5, color: C.ink },
  subHecha: { textDecorationLine: 'line-through', color: C.ink3 },
  subInput: { flex: 1, fontSize: 14.5, color: C.ink, paddingVertical: 2 },
  bordeArriba: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  expediente: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderRadius: R.md, padding: 13, marginTop: 14,
  },
  expT: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  expS: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  personaNom: { flex: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  vacio: { fontSize: 13, color: C.ink3, textAlign: 'center', paddingVertical: 14 },
  com: { flexDirection: 'row', gap: 10, marginBottom: 11 },
  comBurbuja: { backgroundColor: '#fff', borderRadius: R.lg, paddingHorizontal: 13, paddingVertical: 10 },
  comAutor: { fontSize: 12.5, fontWeight: '700', color: C.ink, marginBottom: 3 },
  comTxt: { fontSize: 14, lineHeight: 20, color: C.ink },
  comHora: { fontSize: 10.5, color: C.ink3, marginTop: 3, marginLeft: 4 },
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 11,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 20,
    paddingHorizontal: 15, paddingVertical: 10, fontSize: 15, color: C.ink, maxHeight: 110,
  },
  enviar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
});
