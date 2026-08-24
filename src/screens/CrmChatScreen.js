import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { crmApi, imagenUrl, etiquetasApi } from '../api/client';
import { elegirImagenes } from '../imagenes';
import { useAuth } from '../context/AuthContext';
import { Cargando, ErrorBox, Tag } from '../components/UI';
import { ordenEstados, estadoDe, cargarEstados, hayCatalogo } from '../estados';
import { useGrabador, Reproductor, hayAudio, segundos } from '../audio';
import { C, R } from '../theme';
import { cuando } from './CrmScreen';



/**
 * Cuanto queda de la ventana de 24hs de WhatsApp. Fuera de esa ventana Meta
 * solo permite plantillas aprobadas, asi que hay que avisarlo ANTES de que
 * la persona escriba un mensaje largo y se lo rechacen.
 */
function ventanaWA(conv) {
  if (String(conv.canal).toLowerCase() !== 'whatsapp' || !conv.wa_phone) return null;
  const exp = conv.wa_session_expira_en;
  if (!exp) return { abierta: false };
  const ms = new Date(String(exp).replace(' ', 'T')).getTime() - Date.now();
  if (ms <= 0) return { abierta: false };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { abierta: true, texto: h >= 1 ? `${h} h` : `${m} min` };
}

/** El texto que acompana a un adjunto sin mensaje: no se muestra como texto. */
const esPlaceholder = (t) => String(t || '').startsWith('\uD83D\uDCCE');

const PALETA = ['#11BCB3', '#072D40', '#790F35', '#D7CA4A', '#185FA5',
                '#2e7d32', '#e53935', '#BA7517', '#7F77DD', '#8AA0AB'];

