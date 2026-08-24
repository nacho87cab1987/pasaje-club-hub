import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { academia } from '../api/client';
import { Cargando, ErrorBox, Vacio, Tag } from '../components/UI';
import { C, R, sombra } from '../theme';

const NIVEL = { inicial: 'Inicial', intermedio: 'Intermedio', avanzado: 'Avanzado' };

export default function AcademiaScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [c, r] = await Promise.all([
        academia.misCursos(),
        academia.resumen().catch(() => null),
      ]);
      setItems(c.items || []);
      setResumen(r);
    } catch (e) { setError(e.message); setItems([]); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error && !items?.length) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (items === null) return <Cargando texto="Cargando la Academia" />;

  // Lo que esta empezado va primero: es lo que la persona vino a continuar.
  const orden = { en_curso: 0, sin_empezar: 1, terminado: 2 };
  const lista = [...items].sort((a, b) => orden[a.estado] - orden[b.estado]);

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={lista}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
      ListEmptyComponent={(
        <Vacio icono="school" titulo="Sin cursos" texto="Todavia no hay cursos disponibles para vos." />
      )}
      ListHeaderComponent={resumen ? (
        <View style={[s.resumen, sombra]}>
          <View style={s.dato}>
            <Text style={s.datoN}>{resumen.racha}</Text>
            <Text style={s.datoT}>dias seguidos</Text>
          </View>
          <View style={s.sep} />
          <View style={s.dato}>
            <Text style={s.datoN}>{resumen.cursos_tocados}</Text>
            <Text style={s.datoT}>cursos empezados</Text>
          </View>
          <View style={s.sep} />
          <Pressable style={s.dato} onPress={() => navigation.navigate('Certificados')}>
            <Text style={s.datoN}>{resumen.certificados}</Text>
            <Text style={s.datoT}>certificados</Text>
          </Pressable>
        </View>
      ) : null}
      renderItem={({ item }) => (
        <Pressable
          style={[s.curso, sombra]}
          onPress={() => navigation.navigate('Curso', { id: item.id, titulo: item.titulo })}
        >
          {item.portada ? (
            <Image source={{ uri: item.portada }} style={s.portada} />
          ) : (
            <View style={[s.portada, s.portadaVacia]}>
              <MaterialIcons name="school" size={30} color={C.teal} />
            </View>
          )}

          <View style={s.cuerpo}>
            <View style={s.tags}>
              {item.obligatorio ? <Tag texto="Obligatorio" tipo="warn" /> : null}
              {item.certificado ? <Tag texto="Certificado" tipo="ok" /> : null}
              {item.nivel ? <Text style={s.nivel}>{NIVEL[item.nivel] || item.nivel}</Text> : null}
            </View>

            <Text style={s.titulo} numberOfLines={2}>{item.titulo}</Text>

            <View style={s.barraWrap}>
              <View style={s.barra}>
                <View style={[s.avance, { width: `${item.avance}%` },
                              item.estado === 'terminado' && { backgroundColor: C.ok }]} />
              </View>
              <Text style={s.pct}>{item.avance}%</Text>
            </View>

            <Text style={s.meta}>
              {item.estado === 'terminado' ? 'Terminado'
                : item.estado === 'sin_empezar' ? `${item.lecciones} lecciones`
                : `${item.hechas} de ${item.lecciones} lecciones`}
              {item.minutos ? ` · ${Math.round(item.minutos / 60)} h` : ''}
            </Text>
          </View>

          <MaterialIcons
            name={item.estado === 'terminado' ? 'check-circle'
                : item.estado === 'en_curso' ? 'play-circle-filled' : 'chevron-right'}
            size={item.estado === 'sin_empezar' ? 20 : 24}
            color={item.estado === 'terminado' ? C.ok
                 : item.estado === 'en_curso' ? C.teal : C.ink3}
          />
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  resumen: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.navy,
    borderRadius: R.lg, paddingVertical: 15, marginBottom: 13,
  },
  dato: { flex: 1, alignItems: 'center' },
  datoN: { fontSize: 22, fontWeight: '700', color: C.teal },
  datoT: { fontSize: 11, color: '#A9CBD6', marginTop: 2 },
  sep: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },
  curso: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 12, marginBottom: 10,
  },
  portada: { width: 62, height: 62, borderRadius: 12, backgroundColor: C.lineSoft },
  portadaVacia: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.tealSoft },
  cuerpo: { flex: 1, minWidth: 0 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' },
  nivel: { fontSize: 10.5, color: C.ink3, fontWeight: '600', textTransform: 'uppercase' },
  titulo: { fontSize: 14.5, fontWeight: '600', color: C.ink, lineHeight: 19 },
  barraWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  barra: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.lineSoft, overflow: 'hidden' },
  avance: { height: 6, borderRadius: 3, backgroundColor: C.teal },
  pct: { fontSize: 11, fontWeight: '700', color: C.ink2, width: 34, textAlign: 'right' },
  meta: { fontSize: 11.5, color: C.ink3, marginTop: 5 },
});
