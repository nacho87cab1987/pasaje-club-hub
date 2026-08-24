import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { perfil as perfilApi } from '../api/client';
import { Avatar, Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra, iniciales } from '../theme';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** '03-15' -> 15. La columna guarda mes-dia, sin año. */
const diaDe = (md) => parseInt(String(md || '').split('-')[1] || '0', 10);
const mesDe = (md) => parseInt(String(md || '').split('-')[0] || '0', 10);

function cuando(dias) {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias <= 7) return `en ${dias} dias`;
  return null;
}

export default function CumpleanosScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await perfilApi.cumples(365)); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  const secciones = useMemo(() => {
    if (!data) return [];
    const items = data.items || [];

    // Los proximos van aparte: es lo que uno viene a mirar. El resto se
    // agrupa por mes, en el orden en que van llegando desde hoy.
    const proximos = items.filter((x) => x.dias_faltan <= 7);
    const resto = items.filter((x) => x.dias_faltan > 7);

    const porMes = {};
    resto.forEach((x) => {
      const m = mesDe(x.cumple_md);
      (porMes[m] = porMes[m] || []).push(x);
    });

    const orden = [];
    const mesHoy = new Date().getMonth() + 1;
    for (let i = 0; i < 12; i++) {
      const m = ((mesHoy - 1 + i) % 12) + 1;
      if (porMes[m]) {
        orden.push({
          titulo: MESES[m - 1],
          data: porMes[m].sort((a, b) => diaDe(a.cumple_md) - diaDe(b.cumple_md)),
        });
      }
    }

    return [
      ...(proximos.length ? [{ titulo: 'Se vienen', destacado: true, data: proximos }] : []),
      ...orden,
    ];
  }, [data]);

  const saludar = (p) => {
    navigation.navigate('CrearPost', {
      textoInicial: `¡Feliz cumple, ${String(p.nombre_completo).split(' ')[0]}! 🎂`,
    });
  };

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando cumpleaños" />;

  return (
    <SectionList
      style={{ backgroundColor: C.bg }}
      sections={secciones}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      stickySectionHeadersEnabled={false}
      refreshControl={(
        <RefreshControl
          refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
        />
      )}
      ListEmptyComponent={(
        <Vacio
          icono="cake"
          titulo="Sin cumpleaños cargados"
          texto="Cada uno carga su fecha desde su perfil. Cuando lo hagan, aparecen acá."
        />
      )}
      ListFooterComponent={data.sin_cargar > 0 ? (
        <View style={s.aviso}>
          <MaterialIcons name="info-outline" size={17} color={C.ink3} />
          <Text style={s.avisoTxt}>
            {data.sin_cargar} {data.sin_cargar === 1 ? 'persona todavia no cargo' : 'personas todavia no cargaron'}
            {' '}su fecha. Se carga desde el perfil de cada uno.
          </Text>
        </View>
      ) : null}
      renderSectionHeader={({ section }) => (
        <View style={s.seccion}>
          <Text style={[s.seccionTxt, section.destacado && { color: C.bordo }]}>
            {section.titulo.toUpperCase()}
          </Text>
          <View style={[s.linea, section.destacado && { backgroundColor: '#F0D8E0' }]} />
        </View>
      )}
      renderItem={({ item, section }) => {
        const hoy = item.dias_faltan === 0;
        const texto = cuando(item.dias_faltan);
        return (
          <View style={[s.item, sombra, hoy && s.itemHoy]}>
            <View style={s.fecha}>
              <Text style={[s.dia, hoy && { color: '#fff' }]}>{diaDe(item.cumple_md)}</Text>
              <Text style={[s.mes, hoy && { color: 'rgba(255,255,255,0.8)' }]}>
                {MESES[mesDe(item.cumple_md) - 1].slice(0, 3).toLowerCase()}
              </Text>
            </View>

            <Avatar
              texto={iniciales(...String(item.nombre_completo).split(' '))}
              tam={40}
              fondo={hoy ? '#fff' : C.tealSoft}
              color={hoy ? C.bordo : C.tealDeep}
            />

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.nombre, hoy && { color: '#fff' }]} numberOfLines={1}>
                {item.nombre_completo}
              </Text>
              <Text style={[s.area, hoy && { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={1}>
                {item.area || 'Pasaje Club'}
                {texto && !hoy ? ` · ${texto}` : ''}
              </Text>
            </View>

            {/* Saludar solo tiene sentido cerca de la fecha: un boton en
                cada fila del año entero seria ruido. */}
            {section.destacado ? (
              <Pressable
                onPress={() => saludar(item)}
                style={[s.saludar, hoy && { backgroundColor: '#fff' }]}
              >
                <MaterialIcons name="celebration" size={16} color={hoy ? C.bordo : C.tealDeep} />
                <Text style={[s.saludarTxt, hoy && { color: C.bordo }]}>Saludar</Text>
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  seccion: { marginTop: 18, marginBottom: 9 },
  seccionTxt: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3 },
  linea: { height: 2, backgroundColor: C.lineSoft, borderRadius: 1, marginTop: 6 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 11, marginBottom: 8,
  },
  itemHoy: { backgroundColor: C.bordo },
  fecha: { width: 38, alignItems: 'center' },
  dia: { fontSize: 19, fontWeight: '700', color: C.ink, lineHeight: 22 },
  mes: { fontSize: 10, color: C.ink3, textTransform: 'uppercase', fontWeight: '600' },
  nombre: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  area: { fontSize: 11.5, color: C.ink3, marginTop: 1 },
  saludar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.tealSoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6,
  },
  saludarTxt: { fontSize: 11.5, fontWeight: '700', color: C.tealDeep },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 20,
    paddingHorizontal: 4,
  },
  avisoTxt: { flex: 1, fontSize: 12, color: C.ink3, lineHeight: 17 },
});
