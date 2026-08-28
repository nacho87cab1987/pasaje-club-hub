import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl, ActivityIndicator,
  Image, Dimensions, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { muro, perfil as perfilApi, imagenUrl, notificaciones } from '../api/client';
import { ponerBadge } from '../push';
import VisorImagen from '../VisorImagen';
import { abrirArchivo } from '../archivos';
import MenuContextual, { usarPosicionToque } from '../MenuContextual';
import { useAuth } from '../context/AuthContext';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

const EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F44F}', '\u{1F525}'];

/** "Hace 3 h", "Ayer", "12 ago" — como lo lee la gente, no una fecha ISO. */
function cuando(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'Recien';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  if (h < 48) return 'Ayer';
  const dias = Math.floor(h / 24);
  if (dias < 7) return `Hace ${dias} dias`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function InicioScreen({ navigation }) {
  const { persona, puede } = useAuth();
  const [items, setItems] = useState(null);
  const [cumples, setCumples] = useState([]);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [masCargando, setMasCargando] = useState(false);
  const [siguiente, setSiguiente] = useState(null);
  const vistos = useRef(new Set());
  const [sinLeer, setSinLeer] = useState(0);
  const [viendo, setViendo] = useState(null);
  const ctx = usarPosicionToque();

  // La campanita con el contador: sin eso, las notificaciones existen pero
  // no hay forma de volver a verlas desde la app.
  useEffect(() => navigation.setOptions({
    headerRight: () => (
      <Pressable onPress={() => navigation.navigate('Notificaciones')} hitSlop={10} style={{ marginRight: 4 }}>
        <MaterialIcons name="notifications-none" size={24} color={C.navy} />
        {sinLeer > 0 ? (
          <View style={s.campana}>
            <Text style={s.campanaN}>{sinLeer > 9 ? '9+' : sinLeer}</Text>
          </View>
        ) : null}
      </Pressable>
    ),
  }), [navigation, sinLeer]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [f, c, n] = await Promise.all([
        muro.feed(),
        perfilApi.cumples(30).catch(() => ({ items: [] })),
        notificaciones.listar().catch(() => null),
      ]);
      setItems(f.items);
      setSiguiente(f.siguiente);
      setCumples(c.items || []);
      if (n) { setSinLeer(n.no_leidas || 0); ponerBadge(n.no_leidas || 0); }
    } catch (e) {
      setError(e.message);
      setItems([]);
    }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const masViejos = async () => {
    if (!siguiente || masCargando) return;
    setMasCargando(true);
    try {
      const r = await muro.feed({ antes_de: siguiente });
      setItems((x) => [...x, ...r.items]);
      setSiguiente(r.siguiente);
    } catch { /* si falla, alcanza con volver a bajar */ }
    setMasCargando(false);
  };

  // Vistos en lote y una sola vez por post: una llamada por cada post que
  // cruza la pantalla seria una tormenta de requests al hacer scroll.
  const alVerItems = useRef(({ viewableItems }) => {
    const nuevos = viewableItems
      .map((v) => v.item && v.item.id)
      .filter((id) => id && !vistos.current.has(id));
    if (!nuevos.length) return;
    nuevos.forEach((id) => vistos.current.add(id));
    muro.visto(nuevos).catch(() => {});
  }).current;

  const reaccionar = async (post, emoji) => {
    const previo = { mi: post.mi_reaccion, total: post.reacciones };
    const saca = post.mi_reaccion === emoji;
    setItems((xs) => xs.map((p) => (p.id === post.id
      ? {
          ...p,
          mi_reaccion: saca ? null : emoji,
          reacciones: p.reacciones + (saca ? -1 : (previo.mi ? 0 : 1)),
        }
      : p)));
    try {
      const r = await muro.reaccionar(post.id, saca ? '' : emoji);
      setItems((xs) => xs.map((p) => (p.id === post.id
        ? { ...p, mi_reaccion: r.mi_reaccion, reacciones: r.reacciones } : p)));
    } catch {
      setItems((xs) => xs.map((p) => (p.id === post.id
        ? { ...p, mi_reaccion: previo.mi, reacciones: previo.total } : p)));
    }
  };

  const eliminar = (post) => {
    Alert.alert(
      'Eliminar publicacion',
      post.autor.soy_yo
        ? 'Se va a ocultar para todo el equipo. No se puede deshacer desde la app.'
        : `Vas a ocultar la publicacion de ${post.autor.nombre}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            // Sale de la lista al instante; si el servidor rechaza, vuelve.
            const respaldo = items;
            setItems((xs) => xs.filter((p) => p.id !== post.id));
            try {
              await muro.ocultar(post.id);
            } catch (e) {
              setItems(respaldo);
              Alert.alert('No se pudo eliminar', e.message);
            }
          },
        },
      ],
    );
  };

  const fijar = async (post) => {
    const nuevo = !post.fijado;
    setItems((xs) => xs.map((p) => (p.id === post.id ? { ...p, fijado: nuevo } : p)));
    try {
      await muro.fijar(post.id, nuevo);
      await cargar();   // el fijado cambia el orden del feed
    } catch (e) {
      setItems((xs) => xs.map((p) => (p.id === post.id ? { ...p, fijado: !nuevo } : p)));
      Alert.alert('No se pudo', e.message);
    }
  };

  const menu = (post) => {
    const opciones = [];
    if (puede('muro.fijar')) {
      opciones.push({
        texto: post.fijado ? 'Desfijar del muro' : 'Fijar arriba',
        icono: post.fijado ? 'push-pin' : 'push-pin',
        onPress: () => fijar(post),
      });
    }
    if (post.autor.soy_yo || puede('muro.moderar')) {
      opciones.push({
        texto: 'Eliminar publicacion',
        icono: 'delete-outline',
        destructivo: true,
        onPress: () => eliminar(post),
      });
    }
    if (!opciones.length) return;
    ctx.abrir({
      titulo: post.autor.nombre,
      subtitulo: post.titulo || null,
      opciones,
    });
  };

  // Solo mostramos los tres puntitos si hay algo que hacer con ese post.
  const tieneMenu = (post) => post.autor.soy_yo || puede('muro.moderar') || puede('muro.fijar');

  if (items === null) return <Cargando texto="Cargando el muro" />;
  if (error && !items.length) return <ErrorBox mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={items}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
        onViewableItemsChanged={alVerItems}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onEndReached={masViejos}
        onEndReachedThreshold={0.4}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando}
            tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
          />
        )}
        ListHeaderComponent={(
          <>
            {cumples.length ? <Cumples items={cumples} onVerTodos={() => navigation.navigate('Cumpleanos')} /> : null}
            <Pressable style={[s.componer, sombra]} onPress={() => navigation.navigate('CrearPost')}>
              <Avatar texto={iniciales(persona && persona.nombre, persona && persona.apellido)} tam={34} />
              <Text style={s.componerTxt}>Compartí algo con el equipo</Text>
              <MaterialIcons name="edit" size={19} color={C.tealDeep} />
            </Pressable>
          </>
        )}
        ListEmptyComponent={(
          <Vacio icono="forum" titulo="Todavia no hay nada" texto="Sé el primero en publicar algo." />
        )}
        ListFooterComponent={masCargando ? <ActivityIndicator color={C.teal} style={{ marginTop: 16 }} /> : null}
        renderItem={({ item }) => (
          <Post
            post={item}
            onReaccion={reaccionar}
            onAbrir={() => navigation.navigate('Post', { id: item.id })}
            onAmpliar={(m) => (m.tipo === 'video'
              ? abrirArchivo(imagenUrl(m.url), m.nombre)
              : setViendo({ uri: imagenUrl(m.url), nombre: m.nombre }))}
            onMenu={tieneMenu(item) ? () => menu(item) : null}
            alTocarMenu={ctx.alTocar}
          />
        )}
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

      <VisorImagen
        visible={!!viendo}
        uri={viendo && viendo.uri}
        onCerrar={() => setViendo(null)}
      />
    </View>
  );
}

function Cumples({ items, onVerTodos }) {
  const hoy = items.filter((c) => c.hoy);
  const proximos = items.filter((c) => !c.hoy).slice(0, 6);
  const lista = hoy.length ? hoy : proximos;
  if (!lista.length) return null;
  const esHoy = hoy.length > 0;

  return (
    <View style={[s.cumples, esHoy && { backgroundColor: C.navy }]}>
      <Pressable style={s.cumplesTop} onPress={onVerTodos}>
        <MaterialIcons name="cake" size={16} color={esHoy ? C.teal : C.tealDeep} />
        <Text style={[s.cumplesTit, esHoy && { color: C.teal }]}>
          {esHoy ? 'CUMPLEN HOY' : 'PROXIMOS CUMPLEAÑOS'}
        </Text>
        <MaterialIcons name="chevron-right" size={17} color={esHoy ? C.teal : C.ink3} />
      </Pressable>
      <View style={s.cumplesRow}>
        {lista.map((c) => (
          <View key={c.id} style={{ alignItems: 'center', width: 64 }}>
            <Avatar persona={c}
              texto={iniciales(
                String(c.nombre_completo || '').split(' ')[0],
                String(c.nombre_completo || '').split(' ')[1],
              )}
              tam={44}
              fondo={esHoy ? C.teal : C.tealSoft}
              color={esHoy ? C.navy : C.tealDeep}
            />
            <Text style={[s.cumplesNom, esHoy && { color: '#D6E6EC' }]} numberOfLines={2}>
              {String(c.nombre_completo || '').split(' ')[0]}
            </Text>
            {!esHoy ? <Text style={s.cumplesDia}>{c.dias_faltan}d</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Post({ post, onReaccion, onAbrir, onMenu, onAmpliar, alTocarMenu }) {
  const [abanico, setAbanico] = useState(false);
  const a = post.autor || {};
  const partes = String(a.nombre || '').split(' ');

  return (
    <View style={[s.card, sombra]}>
      <View style={s.cab}>
        <Avatar persona={post.autor}
          texto={post.oficial ? 'PC' : iniciales(partes[0], partes[1])}
          fondo={post.oficial ? C.navy : C.tealSoft}
          color={post.oficial ? C.teal : C.tealDeep}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.autor}>{a.nombre}</Text>
          <Text style={s.detalle} numberOfLines={1}>
            {cuando(post.creado_el)}{a.detalle ? ` · ${a.detalle}` : ''}
          </Text>
        </View>
        {post.oficial ? (
          <View style={s.oficial}><Text style={s.oficialTxt}>OFICIAL</Text></View>
        ) : null}
        {post.fijado ? <MaterialIcons name="push-pin" size={17} color={C.ink3} /> : null}
        {onMenu ? (
          <Pressable onPress={onMenu} onPressIn={alTocarMenu} hitSlop={12} style={{ paddingLeft: 4 }}>
            <MaterialIcons name="more-horiz" size={21} color={C.ink3} />
          </Pressable>
        ) : null}
      </View>

      {post.grupos && post.grupos.length ? (
        <View style={s.grupos}>
          <MaterialIcons name="lock" size={12} color={C.ink3} />
          <Text style={s.gruposTxt}>Solo {post.grupos.map((g) => g.nombre).join(', ')}</Text>
        </View>
      ) : null}

      {post.titulo ? <Text style={s.titulo}>{post.titulo}</Text> : null}
      {post.cuerpo ? <Text style={s.cuerpo}>{post.cuerpo}</Text> : null}

      {post.media && post.media.length
        ? <Galeria media={post.media} onAbrir={onAbrir} onAmpliar={onAmpliar} />
        : null}

      {abanico ? (
        <View style={s.abanico}>
          {EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => { onReaccion(post, e); setAbanico(false); }} style={s.emojiBtn}>
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={s.pie}>
        <Pressable
          style={[s.accion, post.mi_reaccion && s.accionOn]}
          onPress={() => (post.mi_reaccion ? onReaccion(post, post.mi_reaccion) : setAbanico(!abanico))}
          onLongPress={() => setAbanico(!abanico)}
        >
          {post.mi_reaccion
            ? <Text style={{ fontSize: 15 }}>{post.mi_reaccion}</Text>
            : <MaterialIcons name="favorite-border" size={17} color={C.ink2} />}
          <Text style={[s.accionTxt, post.mi_reaccion && { color: C.tealDeep }]}>
            {post.reacciones || ''}
          </Text>
        </Pressable>

        <Pressable style={s.accion} onPress={onAbrir}>
          <MaterialIcons name="chat-bubble-outline" size={16} color={C.ink2} />
          <Text style={s.accionTxt}>{post.comentarios || 'Comentar'}</Text>
        </Pressable>

        <View style={{ flex: 1 }} />
        {post.vistas ? <Text style={s.vistas}>Visto por {post.vistas}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Imagen que, si no carga, muestra la URL que intento pedir.
 * Un recuadro gris sin explicacion no se puede diagnosticar; con la URL a la
 * vista se sabe en un vistazo si el problema es el dominio, la ruta o el
 * certificado.
 */
function Foto({ uri, style }) {
  const [fallo, setFallo] = useState(null);
  if (fallo) {
    return (
      <View style={[style, s.fotoError]}>
        <MaterialIcons name="broken-image" size={26} color={C.ink3} />
        <Text style={s.fotoErrorTit}>No se pudo cargar</Text>
        <Text style={s.fotoErrorUrl} numberOfLines={4} selectable>{uri}</Text>
        {fallo !== true ? <Text style={s.fotoErrorUrl}>{String(fallo)}</Text> : null}
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      onError={(e) => setFallo((e && e.nativeEvent && e.nativeEvent.error) || true)}
    />
  );
}

/**
 * Una foto sola respeta su proporcion real; varias van en grilla cuadrada.
 * Reservar la altura correcta evita el salto del feed cuando carga la imagen.
 */
function Galeria({ media, onAbrir, onAmpliar }) {
  const ancho = Dimensions.get('window').width - 56;

  if (media.length === 1) {
    const m = media[0];
    const prop = m.ancho && m.alto ? m.alto / m.ancho : 0.66;
    const alto = Math.min(ancho * prop, 420);
    // Tocar la foto la amplia. Para entrar al post estan el resto de la
    // tarjeta y el boton de comentar: ampliar es lo que uno intenta primero
    // cuando ve una foto chica.
    return (
      <Pressable
        onPress={() => (onAmpliar ? onAmpliar(m) : onAbrir())}
        onLongPress={onAbrir}
        style={{ marginTop: 11 }}
      >
        <Foto uri={imagenUrl(m.url)} style={[s.foto, { width: ancho, height: alto }]} />
      </Pressable>
    );
  }

  const lado = (ancho - 5) / 2;
  return (
    <View style={s.grilla}>
      {media.slice(0, 4).map((m, i) => (
        <Pressable
          key={m.url}
          onPress={() => (onAmpliar ? onAmpliar(m) : onAbrir())}
          onLongPress={onAbrir}
        >
          <Foto uri={imagenUrl(m.miniatura_url || m.url)} style={[s.foto, { width: lado, height: lado }]} />
          {i === 3 && media.length > 4 ? (
            <View style={[s.mas, { width: lado, height: lado }]}>
              <Text style={s.masTxt}>+{media.length - 4}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  foto: { borderRadius: R.md, backgroundColor: C.lineSoft },
  fotoError: { alignItems: 'center', justifyContent: 'center', padding: 14, gap: 4 },
  fotoErrorTit: { fontSize: 13, fontWeight: '700', color: C.ink2 },
  fotoErrorUrl: { fontSize: 10.5, color: C.ink3, textAlign: 'center', lineHeight: 15 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 11 },
  mas: {
    position: 'absolute', borderRadius: R.md, backgroundColor: 'rgba(7,45,64,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  masTxt: { color: '#fff', fontSize: 21, fontWeight: '700' },
  campana: {
    position: 'absolute', top: -4, right: -6, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: C.bordo, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  campanaN: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cumples: { backgroundColor: '#fff', borderRadius: R.xl, padding: 14, marginBottom: 11 },
  cumplesTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 },
  cumplesTit: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, color: C.tealDeep },
  cumplesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cumplesNom: { fontSize: 11, color: C.ink2, marginTop: 5, textAlign: 'center', lineHeight: 14 },
  cumplesDia: { fontSize: 10, color: C.ink3, marginTop: 1 },
  componer: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: R.lg, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 12,
  },
  componerTxt: { flex: 1, color: C.ink3, fontSize: 14.5 },
  card: { backgroundColor: '#fff', borderRadius: R.lg, padding: 14, marginBottom: 11 },
  cab: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  autor: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  detalle: { fontSize: 12, color: C.ink3, marginTop: 1 },
  oficial: { backgroundColor: C.navy, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  oficialTxt: { color: C.teal, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8 },
  grupos: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  gruposTxt: { fontSize: 11.5, color: C.ink3 },
  titulo: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 5, letterSpacing: -0.2 },
  cuerpo: { fontSize: 14.5, lineHeight: 21, color: C.ink },
  abanico: {
    flexDirection: 'row', gap: 4, marginTop: 11, backgroundColor: C.bg,
    borderRadius: 22, padding: 5, alignSelf: 'flex-start',
  },
  emojiBtn: { paddingHorizontal: 7, paddingVertical: 3 },
  pie: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.lineSoft,
  },
  accion: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.line,
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6,
  },
  accionOn: { borderColor: C.teal, backgroundColor: C.tealSoft },
  accionTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  vistas: { fontSize: 11.5, color: C.ink3 },
});
