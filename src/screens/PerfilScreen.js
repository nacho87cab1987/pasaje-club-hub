import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Pressable, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Card, Boton } from '../components/UI';
import { perfil as perfilApi, imagenUrl } from '../api/client';
import { vibrar, estadoVibracion } from '../MenuContextual';
import { estadoArchivos } from '../archivos';
import { C, R, sombra, iniciales } from '../theme';

export default function PerfilScreen({ navigation }) {
  const { persona, modulos, boot, cerrar } = useAuth();
  const [mio, setMio] = useState(null);

  const cargar = useCallback(async () => {
    try { setMio(await perfilApi.mio()); } catch { /* el perfil basico ya se ve */ }
  }, []);
  // Al volver de editar, los datos cambiaron.
  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const confirmarSalida = () => {
    Alert.alert('Cerrar sesion', 'Vas a tener que volver a entrar con tu email y contrasena.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesion', style: 'destructive', onPress: cerrar },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 34 }}>
      <View style={s.cover} />
      <View style={s.head}>
        {mio?.persona?.foto_url ? (
          <Image source={{ uri: imagenUrl(mio.persona.foto_url) }} style={s.avWrap} />
        ) : (
          <View style={s.avWrap}>
            <Text style={s.avTxt}>{iniciales(persona?.nombre, persona?.apellido)}</Text>
          </View>
        )}
        <Text style={s.nombre}>{persona?.completo}</Text>
        <Text style={s.rol}>
          {persona?.puesto || 'Sin puesto asignado'}
          {persona?.area ? ` · ${persona.area}` : ''}
        </Text>

        {boot?.debe_cambiar_clave ? (
          <Pressable style={[s.aviso, s.avisoFuerte]} onPress={() => navigation.navigate('CambiarClave')}>
            <MaterialIcons name="lock" size={19} color="#fff" />
            <Text style={[s.avisoTxt, { color: '#fff' }]}>
              Estas usando una contrasena temporal. Tocá para poner la tuya.
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#fff" />
          </Pressable>
        ) : null}

        {mio?.pendientes?.length ? (
          <Pressable style={s.aviso} onPress={() => navigation.navigate('EditarPerfil')}>
            <MaterialIcons name="lightbulb" size={19} color={C.tealDeep} />
            <Text style={s.avisoTxt}>
              Te falta cargar {mio.pendientes.map((p) => p.etiqueta.toLowerCase()).join(', ')}. Tocá para completarlo.
            </Text>
            <MaterialIcons name="chevron-right" size={20} color={C.tealDeep} />
          </Pressable>
        ) : null}

        <View style={{ marginTop: 14 }}>
          {mio?.persona?.fecha_nacimiento ? (
            <Dato icono="cake" texto={fechaLarga(mio.persona.fecha_nacimiento)} />
          ) : null}
          <Dato icono="mail-outline" texto={persona?.email} />
          <Dato icono="supervisor-account" texto={`Reporta a ${persona?.jefe || 'Direccion'}`} />
          <Dato icono="verified-user" texto={`Perfil de permisos: ${persona?.perfil || '-'}`} />
        </View>
      </View>

      <View style={{ padding: 14 }}>
        <Card>
          <View style={s.hdr}>
            <MaterialIcons name="tune" size={19} color={C.tealDeep} />
            <Text style={s.hdrTxt}>Tu acceso</Text>
          </View>
          <Linea etiqueta="Modulos habilitados" valor={String(modulos.length)} />
          <Linea etiqueta="Permisos" valor={String(boot?.permisos?.length || 0)} />
          <Linea etiqueta="Notificaciones sin leer" valor={String(boot?.no_leidas || 0)} ultima />
        </Card>

        <View style={{ marginTop: 18 }}>
          <Boton texto="Editar mi perfil" icono="edit" onPress={() => navigation.navigate('EditarPerfil')} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Boton texto="Cambiar contrasena" tipo="borde" icono="lock" onPress={() => navigation.navigate('CambiarClave')} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Boton texto="Cerrar sesion" tipo="borde" icono="logout" onPress={confirmarSalida} />
        </View>

        <Pressable
        style={s.probarVibra}
        onPress={() => {
          vibrar(true);
          const e = estadoVibracion();
          const a = estadoArchivos();
          Alert.alert(
            'Diagnostico',
            `VIBRACION\nMetodo: ${e.ultimo}\nModulo: ${e.haptics}\n\n`
            + `ARCHIVOS\nDescarga: ${a.descarga ? 'si' : 'no'}\n`
            + `Compartir: ${a.compartir ? 'si' : 'no'}\n`
            + `Navegador propio: ${a.navegador ? 'si' : 'no'}\n\n`
            + 'Si "Compartir" dice no, los archivos se abren en el navegador '
            + 'y hace falta recompilar la app.',
          );
        }}
      >
        <MaterialIcons name="vibration" size={17} color={C.ink3} />
        <Text style={s.probarVibraTxt}>Diagnostico del telefono</Text>
      </Pressable>

      <Text style={s.version}>Pasaje Club · version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function Dato({ icono, texto }) {
  if (!texto) return null;
  return (
    <View style={s.dato}>
      <MaterialIcons name={icono} size={18} color={C.tealDeep} />
      <Text style={s.datoTxt}>{texto}</Text>
    </View>
  );
}

function Linea({ etiqueta, valor, ultima }) {
  return (
    <View style={[s.linea, !ultima && { borderBottomWidth: 1, borderBottomColor: C.lineSoft }]}>
      <Text style={{ fontSize: 14, color: C.ink3 }}>{etiqueta}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>{valor}</Text>
    </View>
  );
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
  'agosto','septiembre','octubre','noviembre','diciembre'];

function fechaLarga(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]}`;
}

const s = StyleSheet.create({
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.tealSoft,
    padding: 12, borderRadius: 12, marginTop: 14,
  },
  avisoTxt: { flex: 1, fontSize: 12.5, color: C.tealDeep, lineHeight: 17 },
  avisoFuerte: { backgroundColor: C.bordo },
  cover: { height: 112, backgroundColor: C.navy },
  head: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 18, marginTop: -40 },
  avWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: C.cream,
    borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  avTxt: { fontSize: 27, fontWeight: '700', color: C.navy },
  nombre: { fontSize: 21, fontWeight: '700', marginTop: 11, color: C.ink, letterSpacing: -0.4 },
  rol: { fontSize: 13.5, color: C.ink2, marginTop: 2 },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  datoTxt: { fontSize: 13.5, color: C.ink2, flex: 1 },
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14,
    paddingTop: 13, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hdrTxt: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  probarVibra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, marginTop: 10,
  },
  probarVibraTxt: { fontSize: 13, color: C.ink3 },
  version: { textAlign: 'center', color: C.ink3, fontSize: 12.5, marginTop: 22 },
});
