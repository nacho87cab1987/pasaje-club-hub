import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, Modal, TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { admin } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra } from '../theme';

const COLORES = ['#072D40', '#11BCB3', '#D7CA4A', '#790F35', '#5a7a85',
  '#7F77DD', '#1D7044', '#D85A30'];

export default function CatalogosScreen({ navigation }) {
  const [tipo, setTipo] = useState('areas');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await admin.catalogos()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const abrir = (item) => {
    setEditando(item || {
      nombre: '',
      color: COLORES[0],
      area_id: tipo === 'puestos' ? (data.areas[0]?.id || null) : null,
      nuevo: true,
    });
  };

  const guardar = async () => {
    const nombre = String(editando.nombre || '').trim();
    if (nombre.length < 2) { Alert.alert('Falta el nombre'); return; }

    setGuardando(true);
    try {
      if (tipo === 'areas') {
        await admin.guardarArea({ id: editando.id || 0, nombre, color: editando.color });
      } else {
        await admin.guardarPuesto({
          id: editando.id || 0, nombre, area_id: editando.area_id,
        });
      }
      vibrar();
      await cargar();
      setEditando(null);
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally {
      setGuardando(false);
    }
  };

  const darBaja = (item) => {
    // El servidor igual lo valida; esto evita el viaje de ida y vuelta.
    if (item.personas > 0) {
      Alert.alert(
        'Está en uso',
        `${item.personas} ${item.personas === 1 ? 'persona lo tiene' : 'personas lo tienen'} asignado. `
        + 'Cambiálas primero desde su ficha.',
      );
      return;
    }
    Alert.alert('Dar de baja', `${item.nombre} deja de aparecer en las listas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Dar de baja',
        style: 'destructive',
        onPress: async () => {
          try {
            await admin.bajaCatalogo(tipo === 'areas' ? 'area' : 'puesto', item.id);
            await cargar();
          } catch (e) { Alert.alert('No se pudo', e.message); }
        },
      },
    ]);
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const lista = tipo === 'areas' ? data.areas : data.puestos;
  const areaDe = (id) => (data.areas.find((a) => a.id === id) || {}).nombre;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.tabs}>
        {[
          { k: 'areas', n: `Áreas ${data.areas.length}` },
          { k: 'puestos', n: `Puestos ${data.puestos.length}` },
        ].map((t) => (
          <Pressable key={t.k} onPress={() => setTipo(t.k)}
            style={[s.tab, tipo === t.k && s.tabOn]}>
            <Text style={[s.tabTxt, tipo === t.k && { color: C.navy, fontWeight: '700' }]}>
              {t.n}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: 30 }}>
        <Card>
          {lista.map((x, i) => (
            <Pressable
              key={x.id}
              style={[s.item, i < lista.length - 1 && s.borde]}
              onPress={() => abrir(x)}
              onLongPress={() => darBaja(x)}
            >
              {tipo === 'areas' ? (
                <View style={[s.punto, { backgroundColor: x.color || C.ink3 }]} />
              ) : (
                <MaterialIcons name="badge" size={19} color={C.ink3} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.itemN}>{x.nombre}</Text>
                <Text style={s.itemS}>
                  {tipo === 'puestos' && x.area_id ? `${areaDe(x.area_id)} · ` : ''}
                  {x.personas === 0 ? 'sin personas'
                    : `${x.personas} ${x.personas === 1 ? 'persona' : 'personas'}`}
                </Text>
              </View>
              <MaterialIcons name="edit" size={17} color={C.tealDeep} />
            </Pressable>
          ))}
        </Card>

        <Pressable style={s.nuevo} onPress={() => abrir(null)}>
          <MaterialIcons name="add" size={20} color={C.tealDeep} />
          <Text style={s.nuevoTxt}>
            {tipo === 'areas' ? 'Nueva área' : 'Nuevo puesto'}
          </Text>
        </Pressable>

        <Text style={s.pie}>
          Mantené apretado para dar de baja. Lo que está asignado a alguien no
          se puede dar de baja hasta cambiarlo.
        </Text>
      </ScrollView>

      <Modal visible={!!editando} animationType="slide" transparent
        onRequestClose={() => setEditando(null)}>
        <Pressable style={s.fondo} onPress={() => setEditando(null)} />
        <View style={s.hoja}>
          <View style={s.hojaTop}>
            <Text style={s.hojaTit}>
              {editando?.nuevo
                ? (tipo === 'areas' ? 'Nueva área' : 'Nuevo puesto')
                : 'Editar'}
            </Text>
            <Pressable onPress={() => setEditando(null)} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.ink3} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={s.label}>Nombre</Text>
            <TextInput
              style={s.input}
              value={editando?.nombre}
              onChangeText={(t) => setEditando((e) => ({ ...e, nombre: t }))}
              placeholder={tipo === 'areas' ? 'Ej: Postventa' : 'Ej: Gerenta de Ventas y RRHH'}
              placeholderTextColor={C.ink3}
              autoFocus
            />

            {tipo === 'areas' ? (
              <>
                <Text style={s.label}>Color</Text>
                <View style={s.colores}>
                  {COLORES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => { vibrar(); setEditando((e) => ({ ...e, color: c })); }}
                      style={[s.color, { backgroundColor: c },
                              editando?.color === c && s.colorOn]}
                    >
                      {editando?.color === c ? (
                        <MaterialIcons name="check" size={17} color="#fff" />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={s.label}>Área</Text>
                {data.areas.map((a) => (
                  <Pressable
                    key={a.id}
                    style={[s.opcion, editando?.area_id === a.id && { backgroundColor: C.tealSoft }]}
                    onPress={() => setEditando((e) => ({ ...e, area_id: a.id }))}
                  >
                    <View style={[s.punto, { backgroundColor: a.color || C.ink3 }]} />
                    <Text style={s.opcionT}>{a.nombre}</Text>
                    {editando?.area_id === a.id ? (
                      <MaterialIcons name="check" size={19} color={C.teal} />
                    ) : null}
                  </Pressable>
                ))}
              </>
            )}

            <Pressable
              style={[s.guardar, guardando && { opacity: 0.5 }]}
              onPress={guardar}
              disabled={guardando}
            >
              <Text style={s.guardarTxt}>Guardar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: {
    flexDirection: 'row', gap: 4, backgroundColor: '#fff', margin: 14, marginBottom: 6,
    padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  tabOn: { backgroundColor: C.tealSoft },
  tabTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  punto: { width: 12, height: 12, borderRadius: 6 },
  itemN: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  itemS: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  nuevo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.tealSoft, borderRadius: R.md, paddingVertical: 14, marginTop: 12,
  },
  nuevoTxt: { fontSize: 14, fontWeight: '700', color: C.tealDeep },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 16, lineHeight: 17 },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.4)' },
  hoja: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '82%' },
  hojaTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hojaTit: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  label: { fontSize: 12, fontWeight: '700', color: C.ink2, marginTop: 14, marginBottom: 7, letterSpacing: 0.3 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 13,
    paddingVertical: 12, fontSize: 15.5, color: C.ink,
  },
  colores: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  color: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  colorOn: { borderWidth: 3, borderColor: C.navy },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12,
    paddingHorizontal: 10, borderRadius: R.sm,
  },
  opcionT: { flex: 1, fontSize: 14.5, color: C.ink },
  guardar: {
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 15,
    alignItems: 'center', marginTop: 22,
  },
  guardarTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
