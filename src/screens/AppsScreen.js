import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Vacio } from '../components/UI';
import { C, R, sombra, icono } from '../theme';

// Las pantallas que ya existen. El resto de los modulos habilitados muestran
// la pantalla "en construccion" con su nombre, en vez de desaparecer: si el
// servidor lo habilito, la persona tiene que verlo.
const IMPLEMENTADOS = { personas: 'Personas', admin: 'Admin', crm: 'CRM', gestion: 'Gestion', documentos: 'Documentos', academia: 'Academia', organigrama: 'Organigrama', presupuestos: 'Presupuestos',
  cumpleanos: 'Cumpleanos', cumples: 'Cumpleanos', muro: 'Inicio',
  expedientes: 'Expedientes', equipo: 'Equipo', comisiones: 'Comisiones',
  onboarding: 'Onboarding' };

const TITULOS = {
  general: 'General',
  cultura: 'Cultura',
  rrhh: 'Recursos humanos',
  desarrollo: 'Tu desarrollo',
  comercial: 'Comercial',
  sistema: 'Sistema',
};

export default function AppsScreen({ navigation }) {
  const { modulos, refrescar } = useAuth();
  const [refrescando, setRefrescando] = React.useState(false);

  const grupos = useMemo(() => {
    const g = {};
    for (const m of modulos) {
      const k = m.grupo || 'general';
      (g[k] = g[k] || []).push(m);
    }
    return g;
  }, [modulos]);

  const alRefrescar = async () => {
    setRefrescando(true);
    await refrescar();
    setRefrescando(false);
  };

  const abrir = (m) => {
    const pantalla = IMPLEMENTADOS[m.slug];
    if (pantalla) navigation.navigate(pantalla);
    else navigation.navigate('Pendiente', { modulo: m });
  };

  if (!modulos.length) {
    return <Vacio icono="grid-view" titulo="Sin modulos" texto="Todavia no tenes ningun modulo habilitado." />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={C.teal} />}
    >
      {Object.entries(grupos).map(([clave, items]) => (
        <View key={clave}>
          <Text style={s.seccion}>{(TITULOS[clave] || clave).toUpperCase()}</Text>
          <View style={s.grid}>
            {items.map((m) => (
              <Pressable
                key={m.slug}
                onPress={() => abrir(m)}
                style={({ pressed }) => [s.app, sombra, pressed && { transform: [{ scale: 0.96 }] }]}
              >
                <View style={[s.bx, { backgroundColor: m.color_fondo || C.tealSoft }]}>
                  <MaterialIcons name={icono(m.icono)} size={25} color={m.color || C.tealDeep} />
                </View>
                <Text style={s.nom} numberOfLines={2}>{m.nombre}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Text style={s.pie}>
        Ves {modulos.length} modulos. Si necesitas alguno mas, pedilo a administracion.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, color: C.ink3, marginTop: 18, marginBottom: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  app: {
    width: '31.2%', backgroundColor: C.card, borderRadius: R.lg,
    paddingTop: 14, paddingBottom: 11, paddingHorizontal: 5, alignItems: 'center',
  },
  bx: { width: 46, height: 46, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  nom: { fontSize: 12, fontWeight: '600', color: C.ink, textAlign: 'center', lineHeight: 15 },
  pie: { fontSize: 12.5, color: C.ink3, textAlign: 'center', marginTop: 26, lineHeight: 18 },
});
