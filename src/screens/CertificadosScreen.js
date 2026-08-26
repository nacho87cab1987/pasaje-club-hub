import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { academia } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

export default function CertificadosScreen() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { const r = await academia.certificados(); setItems(r.items || []); }
    catch (e) { setError(e.message); setItems([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = async (c) => {
    if (!c.pdf_url) {
      Alert.alert('Sin PDF', 'Este certificado todavia no tiene archivo. Entra a la Academia desde el navegador.');
      return;
    }
    await abrirArchivo(c.pdf_url, `Certificado ${c.curso || ''}.pdf`);
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (items === null) return <Cargando texto="Cargando" />;

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={items}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={{ padding: 14 }}
      ListEmptyComponent={(
        <Vacio
          icono="workspace-premium"
          titulo="Todavia ninguno"
          texto="Cuando termines un curso con su examen, el certificado aparece aca."
        />
      )}
      renderItem={({ item }) => (
        <Pressable style={[s.cert, sombra]} onPress={() => abrir(item)}>
          <View style={s.medalla}>
            <MaterialIcons name="workspace-premium" size={26} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.curso} numberOfLines={2}>{item.curso}</Text>
            <Text style={s.meta}>
              {item.emitido_en ? new Date(String(item.emitido_en).replace(' ', 'T'))
                .toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            </Text>
            <View style={s.linea}>
              {item.promedio_final ? (
                <Text style={s.nota}>Nota {item.promedio_final}</Text>
              ) : null}
              <Text style={s.codigo}>{item.codigo}</Text>
            </View>
          </View>
          <MaterialIcons name="file-download" size={20} color={C.ink3} />
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  cert: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 14, marginBottom: 10,
  },
  medalla: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FBF3C9',
    alignItems: 'center', justifyContent: 'center',
  },
  curso: { fontSize: 15, fontWeight: '600', color: C.ink, lineHeight: 20 },
  meta: { fontSize: 12, color: C.ink3, marginTop: 3 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  nota: { fontSize: 11.5, fontWeight: '700', color: C.tealDeep },
  codigo: { fontSize: 11, color: C.ink3 },
});
