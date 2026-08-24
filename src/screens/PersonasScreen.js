import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { admin } from '../api/client';
import { Avatar, Cargando, ErrorBox, Vacio, Fila } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

export default function PersonasScreen() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async (busqueda) => {
    setError(null);
    try {
      const r = await admin.personas(busqueda ? { q: busqueda } : undefined);
      setItems(r.items);
    } catch (e) {
      setError(e.message);
      setItems([]);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Buscamos contra el servidor, pero esperamos a que deje de tipear:
  // sin esto sale una consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => { cargar(q.trim()); }, 350);
    return () => clearTimeout(t);
  }, [q, cargar]);

  if (items === null) return <Cargando texto="Cargando el equipo" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.buscador}>
        <MaterialIcons name="search" size={20} color={C.ink3} />
        <TextInput
          style={s.input}
          placeholder="Buscar por nombre, area o puesto"
          placeholderTextColor={C.ink3}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
        {q ? <MaterialIcons name="close" size={19} color={C.ink3} onPress={() => setQ('')} /> : null}
      </View>

      {error ? (
        <ErrorBox mensaje={error} onReintentar={() => cargar(q.trim())} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 14, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              tintColor={C.teal}
              onRefresh={async () => { setRefrescando(true); await cargar(q.trim()); setRefrescando(false); }}
            />
          }
          ListEmptyComponent={
            <Vacio icono="person-search" titulo="Sin resultados" texto={`Nadie coincide con "${q}".`} />
          }
          renderItem={({ item, index }) => (
            <View style={[index === 0 && s.primera, s.envoltura, sombra]}>
              <Fila ultima>
                <Avatar texto={iniciales(item.nombre_completo?.split(' ')[0], item.nombre_completo?.split(' ')[1])} />
                <View style={{ flex: 1 }}>
                  <Text style={s.nom}>{item.nombre_completo}</Text>
                  <Text style={s.sub} numberOfLines={1}>
                    {[item.puesto, item.area].filter(Boolean).join(' · ') || 'Sin puesto asignado'}
                  </Text>
                </View>
                {item.estado !== 'activo' ? (
                  <Text style={s.estado}>{item.estado}</Text>
                ) : null}
              </Fila>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    margin: 14, marginBottom: 8, paddingHorizontal: 13, height: 46,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  envoltura: { backgroundColor: '#fff', borderRadius: R.lg, marginBottom: 8 },
  primera: { marginTop: 4 },
  nom: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  sub: { fontSize: 12.5, color: C.ink3, marginTop: 1 },
  estado: { fontSize: 11, fontWeight: '700', color: C.warn, textTransform: 'uppercase' },
});
