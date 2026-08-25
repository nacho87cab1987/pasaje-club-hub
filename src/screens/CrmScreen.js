import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, RefreshControl,
  Animated, Modal, ScrollView, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { crmApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { filtros, estadoDe, cargarEstados, hayCatalogo } from '../estados';
import MenuContextual, { usarPosicionToque } from '../MenuContextual';
import { C, R, sombra, iniciales } from '../theme';



const COLOR_CANAL = {
  whatsapp: '#25D366',
  web: '#378ADD',
  manual: '#8AA0AB',
  instagram: '#D4537E',
  email: '#7F77DD',
};

export function cuando(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  if (h < 48) return 'ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

export default function CrmScreen({ navigation }) {
  const { boot } = useAuth();
  const crm = crmApi(boot && boot.credencial);

  const [items, setItems] = useState(null);
  const [contadores, setContadores] = useState({});
  const [error, setError] = useState(null);
  const [estado, setEstado] = useState('todas');
  const [q, setQ] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [listo, setListo] = useState(hayCatalogo());
  const [vendedores, setVendedores] = useState([]);
  const [vendedorId, setVendedorId] = useState(null);
  const [verVendedores, setVerVendedores] = useState(false);
  const esAdmin = !!(boot && boot.credencial === 'admin');
  const ctx = usarPosicionToque();
  const [avisoCatalogo, setAvisoCatalogo] = useState(null);

  // El catalogo de estados lo define el servidor: nombres, colores y orden.
  // Si no llega, el filtro se queda con un solo chip y sin explicacion, asi
  // que el motivo se muestra en pantalla.
  useEffect(() => {
    if (hayCatalogo()) return;
    crm.catalogoEstados()
      .then((r) => {
        if (!cargarEstados(r)) setAvisoCatalogo('El servidor no devolvio ningun estado.');
        setListo(true);
      })
      .catch((e) => { setAvisoCatalogo(`No pude cargar los estados: ${e.message}`); setListo(true); });
  }, []);

  const cargar = useCallback(async (est, busqueda) => {
    setError(null);
    try {
      const r = await crm.lista({
        ...(vendedorId ? { vendedor_id: vendedorId } : {}),
        estado: est || 'todas',
        ...(busqueda ? { q: busqueda } : {}),
      });
      setItems(r.items || []);
      // Un supervisor recibe su equipo dentro de la respuesta. El admin no:
      // para el se pide la lista completa por separado, una sola vez.
      if (r.vendedores_filtrables && r.vendedores_filtrables.length) {
        setVendedores(r.vendedores_filtrables);
      } else if (esAdmin && !vendedores.length) {
        crm.vendedores()
          .then((v) => setVendedores(v.items || []))
          .catch(() => {});
      }
      setContadores(r.contadores || {});
    } catch (e) {
      setError(e.message);
      setItems([]);
    }
  }, [boot && boot.credencial, vendedorId]);

  // Al volver de un chat pueden haber cambiado los no leidos.
  useEffect(() => navigation.addListener('focus', () => cargar(estado, q.trim())), [navigation, cargar, estado, q]);

  useEffect(() => {
    const t = setTimeout(() => cargar(estado, q.trim()), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [estado, q, cargar]);

  const alternarLeido = async (conv) => {
    const sinLeer = Number(conv.no_leidos_vendedor || conv.no_leidos_admin || 0) > 0;
    const antes = items;
    // Optimista: la lista responde al gesto, no a la red.
    setItems((xs) => xs.map((x) => (x.id === conv.id
      ? { ...x, no_leidos_vendedor: sinLeer ? 0 : 1, no_leidos_admin: sinLeer ? 0 : 1 }
      : x)));
    try {
      await (sinLeer ? crm.leida(conv.id) : crm.noLeida(conv.id));
      cargar(estado, q.trim());
    } catch (e) {
      setItems(antes);
      Alert.alert('No se pudo', e.message);
    }
  };

  const menuConversacion = (conv, nombre, sinLeer) => {
    ctx.abrir({
      titulo: nombre,
      subtitulo: [conv.codigo, conv.destino].filter(Boolean).join(' · ') || null,
      opciones: [
        {
          texto: sinLeer ? 'Marcar como leida' : 'Marcar como no leida',
          icono: sinLeer ? 'mark-email-read' : 'mark-email-unread',
          onPress: () => alternarLeido(conv),
        },
        {
          texto: 'Abrir conversacion',
          icono: 'open-in-new',
          onPress: () => navigation.navigate('CrmChat', { id: conv.id, nombre }),
        },
      ],
    });
  };

  const vendedorActual = vendedores.find((v) => v.id === vendedorId);

  if (items === null || !listo) return <Cargando texto="Cargando conversaciones" />;
  if (error && !items.length) return <ErrorBox mensaje={error} onReintentar={() => cargar(estado, q.trim())} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {vendedores.length > 1 || esAdmin ? (
        <Pressable style={s.filtroVend} onPress={() => setVerVendedores(true)}>
          <MaterialIcons name={vendedorActual ? 'person' : 'groups'} size={17} color={C.tealDeep} />
          <Text style={s.filtroVendTxt} numberOfLines={1}>
            {vendedorActual
              ? `${vendedorActual.nombre || ''} ${vendedorActual.apellido || ''}`.trim()
              : 'Todo el equipo'}
          </Text>
          <MaterialIcons name="expand-more" size={19} color={C.tealDeep} />
        </Pressable>
      ) : null}

      <View style={s.buscador}>
        <MaterialIcons name="search" size={20} color={C.ink3} />
        <TextInput
          style={s.input}
          placeholder="Buscar cliente, telefono o codigo"
          placeholderTextColor={C.ink3}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
        {q ? <MaterialIcons name="close" size={19} color={C.ink3} onPress={() => setQ('')} /> : null}
      </View>

      {avisoCatalogo ? (
        <Pressable style={s.aviso} onPress={() => { setListo(false); setAvisoCatalogo(null); }}>
          <MaterialIcons name="error-outline" size={17} color={C.bordo} />
          <Text style={s.avisoTxt}>{avisoCatalogo}</Text>
          <MaterialIcons name="refresh" size={17} color={C.bordo} />
        </Pressable>
      ) : null}

      <View style={s.chipsWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filtros()}
          keyExtractor={(e) => e.k}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 7 }}
          renderItem={({ item }) => {
            const n = item.k === 'todas' ? contadores.total : contadores[item.k];
            const on = estado === item.k;
            return (
              <Pressable onPress={() => setEstado(item.k)} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && { color: '#fff' }]}>
                  {item.nom}{n ? ` ${n}` : ''}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 6 }}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando}
            tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(estado, q.trim()); setRefrescando(false); }}
          />
        )}
        ListEmptyComponent={(
          <Vacio
            icono="forum"
            titulo={q ? 'Sin resultados' : 'Nada por aca'}
            texto={q ? `Ninguna conversacion coincide con "${q}".` : 'No tenes conversaciones en este estado.'}
          />
        )}
        renderItem={({ item }) => {
          const nombre = `${item.cliente_nombre || ''} ${item.cliente_apellido || ''}`.trim() || 'Sin nombre';
          const sinLeer = Number(item.no_leidos_vendedor || item.no_leidos_admin || 0);
          const canal = String(item.canal || 'manual').toLowerCase();
          const est = estadoDe(item.estado);
          return (
            <Pressable
              style={[s.conv, sombra, { borderLeftWidth: 4, borderLeftColor: est.color }]}
              onPress={() => navigation.navigate('CrmChat', { id: item.id, nombre })}
              onPressIn={ctx.alTocar}
              onLongPress={() => menuConversacion(item, nombre, sinLeer)}
              delayLongPress={330}
            >
              <View>
                <Avatar
                  texto={iniciales(item.cliente_nombre, item.cliente_apellido)}
                  tam={46}
                  fondo={canal === 'whatsapp' ? '#DFF7E6' : C.tealSoft}
                  color={canal === 'whatsapp' ? '#0F6E56' : C.tealDeep}
                />
                <View style={[s.canal, { backgroundColor: COLOR_CANAL[canal] || C.ink3 }]} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.linea}>
                  <Text style={[s.nombre, sinLeer > 0 && { fontWeight: '700' }]} numberOfLines={1}>
                    {nombre}
                  </Text>
                  <Text style={s.hora}>{cuando(item.ultimo_mensaje_en || item.creado_el)}</Text>
                </View>
                <View style={s.linea}>
                  <Text style={[s.preview, sinLeer > 0 && { color: C.ink, fontWeight: '500' }]} numberOfLines={1}>
                    {item.ultimo_mensaje_de === 'vendedor' ? 'Vos: ' : ''}
                    {item.ultimo_mensaje_preview || item.asunto || 'Sin mensajes'}
                  </Text>
                  {sinLeer > 0 ? (
                    <View style={s.badge}><Text style={s.badgeTxt}>{sinLeer}</Text></View>
                  ) : null}
                </View>
                <View style={s.pie}>
                  <View style={[s.estado, { backgroundColor: est.bg }]}>
                    <MaterialIcons name={est.icono} size={11} color={est.color} />
                    <Text style={[s.estadoTxt, { color: est.color }]}>{est.nom}</Text>
                  </View>
                  {item.destino || item.vendedor_nombre ? (
                    <Text style={s.meta} numberOfLines={1}>
                      {[item.codigo, item.destino, item.vendedor_nombre].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <MenuContextual
        visible={!!ctx.menu}
        x={ctx.menu && ctx.menu.x}
        y={ctx.menu && ctx.menu.y}
        titulo={ctx.menu && ctx.menu.titulo}
        subtitulo={ctx.menu && ctx.menu.subtitulo}
        opciones={ctx.menu && ctx.menu.opciones}
        onCerrar={ctx.cerrar}
      />

      <Modal visible={verVendedores} animationType="slide" transparent
        onRequestClose={() => setVerVendedores(false)}>
        <Pressable style={s.fondo} onPress={() => setVerVendedores(false)} />
        <View style={s.hoja}>
          <View style={s.hojaTop}>
            <Text style={s.hojaTit}>Ver conversaciones de</Text>
            <Pressable onPress={() => setVerVendedores(false)} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={C.ink3} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            <Pressable
              style={[s.opcion, !vendedorId && { backgroundColor: C.tealSoft }]}
              onPress={() => { setVendedorId(null); setVerVendedores(false); }}
            >
              <MaterialIcons name="groups" size={19} color={C.tealDeep} />
              <Text style={s.opcionT}>Todo el equipo</Text>
              {!vendedorId ? <MaterialIcons name="check" size={19} color={C.teal} /> : null}
            </Pressable>
            {vendedores.map((v) => {
              const nom = `${v.nombre || ''} ${v.apellido || ''}`.trim();
              return (
                <Pressable
                  key={v.id}
                  style={[s.opcion, vendedorId === v.id && { backgroundColor: C.tealSoft }]}
                  onPress={() => { setVendedorId(v.id); setVerVendedores(false); }}
                >
                  <MaterialIcons name="person" size={19} color={C.ink3} />
                  <Text style={s.opcionT}>{nom}</Text>
                  {vendedorId === v.id ? <MaterialIcons name="check" size={19} color={C.teal} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  filtroVend: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    backgroundColor: C.tealSoft, borderRadius: 18, paddingHorizontal: 13,
    paddingVertical: 8, marginTop: 14, marginHorizontal: 14, maxWidth: '92%',
  },
  filtroVendTxt: { fontSize: 13, fontWeight: '700', color: C.tealDeep, flexShrink: 1 },
  fondo: { flex: 1, backgroundColor: 'rgba(7,45,64,0.4)' },
  hoja: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  hojaTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  hojaTit: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.lineSoft,
  },
  opcionT: { flex: 1, fontSize: 14.5, fontWeight: '500', color: C.ink },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    margin: 14, marginTop: 10, marginBottom: 10, paddingHorizontal: 13, height: 46,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F6E3EA',
    marginHorizontal: 14, marginBottom: 8, padding: 11, borderRadius: R.md,
  },
  avisoTxt: { flex: 1, fontSize: 12.5, color: C.bordo, lineHeight: 17 },
  chipsWrap: { marginBottom: 4 },
  chip: {
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  conv: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 12, marginBottom: 8,
  },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  estadoTxt: { fontSize: 10, fontWeight: '700' },
  canal: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14,
    borderRadius: 7, borderWidth: 2, borderColor: '#fff',
  },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { flex: 1, fontSize: 15, fontWeight: '600', color: C.ink },
  hora: { fontSize: 11.5, color: C.ink3 },
  preview: { flex: 1, fontSize: 13, color: C.ink3, marginTop: 2 },
  meta: { flex: 1, fontSize: 11, color: C.ink3 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { color: C.navy, fontSize: 11, fontWeight: '700' },
});
