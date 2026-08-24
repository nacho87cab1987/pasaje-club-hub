import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, Switch, Image, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { muro } from '../api/client';
import { elegirImagenes, subirVarias } from '../imagenes';
import { Cargando, ErrorBox, Boton, Card } from '../components/UI';
import { C, R } from '../theme';
import { imagenUrl } from '../api/client';

export default function CrearPostScreen({ navigation }) {
  const [opciones, setOpciones] = useState(null);
  const [error, setError] = useState(null);
  const [cuerpo, setCuerpo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [alcance, setAlcance] = useState('general');
  const [grupos, setGrupos] = useState([]);
  const [oficial, setOficial] = useState(false);
  const [comentarios, setComentarios] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState(null);

  const agregarFotos = async (camara) => {
    const assets = await elegirImagenes({ camara, maximo: 4 - fotos.length });
    if (!assets.length) return;
    setSubiendo({ hecho: 0, total: assets.length });
    const subidas = await subirVarias(assets, 'muro', (hecho, total) => setSubiendo({ hecho, total }));
    setFotos((f) => [...f, ...subidas].slice(0, 4));
    setSubiendo(null);
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await muro.dondePublico();
        setOpciones(r);
        if (!r.puedo_general) setAlcance('grupos');
      } catch (e) { setError(e.message); }
    })();
  }, []);

  const publicar = async () => {
    if (!cuerpo.trim() && !fotos.length) {
      Alert.alert('Falta contenido', 'Escribí algo o agregá una foto.');
      return;
    }
    if (alcance === 'grupos' && !grupos.length) {
      Alert.alert('Falta el destino', 'Elegí al menos un grupo.');
      return;
    }
    setEnviando(true);
    try {
      await muro.publicar({
        cuerpo: cuerpo.trim(),
        titulo: titulo.trim() || null,
        alcance,
        grupos,
        como_oficial: oficial,
        comentarios,
        media: fotos.map((f) => ({ tipo: 'imagen', ...f })),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo publicar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} />;
  if (!opciones) return <Cargando texto="Preparando" />;

  const alcanceGrupos = alcance === 'grupos';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <Card>
          <TextInput
            style={s.titulo}
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Titulo (opcional)"
            placeholderTextColor={C.ink3}
            maxLength={200}
          />
          <TextInput
            style={s.cuerpo}
            value={cuerpo}
            onChangeText={setCuerpo}
            placeholder="¿Qué querés contarle al equipo?"
            placeholderTextColor={C.ink3}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </Card>

        {fotos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 11 }}>
            {fotos.map((f, i) => (
              <View key={f.url} style={s.miniWrap}>
                <Image source={{ uri: imagenUrl(f.miniatura_url || f.url) }} style={s.mini} />
                <Pressable style={s.quitar} onPress={() => setFotos(fotos.filter((_, j) => j !== i))}>
                  <MaterialIcons name="close" size={15} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {subiendo ? (
          <View style={s.subiendo}>
            <ActivityIndicator color={C.teal} size="small" />
            <Text style={s.subiendoTxt}>
              Subiendo {subiendo.hecho + 1} de {subiendo.total}...
            </Text>
          </View>
        ) : null}

        {fotos.length < 4 && !subiendo ? (
          <View style={s.adjuntos}>
            <Pressable style={s.adjunto} onPress={() => agregarFotos(false)}>
              <MaterialIcons name="photo-library" size={20} color={C.tealDeep} />
              <Text style={s.adjuntoTxt}>Fotos</Text>
            </Pressable>
            <Pressable style={s.adjunto} onPress={() => agregarFotos(true)}>
              <MaterialIcons name="photo-camera" size={20} color={C.tealDeep} />
              <Text style={s.adjuntoTxt}>Camara</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={s.seccion}>QUIÉN LO VE</Text>
        <View style={s.seg}>
          <Pressable
            style={[s.segBtn, !alcanceGrupos && s.segOn, !opciones.puedo_general && { opacity: 0.4 }]}
            onPress={() => opciones.puedo_general && setAlcance('general')}
          >
            <MaterialIcons name="public" size={18} color={!alcanceGrupos ? '#fff' : C.ink2} />
            <Text style={[s.segTxt, !alcanceGrupos && { color: '#fff' }]}>Todo el equipo</Text>
          </Pressable>
          <Pressable style={[s.segBtn, alcanceGrupos && s.segOn]} onPress={() => setAlcance('grupos')}>
            <MaterialIcons name="group" size={18} color={alcanceGrupos ? '#fff' : C.ink2} />
            <Text style={[s.segTxt, alcanceGrupos && { color: '#fff' }]}>Grupos</Text>
          </Pressable>
        </View>

        {alcanceGrupos ? (
          <View style={{ marginTop: 11 }}>
            {opciones.grupos.map((g) => {
              const elegido = grupos.includes(g.id);
              return (
                <Pressable
                  key={g.id}
                  disabled={!g.puedo}
                  onPress={() => setGrupos(elegido ? grupos.filter((x) => x !== g.id) : [...grupos, g.id])}
                  style={[s.grupo, elegido && s.grupoOn, !g.puedo && { opacity: 0.45 }]}
                >
                  <MaterialIcons
                    name={elegido ? 'check-circle' : (g.puedo ? 'radio-button-unchecked' : 'lock')}
                    size={21}
                    color={elegido ? C.teal : C.ink3}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.grupoNom}>{g.nombre}</Text>
                    <Text style={s.grupoSub}>
                      {g.motivo || `${g.miembros} ${g.miembros === 1 ? 'persona' : 'personas'}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {opciones.puedo_oficial || true ? (
          <>
            <Text style={s.seccion}>OPCIONES</Text>
            <Card>
              {opciones.puedo_oficial ? (
                <Opcion
                  etiqueta="Publicar como Pasaje Club"
                  ayuda="Firma con la cuenta oficial y notifica a todos"
                  valor={oficial}
                  onChange={setOficial}
                />
              ) : null}
              <Opcion
                etiqueta="Permitir comentarios"
                valor={comentarios}
                onChange={setComentarios}
                ultima
              />
            </Card>
          </>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Boton texto="Publicar" onPress={publicar} cargando={enviando} icono="send" />
        </View>

        {alcance === 'general' && !oficial ? (
          <Text style={s.pie}>Lo va a ver todo el equipo en el muro.</Text>
        ) : null}
        {oficial ? (
          <Text style={[s.pie, { color: C.warn }]}>
            Al publicar como oficial le llega una notificación a todo el equipo.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Opcion({ etiqueta, ayuda, valor, onChange, ultima }) {
  return (
    <View style={[s.opcion, !ultima && { borderBottomWidth: 1, borderBottomColor: C.lineSoft }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.opcionTxt}>{etiqueta}</Text>
        {ayuda ? <Text style={s.opcionAyuda}>{ayuda}</Text> : null}
      </View>
      <Switch value={valor} onValueChange={onChange} trackColor={{ false: C.line, true: C.teal }} thumbColor="#fff" />
    </View>
  );
}

const s = StyleSheet.create({
  titulo: {
    fontSize: 16, fontWeight: '700', color: C.ink, paddingHorizontal: 14, paddingTop: 14,
    paddingBottom: 6,
  },
  cuerpo: {
    fontSize: 15.5, lineHeight: 22, color: C.ink, paddingHorizontal: 14, paddingBottom: 14,
    minHeight: 130,
  },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 12,
  },
  segOn: { backgroundColor: C.navy, borderColor: C.navy },
  segTxt: { fontSize: 13.5, fontWeight: '600', color: C.ink2 },
  grupo: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12, marginBottom: 8,
  },
  grupoOn: { borderColor: C.teal, backgroundColor: C.tealSoft },
  grupoNom: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  grupoSub: { fontSize: 12, color: C.ink3, marginTop: 1 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 13 },
  opcionTxt: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  opcionAyuda: { fontSize: 12, color: C.ink3, marginTop: 2, lineHeight: 17 },
  pie: { fontSize: 12.5, color: C.ink3, textAlign: 'center', marginTop: 14, lineHeight: 18 },
  miniWrap: { marginRight: 9, position: 'relative' },
  mini: { width: 88, height: 88, borderRadius: R.md, backgroundColor: C.lineSoft },
  quitar: {
    position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12,
    backgroundColor: 'rgba(7,45,64,0.82)', alignItems: 'center', justifyContent: 'center',
  },
  subiendo: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.tealSoft,
    padding: 12, borderRadius: R.md, marginTop: 11,
  },
  subiendoTxt: { fontSize: 13, color: C.tealDeep, fontWeight: '600' },
  adjuntos: { flexDirection: 'row', gap: 9, marginTop: 11 },
  adjunto: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 12,
  },
  adjuntoTxt: { fontSize: 13.5, fontWeight: '600', color: C.ink2 },
});
