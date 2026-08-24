import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { notificaciones } from '../api/client';
import { ponerBadge, rutaAPantalla } from '../push';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

const ICONO = {
  muro: 'campaign', comentario: 'chat-bubble', tarea: 'task-alt',
  cumple: 'cake', documento: 'description', prueba: 'notifications',
};

function cuando(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'recien';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function NotificacionesScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await notificaciones.listar();
      setItems(r.items || []);
      ponerBadge(r.no_leidas || 0);
    } catch (e) { setError(e.message); setItems([]); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        items && items.some((x) => !Number(x.leida)) ? (
          <Pressable onPress={marcarTodas} hitSlop={10}>
            <Text style={s.todas}>Marcar leidas</Text>
          </Pressable>
        ) : null
      ),
    });
  }, [items, navigation]);

  const marcarTodas = async () => {
    try {
      await notificaciones.leidas();
      setItems((xs) => xs.map((x) => ({ ...x, leida: 1 })));
      ponerBadge(0);
    } catch (e) { /* se reintenta al refrescar */ }
  };

  const abrir = async (n) => {
    if (!Number(n.leida)) {
      notificaciones.leidas(n.id).catch(() => {});
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, leida: 1 } : x)));
    }
    const [pantalla, params] = rutaAPantalla(n.ruta);
    try { navigation.navigate(pantalla, params); }
    catch { /* la ruta puede apuntar a algo que esta version no tiene */ }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (items === null) return <Cargando texto="Cargando" />;

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={items}
      keyExtractor={(n) => String(n.id)}
      contentContainerStyle={{ padding: 14 }}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
      ListEmptyComponent={(
        <Vacio icono="notifications-none" titulo="Sin novedades"
          texto="Cuando publiquen algo o te asignen una tarea, te avisamos aca." />
      )}
      renderItem={({ item }) => {
        const leida = !!Number(item.leida);
        return (
          <Pressable style={[s.item, sombra, !leida && s.sinLeer]} onPress={() => abrir(item)}>
            <View style={[s.bx, !leida && { backgroundColor: C.tealSoft }]}>
              <MaterialIcons
                name={ICONO[item.tipo] || 'notifications'}
                size={19}
                color={leida ? C.ink3 : C.tealDeep}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.titulo, !leida && { fontWeight: '700' }]} numberOfLines={1}>
                {item.titulo}
              </Text>
              {item.cuerpo ? <Text style={s.cuerpo} numberOfLines={2}>{item.cuerpo}</Text> : null}
              <Text style={s.hora}>{cuando(item.creado_el)}</Text>
            </View>
            {!leida ? <View style={s.punto} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#fff',
    borderRadius: R.md, padding: 12, marginBottom: 8,
  },
  sinLeer: { borderLeftWidth: 3, borderLeftColor: C.teal },
  bx: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.lineSoft, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  cuerpo: { fontSize: 13, color: C.ink2, marginTop: 2, lineHeight: 18 },
  hora: { fontSize: 11, color: C.ink3, marginTop: 4 },
  punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.teal, marginTop: 6 },
  todas: { fontSize: 13, fontWeight: '600', color: C.tealDeep, marginRight: 4 },
});
