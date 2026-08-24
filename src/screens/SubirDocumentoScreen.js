import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { documentos, subirDocumento } from '../api/client';
import { elegirImagenes } from '../imagenes';
import { Cargando, ErrorBox, Boton, Card, Avatar } from '../components/UI';
import { C, R, iniciales, icono } from '../theme';

let DocumentPicker = null;
try { DocumentPicker = require('expo-document-picker'); } catch (e) { DocumentPicker = null; }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function SubirDocumentoScreen({ navigation }) {
  const [carpetas, setCarpetas] = useState(null);
  const [dest, setDest] = useState(null);
  const [error, setError] = useState(null);

  const [carpeta, setCarpeta] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [personaId, setPersonaId] = useState(null);
  const [periodo, setPeriodo] = useState('');
  const [acceso, setAcceso] = useState([]);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await documentos.carpetas();
        setCarpetas(c.items.filter((x) => x.documentos >= 0));
        if (c.puede_compartir) {
          setDest(await documentos.destinatarios().catch(() => null));
        }
      } catch (e) { setError(e.message); }
    })();
  }, []);

  const elegirArchivo = async () => {
    if (DocumentPicker) {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.*', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets || !r.assets.length) return;
      const a = r.assets[0];
      setArchivo({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
      if (!titulo) setTitulo(String(a.name || '').replace(/\.[^.]+$/, ''));
    } else {
      // Sin el selector de archivos solo se pueden elegir imagenes, que es
      // mejor que nada: muchos recibos llegan como foto.
      const [asset] = await elegirImagenes({ maximo: 1 });
      if (!asset) return;
      setArchivo({ uri: asset.uri, name: asset.fileName || `foto_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
    }
  };

  const alternarAcceso = (scope, scope_id) => {
    const existe = acceso.some((a) => a.scope === scope && a.scope_id === scope_id);
    setAcceso(existe
      ? acceso.filter((a) => !(a.scope === scope && a.scope_id === scope_id))
      : [...acceso.filter((a) => a.scope !== 'todos' || scope === 'todos'), { scope, scope_id }]);
  };
  const tiene = (scope, scope_id) => acceso.some((a) => a.scope === scope && a.scope_id === scope_id);

  const guardar = async () => {
    if (!carpeta) { Alert.alert('Falta la carpeta', 'Elegi donde va el documento.'); return; }
    if (!archivo) { Alert.alert('Falta el archivo', 'Elegi el archivo a subir.'); return; }
    if (carpeta.tipo === 'personal' && !personaId) {
      Alert.alert('Falta la persona', 'Un documento personal necesita de quien es.');
      return;
    }
    if (carpeta.tipo === 'compartida' && !acceso.length) {
      Alert.alert('Falta quien lo ve', 'Si no elegis destinatarios no lo va a ver nadie.');
      return;
    }

    setSubiendo(true);
    try {
      await subirDocumento(archivo, {
        carpeta_id: carpeta.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        persona_id: personaId,
        periodo,
        acceso: carpeta.tipo === 'compartida' ? JSON.stringify(acceso) : null,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo subir', e.message);
    } finally {
      setSubiendo(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} />;
  if (!carpetas) return <Cargando texto="Cargando" />;

  const hoy = new Date();
  const meses = [0, 1, 2].map((n) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - n, 1);
    return { v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
             nom: `${MESES[d.getMonth()]} ${d.getFullYear()}` };
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <Text style={s.seccion}>DONDE VA</Text>
        <View style={s.chips}>
          {carpetas.map((c) => (
            <Pressable key={c.id} onPress={() => { setCarpeta(c); setAcceso([]); setPersonaId(null); }}
              style={[s.chip, carpeta && carpeta.id === c.id && s.chipOn]}>
              <MaterialIcons name={icono(c.icono)} size={15}
                color={carpeta && carpeta.id === c.id ? '#fff' : (c.color || C.ink2)} />
              <Text style={[s.chipTxt, carpeta && carpeta.id === c.id && { color: '#fff' }]}>{c.nombre}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.seccion}>ARCHIVO</Text>
        <Pressable style={[s.archivo, archivo && s.archivoOk]} onPress={elegirArchivo}>
          <MaterialIcons name={archivo ? 'check-circle' : 'attach-file'} size={22}
            color={archivo ? C.ok : C.tealDeep} />
          <Text style={s.archivoTxt} numberOfLines={1}>
            {archivo ? archivo.name : 'Elegir archivo'}
          </Text>
        </Pressable>
        {!DocumentPicker ? (
          <Text style={s.aviso}>
            Para elegir PDF instala expo-document-picker. Por ahora solo imagenes.
          </Text>
        ) : null}

        <Text style={s.seccion}>DATOS</Text>
        <Card>
          <View style={s.campo}>
            <Text style={s.label}>Titulo</Text>
            <TextInput style={s.input} value={titulo} onChangeText={setTitulo}
              placeholder="Recibo agosto 2026" placeholderTextColor={C.ink3} />
          </View>
          <View style={[s.campo, { borderTopWidth: 1, borderTopColor: C.lineSoft }]}>
            <Text style={s.label}>Descripcion (opcional)</Text>
            <TextInput style={s.input} value={descripcion} onChangeText={setDescripcion}
              placeholder="De que se trata" placeholderTextColor={C.ink3} />
          </View>
        </Card>

        {carpeta && carpeta.tipo === 'personal' ? (
          <>
            <Text style={s.seccion}>PERIODO</Text>
            <View style={s.chips}>
              {meses.map((m) => (
                <Pressable key={m.v} onPress={() => setPeriodo(periodo === m.v ? '' : m.v)}
                  style={[s.chip, periodo === m.v && s.chipOn]}>
                  <Text style={[s.chipTxt, periodo === m.v && { color: '#fff' }]}>{m.nom}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.seccion}>DE QUIEN ES</Text>
            {dest && dest.personas ? (
              <Card>
                {dest.personas.map((p, i) => (
                  <Pressable key={p.id} onPress={() => setPersonaId(p.id)}
                    style={[s.persona, i < dest.personas.length - 1 && s.borde,
                            personaId === p.id && { backgroundColor: C.tealSoft }]}>
                    <MaterialIcons
                      name={personaId === p.id ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20} color={personaId === p.id ? C.teal : C.ink3} />
                    <Avatar texto={iniciales(...String(p.nombre).split(' '))} tam={30} />
                    <Text style={s.personaNom}>{p.nombre}</Text>
                  </Pressable>
                ))}
              </Card>
            ) : (
              <Text style={s.aviso}>No pude cargar la lista de personas.</Text>
            )}
          </>
        ) : null}

        {carpeta && carpeta.tipo === 'compartida' && dest ? (
          <>
            <Text style={s.seccion}>QUIEN LO PUEDE VER</Text>
            <View style={s.chips}>
              <Pressable onPress={() => setAcceso(tiene('todos', 0) ? [] : [{ scope: 'todos', scope_id: 0 }])}
                style={[s.chip, tiene('todos', 0) && s.chipOn]}>
                <MaterialIcons name="groups" size={15} color={tiene('todos', 0) ? '#fff' : C.ink2} />
                <Text style={[s.chipTxt, tiene('todos', 0) && { color: '#fff' }]}>Todo el equipo</Text>
              </Pressable>
            </View>

            {!tiene('todos', 0) ? (
              <>
                <Text style={s.sub}>Por area</Text>
                <View style={s.chips}>
                  {dest.areas.map((a) => (
                    <Pressable key={a.id} onPress={() => alternarAcceso('area', a.id)}
                      style={[s.chip, tiene('area', a.id) && s.chipOn]}>
                      <Text style={[s.chipTxt, tiene('area', a.id) && { color: '#fff' }]}>{a.nombre}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={s.sub}>Por perfil</Text>
                <View style={s.chips}>
                  {dest.perfiles.map((p) => (
                    <Pressable key={p.id} onPress={() => alternarAcceso('perfil', p.id)}
                      style={[s.chip, tiene('perfil', p.id) && s.chipOn]}>
                      <Text style={[s.chipTxt, tiene('perfil', p.id) && { color: '#fff' }]}>{p.nombre}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {!acceso.length ? (
              <Text style={[s.aviso, { color: C.warn }]}>
                Sin destinatarios el documento no lo ve nadie.
              </Text>
            ) : null}
          </>
        ) : null}

        <View style={{ marginTop: 22 }}>
          <Boton texto="Subir documento" onPress={guardar} cargando={subiendo} icono="upload" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  sub: { fontSize: 12, fontWeight: '600', color: C.ink2, marginTop: 13, marginBottom: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  archivo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderWidth: 2, borderColor: C.line, borderStyle: 'dashed',
    borderRadius: R.md, padding: 16,
  },
  archivoOk: { borderColor: C.ok, borderStyle: 'solid' },
  archivoTxt: { flex: 1, fontSize: 14.5, color: C.ink, fontWeight: '500' },
  campo: { paddingHorizontal: 14, paddingVertical: 11 },
  label: { fontSize: 12, fontWeight: '600', color: C.ink2, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 11,
    height: 42, fontSize: 15, color: C.ink,
  },
  persona: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  personaNom: { flex: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  aviso: { fontSize: 12.5, color: C.ink3, marginTop: 9, lineHeight: 18 },
});
