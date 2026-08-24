import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Linking, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { academia, ACADEMIA_WEB } from '../api/client';
import { Cargando, ErrorBox, Card, Tag } from '../components/UI';
import { C, R, sombra } from '../theme';

const ICONO_TIPO = { video: 'play-circle-outline', texto: 'article',
  material: 'attach-file', quiz: 'quiz', examen: 'quiz', pdf: 'picture-as-pdf' };

export default function CursoScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await academia.curso(id)); }
    catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  useEffect(() => {
    if (data) navigation.setOptions({ title: data.curso.titulo });
  }, [data, navigation]);

  // Las lecciones se ven en la web de la Academia: ahi esta el reproductor,
  // los examenes y el registro de avance. Duplicar eso en la app seria
  // reescribir el sistema entero.
  const abrir = async (leccionId) => {
    const url = `${ACADEMIA_WEB}/curso/${data.curso.slug || id}`
              + (leccionId ? `?leccion=${leccionId}` : '');
    try { await Linking.openURL(url); }
    catch { Alert.alert('No se pudo abrir', 'Entra a academia.pasajeclub.com.ar desde el navegador.'); }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Abriendo curso" />;

  const c = data.curso;
  const porModulo = {};
  data.lecciones.forEach((l) => {
    const k = l.modulo_id || 0;
    (porModulo[k] = porModulo[k] || []).push(l);
  });
  const hayModulos = data.modulos.length > 1;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 34 }}>
      <Card>
        <View style={{ padding: 15 }}>
          <View style={s.tags}>
            {c.obligatorio ? <Tag texto="Obligatorio" tipo="warn" /> : null}
            {c.nivel ? <Text style={s.nivel}>{c.nivel}</Text> : null}
          </View>
          {c.descripcion ? <Text style={s.desc}>{c.descripcion}</Text> : null}

          <View style={s.barraWrap}>
            <View style={s.barra}>
              <View style={[s.avance, { width: `${c.avance}%` },
                            c.avance === 100 && { backgroundColor: C.ok }]} />
            </View>
            <Text style={s.pct}>{c.avance}%</Text>
          </View>
          <Text style={s.meta}>{c.hechas} de {c.lecciones} lecciones</Text>
        </View>

        <Pressable style={s.seguir} onPress={() => abrir(data.siguiente)}>
          <MaterialIcons
            name={c.avance === 100 ? 'replay' : c.hechas > 0 ? 'play-arrow' : 'play-circle-filled'}
            size={20} color="#fff"
          />
          <Text style={s.seguirTxt}>
            {c.avance === 100 ? 'Repasar el curso'
              : c.hechas > 0 ? 'Seguir donde dejaste' : 'Empezar el curso'}
          </Text>
        </Pressable>
      </Card>

      <Text style={s.seccion}>CONTENIDO</Text>
      <Card>
        {Object.entries(porModulo).map(([modId, lecs]) => {
          const mod = data.modulos.find((m) => String(m.id) === String(modId));
          return (
            <View key={modId}>
              {hayModulos && mod ? (
                <Text style={s.modulo}>{mod.titulo}</Text>
              ) : null}
              {lecs.map((l, i) => (
                <Pressable
                  key={l.id}
                  onPress={() => abrir(l.id)}
                  style={[s.leccion, i < lecs.length - 1 && s.borde]}
                >
                  <MaterialIcons
                    name={l.hecha ? 'check-circle'
                        : l.video_pct > 0 ? 'pause-circle-outline'
                        : (ICONO_TIPO[l.tipo] || 'play-circle-outline')}
                    size={21}
                    color={l.hecha ? C.ok : l.video_pct > 0 ? C.teal : C.ink3}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.lecTitulo, l.hecha && s.hecha]} numberOfLines={2}>
                      {l.titulo}
                    </Text>
                    <View style={s.lecPie}>
                      {l.minutos ? <Text style={s.lecMeta}>{l.minutos} min</Text> : null}
                      {l.nota ? <Text style={s.lecNota}>Nota {Math.round(l.nota)}%</Text> : null}
                    </View>
                    {/* Video a medias: sin esto, una leccion empezada se ve
                        igual que una que nunca se abrio. */}
                    {!l.hecha && l.video_pct > 0 ? (
                      <View style={s.lecBarra}>
                        <View style={[s.lecAvance, { width: `${l.video_pct}%` }]} />
                      </View>
                    ) : null}
                  </View>
                  <MaterialIcons name="open-in-new" size={16} color={C.ink3} />
                </Pressable>
              ))}
            </View>
          );
        })}
      </Card>

      <Text style={s.pie}>
        Las clases se ven en academia.pasajeclub.com.ar. El avance se sincroniza solo.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  nivel: { fontSize: 10.5, color: C.ink3, fontWeight: '700', textTransform: 'uppercase' },
  desc: { fontSize: 14, color: C.ink2, lineHeight: 20, marginBottom: 13 },
  barraWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  barra: { flex: 1, height: 7, borderRadius: 4, backgroundColor: C.lineSoft, overflow: 'hidden' },
  avance: { height: 7, borderRadius: 4, backgroundColor: C.teal },
  pct: { fontSize: 12, fontWeight: '700', color: C.ink2, width: 36, textAlign: 'right' },
  meta: { fontSize: 12, color: C.ink3, marginTop: 6 },
  seguir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.navy, paddingVertical: 14,
  },
  seguirTxt: { color: '#fff', fontWeight: '600', fontSize: 15 },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 20, marginBottom: 9 },
  modulo: {
    fontSize: 12, fontWeight: '700', color: C.tealDeep, backgroundColor: C.tealSoft,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  leccion: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  lecTitulo: { fontSize: 14, color: C.ink, lineHeight: 19 },
  hecha: { color: C.ink3 },
  lecPie: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  lecMeta: { fontSize: 11.5, color: C.ink3 },
  lecNota: { fontSize: 11.5, color: C.tealDeep, fontWeight: '600' },
  lecBarra: { height: 3, borderRadius: 2, backgroundColor: C.lineSoft, marginTop: 6, overflow: 'hidden' },
  lecAvance: { height: 3, borderRadius: 2, backgroundColor: C.teal },
  pie: { fontSize: 12, color: C.ink3, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
