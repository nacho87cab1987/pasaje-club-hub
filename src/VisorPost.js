import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Dimensions, Modal, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { muro, imagenUrl } from './api/client';
import { abrirArchivo } from './archivos';
import { vibrar } from './MenuContextual';
import { Avatar } from './components/UI';
import { C, R, iniciales } from './theme';

function cuando(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/**
 * La imagen en grande, con los comentarios abajo.
 *
 * Se mira una foto del muro y se quiere ver que dijeron los demas sin salir
 * a otra pantalla: mirar y comentar son la misma accion, no dos.
 *
 * El panel arranca cerrado -mostrando cuantos comentarios hay- y se abre al
 * tocarlo. Asi la foto se ve completa de entrada, que es a lo que uno vino.
 */
export default function VisorPost({ visible, postId, media, indice = 0, onCerrar }) {
  const { width, height } = Dimensions.get('window');
  const [abierto, setAbierto] = useState(false);
  const [comentarios, setComentarios] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [actual, setActual] = useState(indice);
  const scroll = useRef(null);

  const cargar = useCallback(async () => {
    if (!postId) return;
    try {
      const r = await muro.post(postId);
      setComentarios(r.comentarios || []);
    } catch (e) { setComentarios([]); }
  }, [postId]);

  useEffect(() => {
    if (visible) {
      setActual(indice);
      setAbierto(false);
      cargar();
    }
  }, [visible, indice, cargar]);

  const comentar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      await muro.comentar(postId, t);
      setTexto('');
      vibrar();
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo comentar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!visible) return null;

  const lista = media || [];
  const m = lista[actual] || lista[0] || {};
  const n = comentarios ? comentarios.length : null;

  // Con el panel abierto la imagen se achica para dejarle lugar.
  const altoImagen = abierto ? height * 0.36 : height * 0.68;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={s.fondo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.barra}>
          <Pressable onPress={onCerrar} hitSlop={12}>
            <MaterialIcons name="close" size={26} color="#fff" />
          </Pressable>
          {lista.length > 1 ? (
            <Text style={s.contador}>{actual + 1} de {lista.length}</Text>
          ) : <View style={{ flex: 1 }} />}
          {m.tipo !== 'video' ? (
            <Pressable onPress={() => abrirArchivo(imagenUrl(m.url), m.nombre)} hitSlop={12}>
              <MaterialIcons name="ios-share" size={22} color="#fff" />
            </Pressable>
          ) : <View style={{ width: 22 }} />}
        </View>

        <Pressable style={{ flex: 1 }} onPress={() => setAbierto(false)}>
          {m.tipo === 'video' ? (
            <Pressable
              style={[s.centro, { height: altoImagen }]}
              onPress={() => abrirArchivo(imagenUrl(m.url), m.nombre)}
            >
              <MaterialIcons name="play-circle-filled" size={64} color="#fff" />
              <Text style={s.videoTxt}>Tocá para reproducir</Text>
            </Pressable>
          ) : (
            <View style={[s.centro, { height: altoImagen }]}>
              <Image
                source={{ uri: imagenUrl(m.url) }}
                style={{ width: width - 20, height: altoImagen }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Varias fotos: se pasan de a una tocando los puntos. */}
          {lista.length > 1 ? (
            <View style={s.puntos}>
              {lista.map((x, i) => (
                <Pressable key={i} onPress={() => setActual(i)}
                  style={[s.punto, i === actual && s.puntoOn]} />
              ))}
            </View>
          ) : null}
        </Pressable>

        <View style={[s.panel, abierto && { maxHeight: height * 0.5 }]}>
          <Pressable style={s.panelTop} onPress={() => setAbierto(!abierto)}>
            <MaterialIcons
              name={abierto ? 'expand-more' : 'expand-less'}
              size={22}
              color={C.ink3}
            />
            <Text style={s.panelTit}>
              {n === null ? 'Comentarios'
                : n === 0 ? 'Sin comentarios · escribí el primero'
                : `${n} ${n === 1 ? 'comentario' : 'comentarios'}`}
            </Text>
          </Pressable>

          {abierto ? (
            <ScrollView ref={scroll} style={{ maxHeight: height * 0.28 }}>
              {comentarios === null ? (
                <ActivityIndicator style={{ margin: 20 }} color={C.tealDeep} />
              ) : comentarios.length === 0 ? (
                <Text style={s.vacio}>Todavía no comentó nadie.</Text>
              ) : comentarios.map((c) => (
                <View key={c.id} style={s.comentario}>
                  <Avatar
                    persona={c.autor}
                    texto={iniciales(...String(c.autor?.nombre || '').split(' '))}
                    tam={30}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.autor}>
                      {c.autor?.nombre || 'Alguien'}
                      <Text style={s.fecha}>  {cuando(c.creado_el)}</Text>
                    </Text>
                    <Text style={s.cuerpo}>{c.cuerpo}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={s.escribir}>
            <TextInput
              style={s.input}
              value={texto}
              onChangeText={setTexto}
              placeholder="Escribí un comentario"
              placeholderTextColor={C.ink3}
              onFocus={() => setAbierto(true)}
              multiline
            />
            <Pressable
              onPress={comentar}
              disabled={!texto.trim() || enviando}
              style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.4 }]}
            >
              {enviando
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialIcons name="send" size={18} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.97)' },
  barra: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8,
  },
  contador: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center' },
  centro: { alignItems: 'center', justifyContent: 'center' },
  videoTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 10 },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 14 },
  punto: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  puntoOn: { backgroundColor: '#fff', width: 18 },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingBottom: 26,
  },
  panelTop: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
  },
  panelTit: { fontSize: 13.5, fontWeight: '600', color: C.ink2 },
  comentario: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 9,
  },
  autor: { fontSize: 13, fontWeight: '700', color: C.ink },
  fecha: { fontSize: 11, fontWeight: '400', color: C.ink3 },
  cuerpo: { fontSize: 14, color: C.ink, marginTop: 2, lineHeight: 19 },
  vacio: { fontSize: 13, color: C.ink3, textAlign: 'center', paddingVertical: 22 },
  escribir: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9,
    paddingHorizontal: 14, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: C.lineSoft,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14.5,
    color: C.ink, maxHeight: 90,
  },
  enviar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
});
