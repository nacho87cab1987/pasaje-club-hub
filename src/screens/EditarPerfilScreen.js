import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Switch, Pressable, Alert,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { perfil as perfilApi, imagenUrl } from '../api/client';
import { elegirImagenes, subirImagen } from '../imagenes';
import { useAuth } from '../context/AuthContext';
import { Card, Cargando, ErrorBox, Boton } from '../components/UI';
import { C, R } from '../theme';

/** 1996-05-25 -> 25/05/1996 para mostrar. */
function aVista(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return d && m && a ? `${d}/${m}/${a}` : '';
}

/**
 * Va poniendo las barras mientras se tipea y no deja escribir letras.
 * Es la diferencia entre que la gente cargue la fecha o abandone.
 */
function formatearFecha(txt, anterior) {
  const borrando = txt.length < anterior.length;
  const d = txt.replace(/\D/g, '').slice(0, 8);
  if (borrando && txt.endsWith('/')) return txt.slice(0, -1);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export default function EditarPerfilScreen({ navigation }) {
  const { refrescar } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [fecha, setFecha] = useState('');
  const [telefono, setTelefono] = useState('');
  const [bio, setBio] = useState('');
  const [estadoAnimo, setEstadoAnimo] = useState('');
  const [verCumple, setVerCumple] = useState(true);
  const [verTel, setVerTel] = useState(true);
  const [extras, setExtras] = useState({});
  const [foto, setFoto] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cambiarFoto = async () => {
    const [asset] = await elegirImagenes({ maximo: 1 });
    if (!asset) return;
    setSubiendoFoto(true);
    try {
      const r = await subirImagen(asset, 'perfil');
      setFoto(r.url);
      await refrescar();
    } catch (e) {
      Alert.alert('No se pudo subir la foto', e.message);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await perfilApi.mio();
      setData(r);
      setFecha(aVista(r.persona.fecha_nacimiento));
      setTelefono(r.persona.telefono || '');
      setBio(r.persona.bio || '');
      setEstadoAnimo(r.persona.estado_animo || '');
      setVerCumple(r.persona.mostrar_cumple);
      setVerTel(r.persona.mostrar_telefono);
      setFoto(r.persona.foto_url);
      const e = {};
      for (const c of r.campos) if (c.editable) e[c.slug] = c.valor || '';
      setExtras(e);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (fecha && fecha.length !== 10) {
      Alert.alert('Fecha incompleta', 'Escribila como DD/MM/AAAA, por ejemplo 25/05/1996.');
      return;
    }
    setGuardando(true);
    try {
      await perfilApi.guardar({
        fecha_nacimiento: fecha || null,
        telefono,
        bio,
        estado_animo: estadoAnimo,
        mostrar_cumple: verCumple,
        mostrar_telefono: verTel,
      });
      const conValor = Object.fromEntries(Object.entries(extras).filter(([, v]) => v !== ''));
      if (Object.keys(conValor).length) await perfilApi.campos(conValor);
      await refrescar();
      navigation.goBack();
    } catch (e) {
      // El servidor valida la fecha en serio (31/02, anos absurdos) y su
      // mensaje es mas util que uno generico.
      Alert.alert('No se pudo guardar', e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando tu perfil" />;

  const editables = data.campos.filter((c) => c.editable);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {data.pendientes?.length ? (
          <View style={s.aviso}>
            <MaterialIcons name="lightbulb" size={19} color={C.tealDeep} />
            <Text style={s.avisoTxt}>
              Te falta cargar: {data.pendientes.map((p) => p.etiqueta.toLowerCase()).join(', ')}.
            </Text>
          </View>
        ) : null}

        <Pressable style={s.fotoWrap} onPress={cambiarFoto} disabled={subiendoFoto}>
          {foto ? (
            <Image source={{ uri: imagenUrl(foto) }} style={s.foto} />
          ) : (
            <View style={[s.foto, s.fotoVacia]}>
              <MaterialIcons name="add-a-photo" size={26} color={C.tealDeep} />
            </View>
          )}
          <Text style={s.fotoTxt}>
            {subiendoFoto ? 'Subiendo...' : (foto ? 'Cambiar foto' : 'Agregar foto')}
          </Text>
          {subiendoFoto ? <ActivityIndicator color={C.teal} size="small" /> : null}
        </Pressable>

        <Text style={s.seccion}>TUS DATOS</Text>
        <Card>
          <Campo etiqueta="Cumpleanos" ayuda="Asi el equipo puede saludarte">
            <TextInput
              style={s.input}
              value={fecha}
              onChangeText={(t) => setFecha(formatearFecha(t, fecha))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={C.ink3}
              keyboardType="number-pad"
              maxLength={10}
            />
          </Campo>
          <Campo etiqueta="Telefono">
            <TextInput
              style={s.input}
              value={telefono}
              onChangeText={setTelefono}
              placeholder="351 555 4412"
              placeholderTextColor={C.ink3}
              keyboardType="phone-pad"
            />
          </Campo>
          <Campo etiqueta="En que andas" ayuda="Aparece arriba de tu foto">
            <TextInput
              style={s.input}
              value={estadoAnimo}
              onChangeText={setEstadoAnimo}
              placeholder="Armando las salidas de verano"
              placeholderTextColor={C.ink3}
              maxLength={120}
            />
          </Campo>
          <Campo etiqueta="Sobre vos" ultima>
            <TextInput
              style={[s.input, { height: 76, textAlignVertical: 'top', paddingTop: 8 }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Contale al equipo a que te dedicas"
              placeholderTextColor={C.ink3}
              multiline
              maxLength={500}
            />
          </Campo>
        </Card>

        <Text style={s.seccion}>PRIVACIDAD</Text>
        <Card>
          <Toggle
            etiqueta="Mostrar mi cumpleanos"
            ayuda="Si lo apagas, no aparecas en el feed ni te llegan saludos"
            valor={verCumple}
            onChange={setVerCumple}
          />
          <Toggle
            etiqueta="Mostrar mi telefono"
            ayuda="Visible para el equipo en el directorio"
            valor={verTel}
            onChange={setVerTel}
            ultima
          />
        </Card>

        {editables.length ? (
          <>
            <Text style={s.seccion}>MAS SOBRE VOS</Text>
            <Card>
              {editables.map((c, i) => (
                <Campo key={c.slug} etiqueta={c.etiqueta} ayuda={c.ayuda} ultima={i === editables.length - 1}>
                  {c.tipo === 'select' && c.opciones ? (
                    <View style={s.chips}>
                      {c.opciones.map((o) => (
                        <Pressable
                          key={o}
                          onPress={() => setExtras({ ...extras, [c.slug]: extras[c.slug] === o ? '' : o })}
                          style={[s.chip, extras[c.slug] === o && s.chipOn]}
                        >
                          <Text style={[s.chipTxt, extras[c.slug] === o && { color: '#fff' }]}>{o}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      style={s.input}
                      value={String(extras[c.slug] ?? '')}
                      onChangeText={(t) => setExtras({ ...extras, [c.slug]: t })}
                      placeholder={c.tipo === 'fecha' ? 'DD/MM/AAAA' : ''}
                      placeholderTextColor={C.ink3}
                    />
                  )}
                </Campo>
              ))}
            </Card>
          </>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Boton texto="Guardar cambios" onPress={guardar} cargando={guardando} icono="check" />
        </View>

        <Text style={s.pie}>
          Tu area, tu puesto y tus permisos los maneja administracion.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({ etiqueta, ayuda, children, ultima }) {
  return (
    <View style={[s.campo, !ultima && { borderBottomWidth: 1, borderBottomColor: C.lineSoft }]}>
      <Text style={s.label}>{etiqueta}</Text>
      {children}
      {ayuda ? <Text style={s.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

function Toggle({ etiqueta, ayuda, valor, onChange, ultima }) {
  return (
    <View style={[s.toggle, !ultima && { borderBottomWidth: 1, borderBottomColor: C.lineSoft }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{etiqueta}</Text>
        {ayuda ? <Text style={[s.ayuda, { marginTop: 3 }]}>{ayuda}</Text> : null}
      </View>
      <Switch value={valor} onValueChange={onChange} trackColor={{ false: C.line, true: C.teal }} thumbColor="#fff" />
    </View>
  );
}

const s = StyleSheet.create({
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: C.tealSoft, padding: 13, borderRadius: R.md,
  },
  avisoTxt: { flex: 1, fontSize: 13, color: C.tealDeep, lineHeight: 18 },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  campo: { paddingHorizontal: 14, paddingVertical: 12 },
  label: { fontSize: 12.5, fontWeight: '600', color: C.ink2, marginBottom: 5 },
  ayuda: { fontSize: 11.5, color: C.ink3, marginTop: 5, lineHeight: 16 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 11,
    height: 44, fontSize: 15, color: C.ink, backgroundColor: '#fff',
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 18, lineHeight: 17 },
  fotoWrap: { alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 },
  foto: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.lineSoft },
  fotoVacia: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.teal, borderStyle: 'dashed' },
  fotoTxt: { fontSize: 13, fontWeight: '600', color: C.tealDeep },
});
