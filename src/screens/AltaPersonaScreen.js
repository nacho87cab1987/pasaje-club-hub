import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { admin } from '../api/client';
import { Cargando, ErrorBox, Boton, Card, Avatar } from '../components/UI';
import { C, R, iniciales } from '../theme';

function formatearFecha(txt, anterior) {
  const borrando = txt.length < anterior.length;
  const d = txt.replace(/\D/g, '').slice(0, 8);
  if (borrando && txt.endsWith('/')) return txt.slice(0, -1);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function aISO(vista) {
  if (!vista || vista.length !== 10) return null;
  const [d, m, a] = vista.split('/');
  return `${a}-${m}-${d}`;
}

export default function AltaPersonaScreen({ navigation }) {
  const [cat, setCat] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [modo, setModo] = useState('nueva');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nacimiento, setNacimiento] = useState('');
  const [areaId, setAreaId] = useState(null);
  const [perfilId, setPerfilId] = useState(null);
  const [entrega, setEntrega] = useState('mostrar');
  const [vinculo, setVinculo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, k] = await Promise.all([admin.catalogos(), admin.candidatos()]);
        setCat(c);
        setCandidatos(k.items || []);
        const v = c.perfiles.find((p) => p.slug === 'vendedora');
        if (v) setPerfilId(v.id);
      } catch (e) { setError(e.message); }
    })();
  }, []);

  const elegirCandidato = (c) => {
    setVinculo(c);
    // Prellenamos con lo que ya sabemos, para no volver a tipearlo.
    const partes = String(c.nombre || '').trim().split(' ');
    if (!nombre) setNombre(partes[0] || '');
    if (!apellido) setApellido(partes.slice(1).join(' ') || '');
    if (!email) setEmail(c.email || '');
  };

  const guardar = async () => {
    if (!nombre.trim() || !apellido.trim() || !email.trim()) {
      Alert.alert('Faltan datos', 'Nombre, apellido y email son obligatorios.');
      return;
    }
    if (modo === 'existente' && !vinculo) {
      Alert.alert('Falta el vinculo', 'Elegí a que usuario o vendedor corresponde.');
      return;
    }
    setGuardando(true);
    try {
      const r = await admin.crearPersona({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim() || null,
        fecha_nacimiento: aISO(nacimiento),
        area_id: areaId,
        perfil_id: perfilId,
        modo,
        entrega,
        credencial: 'usuario',
        usuario_id: vinculo && vinculo.tipo === 'usuario' ? vinculo.id : null,
        vendedor_id: vinculo && vinculo.tipo === 'vendedor' ? vinculo.id : null,
      });

      if (r.clave) {
        // Si pediste envio por mail y el mail fallo, el servidor devuelve la
        // clave igual. Avisamos por que aparece en pantalla.
        // La clave se ve una sola vez. Ofrecemos compartirla en el momento,
        // porque si se cierra este cartel no hay forma de recuperarla.
        Alert.alert(
          'Persona creada',
          (r.aviso ? `${r.aviso}\n\n` : '')
          + `Contrasena temporal de ${nombre}:\n\n${r.clave}\n\n`
          + 'Anotala o compartila ahora: no se puede volver a ver.',
          [
            {
              text: 'Compartir',
              onPress: async () => {
                await Share.share({
                  message: `Hola ${nombre}! Ya tenes acceso a la app de Pasaje Club.\n\n`
                         + `Usuario: ${email.trim().toLowerCase()}\nContrasena: ${r.clave}\n\n`
                         + 'Al entrar te va a pedir que la cambies.',
                }).catch(() => {});
                navigation.goBack();
              },
            },
            { text: 'Listo', onPress: () => navigation.goBack() },
          ],
        );
      } else {
        const porMail = r.mail && r.mail.enviado;
        Alert.alert(
          'Persona creada',
          porMail ? `Le mandamos el acceso a ${email}.`
                  : (r.mail ? 'La persona se creo, pero el mail no se pudo enviar.'
                            : 'Ya aparece en el directorio.'),
          [{ text: 'Listo', onPress: () => navigation.goBack() }],
        );
      }
    } catch (e) {
      Alert.alert('No se pudo crear', e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} />;
  if (!cat) return <Cargando texto="Cargando" />;

  const nueva = modo === 'nueva';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <View style={s.seg}>
          <Pressable style={[s.segBtn, nueva && s.segOn]} onPress={() => { setModo('nueva'); setVinculo(null); }}>
            <MaterialIcons name="person-add" size={18} color={nueva ? '#fff' : C.ink2} />
            <Text style={[s.segTxt, nueva && { color: '#fff' }]}>Alguien nuevo</Text>
          </Pressable>
          <Pressable style={[s.segBtn, !nueva && s.segOn]} onPress={() => setModo('existente')}>
            <MaterialIcons name="link" size={18} color={!nueva ? '#fff' : C.ink2} />
            <Text style={[s.segTxt, !nueva && { color: '#fff' }]}>Ya tiene usuario</Text>
          </Pressable>
        </View>

        <Text style={s.ayudaModo}>
          {nueva
            ? 'Le creamos usuario y contrasena, y la ficha del hub.'
            : `Solo la ficha. Usa la contrasena que ya tiene. ${candidatos.length} sin ficha.`}
        </Text>

        {!nueva ? (
          <View style={{ marginTop: 12 }}>
            {candidatos.length === 0 ? (
              <Card>
                <Text style={s.vacio}>
                  Todos los usuarios y vendedores ya tienen ficha en el hub.
                </Text>
              </Card>
            ) : (
              candidatos.slice(0, 25).map((c) => {
                const sel = vinculo && vinculo.tipo === c.tipo && vinculo.id === c.id;
                return (
                  <Pressable
                    key={`${c.tipo}-${c.id}`}
                    onPress={() => elegirCandidato(c)}
                    style={[s.cand, sel && s.candOn]}
                  >
                    <MaterialIcons
                      name={sel ? 'check-circle' : 'radio-button-unchecked'}
                      size={21}
                      color={sel ? C.teal : C.ink3}
                    />
                    <Avatar texto={iniciales(...String(c.nombre).split(' '))} tam={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.candNom}>{c.nombre || '(sin nombre)'}</Text>
                      <Text style={s.candSub} numberOfLines={1}>{c.email} · {c.tipo}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        <Text style={s.seccion}>DATOS</Text>
        <Card>
          <Campo etiqueta="Nombre">
            <TextInput style={s.input} value={nombre} onChangeText={setNombre} placeholder="Rocio" placeholderTextColor={C.ink3} />
          </Campo>
          <Campo etiqueta="Apellido">
            <TextInput style={s.input} value={apellido} onChangeText={setApellido} placeholder="Dutto" placeholderTextColor={C.ink3} />
          </Campo>
          <Campo etiqueta="Email" ayuda={nueva ? 'Con este email va a entrar a la app' : null}>
            <TextInput
              style={s.input} value={email} onChangeText={setEmail}
              placeholder="rocio@pasajeclub.com" placeholderTextColor={C.ink3}
              autoCapitalize="none" keyboardType="email-address"
            />
          </Campo>
          <Campo etiqueta="Telefono">
            <TextInput style={s.input} value={telefono} onChangeText={setTelefono} placeholder="351 555 1234" placeholderTextColor={C.ink3} keyboardType="phone-pad" />
          </Campo>
          <Campo etiqueta="Cumpleanos" ayuda="Opcional, lo puede cargar despues" ultima>
            <TextInput
              style={s.input} value={nacimiento}
              onChangeText={(t) => setNacimiento(formatearFecha(t, nacimiento))}
              placeholder="DD/MM/AAAA" placeholderTextColor={C.ink3}
              keyboardType="number-pad" maxLength={10}
            />
          </Campo>
        </Card>

        <Text style={s.seccion}>AREA</Text>
        <View style={s.chips}>
          {cat.areas.map((a) => (
            <Pressable key={a.id} onPress={() => setAreaId(areaId === a.id ? null : a.id)}
              style={[s.chip, areaId === a.id && s.chipOn]}>
              <Text style={[s.chipTxt, areaId === a.id && { color: '#fff' }]}>{a.nombre}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.seccion}>QUE VA A VER</Text>
        {cat.perfiles.map((p) => (
          <Pressable key={p.id} onPress={() => setPerfilId(p.id)} style={[s.perfil, perfilId === p.id && s.perfilOn]}>
            <MaterialIcons
              name={perfilId === p.id ? 'radio-button-checked' : 'radio-button-unchecked'}
              size={21} color={perfilId === p.id ? C.teal : C.ink3}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.perfilNom}>{p.nombre}</Text>
              {p.descripcion ? <Text style={s.perfilSub}>{p.descripcion}</Text> : null}
            </View>
          </Pressable>
        ))}

        {nueva ? (
          <>
            <Text style={s.seccion}>COMO RECIBE LA CONTRASENA</Text>
            <View style={s.seg}>
              <Pressable style={[s.segBtn, entrega === 'mostrar' && s.segOn]} onPress={() => setEntrega('mostrar')}>
                <MaterialIcons name="visibility" size={17} color={entrega === 'mostrar' ? '#fff' : C.ink2} />
                <Text style={[s.segTxt, entrega === 'mostrar' && { color: '#fff' }]}>Me la muestra</Text>
              </Pressable>
              <Pressable style={[s.segBtn, entrega === 'email' && s.segOn]} onPress={() => setEntrega('email')}>
                <MaterialIcons name="mail" size={17} color={entrega === 'email' ? '#fff' : C.ink2} />
                <Text style={[s.segTxt, entrega === 'email' && { color: '#fff' }]}>Por mail</Text>
              </Pressable>
            </View>
            <Text style={s.ayudaModo}>
              {entrega === 'mostrar'
                ? 'La vas a ver una sola vez y la podes compartir por WhatsApp.'
                : 'Le llega un mail con su usuario y una contrasena temporal.'}
            </Text>
          </>
        ) : null}

        <View style={{ marginTop: 22 }}>
          <Boton texto="Dar de alta" onPress={guardar} cargando={guardando} icono="check" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({ etiqueta, ayuda, children, ultima }) {
  return (
    <View style={[s.campo, !ultima && { borderBottomWidth: 1, borderBottomColor: C.lineSoft }]}>
      <Text style={s.label}>{etiqueta}</Text>
      {children}
      {ayuda ? <Text style={s.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 12,
  },
  segOn: { backgroundColor: C.navy, borderColor: C.navy },
  segTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  ayudaModo: { fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 18, paddingHorizontal: 2 },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, color: C.ink3, marginTop: 22, marginBottom: 9 },
  campo: { paddingHorizontal: 14, paddingVertical: 11 },
  label: { fontSize: 12.5, fontWeight: '600', color: C.ink2, marginBottom: 5 },
  ayuda: { fontSize: 11.5, color: C.ink3, marginTop: 5 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 11,
    height: 44, fontSize: 15, color: C.ink, backgroundColor: '#fff',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  perfil: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12, marginBottom: 8,
  },
  perfilOn: { borderColor: C.teal, backgroundColor: C.tealSoft },
  perfilNom: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  perfilSub: { fontSize: 11.5, color: C.ink3, marginTop: 2, lineHeight: 16 },
  cand: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 11, marginBottom: 7,
  },
  candOn: { borderColor: C.teal, backgroundColor: C.tealSoft },
  candNom: { fontSize: 14, fontWeight: '600', color: C.ink },
  candSub: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  vacio: { padding: 18, textAlign: 'center', color: C.ink3, fontSize: 13.5, lineHeight: 19 },
});
