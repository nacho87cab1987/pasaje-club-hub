import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, Modal, TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { organigrama } from '../api/client';
import { Avatar, Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

export default function PersonaScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [q, setQ] = useState('');

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await organigrama.persona(id)); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  useEffect(() => {
    if (data) navigation.setOptions({ title: data.persona.nombre });
  }, [data, navigation]);

  const abrirSelector = async () => {
    try {
      const r = await organigrama.arbol();
      // No se puede elegir a la propia persona; el servidor ademas rechaza
      // los ciclos, pero sacarla de la lista evita el intento.
      setCandidatos(r.items.filter((p) => p.id !== id && !p.inactivo));
      setEligiendo(true);
    } catch (e) { Alert.alert('No se pudo', e.message); }
  };

  const asignar = async (jefeId) => {
    try {
      await organigrama.cambiarJefe(id, jefeId);
      setEligiendo(false);
      setQ('');
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo cambiar', e.message);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  // Quien puede editar personas llega desde aca a cambiarle area, puesto
  // y de quien depende.
  useEffect(() => {
    // puede_editar lo informa el servidor segun el permiso personas.editar.
    if (!data || !data.puede_editar) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('EditarPersona', { personaId: id })}
          hitSlop={10} style={{ marginRight: 4 }}>
          <MaterialIcons name="edit" size={21} color={C.navy} />
        </Pressable>
      ),
    });
  }, [navigation, id, data]);


  if (!data) return <Cargando texto="Cargando" />;

  const { persona, jefe, pares, equipo, cadena } = data;

  const Ficha = ({ p, chico }) => (
    <Pressable
      style={[s.ficha, sombra, chico && { padding: 9 }]}
      onPress={() => navigation.push('Persona', { id: p.id, nombre: p.nombre })}
    >
      <Avatar
        texto={iniciales(...String(p.nombre).split(' '))}
        tam={chico ? 32 : 38}
        fondo={p.area_color ? `${p.area_color}22` : C.tealSoft}
        color={p.area_color || C.tealDeep}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.fichaNom} numberOfLines={1}>{p.nombre}</Text>
        <Text style={s.fichaPue} numberOfLines={1}>{p.puesto || 'Sin puesto'}</Text>
      </View>
      {p.a_cargo > 0 ? (
        <View style={s.cargo}><Text style={s.cargoN}>{p.a_cargo}</Text></View>
      ) : null}
    </Pressable>
  );

  const filtrados = candidatos.filter((p) =>
    !q.trim() || p.nombre.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 34 }}>
      {cadena.length ? (
        <View style={s.cadena}>
          {cadena.map((c, i) => (
            <View key={c.id} style={s.cadenaItem}>
              <Pressable onPress={() => navigation.push('Persona', { id: c.id, nombre: c.nombre })}>
                <Text style={s.cadenaTxt}>{c.nombre.split(' ')[0]}</Text>
              </Pressable>
              <MaterialIcons name="chevron-right" size={14} color={C.ink3} />
              {i === cadena.length - 1 ? (
                <Text style={s.cadenaFin}>{persona.nombre.split(' ')[0]}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Card>
        <View style={s.cab}>
          <Avatar
            texto={iniciales(...String(persona.nombre).split(' '))}
            tam={62}
            fondo={persona.area_color ? `${persona.area_color}22` : C.tealSoft}
            color={persona.area_color || C.tealDeep}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.nombre}>{persona.nombre}</Text>
            <Text style={s.puesto}>{persona.puesto || 'Sin puesto asignado'}</Text>
            {persona.area ? (
              <View style={s.areaChip}>
                <View style={[s.punto, { backgroundColor: persona.area_color || C.ink3 }]} />
                <Text style={s.areaTxt}>{persona.area}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      <View style={s.seccionFila}>
        <Text style={s.seccion}>REPORTA A</Text>
        {data.puede_editar ? (
          <Pressable onPress={abrirSelector} hitSlop={8}>
            <Text style={s.cambiar}>{jefe ? 'Cambiar' : 'Asignar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {jefe ? <Ficha p={jefe} /> : (
        <Text style={s.vacio}>
          No tiene jefe asignado. {data.puede_editar ? 'Tocá "Asignar" para definirlo.' : ''}
        </Text>
      )}

      {pares.length ? (
        <>
          <Text style={s.seccion}>MISMO EQUIPO</Text>
          {pares.map((p) => <Ficha key={p.id} p={p} chico />)}
        </>
      ) : null}

      {equipo.length ? (
        <>
          <Text style={s.seccion}>
            A CARGO · {equipo.length} {equipo.length === 1 ? 'PERSONA' : 'PERSONAS'}
          </Text>
          {equipo.map((p) => <Ficha key={p.id} p={p} />)}
        </>
      ) : null}

      <Modal visible={eligiendo} animationType="slide" transparent onRequestClose={() => setEligiendo(false)}>
        <Pressable style={s.fondo} onPress={() => setEligiendo(false)} />
        <View style={s.hoja}>
          <View style={s.hojaTop}>
            <Text style={s.hojaTit}>¿De quién depende?</Text>
            <Pressable onPress={() => setEligiendo(false)} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.ink3} />
            </Pressable>
          </View>

          <View style={s.buscador}>
            <MaterialIcons name="search" size={19} color={C.ink3} />
            <TextInput
              style={s.input} value={q} onChangeText={setQ}
              placeholder="Buscar" placeholderTextColor={C.ink3}
            />
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            {jefe ? (
              <Pressable style={s.opcion} onPress={() => asignar(null)}>
                <MaterialIcons name="link-off" size={20} color={C.bordo} />
                <Text style={[s.opcionTxt, { color: C.bordo }]}>Quitar el jefe actual</Text>
              </Pressable>
            ) : null}
            {filtrados.map((p) => (
              <Pressable key={p.id} style={s.opcion} onPress={() => asignar(p.id)}>
                <Avatar
                  texto={iniciales(...String(p.nombre).split(' '))}
                  tam={32}
                  fondo={p.area_color ? `${p.area_color}22` : C.tealSoft}
                  color={p.area_color || C.tealDeep}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.opcionTxt}>{p.nombre}</Text>
                  <Text style={s.opcionSub}>{p.puesto || p.area || ''}</Text>
                </View>
                {jefe && jefe.id === p.id ? (
                  <MaterialIcons name="check" size={19} color={C.teal} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cadena: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 11, paddingHorizontal: 2 },
  cadenaItem: { flexDirection: 'row', alignItems: 'center' },
  cadenaTxt: { fontSize: 12, color: C.tealDeep, fontWeight: '600' },
  cadenaFin: { fontSize: 12, color: C.ink3 },
  cab: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 },
  nombre: { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  puesto: { fontSize: 13.5, color: C.ink2, marginTop: 2 },
  areaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  areaTxt: { fontSize: 12, color: C.ink3 },
  seccionFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 9 },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  cambiar: { fontSize: 13, fontWeight: '600', color: C.tealDeep },
  ficha: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderRadius: R.md, padding: 12, marginBottom: 8,
  },
  fichaNom: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  fichaPue: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  cargo: { backgroundColor: C.tealSoft, borderRadius: 11, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cargoN: { fontSize: 11.5, fontWeight: '700', color: C.tealDeep },
  vacio: { fontSize: 13, color: C.ink3, lineHeight: 19, paddingHorizontal: 4 },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.4)' },
  hoja: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '78%' },
  hojaTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hojaTit: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line,
    borderRadius: R.md, margin: 14, marginBottom: 6, paddingHorizontal: 12, height: 42,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  opcionTxt: { fontSize: 14.5, fontWeight: '500', color: C.ink },
  opcionSub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
});
