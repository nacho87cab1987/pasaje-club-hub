import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { documentos } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, icono } from '../theme';

export default function DocumentosScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await documentos.carpetas()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando documentos" />;

  // Las carpetas vacias molestan mas de lo que ayudan, salvo que puedas
  // subir ahi: en ese caso son el lugar donde vas a poner algo.
  const visibles = data.items.filter((c) => c.documentos > 0 || data.puede_subir);

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={visibles}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando}
          tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
      ListEmptyComponent={(
        <Vacio
          icono="folder-off"
          titulo="Todavia no hay nada"
          texto="Cuando administracion cargue documentos, van a aparecer aca."
        />
      )}
      ListHeaderComponent={data.puede_subir ? (
        <Pressable style={[s.subir, sombra]} onPress={() => navigation.navigate('SubirDocumento')}>
          <MaterialIcons name="upload-file" size={22} color={C.teal} />
          <View style={{ flex: 1 }}>
            <Text style={s.subirTit}>Subir un documento</Text>
            <Text style={s.subirSub}>Recibos, manuales o material</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#7FA6B5" />
        </Pressable>
      ) : null}
      renderItem={({ item }) => (
        <Pressable
          style={[s.carpeta, sombra]}
          onPress={() => navigation.navigate('Carpeta', { carpeta: item })}
        >
          <View style={[s.bx, { backgroundColor: `${item.color || C.tealDeep}1A` }]}>
            <MaterialIcons name={icono(item.icono)} size={24} color={item.color || C.tealDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.linea}>
              <Text style={s.nombre}>{item.nombre}</Text>
              {item.sin_leer > 0 ? (
                <View style={s.badge}><Text style={s.badgeTxt}>{item.sin_leer}</Text></View>
              ) : null}
            </View>
            {item.descripcion ? <Text style={s.desc}>{item.descripcion}</Text> : null}
            <Text style={s.cant}>
              {item.documentos === 0 ? 'Sin documentos'
                : `${item.documentos} ${item.documentos === 1 ? 'documento' : 'documentos'}`}
              {item.tipo === 'personal' ? ' · privado' : ''}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={C.ink3} />
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  subir: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.navy,
    borderRadius: R.lg, padding: 14, marginBottom: 12,
  },
  subirTit: { fontSize: 15, fontWeight: '700', color: '#fff' },
  subirSub: { fontSize: 12, color: '#A9CBD6', marginTop: 1 },
  carpeta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 14, marginBottom: 9,
  },
  bx: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { flex: 1, fontSize: 15.5, fontWeight: '600', color: C.ink },
  desc: { fontSize: 12.5, color: C.ink3, marginTop: 2, lineHeight: 17 },
  cant: { fontSize: 11.5, color: C.ink3, marginTop: 4 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { color: C.navy, fontSize: 11, fontWeight: '700' },
});
