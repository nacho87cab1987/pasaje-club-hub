import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, Pressable, RefreshControl, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { onboarding } from '../api/client';
import { rutaAPantalla } from '../push';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, icono } from '../theme';

export default function OnboardingScreen({ navigation, route }) {
  const dePersona = route.params && route.params.personaId;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setData(dePersona ? await onboarding.persona(dePersona) : await onboarding.mio());
    } catch (e) { setError(e.message); }
  }, [dePersona]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  useEffect(() => {
    if (data?.persona && dePersona) navigation.setOptions({ title: data.persona });
  }, [data, dePersona, navigation]);

  // Quien puede asignar tambien supervisa: el acceso a la lista del equipo
  // va en el header en vez de un modulo aparte.
  useEffect(() => {
    if (dePersona) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('OnboardingGente')} hitSlop={10}
          style={{ marginRight: 4 }}>
          <MaterialIcons name="groups" size={22} color={C.navy} />
        </Pressable>
      ),
    });
  }, [navigation, dePersona]);

  const marcar = async (paso) => {
    if (paso.automatico) {
      Alert.alert('Se completa solo',
        'Este paso se marca cuando hagas la accion. Tocá para ir ahí.');
      if (paso.ruta) abrir(paso);
      return;
    }
    // Optimista: el tilde tiene que responder al toque, no a la red.
    const antes = data;
    setData((d) => ({
      ...d,
      grupos: d.grupos.map((g) => ({
        ...g,
        items: g.items.map((i) => (i.id === paso.id ? { ...i, hecho: !i.hecho } : i)),
      })),
      hechos: d.hechos + (paso.hecho ? -1 : 1),
    }));
    try {
      await onboarding.marcar(paso.id, !paso.hecho);
      await cargar();
    } catch (e) {
      setData(antes);
      Alert.alert('No se pudo', e.message);
    }
  };

  const abrir = (paso) => {
    if (!paso.ruta) return;
    const [pantalla, params] = rutaAPantalla(paso.ruta);
    try { navigation.navigate(pantalla, params); } catch { /* ruta desconocida */ }
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  if (!data.asignado) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Vacio
          icono="flag"
          titulo="No tenes onboarding pendiente"
          texto={data.puede_asignar
            ? 'Podés ver y asignar el de tu equipo.'
            : 'Todavia no te asignaron una lista de bienvenida.'}
        />
        <Pressable style={s.verEquipo} onPress={() => navigation.navigate('OnboardingGente')}>
          <MaterialIcons name="groups" size={19} color={C.tealDeep} />
          <Text style={s.verEquipoTxt}>Ver el onboarding del equipo</Text>
          <MaterialIcons name="chevron-right" size={19} color={C.tealDeep} />
        </Pressable>
      </View>
    );
  }

  const secciones = data.grupos.map((g) => ({ ...g, data: g.items }));
  const listo = data.avance === 100;

  return (
    <SectionList
      style={{ backgroundColor: C.bg }}
      sections={secciones}
      keyExtractor={(i) => String(i.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      stickySectionHeadersEnabled={false}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
      ListHeaderComponent={(
        <View style={[s.cab, sombra, listo && { backgroundColor: C.ok }]}>
          <View style={s.cabTop}>
            <MaterialIcons name={listo ? 'celebration' : 'flag'} size={22} color={C.teal} />
            <View style={{ flex: 1 }}>
              <Text style={s.cabTit}>
                {listo ? '¡Onboarding completo!'
                  : data.es_mio ? 'Tus primeros pasos' : data.persona}
              </Text>
              <Text style={s.cabSub}>
                {data.hechos} de {data.total} listos
                {data.dias !== null ? ` · dia ${data.dias}` : ''}
              </Text>
            </View>
            <Text style={s.pct}>{data.avance}%</Text>
          </View>
          <View style={s.barra}>
            <View style={[s.barraLlena, { width: `${data.avance}%` },
                          listo && { backgroundColor: '#fff' }]} />
          </View>
        </View>
      )}
      renderSectionHeader={({ section }) => {
        const pend = section.items.filter((i) => !i.hecho).length;
        return (
          <View style={s.seccion}>
            <Text style={s.seccionTxt}>{section.nombre.toUpperCase()}</Text>
            {pend === 0 ? (
              <MaterialIcons name="check-circle" size={15} color={C.ok} />
            ) : (
              <Text style={s.seccionN}>{pend}</Text>
            )}
          </View>
        );
      }}
      renderItem={({ item }) => {
        const ajeno = item.responsable !== 'persona' && data.es_mio;
        return (
          <View style={[s.paso, sombra, item.hecho && s.hecho,
                        item.vencido && !item.hecho && s.vencido]}>
            <Pressable onPress={() => marcar(item)} hitSlop={8} disabled={ajeno}>
              <MaterialIcons
                name={item.hecho ? 'check-circle'
                    : item.automatico ? 'radio-button-unchecked'
                    : ajeno ? 'lock-outline' : 'radio-button-unchecked'}
                size={24}
                color={item.hecho ? C.ok : item.vencido ? C.bordo : C.ink3}
              />
            </Pressable>

            <Pressable style={{ flex: 1 }} onPress={() => (item.ruta ? abrir(item) : marcar(item))}>
              <Text style={[s.titulo, item.hecho && s.tachado]}>{item.titulo}</Text>
              {item.detalle ? (
                <Text style={s.detalle} numberOfLines={2}>{item.detalle}</Text>
              ) : null}

              <View style={s.meta}>
                {item.automatico && !item.hecho ? (
                  <View style={s.tag}>
                    <MaterialIcons name="auto-awesome" size={11} color={C.tealDeep} />
                    <Text style={s.tagTxt}>se marca solo</Text>
                  </View>
                ) : null}
                {ajeno ? (
                  <View style={s.tag}>
                    <MaterialIcons name="person" size={11} color={C.ink3} />
                    <Text style={[s.tagTxt, { color: C.ink3 }]}>
                      {item.responsable === 'jefe' ? 'lo marca tu jefa' : 'lo marca administracion'}
                    </Text>
                  </View>
                ) : null}
                {item.vencido && !item.hecho ? (
                  <Text style={s.atrasado}>
                    atrasado {Math.abs(item.dias_restantes)} {Math.abs(item.dias_restantes) === 1 ? 'dia' : 'dias'}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            {item.ruta && !item.hecho ? (
              <MaterialIcons name={icono(item.icono) || 'chevron-right'} size={19} color={C.tealDeep} />
            ) : null}
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  verEquipo: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.tealSoft,
    borderRadius: R.md, padding: 14, margin: 16,
  },
  verEquipoTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: C.tealDeep },
  cab: { backgroundColor: C.navy, borderRadius: R.lg, padding: 16, marginBottom: 6 },
  cabTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cabTit: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cabSub: { fontSize: 12, color: '#A9CBD6', marginTop: 2 },
  pct: { fontSize: 20, fontWeight: '700', color: C.teal },
  barra: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 13, overflow: 'hidden' },
  barraLlena: { height: 7, borderRadius: 4, backgroundColor: C.teal },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 9 },
  seccionTxt: { flex: 1, fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3 },
  seccionN: {
    fontSize: 11, fontWeight: '700', color: C.tealDeep, backgroundColor: C.tealSoft,
    borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2,
  },
  paso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#fff',
    borderRadius: R.md, padding: 13, marginBottom: 8,
  },
  hecho: { opacity: 0.62 },
  vencido: { borderLeftWidth: 3, borderLeftColor: C.bordo },
  titulo: { fontSize: 14.5, fontWeight: '600', color: C.ink, lineHeight: 20 },
  tachado: { textDecorationLine: 'line-through', color: C.ink3, fontWeight: '400' },
  detalle: { fontSize: 12.5, color: C.ink3, marginTop: 3, lineHeight: 17 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 7 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tagTxt: { fontSize: 10.5, color: C.tealDeep, fontWeight: '600' },
  atrasado: { fontSize: 10.5, color: C.bordo, fontWeight: '700' },
});
