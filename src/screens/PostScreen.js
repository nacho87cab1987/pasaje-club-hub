import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { muro, imagenUrl } from '../api/client';
import VisorPost from '../VisorPost';
import { abrirArchivo } from '../archivos';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, iniciales } from '../theme';

function cuando(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'Recien';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  if (h < 48) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function PostScreen({ route }) {
  const { id } = route.params;
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [post, setPost] = useState(null);
  const [viendo, setViendo] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await muro.post(id);
      setPost(r.post || null);
      setItems(r.comentarios);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async () => {
    const cuerpo = texto.trim();
    if (!cuerpo) return;
    setEnviando(true);
    try {
      await muro.comentar(id, cuerpo);
      setTexto('');
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo comentar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  const ocultar = (comentarioId) => {
    Alert.alert('Borrar comentario', 'Se va a ocultar para todos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try { await muro.ocultarComentario(comentarioId); await cargar(); }
          catch (e) { Alert.alert('No se pudo', e.message); }
        },
      },
    ]);
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (items === null) return <Cargando texto="Cargando comentarios" />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 14 }}
        ListHeaderComponent={post ? (
          <View style={s.post}>
            <View style={s.postTop}>
              <Avatar
                persona={{ foto: post.autor_foto }}
                texto={iniciales(...String(post.autor || '').split(' '))}
                tam={38}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.postAutor}>{post.autor || 'Pasaje Club'}</Text>
                <Text style={s.fecha}>{cuando(post.creado_el)}</Text>
              </View>
            </View>

            {post.titulo ? <Text style={s.titulo}>{post.titulo}</Text> : null}
            {post.cuerpo ? <Text style={s.postCuerpo}>{post.cuerpo}</Text> : null}

            {post.media && post.media.length ? (
              <View style={s.media}>
                {post.media.map((m2) => (
                  <Pressable
                    key={m2.id}
                    style={post.media.length === 1 ? s.mediaSola : s.mediaChica}
                    onPress={() => setViendo({
                      indice: post.media.findIndex((x) => x.id === m2.id),
                    })}
                  >
                    <Image
                      source={{ uri: imagenUrl(m2.miniatura || m2.url) }}
                      style={s.mediaImg}
                      resizeMode="cover"
                    />
                    {/* El video no tiene miniatura propia: se marca con el
                        boton de reproducir sobre el fondo. */}
                    {m2.tipo === 'video' ? (
                      <View style={s.play}>
                        <MaterialIcons name="play-circle-filled" size={40} color="#fff" />
                      </View>
                    ) : (
                      <View style={s.lupa}>
                        <MaterialIcons name="zoom-out-map" size={15} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={s.seccion}>COMENTARIOS</Text>
          </View>
        ) : null}
        ListEmptyComponent={(
          <Vacio icono="chat-bubble-outline" titulo="Sin comentarios" texto="Sé el primero en responder." />
        )}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => item.soy_yo && ocultar(item.id)}
            style={[s.com, item.padre_id && { marginLeft: 34 }]}
          >
            <Avatar persona={item} texto={iniciales(String(item.autor).split(' ')[0], String(item.autor).split(' ')[1])} tam={34} />
            <View style={{ flex: 1 }}>
              <View style={s.burbuja}>
                <Text style={s.autor}>{item.autor}</Text>
                <Text style={s.cuerpo}>{item.cuerpo}</Text>
              </View>
              <Text style={s.hora}>
                {cuando(item.creado_el)}{item.soy_yo ? ' · mantené apretado para borrar' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <View style={s.barra}>
        <TextInput
          style={s.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribí un comentario"
          placeholderTextColor={C.ink3}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={enviar}
          disabled={!texto.trim() || enviando}
          style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.4 }]}
        >
          {enviando
            ? <ActivityIndicator color="#fff" size="small" />
            : <MaterialIcons name="send" size={19} color="#fff" />}
        </Pressable>
      </View>

      <VisorPost
        visible={!!viendo}
        postId={id}
        media={post ? post.media : []}
        indice={viendo ? viendo.indice : 0}
        onCerrar={() => { setViendo(null); cargar(); }}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  post: { paddingBottom: 6 },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAutor: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  fecha: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  titulo: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6, lineHeight: 22 },
  postCuerpo: { fontSize: 15, color: C.ink, lineHeight: 22 },
  media: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  mediaSola: { width: '100%', height: 220, borderRadius: R.md, overflow: 'hidden' },
  mediaChica: { width: '48%', height: 130, borderRadius: R.md, overflow: 'hidden' },
  mediaImg: { width: '100%', height: '100%', backgroundColor: C.lineSoft },
  play: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(7,45,64,0.28)',
  },
  lupa: {
    position: 'absolute', right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(7,45,64,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  seccion: {
    fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3,
    marginTop: 20, marginBottom: 4,
  },
  com: { flexDirection: 'row', gap: 10, marginBottom: 13 },
  burbuja: { backgroundColor: '#fff', borderRadius: R.lg, paddingHorizontal: 13, paddingVertical: 10 },
  autor: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 3 },
  cuerpo: { fontSize: 14.5, lineHeight: 20, color: C.ink },
  hora: { fontSize: 11, color: C.ink3, marginTop: 4, marginLeft: 4 },
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 11,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 20,
    paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: C.ink, maxHeight: 110,
  },
  enviar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
});
