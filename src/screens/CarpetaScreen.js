import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Pressable, RefreshControl,
  Linking, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { documentos, urlDocumento } from '../api/client';
import { Cargando, ErrorBox, Vacio, Tag } from '../components/UI';
import { C, R, sombra } from '../theme';

const ICONO_EXT = {
  pdf: 'picture-as-pdf', doc: 'article', docx: 'article',
  xls: 'table-chart', xlsx: 'table-chart',
  ppt: 'slideshow', pptx: 'slideshow',
  jpg: 'image', jpeg: 'image', png: 'image',
};
const COLOR_EXT = {
  pdf: '#e53935', doc: '#185FA5', docx: '#185FA5',
  xls: '#2e7d32', xlsx: '#2e7d32', ppt: '#BA7517', pptx: '#BA7517',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-08' -> 'agosto 2026'. Los recibos se buscan por mes, no por fecha. */
function periodoLargo(p) {
  if (!p) return null;
  const [a, m] = p.split('-');
  return `${MESES[parseInt(m, 10) - 1]} ${a}`;
}

export default function CarpetaScreen({ route, navigation }) {
  const { carpeta } = route.params;
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async (busqueda) => {
    setError(null);
    try {
      const r = await documentos.listar(carpeta.id, busqueda);
      setItems(r.items || []);
    } catch (e) { setError(e.message); setItems([]); }
  }, [carpeta.id]);

  useEffect(() => { navigation.setOptions({ title: carpeta.nombre }); }, [carpeta, navigation]);
  useEffect(() => {
    const t = setTimeout(() => cargar(q.trim()), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, cargar]);

  const abrir = async (doc) => {
    // El visor del sistema abre la URL por su cuenta, sin los headers de la
    // app: por eso el token va en la URL y no en un header.
    const url = urlDocumento(doc.id);
    try {
      const puede = await Linking.canOpenURL(url);
      if (!puede) throw new Error('sin visor');
      await Linking.openURL(url);
      // Al abrirlo queda marcado como leido del lado del servidor.
      setItems((xs) => xs.map((x) => (x.id === doc.id ? { ...x, leido: true } : x)));
    } catch (e) {
      Alert.alert('No se pudo abrir', 'Probá de nuevo o avisale a administracion.');
    }
  };

  const confirmar = async (doc) => {
    try {
      await documentos.confirmar(doc.id);
      setItems((xs) => xs.map((x) => (x.id === doc.id ? { ...x, confirmado: true } : x)));
    } catch (e) { Alert.alert('No se pudo', e.message); }
  };

  if (error && !items) return <ErrorBox mensaje={error} onReintentar={() => cargar(q.trim())} />;
  if (items === null) return <Cargando texto="Cargando" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {(items.length > 6 || q) ? (
        <View style={s.buscador}>
          <MaterialIcons name="search" size={20} color={C.ink3} />
          <TextInput
            style={s.input} value={q} onChangeText={setQ}
            placeholder="Buscar" placeholderTextColor={C.ink3}
          />
          {q ? <MaterialIcons name="close" size={19} color={C.ink3} onPress={() => setQ('')} /> : null}
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 8, paddingBottom: 30 }}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando} tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(q.trim()); setRefrescando(false); }}
          />
        )}
        ListEmptyComponent={(
          <Vacio
            icono="folder-off"
            titulo={q ? 'Sin resultados' : 'Carpeta vacia'}
            texto={q ? `Nada coincide con "${q}".` : 'Todavia no hay documentos aca.'}
          />
        )}
        renderItem={({ item }) => {
          const ext = String(item.extension || '').toLowerCase();
          return (
            <Pressable style={[s.doc, sombra]} onPress={() => abrir(item)}>
              <View style={[s.bx, { backgroundColor: `${COLOR_EXT[ext] || C.ink3}15` }]}>
                <MaterialIcons
                  name={ICONO_EXT[ext] || 'insert-drive-file'}
                  size={23}
                  color={COLOR_EXT[ext] || C.ink3}
                />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.linea}>
                  <Text style={[s.titulo, !item.leido && { fontWeight: '700' }]} numberOfLines={2}>
                    {item.titulo}
                  </Text>
                  {!item.leido ? <View style={s.punto} /> : null}
                </View>

                {item.periodo ? (
                  <Text style={s.periodo}>{periodoLargo(item.periodo)}</Text>
                ) : item.descripcion ? (
                  <Text style={s.desc} numberOfLines={2}>{item.descripcion}</Text>
                ) : null}

                <View style={s.meta}>
                  <Text style={s.metaTxt}>{ext.toUpperCase()} · {item.peso}</Text>
                  {item.version > 1 ? <Text style={s.metaTxt}>· v{item.version}</Text> : null}
                  {item.de_quien ? <Text style={s.metaTxt}>· {item.de_quien}</Text> : null}
                </View>

                {item.pide_lectura && !item.confirmado ? (
                  <Pressable style={s.confirmar} onPress={() => confirmar(item)}>
                    <MaterialIcons name="check-circle-outline" size={15} color={C.tealDeep} />
                    <Text style={s.confirmarTxt}>Confirmar que lo lei</Text>
                  </Pressable>
                ) : null}
                {item.pide_lectura && item.confirmado ? (
                  <View style={{ marginTop: 7, alignSelf: 'flex-start' }}>
                    <Tag texto="Leido" tipo="ok" />
                  </View>
                ) : null}
              </View>

              <MaterialIcons name="open-in-new" size={19} color={C.ink3} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    margin: 14, marginBottom: 4, paddingHorizontal: 13, height: 44,
    borderRadius: R.md, borderWidth: 1, borderColor: C.line,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  doc: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 13, marginBottom: 9,
  },
  bx: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linea: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titulo: { flex: 1, fontSize: 14.5, fontWeight: '600', color: C.ink, lineHeight: 20 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal, marginTop: 6 },
  periodo: { fontSize: 12.5, color: C.tealDeep, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  desc: { fontSize: 12.5, color: C.ink3, marginTop: 2, lineHeight: 17 },
  meta: { flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  metaTxt: { fontSize: 11, color: C.ink3 },
  confirmar: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
    backgroundColor: C.tealSoft, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14, alignSelf: 'flex-start',
  },
  confirmarTxt: { fontSize: 12, fontWeight: '600', color: C.tealDeep },
});
