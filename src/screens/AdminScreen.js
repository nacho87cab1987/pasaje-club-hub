import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Switch, ScrollView, Alert, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { admin } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar, Cargando, ErrorBox, Tag, Fila, Card } from '../components/UI';
import { C, R, sombra, icono, iniciales } from '../theme';

// ---------------------------------------------------------------------------
// Lista de personas
// ---------------------------------------------------------------------------
export function AdminScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await admin.personas();
      setItems(r.items);
    } catch (e) {
      setError(e.message);
      setItems([]);
    }
  }, []);

  // Al volver de la ficha, los contadores pudieron cambiar.
  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (items === null) return <Cargando texto="Cargando personas" />;
  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={items}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14 }}
      ListHeaderComponent={
        <>
          <Pressable style={[s.alta, sombra]} onPress={() => navigation.navigate('AltaPersona')}>
            <MaterialIcons name="person-add" size={22} color={C.teal} />
            <View style={{ flex: 1 }}>
              <Text style={s.altaTit}>Dar de alta a alguien</Text>
              <Text style={s.altaSub}>Crea su acceso y su ficha</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#7FA6B5" />
          </Pressable>

          <Pressable style={[s.catalogos, sombra]} onPress={() => navigation.navigate('Catalogos')}>
            <MaterialIcons name="category" size={20} color={C.tealDeep} />
            <View style={{ flex: 1 }}>
              <Text style={s.catTit}>Áreas y puestos</Text>
              <Text style={s.catSub}>Crealos y editalos sin tocar la base</Text>
            </View>
            <MaterialIcons name="chevron-right" size={19} color={C.ink3} />
          </Pressable>

          <View style={s.aviso}>
            <MaterialIcons name="info-outline" size={18} color={C.tealDeep} />
            <Text style={s.avisoTxt}>
              Elegi una persona para habilitar o bloquear sus modulos. Los cambios se
              aplican en su proximo refresh.
            </Text>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={[s.envoltura, sombra]}>
          <Fila ultima onPress={() => navigation.navigate('AdminPersona', { id: item.id, nombre: item.nombre_completo })}>
            <Avatar texto={iniciales(item.nombre_completo?.split(' ')[0], item.nombre_completo?.split(' ')[1])} />
            <View style={{ flex: 1 }}>
              <Text style={s.nom}>{item.nombre_completo}</Text>
              <Text style={s.sub}>{item.perfil || item.perfil_slug}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Tag texto={`${item.modulos} modulos`} />
              {item.overrides > 0 ? <Tag texto={`${item.overrides} manual`} tipo="warn" /> : null}
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.ink3} />
          </Fila>
        </View>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Ficha de una persona con los switches
// ---------------------------------------------------------------------------
export function AdminPersonaScreen({ route, navigation }) {
  const { id } = route.params;
  const { persona: yo, puede, refrescar } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(null);

  const puedeEditar = puede('permisos.gestionar');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setData(await admin.persona(id));
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (data?.persona) navigation.setOptions({ title: data.persona.nombre_completo });
  }, [data, navigation]);

  const alternar = async (m) => {
    const nuevo = !m.habilitado;
    setGuardando(m.slug);

    // Optimista: el switch se mueve al instante. Si el servidor rechaza,
    // volvemos atras y explicamos por que.
    setData((d) => ({
      ...d,
      modulos: d.modulos.map((x) => (x.slug === m.slug ? { ...x, habilitado: nuevo } : x)),
    }));

    try {
      const r = await admin.setModulo(id, m.slug, nuevo);
      setData((d) => ({
        ...d,
        modulos: d.modulos.map((x) => {
          const srv = r.modulos.find((y) => y.slug === x.slug);
          return srv ? { ...x, habilitado: !!Number(srv.habilitado), es_override: !!Number(srv.es_override) } : x;
        }),
      }));
      // Si me estoy editando a mi mismo, mi propia sesion cambio.
      if (Number(id) === Number(yo?.id)) refrescar();
    } catch (e) {
      setData((d) => ({
        ...d,
        modulos: d.modulos.map((x) => (x.slug === m.slug ? { ...x, habilitado: !nuevo } : x)),
      }));
      Alert.alert('No se pudo aplicar', e.message);
    } finally {
      setGuardando(null);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando ficha" />;

  const p = data.persona;
  const habilitados = data.modulos.filter((m) => m.habilitado).length;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 34 }}>
      <Card>
        <View style={s.cab}>
          <Avatar texto={iniciales(p.nombre, p.apellido)} tam={48} />
          <View style={{ flex: 1 }}>
            <Text style={s.cabNom}>{p.nombre_completo}</Text>
            <Text style={s.cabSub}>
              {p.puesto || 'Sin puesto'} · perfil {p.perfil_slug}
            </Text>
          </View>
          <Tag texto={String(habilitados)} />
        </View>
      </Card>

      {!puedeEditar ? (
        <View style={s.aviso}>
          <MaterialIcons name="lock-outline" size={18} color={C.tealDeep} />
          <Text style={s.avisoTxt}>
            Podes ver los modulos, pero solo direccion puede modificarlos.
          </Text>
        </View>
      ) : null}

      <Text style={s.seccion}>MODULOS</Text>
      <Card>
        {data.modulos.map((m, i) => (
          <View
            key={m.slug}
            style={[s.mod, i < data.modulos.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.lineSoft }]}
          >
            <View style={[s.bx, { backgroundColor: m.color_fondo || C.tealSoft }]}>
              <MaterialIcons name={icono(m.icono)} size={19} color={m.color || C.tealDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.modNom}>{m.nombre}</Text>
              <Text style={[s.modSub, m.es_override && { color: C.warn, fontWeight: '600' }]}>
                {m.es_override ? 'Ajuste manual' : `Segun perfil ${p.perfil_slug}`}
              </Text>
            </View>
            <Switch
              value={!!m.habilitado}
              onValueChange={() => alternar(m)}
              disabled={!puedeEditar || guardando === m.slug}
              trackColor={{ false: C.line, true: C.teal }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </Card>

      <Text style={s.pie}>
        Cuando el valor coincide con el del perfil, el ajuste manual se borra solo y la
        persona vuelve a seguir a su perfil.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  catalogos: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.md, padding: 13, marginTop: 10,
  },
  catTit: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  catSub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: C.tealSoft,
    padding: 13, borderRadius: R.md, marginBottom: 12, marginTop: 12,
  },
  avisoTxt: { flex: 1, fontSize: 13, color: C.tealDeep, lineHeight: 18 },
  alta: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.navy,
    borderRadius: R.lg, padding: 14, marginBottom: 2,
  },
  altaTit: { fontSize: 15, fontWeight: '700', color: '#fff' },
  altaSub: { fontSize: 12, color: '#A9CBD6', marginTop: 1 },
  envoltura: { backgroundColor: '#fff', borderRadius: R.lg, marginBottom: 8 },
  nom: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  sub: { fontSize: 12.5, color: C.ink3, marginTop: 1 },
  cab: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  cabNom: { fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  cabSub: { fontSize: 13, color: C.ink2, marginTop: 1 },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  mod: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11 },
  bx: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modNom: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  modSub: { fontSize: 12, color: C.ink3, marginTop: 1 },
  pie: { fontSize: 12.5, color: C.ink3, marginTop: 18, lineHeight: 18, textAlign: 'center' },
});
