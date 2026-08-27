import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, Modal, TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { admin, organigrama } from '../api/client';
import { vibrar } from '../MenuContextual';
import { Avatar, Cargando, ErrorBox, Card } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

export default function EditarPersonaScreen({ route, navigation }) {
  const { personaId } = route.params;

  const [persona, setPersona] = useState(null);
  const [catalogos, setCatalogos] = useState(null);
  const [gente, setGente] = useState([]);
  const [error, setError] = useState(null);
  const [eligiendo, setEligiendo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [busca, setBusca] = useState('');
  const [texto, setTexto] = useState(null);   // campo de texto en edicion

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [p, c, o] = await Promise.all([
        admin.persona(personaId),
        admin.catalogos(),
        organigrama.arbol().catch(() => ({ items: [] })),
      ]);
      setPersona(p.persona || p);
      setCatalogos(c);
      setGente((o.items || []).filter((x) => x.id !== personaId && !x.inactivo));
    } catch (e) { setError(e.message); }
  }, [personaId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (persona) {
      navigation.setOptions({
        title: `${persona.nombre || ''} ${persona.apellido || ''}`.trim() || 'Editar',
      });
    }
  }, [persona, navigation]);

  const guardar = async (campo, valor, etiqueta) => {
    setGuardando(true);
    try {
      await admin.actualizar({ persona_id: personaId, [campo]: valor });
      vibrar();
      // Se recarga en vez de tocar el estado local: cambiar el area
      // recalcula los grupos del muro del lado del servidor.
      await cargar();
      setEligiendo(null);
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardarTexto = async () => {
    const valor = String(texto.valor || '').trim();
    if (texto.requerido && valor.length < 2) {
      Alert.alert('Falta el dato', `${texto.titulo} no puede quedar vacío.`);
      return;
    }
    setGuardando(true);
    try {
      await admin.actualizar({ persona_id: personaId, [texto.campo]: valor });
      vibrar();
      await cargar();
      setTexto(null);
    } catch (e) {
      Alert.alert('No se pudo', e.message);
    } finally {
      setGuardando(false);
    }
  };

  const filaJefeExtra = {
    campo: '__jefe_extra', titulo: 'Agregar otra jefa',
    opciones: gente
      .filter((g) => g.id !== persona?.jefe_id
        && !(persona?.jefes_extra || []).some((j) => j.id === g.id))
      .map((g) => ({ id: g.id, nombre: g.nombre, sub: g.puesto })),
  };

  const quitarJefeExtra = (j) => {
    Alert.alert('Quitar', `${j.nombre} deja de ver a esta persona en su equipo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await organigrama.quitarJefeExtra(personaId, j.id);
            await cargar();
          } catch (e) { Alert.alert('No se pudo', e.message); }
        },
      },
    ]);
  };

  const eliminar = () => {
    const nombre = `${persona.nombre || ''} ${persona.apellido || ''}`.trim();
    Alert.alert(
      'Eliminar del hub',
      `${nombre} deja de existir en el hub. Su cuenta del panel y sus expedientes `
      + 'no se tocan.\n\nSi la persona se fue de la empresa, conviene darle de baja '
      + 'en lugar de eliminarla: así conserva su historial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dar de baja',
          onPress: async () => {
            try {
              await admin.estado(personaId, 'baja');
              // La baja conserva la ficha, asi que volver esta bien.
              navigation.goBack();
            } catch (e) { Alert.alert('No se pudo', e.message); }
          },
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await admin.eliminar(personaId);
              vibrar(true);
              // No se vuelve con goBack: atras esta la ficha de la persona
              // que acabamos de eliminar, y al recargarse da "no encontrada".
              // Se sale hasta la lista, que si existe.
              navigation.popToTop();
            } catch (e) { Alert.alert('No se pudo eliminar', e.message); }
          },
        },
      ],
    );
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!persona || !catalogos) return <Cargando texto="Cargando" />;

  const areas = catalogos.areas || [];
  const puestos = catalogos.puestos || [];
  const perfiles = catalogos.perfiles || [];

  // Los puestos del area elegida primero: el resto igual se puede elegir,
  // porque a veces alguien ocupa un puesto de otra area.
  const puestosOrdenados = [...puestos].sort((a, b) => {
    const da = a.area_id === persona.area_id ? 0 : 1;
    const db = b.area_id === persona.area_id ? 0 : 1;
    return da - db;
  });

  const nombreDe = (lista, id) => (lista.find((x) => x.id === id) || {}).nombre || null;

  const filas = [
    {
      campo: 'area_id', titulo: 'Área', icono: 'apartment',
      valor: nombreDe(areas, persona.area_id),
      opciones: areas.map((a) => ({ id: a.id, nombre: a.nombre, color: a.color })),
    },
    {
      campo: 'puesto_id', titulo: 'Puesto', icono: 'badge',
      valor: nombreDe(puestos, persona.puesto_id),
      opciones: puestosOrdenados.map((p) => ({
        id: p.id, nombre: p.nombre,
        sub: nombreDe(areas, p.area_id),
      })),
    },
    {
      campo: 'jefe_id', titulo: 'Reporta a', icono: 'account-tree',
      valor: gente.find((g) => g.id === persona.jefe_id)?.nombre || 'Nadie (queda en la cabeza)',
      opciones: [
        { id: 0, nombre: 'Nadie', sub: 'Queda arriba del organigrama' },
        ...gente.map((g) => ({ id: g.id, nombre: g.nombre, sub: g.puesto })),
      ],
    },
    {
      campo: 'perfil_id', titulo: 'Perfil de acceso', icono: 'shield',
      valor: nombreDe(perfiles, persona.perfil_id),
      opciones: perfiles.map((p) => ({ id: p.id, nombre: p.nombre, sub: p.descripcion })),
      // El perfil tiene su propia accion porque cambia permisos, no datos.
      accion: 'perfil',
    },
  ];

  const elegir = async (fila, opcion) => {
    if (fila.campo === '__jefe_extra') {
      setGuardando(true);
      try {
        await organigrama.jefeExtra(personaId, opcion.id);
        vibrar();
        await cargar();
        setEligiendo(null);
      } catch (e) { Alert.alert('No se pudo', e.message); }
      finally { setGuardando(false); }
      return;
    }
    if (fila.accion === 'perfil') {
      setGuardando(true);
      try {
        await admin.cambiarPerfil(personaId, opcion.id);
        vibrar();
        await cargar();
        setEligiendo(null);
      } catch (e) { Alert.alert('No se pudo', e.message); }
      finally { setGuardando(false); }
      return;
    }
    guardar(fila.campo, opcion.id, opcion.nombre);
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      <View style={[s.cab, sombra]}>
        <Avatar
          texto={iniciales(persona.nombre, persona.apellido)}
          tam={56}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.nombre}>
            {`${persona.nombre || ''} ${persona.apellido || ''}`.trim()}
          </Text>
          <Text style={s.email}>{persona.email}</Text>
        </View>
      </View>

      <Text style={s.seccion}>DATOS</Text>
      <Card>
        {[
          { campo: 'nombre',   titulo: 'Nombre',   icono: 'person', requerido: true },
          { campo: 'apellido', titulo: 'Apellido', icono: 'person-outline', requerido: true },
          { campo: 'telefono', titulo: 'Teléfono', icono: 'phone', teclado: 'phone-pad' },
          { campo: 'dni',      titulo: 'DNI',      icono: 'badge', teclado: 'number-pad' },
          { campo: 'legajo',   titulo: 'Legajo',   icono: 'tag' },
        ].map((f, i, arr) => (
          <Pressable
            key={f.campo}
            style={[s.fila, i < arr.length - 1 && s.borde]}
            onPress={() => setTexto({ ...f, valor: persona[f.campo] || '' })}
          >
            <MaterialIcons name={f.icono} size={20} color={C.ink3} />
            <View style={{ flex: 1 }}>
              <Text style={s.filaT}>{f.titulo}</Text>
              <Text style={[s.filaV, !persona[f.campo] && { color: C.ink3, fontStyle: 'italic' }]}>
                {persona[f.campo] || 'Sin cargar'}
              </Text>
            </View>
            <MaterialIcons name="edit" size={18} color={C.tealDeep} />
          </Pressable>
        ))}
      </Card>

      <Text style={s.seccion}>SU LUGAR EN LA EMPRESA</Text>
      <Card>
        {filas.map((f, i) => (
          <Pressable
            key={f.campo}
            style={[s.fila, i < filas.length - 1 && s.borde]}
            onPress={() => { setBusca(''); setEligiendo(f); }}
          >
            <MaterialIcons name={f.icono} size={20} color={C.ink3} />
            <View style={{ flex: 1 }}>
              <Text style={s.filaT}>{f.titulo}</Text>
              <Text style={[s.filaV, !f.valor && { color: C.warn, fontStyle: 'italic' }]}>
                {f.valor || 'Sin asignar'}
              </Text>
            </View>
            <MaterialIcons name="edit" size={18} color={C.tealDeep} />
          </Pressable>
        ))}
      </Card>

      <Text style={s.pie}>
        Cambiar el área recalcula a qué publicaciones del muro llega.
      </Text>

      <Text style={s.seccion}>TAMBIÉN REPORTA A</Text>
      <Card>
        {(persona.jefes_extra || []).map((j) => (
          <View key={j.id} style={[s.fila, s.borde]}>
            <MaterialIcons name="alt-route" size={20} color="#5B52C4" />
            <View style={{ flex: 1 }}>
              <Text style={s.filaV}>{j.nombre}</Text>
              {j.motivo ? <Text style={s.filaT}>{j.motivo}</Text> : null}
            </View>
            <Pressable onPress={() => quitarJefeExtra(j)} hitSlop={8}>
              <MaterialIcons name="close" size={19} color={C.bordo} />
            </Pressable>
          </View>
        ))}
        <Pressable style={s.fila} onPress={() => setEligiendo(filaJefeExtra)}>
          <MaterialIcons name="add" size={20} color={C.tealDeep} />
          <Text style={[s.filaV, { color: C.tealDeep, fontWeight: '600' }]}>
            Agregar otra jefa
          </Text>
        </Pressable>
      </Card>
      <Text style={s.nota}>
        La jefa principal es la que evalúa y define el organigrama. Las
        adicionales ven a la persona en su equipo.
      </Text>

      <Pressable style={s.eliminar} onPress={eliminar}>
        <MaterialIcons name="person-remove" size={18} color={C.bordo} />
        <Text style={s.eliminarTxt}>Dar de baja o eliminar</Text>
      </Pressable>

      <Modal visible={!!texto} animationType="slide" transparent
        onRequestClose={() => setTexto(null)}>
        <Pressable style={s.fondo} onPress={() => setTexto(null)} />
        <View style={s.hoja}>
          <View style={s.hojaTop}>
            <Text style={s.hojaTit}>{texto?.titulo}</Text>
            <Pressable onPress={() => setTexto(null)} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.ink3} />
            </Pressable>
          </View>
          <View style={{ padding: 16 }}>
            <TextInput
              style={s.input}
              value={texto?.valor}
              onChangeText={(t) => setTexto((x) => ({ ...x, valor: t }))}
              placeholder={texto?.titulo}
              placeholderTextColor={C.ink3}
              keyboardType={texto?.teclado || 'default'}
              autoFocus
            />
            <Pressable
              style={[s.guardar, guardando && { opacity: 0.5 }]}
              onPress={guardarTexto}
              disabled={guardando}
            >
              <Text style={s.guardarTxt}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!eligiendo}
        animationType="slide"
        transparent
        onRequestClose={() => setEligiendo(null)}
      >
        <Pressable style={s.fondo} onPress={() => setEligiendo(null)} />
        <View style={s.hoja}>
          <View style={s.hojaTop}>
            <Text style={s.hojaTit}>{eligiendo?.titulo}</Text>
            <Pressable onPress={() => setEligiendo(null)} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.ink3} />
            </Pressable>
          </View>

          {(eligiendo?.opciones || []).length > 8 ? (
            <View style={s.buscador}>
              <MaterialIcons name="search" size={18} color={C.ink3} />
              <TextInput
                style={s.buscadorInput}
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar"
                placeholderTextColor={C.ink3}
              />
            </View>
          ) : null}

          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            {(eligiendo?.opciones || [])
              .filter((o) => !busca || String(o.nombre).toLowerCase().includes(busca.toLowerCase()))
              .map((o) => {
                const actual = persona[eligiendo.campo] === o.id
                  || (o.id === 0 && !persona[eligiendo.campo]);
                return (
                  <Pressable
                    key={`${o.id}-${o.nombre}`}
                    style={[s.opcion, actual && { backgroundColor: C.tealSoft }]}
                    onPress={() => elegir(eligiendo, o)}
                    disabled={guardando}
                  >
                    {o.color ? (
                      <View style={[s.punto, { backgroundColor: o.color }]} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={s.opcionT}>{o.nombre}</Text>
                      {o.sub ? <Text style={s.opcionS}>{o.sub}</Text> : null}
                    </View>
                    {actual ? <MaterialIcons name="check" size={20} color={C.teal} /> : null}
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cab: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 15,
  },
  nombre: { fontSize: 17, fontWeight: '700', color: C.ink },
  email: { fontSize: 12.5, color: C.ink3, marginTop: 2 },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 22, marginBottom: 9 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  filaT: { fontSize: 11, color: C.ink3, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.4 },
  filaV: { fontSize: 15, color: C.ink, marginTop: 2, fontWeight: '500' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 16, lineHeight: 17 },
  nota: { fontSize: 11.5, color: C.ink3, marginTop: 8, lineHeight: 16, paddingHorizontal: 4 },
  eliminar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#F0C0CC', borderRadius: R.md,
    paddingVertical: 14, marginTop: 22,
  },
  eliminarTxt: { fontSize: 14, fontWeight: '600', color: C.bordo },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 13,
    paddingVertical: 12, fontSize: 16, color: C.ink,
  },
  guardar: {
    backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 15,
    alignItems: 'center', marginTop: 18,
  },
  guardarTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.4)' },
  hoja: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '78%' },
  hojaTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hojaTit: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 12, height: 42, borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  buscadorInput: { flex: 1, fontSize: 14.5, color: C.ink },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  punto: { width: 10, height: 10, borderRadius: 5 },
  opcionT: { fontSize: 14.5, fontWeight: '500', color: C.ink },
  opcionS: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
});
