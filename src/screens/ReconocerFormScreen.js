import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { reconocimientos, organigrama } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Avatar, Cargando, ErrorBox } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

export default function ReconocerFormScreen({ navigation, route }) {
  const [valores, setValores] = useState([]);
  const [gente, setGente] = useState([]);
  const [error, setError] = useState(null);

  const [para, setPara] = useState(route.params?.persona || null);
  const [valor, setValor] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [buscando, setBuscando] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      // La gente sale del organigrama, que ya trae a todos los activos con
      // su puesto y area.
      const [v, p] = await Promise.all([
        reconocimientos.valores(),
        organigrama.arbol().catch(() => ({ items: [] })),
      ]);
      setValores(v.items || []);
      // El arbol ya marca cual soy yo y trae solo activos.
      setGente((p.items || []).filter((x) => !x.soy_yo && !x.inactivo));
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async () => {
    if (!para) { Alert.alert('Falta', 'Elegí a quién querés reconocer.'); return; }
    if (mensaje.trim().length < 10) {
      Alert.alert('Contá un poco más',
        'Un reconocimiento sin detalle no dice nada. Escribí qué hizo.');
      return;
    }
    setEnviando(true);
    try {
      await reconocimientos.crear({
        para_id: para.id,
        valor_id: valor?.id || null,
        mensaje: mensaje.trim(),
      });
      vibrar(true);
      Alert.alert(
        'Listo',
        `Se publicó en el muro y le avisamos a ${String(para.nombre).split(' ')[0]}.`,
        [{ text: 'Genial', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!valores.length && !gente.length) return <Cargando texto="Cargando" />;

  const filtrados = buscando
    ? gente.filter((p) => String(p.nombre).toLowerCase().includes(buscando.toLowerCase()))
    : gente;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

        <Text style={s.paso}>¿A QUIÉN?</Text>
        {para ? (
          <Pressable style={[s.elegida, sombra]} onPress={() => setPara(null)}>
            <Avatar persona={para} texto={iniciales(...String(para.nombre).split(' '))} tam={40} />
            <View style={{ flex: 1 }}>
              <Text style={s.elegidaN}>{para.nombre}</Text>
              {para.puesto ? <Text style={s.elegidaP}>{para.puesto}</Text> : null}
            </View>
            <MaterialIcons name="close" size={20} color={C.ink3} />
          </Pressable>
        ) : (
          <>
            <View style={s.buscador}>
              <MaterialIcons name="search" size={19} color={C.ink3} />
              <TextInput
                style={s.buscadorInput}
                value={buscando}
                onChangeText={setBuscando}
                placeholder="Buscar por nombre"
                placeholderTextColor={C.ink3}
              />
            </View>
            <View style={s.grid}>
              {filtrados.slice(0, 12).map((p) => (
                <Pressable key={p.id} style={s.persona} onPress={() => { vibrar(); setPara(p); }}>
                  <Avatar persona={p} texto={iniciales(...String(p.nombre).split(' '))} tam={46} />
                  <Text style={s.personaN} numberOfLines={2}>
                    {String(p.nombre).split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {para ? (
          <>
            <Text style={s.paso}>¿POR QUÉ?</Text>
            {valores.map((v) => {
              const sel = valor?.id === v.id;
              return (
                <Pressable
                  key={v.id}
                  style={[s.valor, sombra, sel && { borderColor: v.color, borderWidth: 2 }]}
                  onPress={() => { vibrar(); setValor(sel ? null : v); }}
                >
                  <View style={[s.valorIcono, { backgroundColor: `${v.color}1A` }]}>
                    <MaterialIcons name={v.icono || 'star'} size={21} color={v.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.valorN}>{v.nombre}</Text>
                    {v.descripcion ? <Text style={s.valorD}>{v.descripcion}</Text> : null}
                    {/* El ejemplo evita que cada uno interprete el valor a su
                        manera y terminen siendo etiquetas vacias. */}
                    {sel && v.ejemplo ? (
                      <Text style={[s.valorE, { color: v.color }]}>Ej: {v.ejemplo}</Text>
                    ) : null}
                  </View>
                  {sel ? <MaterialIcons name="check-circle" size={20} color={v.color} /> : null}
                </Pressable>
              );
            })}

            <Text style={s.paso}>¿QUÉ HIZO?</Text>
            <TextInput
              style={[s.mensaje, sombra]}
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Contá qué pasó, con detalle. Se va a publicar en el muro."
              placeholderTextColor={C.ink3}
              multiline
            />
            <Text style={s.contador}>
              {mensaje.trim().length < 10
                ? `Escribí al menos ${10 - mensaje.trim().length} caracteres más`
                : `${mensaje.length} caracteres`}
            </Text>

            <Pressable
              style={[s.enviar, (mensaje.trim().length < 10 || enviando) && { opacity: 0.45 }]}
              onPress={enviar}
              disabled={mensaje.trim().length < 10 || enviando}
            >
              <MaterialIcons name="emoji-events" size={19} color="#fff" />
              <Text style={s.enviarTxt}>Publicar reconocimiento</Text>
            </Pressable>

            <Text style={s.pie}>
              Se publica en el muro con tu nombre y le llega un aviso.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  paso: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    paddingHorizontal: 13, height: 44, borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  buscadorInput: { flex: 1, fontSize: 14.5, color: C.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  persona: { alignItems: 'center', width: 68 },
  personaN: { fontSize: 11.5, color: C.ink2, textAlign: 'center', marginTop: 5, fontWeight: '600' },
  elegida: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderRadius: R.md, padding: 12,
  },
  elegidaN: { fontSize: 15, fontWeight: '700', color: C.ink },
  elegidaP: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  valor: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderRadius: R.md, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: 'transparent',
  },
  valorIcono: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  valorN: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  valorD: { fontSize: 12, color: C.ink3, marginTop: 2, lineHeight: 16 },
  valorE: { fontSize: 11.5, marginTop: 6, fontStyle: 'italic', lineHeight: 16 },
  mensaje: {
    backgroundColor: '#fff', borderRadius: R.md, padding: 13, fontSize: 15,
    color: C.ink, minHeight: 110, textAlignVertical: 'top', lineHeight: 21,
  },
  contador: { fontSize: 11.5, color: C.ink3, marginTop: 7, textAlign: 'right' },
  enviar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 15, marginTop: 18,
  },
  enviarTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
