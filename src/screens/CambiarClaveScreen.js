import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { perfil as perfilApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Boton } from '../components/UI';
import { C, R } from '../theme';

export default function CambiarClaveScreen({ navigation }) {
  const { refrescar } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const corta = nueva.length > 0 && nueva.length < 8;
  const noCoincide = repetir.length > 0 && nueva !== repetir;
  const listo = actual && nueva.length >= 8 && nueva === repetir;

  const guardar = async () => {
    setGuardando(true);
    try {
      await perfilApi.cambiarClave(actual, nueva);
      await refrescar();
      Alert.alert('Listo', 'Tu contrasena quedo cambiada.', [
        { text: 'Perfecto', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('No se pudo cambiar', e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <View style={s.aviso}>
          <MaterialIcons name="lock" size={19} color={C.tealDeep} />
          <Text style={s.avisoTxt}>
            Es la misma contrasena que usas para entrar al panel web. Al cambiarla
            aca, cambia en los dos lados.
          </Text>
        </View>

        <Card style={{ marginTop: 12 }}>
          <Campo etiqueta="Contrasena actual">
            <TextInput
              style={s.input} value={actual} onChangeText={setActual}
              secureTextEntry={!ver} autoCapitalize="none"
              placeholder="La que usas hoy" placeholderTextColor={C.ink3}
            />
          </Campo>
          <Campo etiqueta="Nueva contrasena" error={corta ? 'Tiene que tener al menos 8 caracteres' : null}>
            <TextInput
              style={[s.input, corta && s.inputMal]} value={nueva} onChangeText={setNueva}
              secureTextEntry={!ver} autoCapitalize="none"
              placeholder="Minimo 8 caracteres" placeholderTextColor={C.ink3}
            />
          </Campo>
          <Campo etiqueta="Repetila" error={noCoincide ? 'No coinciden' : null} ultima>
            <TextInput
              style={[s.input, noCoincide && s.inputMal]} value={repetir} onChangeText={setRepetir}
              secureTextEntry={!ver} autoCapitalize="none"
              placeholder="La nueva otra vez" placeholderTextColor={C.ink3}
            />
          </Campo>
        </Card>

        <Pressable style={s.verWrap} onPress={() => setVer(!ver)}>
          <MaterialIcons name={ver ? 'visibility-off' : 'visibility'} size={18} color={C.tealDeep} />
          <Text style={s.verTxt}>{ver ? 'Ocultar' : 'Ver lo que escribo'}</Text>
        </Pressable>

        <View style={{ marginTop: 18 }}>
          <Boton texto="Cambiar contrasena" onPress={guardar} cargando={guardando} deshabilitado={!listo} icono="check" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({ etiqueta, error, children, ultima }) {
  return (
    <View style={[s.campo, !ultima && { borderBottomWidth: 1, borderBottomColor: C.lineSoft }]}>
      <Text style={s.label}>{etiqueta}</Text>
      {children}
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: C.tealSoft, padding: 13, borderRadius: R.md,
  },
  avisoTxt: { flex: 1, fontSize: 13, color: C.tealDeep, lineHeight: 18 },
  campo: { paddingHorizontal: 14, paddingVertical: 12 },
  label: { fontSize: 12.5, fontWeight: '600', color: C.ink2, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 11,
    height: 44, fontSize: 15, color: C.ink, backgroundColor: '#fff',
  },
  inputMal: { borderColor: C.bordo },
  err: { fontSize: 11.5, color: C.bordo, marginTop: 5 },
  verWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingHorizontal: 4 },
  verTxt: { fontSize: 13, fontWeight: '600', color: C.tealDeep },
});
