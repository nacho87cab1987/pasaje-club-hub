import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { organigrama } from '../api/client';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

export default function OrganigramaScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [abiertos, setAbiertos] = useState({});
  const [q, setQ] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await organigrama.arbol();
      setData(r);
      // Arranca con el primer nivel abierto: un arbol todo cerrado no dice
      // nada, y todo abierto es una lista sin forma.
      const raices = r.items.filter((p) => !p.jefe_id);
      const inicial = {};
      raices.forEach((p) => { inicial[p.id] = true; });
      setAbiertos((a) => (Object.keys(a).length ? a : inicial));
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const porJefe = useMemo(() => {
    const m = {};
    (data?.items || []).forEach((p) => {
      const k = p.jefe_id || 'raiz';
      (m[k] = m[k] || []).push(p);
    });
    return m;
  }, [data]);

  const encontrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t || !data) return null;
    return data.items.filter((p) =>
      p.nombre.toLowerCase().includes(t)
      || String(p.puesto || '').toLowerCase().includes(t)
      || String(p.area || '').toLowerCase().includes(t));
  }, [q, data]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Armando el organigrama" />;

  const raices = porJefe.raiz || [];
  const abrir = (p) => navigation.navigate('Persona', { id: p.id, nombre: p.nombre });

  const Nodo = ({ persona, nivel }) => {
    const hijos = porJefe[persona.id] || [];
    const abierto = abiertos[persona.id];
    return (
      <View>
        <View style={[s.fila, { marginLeft: nivel * 18 }]}>
          {/* La linea vertical hace visible de quien cuelga cada uno. */}
          {nivel > 0 ? <View style={s.rama} /> : null}

          <Pressable
            style={[s.tarjeta, sombra, persona.soy_yo && s.tarjetaYo]}
            onPress={() => abrir(persona)}
          >
            <Avatar
              texto={iniciales(...String(persona.nombre).split(' '))}
              tam={38}
              fondo={persona.area_color ? `${persona.area_color}22` : C.tealSoft}
              color={persona.area_color || C.tealDeep}
            />

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.nombre} numberOfLines={1}>
                {persona.nombre}{persona.soy_yo ? ' · vos' : ''}
              </Text>
              <Text style={s.puesto} numberOfLines={1}>
                {persona.puesto || 'Sin puesto'}
                {persona.area ? ` · ${persona.area}` : ''}
              </Text>
            </View>

            {hijos.length ? (
              <Pressable
                hitSlop={10}
                onPress={() => setAbiertos((a) => ({ ...a, [persona.id]: !a[persona.id] }))}
                style={s.toggle}
              >
                <Text style={s.toggleN}>{hijos.length}</Text>
                <MaterialIcons
                  name={abierto ? 'expand-less' : 'expand-more'}
                  size={18}
                  color={C.tealDeep}
                />
              </Pressable>
            ) : null}
          </Pressable>
        </View>

        {abierto && hijos.map((h) => <Nodo key={h.id} persona={h} nivel={nivel + 1} />)}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.buscador}>
        <MaterialIcons name="search" size={20} color={C.ink3} />
        <TextInput
          style={s.input} value={q} onChangeText={setQ}
          placeholder="Buscar persona, puesto o area" placeholderTextColor={C.ink3}
        />
        {q ? <MaterialIcons name="close" size={19} color={C.ink3} onPress={() => setQ('')} /> : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: 4, paddingBottom: 34 }}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
          />
        )}
      >
        {encontrados ? (
          encontrados.length ? (
            encontrados.map((p) => <Nodo key={p.id} persona={p} nivel={0} />)
          ) : (
            <Vacio icono="person-search" titulo="Sin resultados" texto={`Nadie coincide con "${q}".`} />
          )
        ) : (
          <>
            {raices.map((p) => <Nodo key={p.id} persona={p} nivel={0} />)}
            {raices.length > 1 ? (
              <Text style={s.aviso}>
                Hay {raices.length} personas sin jefe asignado. Tocá cada una para
                acomodar de quién depende.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    margin: 14, marginBottom: 8, paddingHorizontal: 13, height: 44,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  fila: { flexDirection: 'row', alignItems: 'center' },
  rama: { width: 14, height: 1, backgroundColor: C.line, marginRight: -2 },
  tarjeta: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: R.md, padding: 10, marginBottom: 7,
  },
  tarjetaYo: { borderWidth: 1.5, borderColor: C.teal },
  nombre: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  puesto: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: C.tealSoft, borderRadius: 12, paddingLeft: 8, paddingRight: 4, paddingVertical: 4,
  },
  toggleN: { fontSize: 12, fontWeight: '700', color: C.tealDeep },
  aviso: { fontSize: 12.5, color: C.ink3, marginTop: 16, lineHeight: 18, paddingHorizontal: 4 },
});
