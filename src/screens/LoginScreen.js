import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable, Image, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { C, R } from '../theme';

export default function LoginScreen() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    if (!email.trim() || !pass) { setError('Completa email y contrasena'); return; }
    setError(null);
    setCargando(true);
    try {
      await entrar(email, pass);
    } catch (e) {
      // El servidor distingue "credenciales mal" de "todavia no tenes ficha
      // en el hub". Repetir su mensaje es mas util que uno generico.
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.navyLogo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../assets/logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
        <Text style={s.sub}>Entra con el mismo email y contrasena que usas en el panel</Text>

        <View style={s.campo}>
          <MaterialIcons name="mail-outline" size={20} color={C.ink3} />
          <TextInput
            style={s.input}
            placeholder="tu@pasajeclub.com"
            placeholderTextColor={C.ink3}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />
        </View>

        <View style={s.campo}>
          <MaterialIcons name="lock-outline" size={20} color={C.ink3} />
          <TextInput
            style={s.input}
            placeholder="Contrasena"
            placeholderTextColor={C.ink3}
            value={pass}
            onChangeText={setPass}
            secureTextEntry={!ver}
            autoCapitalize="none"
            onSubmitEditing={enviar}
            returnKeyType="go"
          />
          <Pressable onPress={() => setVer(!ver)} hitSlop={10}>
            <MaterialIcons name={ver ? 'visibility-off' : 'visibility'} size={20} color={C.ink3} />
          </Pressable>
        </View>

        {error ? (
          <View style={s.error}>
            <MaterialIcons name="error-outline" size={18} color="#F09595" />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* El fondo del login es navy y el boton tambien: sobre ese fondo
            quedaba como texto suelto. En teal se lee como boton. */}
        <Pressable
          onPress={cargando ? undefined : enviar}
          style={({ pressed }) => [s.entrar, pressed && { opacity: 0.85 }]}
        >
          {cargando ? (
            <ActivityIndicator color={C.navy} size="small" />
          ) : (
            <>
              <Text style={s.entrarTxt}>Entrar</Text>
              <MaterialIcons name="arrow-forward" size={19} color={C.navy} />
            </>
          )}
        </Pressable>

        <Text style={s.pie}>Si no podes entrar, escribile a administracion.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  // El logo trae su proporcion: se fija el alto y el ancho se acomoda solo.
  logo: { width: 210, height: 120, alignSelf: 'center', marginBottom: 22 },
  sub: {
    fontSize: 14.5, color: '#A9CBD6', marginBottom: 26, lineHeight: 21,
    textAlign: 'center', paddingHorizontal: 10,
  },
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: R.md, paddingHorizontal: 14, height: 52, marginBottom: 11,
  },
  input: { flex: 1, fontSize: 15.5, color: C.ink },
  error: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
    backgroundColor: 'rgba(240,149,149,0.14)', padding: 12, borderRadius: R.md,
  },
  errorTxt: { color: '#F7C1C1', fontSize: 13.5, flex: 1, lineHeight: 19 },
  entrar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  entrarTxt: { color: C.navy, fontWeight: '700', fontSize: 16 },
  pie: { color: '#7FA6B5', fontSize: 12.5, textAlign: 'center', marginTop: 22 },
});
