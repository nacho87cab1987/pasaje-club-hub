import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, Linking, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { eventos } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Avatar, Cargando, ErrorBox, Card } from '../components/UI';
import { TIPOS, cuando } from './EventosScreen';
import { C, R, sombra, iniciales } from '../theme';

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
  'agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];

function fechaLarga(iso, todoElDia) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const base = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  if (todoElDia) return base;
  return `${base}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function EventoScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  // Tomar asistencia se hace sobre la misma lista, tildando: abrir otra
  // pantalla para lo mismo seria un rodeo.
  const [tomandoAsistencia, setTomandoAsistencia] = useState(false);
  const [asistencias, setAsistencias] = useState({});

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await eventos.evento(id)); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  useEffect(() => {
    if (!data) return;
    navigation.setOptions({
      title: '',
      headerRight: () => (
        data.evento.puedo_editar ? (
          <Pressable onPress={menu} hitSlop={10} style={{ marginRight: 4 }}>
            <MaterialIcons name="more-vert" size={22} color={C.navy} />
          </Pressable>
        ) : null
      ),
    });
  }, [data, navigation]);

  const menu = () => {
    const e = data.evento;
    const opciones = [
      { text: 'Editar', onPress: () => navigation.navigate('EventoForm', { id: e.id }) },
    ];
    if (e.estado === 'borrador') {
      opciones.push({ text: 'Publicar y avisar', onPress: publicar });
    }
    if (e.estado === 'publicado' && !e.pasado) {
      opciones.push({ text: 'Cancelar evento', style: 'destructive', onPress: cancelar });
    }
    if (e.pasado && e.estado !== 'cancelado') {
      opciones.push({ text: 'Tomar asistencia', onPress: () => setTomandoAsistencia(true) });
    }
    opciones.push({ text: 'Cerrar', style: 'cancel' });
    Alert.alert(e.titulo, null, opciones);
  };

  const publicar = async () => {
    try {
      const r = await eventos.publicar(id);
      vibrar(true);
      Alert.alert('Publicado', `Le avisamos a ${r.avisados} ${r.avisados === 1 ? 'persona' : 'personas'}.`);
      cargar();
    } catch (e) { Alert.alert('No se pudo', e.message); }
  };

  const cancelar = () => {
    Alert.alert('Cancelar evento', 'Se les avisa a los anotados.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancelar evento',
        style: 'destructive',
        onPress: async () => {
          try { await eventos.cancelar(id); cargar(); }
          catch (e) { Alert.alert('No se pudo', e.message); }
        },
      },
    ]);
  };

  const anotarse = async () => {
    setOcupado(true);
    try {
      const r = await eventos.anotarse(id);
      vibrar(true);
      if (r.estado === 'espera') {
        Alert.alert('Quedaste en la fila',
          `El cupo está completo. Sos el número ${r.posicion} en la lista de espera: si alguien se baja, entrás automáticamente.`);
      }
      await cargar();
    } catch (e) { Alert.alert('No se pudo', e.message); }
    finally { setOcupado(false); }
  };

  const bajarse = () => {
    Alert.alert('Bajarte del evento', '¿Seguro? Si hay lista de espera, tu lugar se lo lleva otro.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Bajarme',
        style: 'destructive',
        onPress: async () => {
          setOcupado(true);
          try { await eventos.bajarme(id); await cargar(); }
          catch (e) { Alert.alert('No se pudo', e.message); }
          finally { setOcupado(false); }
        },
      },
    ]);
  };

  const guardarAsistencia = async () => {
    try {
      const lista = data.anotados.map((p) => ({
        persona_id: p.id,
        asistio: asistencias[p.id] !== undefined
          ? asistencias[p.id]
          : p.estado === 'asistio',
      }));
      await eventos.asistencia(id, lista);
      setTomandoAsistencia(false);
      setAsistencias({});
      await cargar();
    } catch (e) { Alert.alert('No se pudo', e.message); }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const e = data.evento;
  const t = TIPOS[e.tipo] || TIPOS.otro;
  const pronto = cuando(e.inicio);
  const anotado = e.mi_estado === 'anotado';
  const espera = e.mi_estado === 'espera';
  const puedeAnotarse = e.estado === 'publicado' && !e.pasado && !e.inscripcion_cerrada;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        refreshControl={(
          <RefreshControl refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
        )}
      >
        {e.estado === 'cancelado' ? (
          <View style={s.avisoCancel}>
            <MaterialIcons name="event-busy" size={19} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.avisoCancelT}>Este evento se canceló</Text>
              {e.motivo_cancelacion ? (
                <Text style={s.avisoCancelS}>{e.motivo_cancelacion}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={[s.cab, sombra]}>
          <View style={[s.tipoChip, { backgroundColor: `${t.color}18` }]}>
            <MaterialIcons name={t.icono} size={14} color={t.color} />
            <Text style={[s.tipoTxt, { color: t.color }]}>{t.nom}</Text>
          </View>

          <Text style={s.titulo}>{e.titulo}</Text>

          <View style={s.dato}>
            <MaterialIcons name="event" size={17} color={C.tealDeep} />
            <Text style={s.datoTxt}>
              {fechaLarga(e.inicio, e.todo_el_dia)}
              {pronto ? ` · ${pronto}` : ''}
            </Text>
          </View>

          {e.lugar ? (
            <View style={s.dato}>
              <MaterialIcons
                name={e.modalidad === 'virtual' ? 'videocam' : 'place'}
                size={17} color={C.tealDeep}
              />
              <Text style={s.datoTxt}>{e.lugar}</Text>
            </View>
          ) : null}

          {e.enlace ? (
            <Pressable style={s.dato} onPress={() => Linking.openURL(e.enlace).catch(() => {})}>
              <MaterialIcons name="link" size={17} color={C.tealDeep} />
              <Text style={[s.datoTxt, s.enlace]} numberOfLines={1}>{e.enlace}</Text>
            </Pressable>
          ) : null}

          {e.obligatorio ? (
            <View style={s.oblig}>
              <MaterialIcons name="priority-high" size={14} color="#854F0B" />
              <Text style={s.obligTxt}>Asistencia obligatoria</Text>
            </View>
          ) : null}
        </View>

        {e.descripcion ? (
          <Card>
            <Text style={s.desc}>{e.descripcion}</Text>
          </Card>
        ) : null}

        {e.cupo > 0 ? (
          <View style={[s.cupo, sombra]}>
            <View style={{ flex: 1 }}>
              <Text style={s.cupoN}>
                {e.anotados} de {e.cupo} lugares
              </Text>
              <View style={s.barra}>
                <View style={[s.barraLlena,
                  { width: `${Math.min(100, (e.anotados / e.cupo) * 100)}%` },
                  e.lleno && { backgroundColor: C.bordo }]} />
              </View>
            </View>
            {e.en_espera > 0 ? (
              <Text style={s.esperaN}>{e.en_espera} en espera</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={s.seccion}>
          QUIENES VAN {data.anotados.length ? `· ${data.anotados.length}` : ''}
        </Text>
        {data.anotados.length ? (
          <Card>
            {data.anotados.map((p, i) => {
              const marcado = asistencias[p.id] !== undefined
                ? asistencias[p.id]
                : p.estado === 'asistio';
              return (
                <Pressable
                  key={p.id}
                  style={[s.persona, i < data.anotados.length - 1 && s.borde]}
                  disabled={!tomandoAsistencia}
                  onPress={() => {
                    vibrar();
                    setAsistencias((a) => ({ ...a, [p.id]: !marcado }));
                  }}
                >
                  <Avatar texto={iniciales(...String(p.nombre).split(' '))} tam={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.personaN} numberOfLines={1}>
                      {p.nombre}{p.soy_yo ? ' · vos' : ''}
                    </Text>
                    {p.area ? <Text style={s.personaA}>{p.area}</Text> : null}
                  </View>
                  {tomandoAsistencia ? (
                    <MaterialIcons
                      name={marcado ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={marcado ? C.teal : C.ink3}
                    />
                  ) : p.estado === 'asistio' ? (
                    <MaterialIcons name="check-circle" size={18} color={C.ok} />
                  ) : p.estado === 'falto' ? (
                    <MaterialIcons name="cancel" size={18} color={C.ink3} />
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <Text style={s.nadie}>Todavia no se anotó nadie. Podés ser el primero.</Text>
        )}

        {data.espera.length ? (
          <>
            <Text style={s.seccion}>LISTA DE ESPERA · {data.espera.length}</Text>
            <Card>
              {data.espera.map((p, i) => (
                <View key={p.id} style={[s.persona, i < data.espera.length - 1 && s.borde]}>
                  <Text style={s.posicion}>{i + 1}</Text>
                  <Text style={[s.personaN, { flex: 1 }]} numberOfLines={1}>
                    {p.nombre}{p.soy_yo ? ' · vos' : ''}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>

      {tomandoAsistencia ? (
        <View style={s.barraAccion}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={s.btnBajarse} onPress={() => { setTomandoAsistencia(false); setAsistencias({}); }}>
              <Text style={s.btnBajarseTxt}>Cancelar</Text>
            </Pressable>
            <Pressable style={[s.btnAnotarse, { flex: 1.3 }]} onPress={guardarAsistencia}>
              <MaterialIcons name="how-to-reg" size={19} color="#fff" />
              <Text style={s.btnAnotarseTxt}>Guardar asistencia</Text>
            </Pressable>
          </View>
        </View>
      ) : puedeAnotarse ? (
        <View style={s.barraAccion}>
          {anotado || espera ? (
            <Pressable style={s.btnBajarse} onPress={bajarse} disabled={ocupado}>
              <Text style={s.btnBajarseTxt}>
                {espera ? 'Salir de la lista de espera' : 'No voy a ir'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.btnAnotarse, e.lleno && { backgroundColor: C.tealDeep }]}
              onPress={anotarse}
              disabled={ocupado}
            >
              <MaterialIcons name={e.lleno ? 'hourglass-top' : 'check'} size={19} color="#fff" />
              <Text style={s.btnAnotarseTxt}>
                {e.lleno ? 'Anotarme en la lista de espera' : 'Anotarme'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : e.inscripcion_cerrada && !e.pasado ? (
        <View style={s.barraAccion}>
          <Text style={s.cerrado}>Las inscripciones ya cerraron</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  avisoCancel: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bordo,
    borderRadius: R.md, padding: 13, marginBottom: 12,
  },
  avisoCancelT: { color: '#fff', fontSize: 14, fontWeight: '700' },
  avisoCancelS: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 2 },
  cab: { backgroundColor: '#fff', borderRadius: R.lg, padding: 16 },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4,
  },
  tipoTxt: { fontSize: 11, fontWeight: '700' },
  titulo: { fontSize: 21, fontWeight: '700', color: C.ink, marginTop: 10, lineHeight: 27, letterSpacing: -0.4 },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  datoTxt: { flex: 1, fontSize: 14, color: C.ink2, textTransform: 'capitalize' },
  enlace: { color: C.tealDeep, textDecorationLine: 'underline', textTransform: 'none' },
  oblig: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FAEEDA',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, marginTop: 13, alignSelf: 'flex-start',
  },
  obligTxt: { fontSize: 12, fontWeight: '700', color: '#854F0B' },
  desc: { fontSize: 14.5, color: C.ink, lineHeight: 21, padding: 15 },
  cupo: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.md, padding: 14, marginTop: 12,
  },
  cupoN: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  barra: { height: 6, borderRadius: 3, backgroundColor: C.lineSoft, marginTop: 7, overflow: 'hidden' },
  barraLlena: { height: 6, borderRadius: 3, backgroundColor: C.teal },
  esperaN: { fontSize: 11.5, color: C.warn, fontWeight: '700' },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  persona: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  personaN: { fontSize: 14, fontWeight: '500', color: C.ink },
  personaA: { fontSize: 11, color: C.ink3, marginTop: 1 },
  posicion: { fontSize: 13, fontWeight: '700', color: C.ink3, width: 22 },
  nadie: { fontSize: 13, color: C.ink3, textAlign: 'center', paddingVertical: 16, lineHeight: 18 },
  barraAccion: {
    padding: 13, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line,
  },
  btnAnotarse: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 15,
  },
  btnAnotarseTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnBajarse: {
    flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line,
    borderRadius: R.md, paddingVertical: 15,
  },
  btnBajarseTxt: { fontSize: 14.5, fontWeight: '600', color: C.ink2 },
  cerrado: { fontSize: 13.5, color: C.ink3, textAlign: 'center', paddingVertical: 4 },
});
