import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Pressable, Alert, Share, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tarjeta } from '../api/client';
import { Cargando, ErrorBox, Avatar } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

/**
 * El QR que agenda tu contacto en el teléfono de quien lo escanea.
 *
 * Pensado para ferias: se muestra la pantalla, la persona apunta la cámara y
 * queda con el contacto guardado. No hace falta que tenga la app ni cuenta.
 *
 * El QR lleva un enlace, no los datos: así, si cambiás de teléfono, el mismo
 * QR impreso sigue sirviendo.
 */
export default function MiTarjetaScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await tarjeta.mia()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const compartir = async () => {
    try {
      await Share.share({
        message: `Mis datos de contacto en Pasaje Club:\n${data.url}`,
        url: data.url,
      });
    } catch (e) { /* cancelado */ }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Preparando tu tarjeta" />;

  const lado = Math.min(280, Dimensions.get('window').width - 90);

  return (
    <View style={s.fondo}>
      <View style={[s.tarjeta, sombra]}>
        <View style={s.cabecera}>
          <Avatar
            foto={data.foto}
            texto={iniciales(...String(data.nombre || '').split(' '))}
            tam={54}
            fondo="rgba(255,255,255,0.18)"
            color="#fff"
          />
          <View style={{ flex: 1 }}>
            <Text style={s.nombre}>{data.nombre}</Text>
            {data.puesto ? <Text style={s.puesto}>{data.puesto}</Text> : null}
            <Text style={s.agencia}>{data.agencia?.nombre || 'Pasaje Club'}</Text>
          </View>
        </View>

        <View style={s.qrCaja}>
          <Image
            source={{ uri: data.qr }}
            style={{ width: lado, height: lado }}
            resizeMode="contain"
          />
        </View>

        <Text style={s.instruccion}>
          Que apunten la cámara del teléfono acá.{'\n'}
          Se les guarda tu contacto.
        </Text>
      </View>

      {/* Sin teléfono ni foto, el contacto que se agenda queda a medias: se
          avisa antes de que lo descubra en la feria. */}
      {data.faltan && data.faltan.length ? (
        <Pressable style={s.aviso} onPress={() => navigation.navigate('Perfil')}>
          <MaterialIcons name="info-outline" size={18} color="#854F0B" />
          <Text style={s.avisoTxt}>
            Te falta cargar {data.faltan.join(' y ')}. Tocá para completarlo.
          </Text>
        </Pressable>
      ) : null}

      <View style={s.datos}>
        {data.telefono ? <Dato icono="phone" texto={data.telefono} /> : null}
        {data.email ? <Dato icono="mail-outline" texto={data.email} /> : null}
        {data.agencia?.instagram ? (
          <Dato icono="alternate-email"
            texto={data.agencia.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@')} />
        ) : null}
      </View>

      <Pressable style={s.compartir} onPress={compartir}>
        <MaterialIcons name="ios-share" size={18} color="#fff" />
        <Text style={s.compartirTxt}>Compartir el enlace</Text>
      </Pressable>
    </View>
  );
}

function Dato({ icono, texto }) {
  return (
    <View style={s.dato}>
      <MaterialIcons name={icono} size={16} color={C.ink3} />
      <Text style={s.datoTxt} numberOfLines={1}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: C.bg, padding: 16, alignItems: 'center' },
  tarjeta: {
    width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
  },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: C.navy, padding: 16,
  },
  nombre: { fontSize: 17, fontWeight: '700', color: '#fff' },
  puesto: { fontSize: 12.5, color: C.teal, fontWeight: '600', marginTop: 2 },
  agencia: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  qrCaja: { alignItems: 'center', paddingVertical: 22 },
  instruccion: {
    fontSize: 13, color: C.ink3, textAlign: 'center',
    lineHeight: 19, paddingBottom: 20, paddingHorizontal: 20,
  },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FAEEDA',
    borderRadius: R.md, padding: 12, marginTop: 14, width: '100%',
  },
  avisoTxt: { flex: 1, fontSize: 12.5, color: '#854F0B', lineHeight: 17 },
  datos: { width: '100%', marginTop: 16, gap: 9 },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  datoTxt: { flex: 1, fontSize: 13.5, color: C.ink2 },
  compartir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 14,
    width: '100%', marginTop: 20,
  },
  compartirTxt: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
});
