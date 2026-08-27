import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { muro } from '../api/client';
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

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await muro.post(id);
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
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
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
