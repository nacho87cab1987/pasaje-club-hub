import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, RefreshControl,
  Alert, Share, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { presupuestos } from '../api/client';
import { Cargando, ErrorBox, Vacio, Tag } from '../components/UI';
import MenuContextual, { usarPosicionToque } from '../MenuContextual';
import { C, R, sombra } from '../theme';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-');
  if (!d) return iso;
  return `${parseInt(d, 10)} ${MESES[parseInt(m, 10) - 1]}`;
}

function rango(inicio, fin) {
  if (!inicio) return null;
  const a = fechaCorta(inicio);
  return fin ? `${a} al ${fechaCorta(fin)}` : a;
}

export default function PresupuestosScreen({ navigation, route }) {
  // Cuando se llega desde una conversacion del CRM, se elige uno y se manda
  // al chat en vez de abrir el detalle.
  const paraEnviar = route.params && route.params.conversacionId;

  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('mios');
  const [veTodo, setVeTodo] = useState(false);
  const [esSupervisor, setEsSupervisor] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const ctx = usarPosicionToque();

  const cargar = useCallback(async (busqueda) => {
    setError(null);
    try {
      const r = await presupuestos.listar({ q: busqueda, scope });
      setItems(r.items || []);
      // El servidor lo llama ve_todos: quien supervisa puede alternar entre
      // los propios y los de todo el equipo.
      // Son dos cosas distintas: una supervisora ve a su equipo, pero no
      // necesariamente a toda la agencia. Mezclarlas hacia que le apareciera
      // la opcion "Todos" mostrandole cosas que no le corresponden.
      setVeTodo(!!r.ve_todos);
      setEsSupervisor(!!r.es_supervisor);
    } catch (e) { setError(e.message); setItems([]); }
  }, [scope]);

  useEffect(() => {
    navigation.setOptions({ title: paraEnviar ? 'Elegí el presupuesto' : 'Presupuestos' });
  }, [navigation, paraEnviar]);

  useEffect(() => {
    const t = setTimeout(() => cargar(q.trim()), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, cargar]);

  /** Publica si hace falta y devuelve el link. */
  const obtenerLink = async (p) => {
    if (p.publicado && p.slug) return `https://pasajeclub.com.ar/p/${p.slug}`;
    const r = await presupuestos.publicar(p.id);
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, publicado: 1, slug: r.slug } : x)));
    return r.url;
  };

  const compartir = async (p) => {
    try {
      const url = await obtenerLink(p);
      await Share.share({
        message: `${p.destino || 'Tu presupuesto'} — Pasaje Club\n${url}`,
        url,
      });
    } catch (e) {
      Alert.alert('No se pudo compartir', e.message);
    }
  };

  const enviarAlChat = async (p) => {
    try {
      const url = await obtenerLink(p);
      // Vuelve al chat con el texto listo: la vendedora revisa y manda.
      navigation.navigate('CrmChat', {
        id: paraEnviar,
        textoInicial: `Te paso el presupuesto para ${p.destino}:\n${url}`,
      });
    } catch (e) {
      Alert.alert('No se pudo preparar el link', e.message);
    }
  };

  const menu = (p) => {
    ctx.abrir({
      titulo: p.destino || 'Presupuesto',
      subtitulo: [p.cliente_nombre, p.codigo].filter(Boolean).join(' · ') || null,
      opciones: [
        { texto: 'Compartir link', icono: 'ios-share', onPress: () => compartir(p) },
        {
          texto: 'Abrir en el navegador',
          icono: 'open-in-new',
          onPress: async () => {
            try { await Linking.openURL(await obtenerLink(p)); }
            catch (e) { Alert.alert('No se pudo abrir', e.message); }
          },
        },
        { texto: 'Duplicar', icono: 'content-copy', onPress: () => duplicar(p) },
      ],
    });
  };

  const duplicar = async (p) => {
    try {
      const r = await presupuestos.duplicar(p.id);
      await cargar(q.trim());
      Alert.alert(
        'Duplicado',
        'Se creó una copia sin los datos del cliente. Editala desde la web para ajustar el detalle.',
      );
      return r;
    } catch (e) { Alert.alert('No se pudo duplicar', e.message); }
  };

  if (error && !items?.length) return <ErrorBox mensaje={error} onReintentar={() => cargar(q.trim())} />;
  if (items === null) return <Cargando texto="Cargando presupuestos" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.buscador}>
        <MaterialIcons name="search" size={20} color={C.ink3} />
        <TextInput
          style={s.input} value={q} onChangeText={setQ}
          placeholder="Destino, cliente o codigo" placeholderTextColor={C.ink3}
        />
        {q ? <MaterialIcons name="close" size={19} color={C.ink3} onPress={() => setQ('')} /> : null}
      </View>

      {/* El selector aparece tambien para una supervisora, aunque no vea
          toda la agencia: necesita poder separar lo suyo de lo de su equipo. */}
      {veTodo || esSupervisor ? (
        <View style={s.scopes}>
          {[
            { k: 'mios', n: 'Míos' },
            ...(esSupervisor ? [{ k: 'equipo', n: 'Mi equipo' }] : []),
            ...(veTodo ? [{ k: 'todos', n: 'Todos' }] : []),
          ].map((o) => (
            <Pressable key={o.k} onPress={() => setScope(o.k)}
              style={[s.scope, scope === o.k && s.scopeOn]}>
              <Text style={[s.scopeTxt, scope === o.k && { color: C.navy, fontWeight: '700' }]}>
                {o.n}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 8, paddingBottom: 30 }}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(q.trim()); setRefrescando(false); }}
          />
        )}
        ListEmptyComponent={(
          <Vacio
            icono="request-quote"
            titulo={q ? 'Sin resultados' : 'Todavia no hay presupuestos'}
            texto={q ? `Nada coincide con "${q}".`
                     : 'Los presupuestos se arman desde la web y aca los compartis.'}
          />
        )}
        renderItem={({ item }) => (
          <Pressable
            style={[s.item, sombra]}
            onPress={() => (paraEnviar ? enviarAlChat(item) : menu(item))}
            onPressIn={ctx.alTocar}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.linea}>
                <Text style={s.destino} numberOfLines={1}>
                  {item.destino || 'Sin destino'}
                </Text>
                {item.publicado ? <Tag texto="Publicado" tipo="ok" /> : null}
              </View>

              <Text style={s.cliente} numberOfLines={1}>
                {item.cliente_nombre || 'Sin cliente'}
                {item.codigo ? ` · ${item.codigo}` : ''}
              </Text>

              <View style={s.meta}>
                {rango(item.fecha_in, item.fecha_out) ? (
                  <View style={s.metaItem}>
                    <MaterialIcons name="event" size={12} color={C.ink3} />
                    <Text style={s.metaTxt}>{rango(item.fecha_in, item.fecha_out)}</Text>
                  </View>
                ) : null}
                {item.base ? (
                  <View style={s.metaItem}>
                    <MaterialIcons name="sell" size={12} color={C.tealDeep} />
                    <Text style={[s.metaTxt, { color: C.tealDeep, fontWeight: '600' }]}>
                      {item.base}
                    </Text>
                  </View>
                ) : null}
                {/* Las vistas dicen si el cliente lo abrio: es el dato que
                    convierte un presupuesto enviado en un seguimiento. */}
                {item.vistas > 0 ? (
                  <View style={s.metaItem}>
                    <MaterialIcons name="visibility" size={12} color={C.ok} />
                    <Text style={[s.metaTxt, { color: C.ok }]}>
                      {item.vistas} {item.vistas === 1 ? 'vista' : 'vistas'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {scope === 'todos' && item.vendedor_nombre ? (
                <Text style={s.vendedor}>{item.vendedor_nombre}</Text>
              ) : null}
            </View>

            <MaterialIcons
              name={paraEnviar ? 'send' : 'more-vert'}
              size={paraEnviar ? 20 : 22}
              color={paraEnviar ? C.teal : C.ink3}
            />
          </Pressable>
        )}
        ListFooterComponent={!paraEnviar && items.length ? (
          <Text style={s.pie}>
            Los presupuestos se arman y editan en el panel web. Desde acá los
            compartís y duplicás.
          </Text>
        ) : null}
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
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    margin: 14, marginBottom: 6, paddingHorizontal: 13, height: 44,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  scopes: {
    flexDirection: 'row', gap: 4, backgroundColor: '#fff', marginHorizontal: 14,
    padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  scope: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  scopeOn: { backgroundColor: C.tealSoft },
  scopeTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 13, marginBottom: 9,
  },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  destino: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink },
  cliente: { fontSize: 12.5, color: C.ink2, marginTop: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 11.5, color: C.ink3 },
  vendedor: { fontSize: 11, color: C.ink3, marginTop: 5, fontStyle: 'italic' },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 18, lineHeight: 17, paddingHorizontal: 20 },
});
