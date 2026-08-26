import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { eventos } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const TIPOS = {
  capacitacion: { nom: 'Capacitacion', icono: 'school', color: '#185FA5' },
  salida:       { nom: 'Salida',       icono: 'hiking', color: '#1D9E75' },
  reunion:      { nom: 'Reunion',      icono: 'groups', color: '#5a7a85' },
  feria:        { nom: 'Feria',        icono: 'storefront', color: '#BA7517' },
  celebracion:  { nom: 'Celebracion',  icono: 'celebration', color: '#790F35' },
  otro:         { nom: 'Evento',       icono: 'event', color: C.tealDeep },
};

export function fechaCorta(iso) {
  if (!iso) return { dia: '', mes: '', hora: '' };
  const d = new Date(String(iso).replace(' ', 'T'));
  return {
    dia: d.getDate(),
    mes: MESES[d.getMonth()],
    hora: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

/** Cuantos dias faltan, en palabras. */
export function cuando(iso) {
  const d = new Date(String(iso).replace(' ', 'T'));
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const dias = Math.round((dia - hoy) / 86400000);
  if (dias < 0) return null;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias <= 7) return `en ${dias} dias`;
  return null;
}

export default function EventosScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await eventos.listar()); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        data && data.puede_crear ? (
          <Pressable onPress={() => navigation.navigate('EventoForm')} hitSlop={10}
            style={{ marginRight: 4 }}>
            <MaterialIcons name="add" size={24} color={C.navy} />
          </Pressable>
        ) : null
      ),
    });
  }, [navigation, data]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando eventos" />;

  const secciones = [];
  if (data.proximos.length) secciones.push({ titulo: 'Se vienen', data: data.proximos });
  if (data.pasados.length) secciones.push({ titulo: 'Ya pasaron', data: data.pasados });

  return (
    <SectionList
      style={{ backgroundColor: C.bg }}
      sections={secciones}
      keyExtractor={(e) => String(e.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      stickySectionHeadersEnabled={false}
      refreshControl={(
        <RefreshControl refreshing={refrescando} tintColor={C.teal}
          onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />
      )}
      ListEmptyComponent={(
        <Vacio icono="event-busy" titulo="Sin eventos"
          texto={data.puede_crear
            ? 'Tocá el + para cargar el primero.'
            : 'Cuando haya algo, te avisamos.'} />
      )}
      ListHeaderComponent={data.mis_proximos > 0 ? (
        <Text style={s.anotado}>
          Estás anotado en {data.mis_proximos} {data.mis_proximos === 1 ? 'evento' : 'eventos'}
        </Text>
      ) : null}
      renderSectionHeader={({ section }) => (
        <Text style={s.seccion}>{section.titulo.toUpperCase()}</Text>
      )}
      renderItem={({ item }) => {
        const t = TIPOS[item.tipo] || TIPOS.otro;
        const f = fechaCorta(item.inicio);
        const pronto = cuando(item.inicio);
        const cancelado = item.estado === 'cancelado';
        const anotado = item.mi_estado === 'anotado';
        const espera = item.mi_estado === 'espera';

        return (
          <Pressable
            style={[s.item, sombra, cancelado && { opacity: 0.6 }]}
            onPress={() => navigation.navigate('Evento', { id: item.id })}
          >
            <View style={[s.fecha, { backgroundColor: `${t.color}14` }]}>
              <Text style={[s.dia, { color: t.color }]}>{f.dia}</Text>
              <Text style={[s.mes, { color: t.color }]}>{f.mes}</Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.linea}>
                <MaterialIcons name={t.icono} size={13} color={t.color} />
                <Text style={[s.tipo, { color: t.color }]}>{t.nom.toUpperCase()}</Text>
                {item.obligatorio ? (
                  <View style={s.oblig}><Text style={s.obligTxt}>OBLIGATORIO</Text></View>
                ) : null}
                {item.estado === 'borrador' ? (
                  <View style={s.borrador}><Text style={s.borradorTxt}>BORRADOR</Text></View>
                ) : null}
              </View>

              <Text style={[s.titulo, cancelado && s.tachado]} numberOfLines={2}>
                {item.titulo}
              </Text>

              <View style={s.meta}>
                {!item.todo_el_dia ? (
                  <Text style={s.metaTxt}>{f.hora}</Text>
                ) : null}
                {item.lugar ? <Text style={s.metaTxt} numberOfLines={1}>· {item.lugar}</Text> : null}
                {pronto ? <Text style={s.pronto}>· {pronto}</Text> : null}
              </View>

              <View style={s.pie}>
                {cancelado ? (
                  <Text style={s.cancelado}>Cancelado</Text>
                ) : anotado ? (
                  <View style={s.chipOk}>
                    <MaterialIcons name="check" size={12} color="#1B5E3F" />
                    <Text style={s.chipOkTxt}>Vas</Text>
                  </View>
                ) : espera ? (
                  <View style={s.chipEspera}>
                    <MaterialIcons name="hourglass-top" size={12} color="#854F0B" />
                    <Text style={s.chipEsperaTxt}>En espera</Text>
                  </View>
                ) : null}

                {item.cupo > 0 && !cancelado ? (
                  <Text style={[s.cupo, item.lleno && { color: C.bordo }]}>
                    {item.lleno
                      ? `Completo · ${item.en_espera} en espera`
                      : `${item.lugares} ${item.lugares === 1 ? 'lugar' : 'lugares'}`}
                  </Text>
                ) : item.anotados > 0 ? (
                  <Text style={s.cupo}>{item.anotados} anotados</Text>
                ) : null}
              </View>
            </View>

            <MaterialIcons name="chevron-right" size={19} color={C.ink3} />
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  anotado: {
    fontSize: 12.5, color: C.tealDeep, fontWeight: '600',
    backgroundColor: C.tealSoft, borderRadius: R.md, padding: 11, marginBottom: 4,
  },
  seccion: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3, marginTop: 18, marginBottom: 9 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 12, marginBottom: 9,
  },
  fecha: { width: 50, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dia: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
  mes: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  tipo: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  oblig: { backgroundColor: '#FAEEDA', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  obligTxt: { fontSize: 8.5, fontWeight: '800', color: '#854F0B' },
  borrador: { backgroundColor: C.lineSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  borradorTxt: { fontSize: 8.5, fontWeight: '800', color: C.ink3 },
  titulo: { fontSize: 14.5, fontWeight: '700', color: C.ink, marginTop: 3, lineHeight: 19 },
  tachado: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  metaTxt: { fontSize: 11.5, color: C.ink3 },
  pronto: { fontSize: 11.5, color: C.tealDeep, fontWeight: '700' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  chipOk: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E1F5EE',
    borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3,
  },
  chipOkTxt: { fontSize: 10.5, fontWeight: '700', color: '#1B5E3F' },
  chipEspera: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FAEEDA',
    borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3,
  },
  chipEsperaTxt: { fontSize: 10.5, fontWeight: '700', color: '#854F0B' },
  cupo: { fontSize: 11, color: C.ink3 },
  cancelado: { fontSize: 11.5, fontWeight: '700', color: C.bordo },
});
