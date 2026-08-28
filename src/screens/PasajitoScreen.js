import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { pasajito, imagenUrl } from '../api/client';
import { elegirImagenes } from '../imagenes';
import { subirArchivo } from '../subir';
import { useGrabador, hayAudio, segundos } from '../audio';
import { Cargando, ErrorBox } from '../components/UI';
import { C, R, sombra } from '../theme';

// Lo que una vendedora pregunta seguido. Un chat en blanco no invita a nada;
// con estos, la primera consulta sale sin pensarla.
const SUGERENCIAS = [
  '¿Cuánto sale Cancún en diciembre?',
  '¿Qué grupales hay disponibles?',
  '¿Qué documentación necesita Brasil?',
  'Armame un texto para ofrecer Punta Cana',
];

export default function PasajitoScreen({ navigation }) {
  const [chatId, setChatId] = useState(null);
  const [mensajes, setMensajes] = useState(null);
  const [chats, setChats] = useState([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [adjuntos, setAdjuntos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const grabador = useGrabador();
  const [error, setError] = useState(null);
  const [verChats, setVerChats] = useState(false);
  const lista = useRef(null);

  const cargarChats = useCallback(async () => {
    try {
      const r = await pasajito.chats();
      setChats(r.items || []);
      return r.items || [];
    } catch (e) { return []; }
  }, []);

  // Al abrir: retoma el ultimo chat o arranca uno nuevo. Nadie quiere elegir
  // un chat de una lista antes de poder preguntar algo.
  useEffect(() => {
    (async () => {
      try {
        const previos = await cargarChats();
        if (previos.length) {
          await abrirChat(previos[0].id);
        } else {
          const r = await pasajito.nuevoChat();
          setChatId(r.id);
          setMensajes([]);
          await cargarChats();
        }
      } catch (e) { setError(e.message); }
    })();
  }, []);

  const abrirChat = async (id) => {
    setVerChats(false);
    setMensajes(null);
    setChatId(id);
    try {
      const r = await pasajito.mensajes(id);
      setMensajes(r.items || []);
    } catch (e) { setError(e.message); setMensajes([]); }
  };

  const nuevoChat = async () => {
    setVerChats(false);
    try {
      const r = await pasajito.nuevoChat();
      setChatId(r.id);
      setMensajes([]);
      await cargarChats();
    } catch (e) { Alert.alert('No se pudo', e.message); }
  };

  const borrarChat = (c) => {
    Alert.alert('Borrar conversacion', c.titulo || 'Sin titulo', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await pasajito.eliminarChat(c.id);
            const quedan = await cargarChats();
            if (c.id === chatId) {
              if (quedan.length) abrirChat(quedan[0].id);
              else nuevoChat();
            }
          } catch (e) { Alert.alert('No se pudo', e.message); }
        },
      },
    ]);
  };

  const adjuntar = async () => {
    const assets = await elegirImagenes({ maximo: 3 });
    if (!assets.length) return;
    setSubiendo(true);
    try {
      for (const a of assets) {
        const r = await subirArchivo(a, {
          url: 'pasajito.php', campo: 'archivo', params: { action: 'subir' },
        });
        setAdjuntos((x) => [...x, { ...r, previa: a.uri }]);
      }
    } catch (e) {
      Alert.alert('No se pudo subir', e.message);
    } finally {
      setSubiendo(false);
    }
  };

  // Grabar y preguntar de viva voz: el servidor transcribe el audio antes
  // de pasarselo al modelo, asi la conversacion queda legible despues.
  const conVoz = async () => {
    if (grabador.grabando) {
      const audio = await grabador.parar();
      if (!audio) return;
      setSubiendo(true);
      try {
        const r = await subirArchivo(
          { uri: audio.uri, name: 'consulta.m4a', mimeType: 'audio/m4a' },
          { url: 'pasajito.php', campo: 'archivo', params: { action: 'subir' } },
        );
        setAdjuntos((x) => [...x, { ...r, tipo: 'audio', duracion: audio.duracion }]);
      } catch (e) {
        Alert.alert('No se pudo subir el audio', e.message);
      } finally {
        setSubiendo(false);
      }
      return;
    }

    const r = await grabador.arrancar();
    if (r === 'sin_permiso') {
      Alert.alert('Sin acceso al microfono',
        'Podes habilitarlo desde los ajustes del telefono.');
    }
  };

  const enviar = async (preguntaDirecta) => {
    const pregunta = (preguntaDirecta || texto).trim();
    // Con un adjunto no hace falta escribir: la imagen ya es la pregunta.
    if ((!pregunta && !adjuntos.length) || pensando || !chatId) return;

    const envio = adjuntos;
    setAdjuntos([]);
    setTexto('');
    // El mensaje propio aparece al instante: esperar la respuesta del modelo
    // para verlo hace sentir que no se envio.
    setMensajes((m) => [...(m || []), {
      id: `tmp-${Date.now()}`, rol: 'user',
      contenido: pregunta || `[${envio.length} adjunto${envio.length > 1 ? 's' : ''}]`,
      adjuntos: envio,
    }]);
    setPensando(true);
    setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 60);

    try {
      const r = await pasajito.enviar(chatId, pregunta, envio.map(({ previa, ...a }) => a));
      setMensajes((m) => [...m, {
        id: `r-${Date.now()}`, rol: 'assistant', contenido: r.respuesta,
      }]);
      cargarChats();
    } catch (e) {
      setMensajes((m) => [...m, {
        id: `e-${Date.now()}`, rol: 'error',
        contenido: e.message || 'No pude responder. Proba de nuevo.',
      }]);
    } finally {
      setPensando(false);
      setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={s.acciones}>
          <Pressable onPress={() => setVerChats(true)} hitSlop={10}>
            <MaterialIcons name="history" size={22} color={C.navy} />
          </Pressable>
          <Pressable onPress={nuevoChat} hitSlop={10}>
            <MaterialIcons name="add-comment" size={21} color={C.navy} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, chatId]);

  if (error && !mensajes) return <ErrorBox mensaje={error} />;
  if (mensajes === null) return <Cargando texto="Abriendo Pasajito" />;

  const vacio = mensajes.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      <FlatList
        ref={lista}
        data={mensajes}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 14, paddingBottom: 20, flexGrow: 1 }}
        onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={(
          <View style={s.bienvenida}>
            <View style={s.avatarGrande}>
              <MaterialIcons name="flight" size={30} color={C.teal} />
            </View>
            <Text style={s.bienvenidaT}>Preguntale a Pasajito</Text>
            <Text style={s.bienvenidaS}>
              Sabe de destinos, tarifas de referencia, paquetes, grupales y
              documentacion. Todo lo que tenemos cargado adentro.
            </Text>
            <View style={s.sugerencias}>
              {SUGERENCIAS.map((x) => (
                <Pressable key={x} style={s.sug} onPress={() => enviar(x)}>
                  <Text style={s.sugTxt}>{x}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const mio = item.rol === 'user';
          const esError = item.rol === 'error';
          return (
            <View style={[s.fila, mio && { justifyContent: 'flex-end' }]}>
              {!mio && !esError ? (
                <View style={s.avatar}>
                  <MaterialIcons name="flight" size={15} color={C.teal} />
                </View>
              ) : null}
              <View style={[s.burbuja, mio ? s.mia : esError ? s.err : s.suya]}>
                <Text style={[s.txt, mio && { color: '#fff' }, esError && { color: C.bordo }]}>
                  {item.contenido}
                </Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={pensando ? (
          <View style={s.fila}>
            <View style={s.avatar}>
              <MaterialIcons name="flight" size={15} color={C.teal} />
            </View>
            <View style={[s.burbuja, s.suya, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <ActivityIndicator size="small" color={C.tealDeep} />
              <Text style={s.pensando}>Buscando en lo que sabemos…</Text>
            </View>
          </View>
        ) : null}
      />

      {adjuntos.length || subiendo ? (
        <View style={s.adjBarra}>
          {adjuntos.map((a, i) => (
            <View key={`${a.url}-${i}`} style={s.adj}>
              {a.tipo === 'imagen' ? (
                <Image source={{ uri: a.previa || imagenUrl(a.url) }} style={s.adjImg} />
              ) : (
                <View style={[s.adjImg, s.adjDoc]}>
                  <MaterialIcons
                    name={a.tipo === 'audio' ? 'mic' : 'description'}
                    size={18} color={C.tealDeep}
                  />
                </View>
              )}
              <Pressable
                style={s.adjQuitar}
                onPress={() => setAdjuntos(adjuntos.filter((_, j) => j !== i))}
              >
                <MaterialIcons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          {subiendo ? <ActivityIndicator size="small" color={C.tealDeep} /> : null}
        </View>
      ) : null}

      <View style={s.barra}>
        <Pressable onPress={adjuntar} hitSlop={8} style={s.clip} disabled={pensando}>
          <MaterialIcons name="attach-file" size={22} color={C.ink3} />
        </Pressable>

        {hayAudio && !texto.trim() ? (
          <Pressable onPress={conVoz} hitSlop={8} style={s.clip} disabled={pensando}>
            <MaterialIcons
              name={grabador.grabando ? 'stop-circle' : 'mic'}
              size={22}
              color={grabador.grabando ? C.bordo : C.ink3}
            />
          </Pressable>
        ) : null}

        <TextInput
          style={s.input}
          value={texto}
          onChangeText={setTexto}
          placeholder={grabador.grabando
            ? `Grabando ${segundos(grabador.seg)}`
            : vacio ? 'Preguntá lo que necesites' : 'Escribi tu consulta'}
          placeholderTextColor={C.ink3}
          multiline
          editable={!pensando}
        />
        <Pressable
          onPress={() => enviar()}
          disabled={(!texto.trim() && !adjuntos.length) || pensando}
          style={[s.enviar,
                  ((!texto.trim() && !adjuntos.length) || pensando) && { opacity: 0.4 }]}
        >
          <MaterialIcons name="arrow-upward" size={20} color="#fff" />
        </Pressable>
      </View>

      <Modal visible={verChats} animationType="slide" transparent
        onRequestClose={() => setVerChats(false)}>
        <Pressable style={s.fondo} onPress={() => setVerChats(false)} />
        <View style={s.hoja}>
          <View style={s.hojaTop}>
            <Text style={s.hojaTit}>Tus conversaciones</Text>
            <Pressable onPress={() => setVerChats(false)} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.ink3} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            <Pressable style={s.nuevo} onPress={nuevoChat}>
              <MaterialIcons name="add" size={19} color={C.tealDeep} />
              <Text style={s.nuevoTxt}>Conversacion nueva</Text>
            </Pressable>
            {chats.map((c) => (
              <Pressable
                key={c.id}
                style={[s.chat, c.id === chatId && { backgroundColor: C.tealSoft }]}
                onPress={() => abrirChat(c.id)}
                onLongPress={() => borrarChat(c)}
              >
                <MaterialIcons name="chat-bubble-outline" size={17} color={C.ink3} />
                <View style={{ flex: 1 }}>
                  <Text style={s.chatT} numberOfLines={1}>
                    {c.titulo || 'Sin titulo'}
                  </Text>
                  {c.ultimo ? (
                    <Text style={s.chatU} numberOfLines={1}>{c.ultimo}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
            <Text style={s.pieHoja}>Mantené apretada una para borrarla.</Text>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 4 },
  bienvenida: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 10 },
  avatarGrande: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  bienvenidaT: { fontSize: 19, fontWeight: '700', color: C.ink },
  bienvenidaS: {
    fontSize: 13.5, color: C.ink3, textAlign: 'center', marginTop: 8,
    lineHeight: 19, paddingHorizontal: 16,
  },
  sugerencias: { width: '100%', marginTop: 24, gap: 8 },
  sug: {
    backgroundColor: '#fff', borderRadius: R.md, padding: 13,
    borderWidth: 1, borderColor: C.line,
  },
  sugTxt: { fontSize: 13.5, color: C.ink2 },
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 11 },
  avatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  burbuja: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  mia: { backgroundColor: C.navy, borderBottomRightRadius: 5 },
  suya: { backgroundColor: '#fff', borderBottomLeftRadius: 5 },
  err: { backgroundColor: '#FCEBEB', borderBottomLeftRadius: 5 },
  txt: { fontSize: 14.5, lineHeight: 21, color: C.ink },
  pensando: { fontSize: 13, color: C.ink3, fontStyle: 'italic' },
  adjBarra: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12,
    paddingTop: 10, backgroundColor: '#fff',
  },
  adj: { width: 54, height: 54 },
  adjImg: { width: 54, height: 54, borderRadius: 9, backgroundColor: C.lineSoft },
  adjDoc: { alignItems: 'center', justifyContent: 'center' },
  adjQuitar: {
    position: 'absolute', right: -4, top: -4, width: 19, height: 19, borderRadius: 10,
    backgroundColor: C.bordo, alignItems: 'center', justifyContent: 'center',
  },
  clip: { paddingBottom: 10 },
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 11,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 22,
    paddingHorizontal: 15, paddingVertical: 11, fontSize: 15, color: C.ink, maxHeight: 120,
  },
  enviar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.4)' },
  hoja: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '72%' },
  hojaTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hojaTit: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  nuevo: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  nuevoTxt: { fontSize: 14.5, fontWeight: '600', color: C.tealDeep },
  chat: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  chatT: { fontSize: 14, fontWeight: '500', color: C.ink },
  chatU: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  pieHoja: { fontSize: 11.5, color: C.ink3, textAlign: 'center', marginTop: 14 },
});
