import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { gestion } from '../api/client';
import { Cargando, ErrorBox, Vacio } from '../components/UI';
import { C, R, sombra } from '../theme';

const GRUPOS = [
  { k: 'vencidas',  nom: 'Vencidas',    color: C.bordo },
  { k: 'hoy',       nom: 'Para hoy',    color: C.warn },
  { k: 'semana',    nom: 'Esta semana', color: C.tealDeep },
  { k: 'despues',   nom: 'Mas adelante',color: C.ink3 },
  { k: 'sin_fecha', nom: 'Sin fecha',   color: C.ink3 },
  { k: 'hechas',    nom: 'Completadas', color: C.ok },
];

const PRIORIDAD = {
  urgente: { c: '#790F35', bg: '#F6E3EA' },
  alta:    { c: '#BA7517', bg: '#FAEEDA' },
  normal:  null,
  baja:    null,
};

function textoVence(t) {
  if (t.dias === null) return null;
  if (t.dias < -1) return `hace ${Math.abs(t.dias)} dias`;
  if (t.dias === -1) return 'ayer';
  if (t.dias === 0) return 'hoy';
  if (t.dias === 1) return 'manana';
  if (t.dias <= 7) return `en ${t.dias} dias`;
  const d = new Date(`${t.vence}T12:00:00`);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function GestionScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [espacios, setEspacios] = useState([]);
  const [espacio, setEspacio] = useState(null);
  const [scope, setScope] = useState('mias');
  const [puedeTodas, setPuedeTodas] = useState(false);
  const [verHechas, setVerHechas] = useState(false);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [t, e] = await Promise.all([
        gestion.misTareas({
          scope,
          ...(espacio ? { espacio_id: espacio } : {}),
          ...(verHechas ? { completadas: 1 } : {}),
        }),
        gestion.espacios().catch(() => ({ items: [] })),
      ]);
      setData(t.grupos);
      setPuedeTodas(!!t.puede_ver_todas);
      // El servidor puede bajar el alcance pedido si no tenes permiso.
      if (t.scope && t.scope !== scope) setScope(t.scope);
      setEspacios(e.items || []);
    } catch (err) {
      setError(err.message);
      setData({});
    }
  }, [espacio, verHechas, scope]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  useEffect(() => { cargar(); }, [cargar]);

  const completar = async (tarea) => {
    // Optimista: sale de la lista al instante. La tarea se marca tambien en
    // gestion, no es una copia.
    const antes = data;
    setData((d) => {
      const nuevo = {};
      for (const [k, arr] of Object.entries(d)) nuevo[k] = arr.filter((x) => x.id !== tarea.id);
      return nuevo;
    });
    try {
      await gestion.completar(tarea.id, !tarea.completada);
    } catch (e) {
      setData(antes);
    }
  };

  if (data === null) return <Cargando texto="Cargando tus tareas" />;
  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;

  const secciones = GRUPOS
    .filter((g) => (data[g.k] || []).length)
    .map((g) => ({ ...g, data: data[g.k] }));

  // En "Mias" filtramos por los espacios donde tengo algo; en los otros
  // alcances, por los que tienen pendientes de cualquiera.
  const clave = scope === 'mias' ? 'mias' : 'pendientes';
  const conPendientes = espacios.filter((e) => e[clave] > 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.scopes}>
        {[
          { k: 'mias', nom: 'Mias' },
          { k: 'espacios', nom: 'Mis espacios' },
          ...(puedeTodas ? [{ k: 'todas', nom: 'Todas' }] : []),
        ].map((o) => (
          <Pressable
            key={o.k}
            onPress={() => { setScope(o.k); setEspacio(null); }}
            style={[s.scope, scope === o.k && s.scopeOn]}
          >
            <Text style={[s.scopeTxt, scope === o.k && { color: C.navy, fontWeight: '700' }]}>
              {o.nom}
            </Text>
          </Pressable>
        ))}
      </View>

      {conPendientes.length > 1 || espacio ? (
        <View style={s.filtros}>
          <Pressable onPress={() => setEspacio(null)} style={[s.chip, !espacio && s.chipOn]}>
            <Text style={[s.chipTxt, !espacio && { color: '#fff' }]}>Todos</Text>
          </Pressable>
          {espacios.filter((e) => e[clave] > 0 || e.id === espacio).map((e) => (
            <Pressable key={e.id} onPress={() => setEspacio(espacio === e.id ? null : e.id)}
              style={[s.chip, espacio === e.id && s.chipOn]}>
              <View style={[s.punto, { backgroundColor: e.color || C.ink3 }]} />
              <Text style={[s.chipTxt, espacio === e.id && { color: '#fff' }]}>
                {e.nombre}{e[clave] ? ` ${e[clave]}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <SectionList
        sections={secciones}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        stickySectionHeadersEnabled={false}
        refreshControl={(
          <RefreshControl
            refreshing={refrescando}
            tintColor={C.teal}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
          />
        )}
        ListEmptyComponent={(
          <Vacio
            icono="task-alt"
            titulo={scope === 'mias' ? 'Nada tuyo pendiente' : 'Sin pendientes'}
            texto={scope === 'mias'
              ? 'Proba en "Mis espacios" para ver el trabajo de tu area.'
              : 'No hay tareas pendientes en este filtro.'}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={s.seccion}>
            <View style={[s.puntoSec, { backgroundColor: section.color }]} />
            <Text style={[s.seccionTxt, { color: section.color }]}>
              {section.nom.toUpperCase()}
            </Text>
            <Text style={s.seccionN}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const p = PRIORIDAD[item.prioridad];
          const vence = textoVence(item);
          return (
            <Pressable
              style={[s.tarea, sombra]}
              onPress={() => navigation.navigate('Tarea', { id: item.id, titulo: item.titulo })}
            >
              <Pressable onPress={() => completar(item)} hitSlop={10} style={{ paddingTop: 1 }}>
                <MaterialIcons
                  name={item.completada ? 'check-circle' : 'radio-button-unchecked'}
                  size={23}
                  color={item.completada ? C.ok : C.ink3}
                />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={[s.titulo, item.completada && s.tachado]} numberOfLines={2}>
                  {item.titulo}
                </Text>

                <View style={s.meta}>
                  {item.espacio ? (
                    <View style={s.espacio}>
                      <View style={[s.punto, { backgroundColor: item.espacio_color || C.ink3 }]} />
                      <Text style={s.espacioTxt}>{item.espacio}</Text>
                    </View>
                  ) : null}
                  {vence ? (
                    <Text style={[s.vence, item.dias < 0 && { color: C.bordo, fontWeight: '700' }]}>
                      {vence}
                    </Text>
                  ) : null}
                  {item.sin_asignar ? (
                    <View style={s.sinAsignar}>
                      <MaterialIcons name="person-off" size={11} color={C.warn} />
                      <Text style={s.sinAsignarTxt}>sin asignar</Text>
                    </View>
                  ) : null}
                  {item.subtareas > 0 ? (
                    <Text style={s.sub}>{item.subtareas_ok}/{item.subtareas}</Text>
                  ) : null}
                  {item.comentarios > 0 ? (
                    <View style={s.espacio}>
                      <MaterialIcons name="chat-bubble-outline" size={12} color={C.ink3} />
                      <Text style={s.sub}>{item.comentarios}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {p ? (
                <View style={[s.prio, { backgroundColor: p.bg }]}>
                  <Text style={[s.prioTxt, { color: p.c }]}>{item.prioridad}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListFooterComponent={(
          <Pressable style={s.verHechas} onPress={() => setVerHechas(!verHechas)}>
            <MaterialIcons name={verHechas ? 'visibility-off' : 'history'} size={17} color={C.tealDeep} />
            <Text style={s.verHechasTxt}>
              {verHechas ? 'Ocultar completadas' : 'Ver completadas'}
            </Text>
          </Pressable>
        )}
      />

      <Pressable style={s.fab} onPress={() => navigation.navigate('TareaForm')}>
        <MaterialIcons name="add" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  scopes: {
    flexDirection: 'row', gap: 4, backgroundColor: '#fff', margin: 14, marginBottom: 4,
    padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line,
  },
  scope: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  scopeOn: { backgroundColor: C.tealSoft },
  scopeTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  fab: {
    position: 'absolute', right: 18, bottom: 22, width: 54, height: 54, borderRadius: 27,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#072D40', shadowOpacity: 0.28, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  sinAsignar: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sinAsignarTxt: { fontSize: 10.5, color: C.warn, fontWeight: '600' },
  filtros: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: C.ink2 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, marginBottom: 9 },
  puntoSec: { width: 7, height: 7, borderRadius: 4 },
  seccionTxt: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1 },
  seccionN: { fontSize: 11.5, color: C.ink3, marginLeft: 'auto' },
  tarea: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#fff',
    borderRadius: R.lg, padding: 13, marginBottom: 8,
  },
  titulo: { fontSize: 14.5, fontWeight: '600', color: C.ink, lineHeight: 20 },
  tachado: { textDecorationLine: 'line-through', color: C.ink3, fontWeight: '400' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 6, flexWrap: 'wrap' },
  espacio: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  espacioTxt: { fontSize: 11.5, color: C.ink3 },
  vence: { fontSize: 11.5, color: C.ink3 },
  sub: { fontSize: 11.5, color: C.ink3 },
  prio: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  prioTxt: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  verHechas: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 22, paddingVertical: 10,
  },
  verHechasTxt: { fontSize: 13, fontWeight: '600', color: C.tealDeep },
});
