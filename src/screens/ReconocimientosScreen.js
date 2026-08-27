import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { reconocimientos } from '../api/client';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

function cuando(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const h = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (h < 1) return 'recién';
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  const dd = Math.floor(h / 24);
  if (dd < 30) return `hace ${dd} días`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function ReconocimientosScreen({ navigation }) {
  const [vista, setVista] = useState('todos');
  const [data, setData] = useState(null);
  const [mios, setMios] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [m, p] = await Promise.all([
        reconocimientos.muro(),
        reconocimientos.mios().catch(() => ({ recibidos: [], dados: [] })),
      ]);
      setData(m);
      setMios(p);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('ReconocerForm')} hitSlop={10}
          style={{ marginRight: 4 }}>
          <MaterialIcons name="add-circle" size={24} color={C.gold} />
        </Pressable>
      ),
    });
  }, [navigation]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const lista = vista === 'todos' ? data.items
    : vista === 'recibidos' ? (mios?.recibidos || [])
    : (mios?.dados || []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.tabs}>
        {[
          { k: 'todos', n: 'Todos' },
          { k: 'recibidos', n: `Recibí ${mios?.recibidos?.length || 0}` },
          { k: 'dados', n: `Di ${mios?.dados?.length || 0}` },
        ].map((t) => (
          <Pressable key={t.k} onPress={() => setVista(t.k)}
            style={[s.tab, vista === t.k && s.tabOn]}>
            <Text style={[s.tabTxt, vista === t.k && { color: C.navy, fontWeight: '700' }]}>
              {t.n}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={lista}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 30 }}
        refreshControl={(
          <RefreshControl refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
        )}
        ListHeaderComponent={vista === 'todos' && data.del_mes > 0 ? (
          <Text style={s.encabezado}>
            {data.del_mes} {data.del_mes === 1 ? 'reconocimiento' : 'reconocimientos'} este mes
          </Text>
        ) : null}
        ListEmptyComponent={(
          <Vacio
            icono="emoji-events"
            titulo={vista === 'dados' ? 'Todavía no reconociste a nadie'
                  : vista === 'recibidos' ? 'Todavía no te reconocieron'
                  : 'Sin reconocimientos'}
            texto={vista === 'dados'
              ? 'Cuando alguien haga algo que valga la pena, destacalo.'
              : 'Cuando alguien destaque a otro, aparece acá y en el muro.'}
          />
        )}
        renderItem={({ item }) => {
          const color = item.valor?.color || C.gold;
          return (
            <Pressable
              style={[s.item, sombra, { borderLeftColor: color }]}
              onPress={() => item.post_id && navigation.navigate('Post', { id: item.post_id })}
            >
              {item.valor ? (
                <View style={[s.valor, { backgroundColor: `${color}1A` }]}>
                  <MaterialIcons name={item.valor.icono || 'star'} size={15} color={color} />
                  <Text style={[s.valorTxt, { color }]}>{item.valor.nombre}</Text>
                </View>
              ) : null}

              <View style={s.personas}>
                <Avatar persona={item.para} texto={iniciales(...String(item.para.nombre).split(' '))} tam={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.para} numberOfLines={1}>
                    {item.para.soy_yo ? 'Vos' : item.para.nombre}
                  </Text>
                  <Text style={s.de} numberOfLines={1}>
                    de {item.de.soy_yo ? 'vos' : item.de.nombre} · {cuando(item.fecha)}
                  </Text>
                </View>
              </View>

              <Text style={s.mensaje}>{item.mensaje}</Text>

              {item.post_id ? (
                <View style={s.verPost}>
                  <MaterialIcons name="forum" size={13} color={C.ink3} />
                  <Text style={s.verPostTxt}>Ver en el muro</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tabs: {
    flexDirection: 'row', gap: 4, backgroundColor: '#fff', margin: 14, marginBottom: 6,
    padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  tabOn: { backgroundColor: '#FBF6DC' },
  tabTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  encabezado: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginBottom: 10 },
  item: {
    backgroundColor: '#fff', borderRadius: R.lg, padding: 13, marginBottom: 9,
    borderLeftWidth: 4,
  },
  valor: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 10,
  },
  valorTxt: { fontSize: 11.5, fontWeight: '800' },
  personas: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  para: { fontSize: 15, fontWeight: '700', color: C.ink },
  de: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  mensaje: { fontSize: 14, color: C.ink, lineHeight: 20, marginTop: 10 },
  verPost: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  verPostTxt: { fontSize: 11.5, color: C.ink3 },
});
