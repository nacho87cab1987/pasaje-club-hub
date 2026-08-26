import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R } from './theme';

// Cada formato con su icono y su color. Reconocer un PDF de un Excel de un
// vistazo es la mitad de lo que uno necesita de una lista de adjuntos.
const TIPOS = {
  pdf:  { icono: 'picture-as-pdf', color: '#e53935', nom: 'PDF' },
  doc:  { icono: 'article', color: '#185FA5', nom: 'Word' },
  docx: { icono: 'article', color: '#185FA5', nom: 'Word' },
  xls:  { icono: 'table-chart', color: '#1D7044', nom: 'Excel' },
  xlsx: { icono: 'table-chart', color: '#1D7044', nom: 'Excel' },
  ppt:  { icono: 'slideshow', color: '#BA7517', nom: 'PowerPoint' },
  pptx: { icono: 'slideshow', color: '#BA7517', nom: 'PowerPoint' },
  zip:  { icono: 'folder-zip', color: '#6a868e', nom: 'Comprimido' },
};

const extDe = (a) => {
  const n = String(a.nombre_original || a.archivo_path || '');
  const m = n.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
};

export function pesoLegible(bytes) {
  const b = Number(bytes || 0);
  if (!b) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/**
 * Adjunto que no es imagen ni audio.
 *
 * Los PDF muestran su primera pagina como fondo cuando el servidor puede
 * generarla; si no, queda la tarjeta con el icono del formato, que ya dice
 * de que se trata sin tener que abrirlo.
 */
export default function AdjuntoArchivo({ adjunto, url, claro, compacto }) {
  const ext = extDe(adjunto);
  const t = TIPOS[ext] || { icono: 'insert-drive-file', color: C.ink3, nom: ext.toUpperCase() || 'Archivo' };
  const peso = pesoLegible(adjunto.tamanio_bytes);
  const nombre = adjunto.nombre_original || `Archivo.${ext}`;

  const abrir = async () => {
    try {
      const puede = await Linking.canOpenURL(url);
      if (!puede) throw new Error('sin visor');
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(
        'No se pudo abrir',
        'Proba de nuevo, o abrilo desde el navegador.',
      );
    }
  };

  if (compacto) {
    return (
      <Pressable style={[s.compacto, { borderColor: `${t.color}44` }]} onPress={abrir}>
        <MaterialIcons name={t.icono} size={20} color={t.color} />
        <Text style={s.compactoTxt} numberOfLines={1}>{nombre}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={[s.tarjeta, claro && s.tarjetaClara]} onPress={abrir}>
      <View style={[s.icono, { backgroundColor: `${t.color}18` }]}>
        <MaterialIcons name={t.icono} size={26} color={t.color} />
        <Text style={[s.ext, { color: t.color }]}>{t.nom}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.nombre, claro && { color: '#fff' }]} numberOfLines={2}>
          {nombre}
        </Text>
        <Text style={[s.meta, claro && { color: 'rgba(255,255,255,0.7)' }]}>
          {[t.nom, peso].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <MaterialIcons
        name="open-in-new"
        size={18}
        color={claro ? 'rgba(255,255,255,0.8)' : C.ink3}
      />
    </Pressable>
  );
}

/** Miniatura de imagen con el peso encima. */
export function AdjuntoImagen({ adjunto, url, onAbrir, ancho = 210, alto = 150 }) {
  const peso = pesoLegible(adjunto.tamanio_bytes);
  return (
    <Pressable onPress={onAbrir} style={{ marginBottom: 6 }}>
      <Image source={{ uri: url }} style={[s.img, { width: ancho, height: alto }]} />
      <View style={s.lupa}>
        <MaterialIcons name="zoom-out-map" size={14} color="#fff" />
      </View>
      {peso ? (
        <View style={s.peso}>
          <Text style={s.pesoTxt}>{peso}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: C.bg, borderRadius: R.md, padding: 10,
    marginBottom: 6, minWidth: 210,
  },
  tarjetaClara: { backgroundColor: 'rgba(255,255,255,0.12)' },
  icono: {
    width: 46, height: 46, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  ext: { fontSize: 7.5, fontWeight: '800', marginTop: 1, letterSpacing: 0.3 },
  nombre: { fontSize: 13.5, fontWeight: '600', color: C.ink, lineHeight: 18 },
  meta: { fontSize: 11, color: C.ink3, marginTop: 2 },
  compacto: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7,
    backgroundColor: '#fff', maxWidth: 190,
  },
  compactoTxt: { fontSize: 12, color: C.ink, flexShrink: 1 },
  img: { borderRadius: 10, backgroundColor: C.lineSoft },
  lupa: {
    position: 'absolute', right: 7, bottom: 7, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(7,45,64,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  peso: {
    position: 'absolute', left: 7, bottom: 7,
    backgroundColor: 'rgba(7,45,64,0.55)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  pesoTxt: { color: '#fff', fontSize: 10, fontWeight: '600' },
});
