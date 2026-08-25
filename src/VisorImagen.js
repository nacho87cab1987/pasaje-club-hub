import React from 'react';
import {
  Modal, View, Image, Pressable, StyleSheet, Dimensions, Text, Alert, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C } from './theme';

/**
 * Ver una imagen en grande. Se abre desde el chat, donde las miniaturas son
 * demasiado chicas para leer un voucher o un tarifario.
 *
 * Sin librerias de zoom: la imagen entra completa en pantalla, que es lo que
 * resuelve el 90% de los casos. Para el resto esta "Abrir en el navegador",
 * donde el zoom del sistema funciona.
 */
export default function VisorImagen({ visible, uri, nombre, onCerrar }) {
  const { width, height } = Dimensions.get('window');

  const abrirAfuera = async () => {
    try { await Linking.openURL(uri); }
    catch { Alert.alert('No se pudo abrir'); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={s.fondo}>
        <View style={s.barra}>
          <Pressable onPress={onCerrar} hitSlop={12} style={s.btn}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </Pressable>
          {nombre ? (
            <Text style={s.nombre} numberOfLines={1}>{nombre}</Text>
          ) : <View style={{ flex: 1 }} />}
          <Pressable onPress={abrirAfuera} hitSlop={12} style={s.btn}>
            <MaterialIcons name="open-in-new" size={21} color="#fff" />
          </Pressable>
        </View>

        {/* Tocar el fondo cierra: es el gesto que uno intenta primero. */}
        <Pressable style={s.centro} onPress={onCerrar}>
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: width - 24, height: height - 200 }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>

        <Text style={s.pie}>Tocá afuera para cerrar</Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.96)' },
  barra: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 52, paddingHorizontal: 14, paddingBottom: 10,
  },
  btn: { padding: 4 },
  nombre: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pie: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', paddingBottom: 34 },
});