export default function CrmChatScreen({ route, navigation }) {
  const { id } = route.params;
  const { boot } = useAuth();
  const crm = crmApi(boot && boot.credencial);

  const [conv, setConv] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState(route.params?.textoInicial || '');

  // Al volver de elegir un presupuesto, el link llega listo para revisar y
  // mandar. No se envia solo: la vendedora decide que decir alrededor.
  useEffect(() => {
    const t = route.params?.textoInicial;
    if (t) {
      setTexto(t);
      navigation.setParams({ textoInicial: undefined });
    }
  }, [route.params?.textoInicial]);
  const [enviando, setEnviando] = useState(false);
  const [modoNota, setModoNota] = useState(false);
  const [plantillas, setPlantillas] = useState([]);
  const [verPlantillas, setVerPlantillas] = useState(false);
  const [etiquetas, setEtiquetas] = useState([]);
  const [verEtiquetas, setVerEtiquetas] = useState(false);
  const [falla, setFalla] = useState({});
  const [nuevaEti, setNuevaEti] = useState('');
  const [colorEti, setColorEti] = useState(PALETA[0]);
  const [creandoEti, setCreandoEti] = useState(false);
  const [misEtiquetas, setMisEtiquetas] = useState([]);
  const [verFicha, setVerFicha] = useState(false);
  const [adjuntos, setAdjuntos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const lista = useRef(null);
  const grabador = useGrabador();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await crm.get(id);
      setConv(r.conversacion);
      setMensajes(r.mensajes || []);
      try {
        const e = r.conversacion.etiquetas;
        setMisEtiquetas(typeof e === 'string' ? (JSON.parse(e) || []) : (e || []));
      } catch { setMisEtiquetas([]); }
    } catch (e) {
      setError(e.message);
    }
  }, [id, boot && boot.credencial]);

  useEffect(() => { cargar(); }, [cargar]);

  // Plantillas y etiquetas se piden una sola vez: no cambian seguido.
  useEffect(() => {
    if (!hayCatalogo()) crm.catalogoEstados().then(cargarEstados).catch(() => {});
    crm.plantillas()
      .then((r) => setPlantillas(r.items || []))
      .catch((e) => setFalla((f) => ({ ...f, plantillas: e.message })));
    crm.etiquetas()
      .then((r) => setEtiquetas(r.items || []))
      .catch((e) => setFalla((f) => ({ ...f, etiquetas: e.message })));
  }, []);

  const usarPlantilla = (p) => {
    setTexto((t) => (t ? `${t} ${p.contenido}` : p.contenido));
    setVerPlantillas(false);
    crm.usoPlantilla(p.id).catch(() => {});
  };

  const crearEtiqueta = async () => {
    const nombre = nuevaEti.trim();
    if (!nombre) return;
    setCreandoEti(true);
    try {
      await etiquetasApi.crear(nombre, colorEti);
      const r = await crm.etiquetas();
      setEtiquetas(r.items || []);
      setFalla((f) => ({ ...f, etiquetas: null }));
      setNuevaEti('');
      // Al crearla desde una conversacion, lo esperable es que quede puesta.
      await alternarEtiqueta(nombre);
    } catch (e) {
      Alert.alert('No se pudo crear', e.message);
    } finally {
      setCreandoEti(false);
    }
  };

  const alternarEtiqueta = async (nombre) => {
    const nuevas = misEtiquetas.includes(nombre)
      ? misEtiquetas.filter((x) => x !== nombre)
      : [...misEtiquetas, nombre];
    setMisEtiquetas(nuevas);
    try { await crm.ponerEtiquetas(id, nuevas); }
    catch (e) { setMisEtiquetas(misEtiquetas); Alert.alert('No se pudo', e.message); }
  };

  const grabar = async () => {
    const r = await grabador.arrancar();
    if (r === 'sin_permiso') {
      Alert.alert('Sin microfono', 'Habilita el permiso desde los ajustes del telefono.');
    } else if (r !== true) {
      Alert.alert('No se pudo grabar', 'Proba de nuevo en un momento.');
    }
  };

  const soltarAudio = async () => {
    const audio = await grabador.parar();
    if (!audio) return;   // muy corto o fallo
    setSubiendo(true);
    try {
      const subido = await crm.subirAdjunto(audio, id, audio.duracion);
      setAdjuntos((x) => [...x, { ...subido, duracion: audio.duracion }]);
    } catch (e) {
      Alert.alert('No se pudo subir el audio', e.message);
    } finally {
      setSubiendo(false);
    }
  };

  const adjuntar = async (camara) => {
    const assets = await elegirImagenes({ camara, maximo: 3 });
    if (!assets.length) return;
    setSubiendo(true);
    for (const a of assets) {
      try {
        const subido = await crm.subirAdjunto(a, id);
        setAdjuntos((x) => [...x, subido]);
      } catch (e) {
        // Que falle una no debe cortar las otras.
        Alert.alert('No se pudo subir', e.message);
      }
    }
    setSubiendo(false);
  };

  useEffect(() => {
    if (conv) {
      const n = `${conv.cliente_nombre || ''} ${conv.cliente_apellido || ''}`.trim();
      navigation.setOptions({
        title: n || route.params.nombre || 'Conversacion',
        headerRight: () => (
          <Pressable onPress={menuPrincipal} hitSlop={10}>
            <MaterialIcons name="more-vert" size={22} color={C.navy} />
          </Pressable>
        ),
      });
    }
  }, [conv, navigation]);

  const menuPrincipal = () => {
    Alert.alert('Conversacion', null, [
      // Lo mas util del modulo: estas hablando con el cliente y le mandas
      // el presupuesto sin salir de la conversacion.
      { text: 'Enviar presupuesto',
        onPress: () => navigation.navigate('Presupuestos', { conversacionId: id }) },
      { text: 'Datos del cliente', onPress: () => setVerFicha(true) },
      { text: 'Etiquetas', onPress: () => setVerEtiquetas(true) },
      { text: 'Cambiar estado', onPress: cambiarEstado },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const cambiarEstado = () => {
    if (!conv) return;
    Alert.alert('Cambiar estado', `Ahora: ${conv.estado}`,
      [
        ...ordenEstados().filter((e) => e !== conv.estado).map((e) => ({
          text: estadoDe(e).nom,
          onPress: async () => {
            try { await crm.estado(id, e); await cargar(); }
            catch (err) { Alert.alert('No se pudo', err.message); }
          },
        })),
        { text: 'Cancelar', style: 'cancel' },
      ]);
  };

  const enviar = async () => {
    let contenido = texto.trim();
    if (!contenido && !adjuntos.length) return;

    // Un mensaje que es solo un adjunto igual necesita texto: el servidor
    // exige contenido. La convencion que ya usa el panel es un placeholder
    // que arranca con el clip, y crm_conversaciones.php lo reconoce para no
    // mandarlo como mensaje de texto aparte al cliente.
    if (!contenido) {
      const tipos = adjuntos.map((a) => a.tipo);
      const soloAudio = tipos.every((t) => t === 'audio');
      const soloFotos = tipos.every((t) => t === 'imagen');
      contenido = soloAudio ? '\uD83D\uDCCE Audio'
                : soloFotos ? (adjuntos.length > 1 ? '\uD83D\uDCCE Fotos' : '\uD83D\uDCCE Foto')
                : '\uD83D\uDCCE Adjunto';
    }

    setEnviando(true);
    try {
      const ids = adjuntos.map((a) => a.adjunto_id);
      if (modoNota) {
        await crm.nota(id, contenido, ids);
      } else {
        const r = await crm.responder(id, contenido, ids);
        // El envio a WhatsApp puede fallar aunque el mensaje se guarde.
        if (r.wa && r.wa.enviado_ok === false) {
          Alert.alert('El mensaje quedo guardado', r.wa.error || 'No se pudo entregar por WhatsApp.');
        }
      }
      setTexto('');
      setAdjuntos([]);
      await cargar();
      setTimeout(() => lista.current && lista.current.scrollToEnd({ animated: true }), 250);
    } catch (e) {
      Alert.alert('No se pudo enviar', e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!conv) return <Cargando texto="Abriendo conversacion" />;

  const wa = ventanaWA(conv);
  const bloqueado = wa && !wa.abierta && !modoNota;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      <View style={s.cabecera}>
        <Pressable onPress={cambiarEstado} style={[s.estado, { backgroundColor: estadoDe(conv.estado).bg }]}>
          <MaterialIcons name={estadoDe(conv.estado).icono} size={13} color={estadoDe(conv.estado).color} />
          <Text style={[s.estadoTxt, { color: estadoDe(conv.estado).color }]}>
            {estadoDe(conv.estado).nom}
          </Text>
        </Pressable>
        {conv.codigo ? <Text style={s.meta}>{conv.codigo}</Text> : null}
        {conv.destino ? <Text style={s.meta}>· {conv.destino}</Text> : null}
        {misEtiquetas.map((e) => {
          const cfg = etiquetas.find((x) => x.nombre === e);
          return (
            <View key={e} style={[s.eti, { backgroundColor: (cfg && cfg.color) || C.tealDeep }]}>
              <Text style={s.etiTxt}>{e}</Text>
            </View>
          );
        })}
        {wa ? (
          <View style={[s.wa, !wa.abierta && { backgroundColor: '#F6E3EA' }]}>
            <MaterialIcons name={wa.abierta ? 'schedule' : 'lock'} size={12} color={wa.abierta ? '#0F6E56' : C.bordo} />
            <Text style={[s.waTxt, !wa.abierta && { color: C.bordo }]}>
              {wa.abierta ? `Ventana ${wa.texto}` : 'Ventana cerrada'}
            </Text>
          </View>
        ) : null}
      </View>

      <FlatList
        ref={lista}
        data={mensajes}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 14 }}
        onContentSizeChange={() => lista.current && lista.current.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const nota = item.autor_tipo === 'nota' || item.direccion === 'nota';
          const mio = item.direccion === 'saliente';
          if (nota) {
            return (
              <View style={s.nota}>
                <MaterialIcons name="sticky-note-2" size={14} color="#854F0B" />
                <Text style={s.notaTxt}>{item.contenido}</Text>
              </View>
            );
          }
          return (
            <View style={[s.burbujaWrap, mio ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
              <View style={[s.burbuja, mio ? s.mia : s.suya]}>
                {(item.adjuntos || []).map((a) => (
                  a.tipo === 'imagen' ? (
                    <Image key={a.id} source={{ uri: imagenUrl(a.archivo_path) }} style={s.adjImg} />
                  ) : a.tipo === 'audio' ? (
                    <Reproductor key={a.id} uri={imagenUrl(a.archivo_path)} claro={mio} />
                  ) : (
                    <View key={a.id} style={s.adjDoc}>
                      <MaterialIcons name="description" size={19} color={mio ? '#fff' : C.tealDeep} />
                      <Text style={[s.adjDocTxt, mio && { color: '#fff' }]} numberOfLines={1}>
                        {a.nombre_original || 'Archivo'}
                      </Text>
                    </View>
                  )
                ))}
                {item.contenido && !esPlaceholder(item.contenido) ? (
                  <Text style={[s.msg, mio && { color: '#fff' }]}>{item.contenido}</Text>
                ) : null}
              </View>
              <View style={s.pie}>
                <Text style={s.hora}>{cuando(item.creado_el)}</Text>
                {mio && item.wa_status ? (
                  <MaterialIcons
                    name={item.wa_status === 'read' ? 'done-all'
                        : item.wa_status === 'failed' ? 'error-outline' : 'done'}
                    size={13}
                    color={item.wa_status === 'failed' ? C.bordo : C.ink3}
                  />
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {bloqueado ? (
        <View style={s.avisoWA}>
          <MaterialIcons name="info-outline" size={17} color={C.bordo} />
          <Text style={s.avisoWATxt}>
            Pasaron mas de 24 hs desde el ultimo mensaje del cliente. Para reabrir hay que
            mandar una plantilla aprobada desde el panel web.
          </Text>
        </View>
      ) : null}

      {adjuntos.length || subiendo ? (
        <ScrollView horizontal style={s.adjBarra} showsHorizontalScrollIndicator={false}>
          {adjuntos.map((a, i) => (
            <View key={a.adjunto_id} style={s.adjMini}>
              {a.tipo === 'imagen'
                ? <Image source={{ uri: a.url }} style={s.adjMiniImg} />
                : (
                  <View style={[s.adjMiniImg, s.adjMiniDoc]}>
                    <MaterialIcons name={a.tipo === 'audio' ? 'mic' : 'description'} size={22} color={C.tealDeep} />
                    {a.duracion ? <Text style={s.adjDur}>{segundos(a.duracion)}</Text> : null}
                  </View>
                )}
              <Pressable style={s.adjQuitar} onPress={() => setAdjuntos(adjuntos.filter((_, j) => j !== i))}>
                <MaterialIcons name="close" size={13} color="#fff" />
              </Pressable>
            </View>
          ))}
          {subiendo ? <View style={s.adjMini}><ActivityIndicator color={C.teal} /></View> : null}
        </ScrollView>
      ) : null}

      {grabador.grabando ? (
        <View style={s.grabando}>
          <View style={s.puntoRojo} />
          <Text style={s.grabandoTxt}>Grabando {segundos(grabador.seg)}</Text>
          <Pressable onPress={grabador.cancelar} style={s.cancelar}>
            <Text style={s.cancelarTxt}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={soltarAudio} style={s.listo}>
            <MaterialIcons name="check" size={19} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <View style={s.barra}>
        <Pressable onPress={() => setModoNota(!modoNota)} hitSlop={8} style={[s.notaBtn, modoNota && s.notaBtnOn]}>
          <MaterialIcons name="sticky-note-2" size={19} color={modoNota ? '#854F0B' : C.ink3} />
        </Pressable>
        <Pressable onPress={() => adjuntar(false)} hitSlop={8} style={s.notaBtn}>
          <MaterialIcons name="attach-file" size={19} color={C.ink3} />
        </Pressable>
        <Pressable onPress={() => setVerPlantillas(true)} hitSlop={8} style={s.notaBtn}>
          <MaterialIcons name="bolt" size={19} color={C.ink3} />
        </Pressable>
        <TextInput
          style={[s.input, modoNota && s.inputNota]}
          value={texto}
          onChangeText={setTexto}
          placeholder={modoNota ? 'Nota interna (no la ve el cliente)' : 'Escribi tu respuesta'}
          placeholderTextColor={C.ink3}
          multiline
          editable={!bloqueado || modoNota}
        />
        {!texto.trim() && !adjuntos.length && !grabador.grabando ? (
          <Pressable
            onPress={grabador.disponible ? grabar : () => Alert.alert(
              'Falta instalar el modulo de audio',
              'En la carpeta del proyecto corre:\n\nnpx expo install expo-audio\n\ny volve a escanear el QR.',
            )}
            disabled={bloqueado && !modoNota}
            style={[s.enviar, (bloqueado && !modoNota) && { opacity: 0.4 },
                    !grabador.disponible && { backgroundColor: C.ink3 }]}
          >
            <MaterialIcons name="mic" size={20} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            onPress={enviar}
            disabled={(!texto.trim() && !adjuntos.length) || enviando || (bloqueado && !modoNota)}
            style={[s.enviar, modoNota && { backgroundColor: '#854F0B' },
                    ((!texto.trim() && !adjuntos.length) || enviando || (bloqueado && !modoNota)) && { opacity: 0.4 }]}
          >
            {enviando ? <ActivityIndicator color="#fff" size="small" />
                      : <MaterialIcons name="send" size={19} color="#fff" />}
          </Pressable>
        )}
      </View>
      <Hoja visible={verPlantillas} onCerrar={() => setVerPlantillas(false)} titulo="Respuestas rapidas">
        {falla.plantillas ? (
          <Text style={s.hojaVacio}>No pude cargarlas: {falla.plantillas}</Text>
        ) : !plantillas.length ? (
          <Text style={s.hojaVacio}>
            Todavia no hay respuestas rapidas. Se crean desde el panel web, en
            Config plantillas.
          </Text>
        ) : null}
        {Object.entries(plantillas.reduce((acc, p) => {
          const k = p.categoria || 'General';
          (acc[k] = acc[k] || []).push(p);
          return acc;
        }, {})).map(([cat, items]) => (
          <View key={cat}>
            <Text style={s.hojaCat}>{cat.toUpperCase()}</Text>
            {items.map((p) => (
              <Pressable key={p.id} style={s.plantilla} onPress={() => usarPlantilla(p)}>
                <View style={{ flex: 1 }}>
                  <View style={s.plantillaTop}>
                    <Text style={s.plantillaTit}>{p.titulo}</Text>
                    {p.atajo ? <Text style={s.atajo}>{p.atajo}</Text> : null}
                  </View>
                  <Text style={s.plantillaTxt} numberOfLines={2}>{p.contenido}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </Hoja>

      <Hoja visible={verEtiquetas} onCerrar={() => setVerEtiquetas(false)} titulo="Etiquetas">
        {falla.etiquetas ? (
          <Text style={s.hojaVacio}>No pude cargarlas: {falla.etiquetas}</Text>
        ) : !etiquetas.length ? (
          <Text style={s.hojaVacio}>
            Todavia no hay etiquetas creadas. Se crean desde el panel web, en
            Config plantillas, y despues aparecen aca.
          </Text>
        ) : null}
        <View style={s.etiNueva}>
          <TextInput
            style={s.etiInput}
            value={nuevaEti}
            onChangeText={setNuevaEti}
            placeholder="Nueva etiqueta"
            placeholderTextColor={C.ink3}
            maxLength={60}
            onSubmitEditing={crearEtiqueta}
            returnKeyType="done"
          />
          <Pressable
            onPress={crearEtiqueta}
            disabled={!nuevaEti.trim() || creandoEti}
            style={[s.etiAdd, { backgroundColor: colorEti }, (!nuevaEti.trim() || creandoEti) && { opacity: 0.4 }]}
          >
            {creandoEti ? <ActivityIndicator color="#fff" size="small" />
                        : <MaterialIcons name="add" size={20} color="#fff" />}
          </Pressable>
        </View>
        <View style={s.paleta}>
          {PALETA.map((c) => (
            <Pressable key={c} onPress={() => setColorEti(c)}
              style={[s.color, { backgroundColor: c }, colorEti === c && s.colorOn]} />
          ))}
        </View>

        <View style={s.etiGrid}>
          {etiquetas.map((e) => {
            const on = misEtiquetas.includes(e.nombre);
            return (
              <Pressable key={e.id} onPress={() => alternarEtiqueta(e.nombre)}
                style={[s.etiChip, on && { backgroundColor: e.color || C.teal, borderColor: e.color || C.teal }]}>
                <Text style={[s.etiChipTxt, on && { color: '#fff' }]}>{e.nombre}</Text>
              </Pressable>
            );
          })}
        </View>
      </Hoja>

      <FichaCliente
        visible={verFicha}
        conv={conv}
        onCerrar={() => setVerFicha(false)}
        onGuardar={async (datos) => {
          try { await crm.editarCliente(id, datos); setVerFicha(false); await cargar(); }
          catch (e) { Alert.alert('No se pudo guardar', e.message); }
        }}
      />
    </KeyboardAvoidingView>
  );
}

/** Panel que sube desde abajo. Mas comodo que una pantalla nueva para algo
 *  que se usa y se cierra en dos segundos. */
function Hoja({ visible, onCerrar, titulo, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <Pressable style={s.fondo} onPress={onCerrar} />
      <View style={s.hoja}>
        <View style={s.hojaTop}>
          <Text style={s.hojaTit}>{titulo}</Text>
          <Pressable onPress={onCerrar} hitSlop={10}>
            <MaterialIcons name="close" size={22} color={C.ink3} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function FichaCliente({ visible, conv, onCerrar, onGuardar }) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [destino, setDestino] = useState('');
  const [presupuesto, setPresupuesto] = useState('');

  useEffect(() => {
    if (!visible || !conv) return;
    setNombre(conv.cliente_nombre || '');
    setApellido(conv.cliente_apellido || '');
    setTelefono(conv.cliente_telefono || '');
    setEmail(conv.cliente_email || '');
    setDestino(conv.destino || '');
    setPresupuesto(String(conv.presupuesto || ''));
  }, [visible, conv]);

  return (
    <Hoja visible={visible} onCerrar={onCerrar} titulo="Datos del cliente">
      {[
        ['Nombre', nombre, setNombre, 'default'],
        ['Apellido', apellido, setApellido, 'default'],
        ['Telefono', telefono, setTelefono, 'phone-pad'],
        ['Email', email, setEmail, 'email-address'],
        ['Destino', destino, setDestino, 'default'],
        ['Presupuesto', presupuesto, setPresupuesto, 'default'],
      ].map(([et, val, set, kb]) => (
        <View key={et} style={s.campo}>
          <Text style={s.campoLabel}>{et}</Text>
          <TextInput
            style={s.campoInput}
            value={val}
            onChangeText={set}
            keyboardType={kb}
            autoCapitalize={kb === 'email-address' ? 'none' : 'sentences'}
            placeholderTextColor={C.ink3}
          />
        </View>
      ))}
      <Pressable
        style={s.guardar}
        onPress={() => onGuardar({
          cliente_nombre: nombre, cliente_apellido: apellido, cliente_telefono: telefono,
          cliente_email: email, destino, presupuesto,
        })}
      >
        <Text style={s.guardarTxt}>Guardar</Text>
      </Pressable>
    </Hoja>
  );
}

const s = StyleSheet.create({
  etiNueva: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingTop: 14 },
  etiInput: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: R.md,
    paddingHorizontal: 12, height: 42, fontSize: 15, color: C.ink,
  },
  etiAdd: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  paleta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 11 },
  color: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  colorOn: { borderColor: C.ink, transform: [{ scale: 1.15 }] },
  hojaVacio: { padding: 20, fontSize: 13.5, color: C.ink3, lineHeight: 20, textAlign: 'center' },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  estadoTxt: { fontSize: 11, fontWeight: '700' },
  grabando: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FCEBEB',
    paddingHorizontal: 14, paddingVertical: 11, marginHorizontal: 11, borderRadius: R.md, marginBottom: 6,
  },
  puntoRojo: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e53935' },
  grabandoTxt: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#a02020' },
  cancelar: { paddingHorizontal: 10, paddingVertical: 6 },
  cancelarTxt: { fontSize: 13, color: C.ink3, fontWeight: '600' },
  listo: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  adjDur: { fontSize: 9.5, color: C.tealDeep, marginTop: 2, fontWeight: '700' },
  eti: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  etiTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  adjImg: { width: 210, height: 150, borderRadius: 10, marginBottom: 6, backgroundColor: C.lineSoft },
  adjDoc: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  adjDocTxt: { fontSize: 13, color: C.ink, flex: 1 },
  adjBarra: { maxHeight: 84, paddingHorizontal: 11, paddingTop: 9, backgroundColor: '#fff' },
  adjMini: { marginRight: 8, width: 66, height: 66 },
  adjMiniImg: { width: 66, height: 66, borderRadius: 10, backgroundColor: C.lineSoft },
  adjMiniDoc: { alignItems: 'center', justifyContent: 'center' },
  adjQuitar: {
    position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(7,45,64,0.82)', alignItems: 'center', justifyContent: 'center',
  },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.4)' },
  hoja: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '76%', paddingTop: 6,
  },
  hojaTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hojaTit: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  hojaCat: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.ink3, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  plantilla: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  plantillaTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plantillaTit: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  atajo: { fontSize: 11, color: C.tealDeep, fontWeight: '700', backgroundColor: C.tealSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  plantillaTxt: { fontSize: 13, color: C.ink3, marginTop: 3, lineHeight: 18 },
  etiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  etiChip: { borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  etiChipTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  campo: { paddingHorizontal: 16, paddingVertical: 9 },
  campoLabel: { fontSize: 12, fontWeight: '600', color: C.ink2, marginBottom: 5 },
  campoInput: {
    borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 11,
    height: 42, fontSize: 15, color: C.ink,
  },
  guardar: { backgroundColor: C.navy, margin: 16, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  guardarTxt: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cabecera: {
    flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap',
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  meta: { fontSize: 11.5, color: C.ink3 },
  wa: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DFF7E6',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 'auto',
  },
  waTxt: { fontSize: 10.5, fontWeight: '700', color: '#0F6E56' },
  burbujaWrap: { marginBottom: 11 },
  burbuja: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  mia: { backgroundColor: C.navy, borderBottomRightRadius: 4 },
  suya: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msg: { fontSize: 14.5, lineHeight: 20, color: C.ink },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: 4 },
  hora: { fontSize: 10.5, color: C.ink3 },
  nota: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FAEEDA',
    borderRadius: R.md, padding: 11, marginBottom: 11,
  },
  notaTxt: { flex: 1, fontSize: 13, color: '#854F0B', lineHeight: 18 },
  avisoWA: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F6E3EA',
    padding: 12, marginHorizontal: 11, borderRadius: R.md, marginBottom: 6,
  },
  avisoWATxt: { flex: 1, fontSize: 12, color: C.bordo, lineHeight: 17 },
  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 11,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line,
  },
  notaBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.line,
  },
  notaBtnOn: { backgroundColor: '#FAEEDA', borderColor: '#E2C68A' },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 20,
    paddingHorizontal: 15, paddingVertical: 10, fontSize: 15, color: C.ink, maxHeight: 110,
  },
  inputNota: { backgroundColor: '#FDF8EE', borderColor: '#E2C68A' },
  enviar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
});
