import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Avatar } from './components/UI';
import { C, R, iniciales } from './theme';

const ANCHO_CAJA = 132;
const SEPARACION = 14;   // entre hermanos
const ALTO_RAMA  = 26;   // largo de las lineas verticales

/**
 * Organigrama como diagrama, no como lista.
 *
 * El arbol se arma con columnas anidadas en vez de posiciones absolutas: cada
 * nodo es [caja, linea, fila de hijos], y cada hijo repite la estructura. Asi
 * los anchos se acomodan solos cuando alguien tiene mucha gente a cargo, sin
 * tener que calcular coordenadas.
 *
 * Se desplaza en las dos direcciones porque un organigrama de verdad no entra
 * en una pantalla de telefono, y achicarlo hasta que entre lo vuelve ilegible.
 */
export default function Diagrama({ personas, yo, onTocar }) {
  const porJefe = useMemo(() => {
    const m = {};
    (personas || []).forEach((p) => {
      const k = p.jefe_id || 'raiz';
      (m[k] = m[k] || []).push(p);
    });
    return m;
  }, [personas]);

  const raices = porJefe.raiz || [];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scrollH}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollV}>
        {/* Varias personas sin jefe = varias cabezas. Se dibujan lado a lado
            y unidas por una linea, que es como se lee una direccion
            compartida. */}
        {raices.length > 1 ? (
          <View style={s.cabezas}>
            <View style={s.lineaCabezas} />
            <View style={s.filaHijos}>
              {raices.map((p) => (
                <Rama key={p.id} persona={p} porJefe={porJefe} yo={yo} onTocar={onTocar} />
              ))}
            </View>
          </View>
        ) : (
          raices.map((p) => (
            <Rama key={p.id} persona={p} porJefe={porJefe} yo={yo} onTocar={onTocar} />
          ))
        )}
      </ScrollView>
    </ScrollView>
  );
}


function Rama({ persona, porJefe, yo, onTocar }) {
  const hijos = porJefe[persona.id] || [];

  return (
    <View style={s.rama}>
      <Caja persona={persona} esYo={persona.id === yo} onTocar={onTocar} />

      {hijos.length ? (
        <>
          {/* Baja del padre */}
          <View style={s.bajada} />

          {/* Horizontal que une a los hermanos. Con un solo hijo no se
              dibuja: quedaria un travesano de la nada. */}
          {hijos.length > 1 ? (
            <View style={s.travesanoWrap}>
              <View style={s.travesano} />
            </View>
          ) : null}

          <View style={s.filaHijos}>
            {hijos.map((h) => (
              <View key={h.id} style={s.hijo}>
                {hijos.length > 1 ? <View style={s.subida} /> : null}
                <Rama persona={h} porJefe={porJefe} yo={yo} onTocar={onTocar} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}


function Caja({ persona, esYo, onTocar }) {
  const color = persona.area_color || C.tealDeep;
  const aCargo = persona.a_cargo || 0;

  return (
    <Pressable
      style={[s.caja, esYo && s.cajaYo, { borderTopColor: color }]}
      onPress={() => onTocar && onTocar(persona)}
    >
      <Avatar
        texto={iniciales(...String(persona.nombre).split(' '))}
        tam={38}
        fondo={`${color}1F`}
        color={color}
      />
      <Text style={s.nombre} numberOfLines={2}>{persona.nombre}</Text>
      {persona.puesto ? (
        <Text style={s.puesto} numberOfLines={2}>{persona.puesto}</Text>
      ) : null}

      {aCargo > 0 ? (
        <View style={[s.aCargo, { backgroundColor: `${color}1F` }]}>
          <MaterialIcons name="group" size={10} color={color} />
          <Text style={[s.aCargoN, { color }]}>{aCargo}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrollH: { paddingHorizontal: 20, paddingVertical: 8 },
  scrollV: { paddingBottom: 40, alignItems: 'center' },

  cabezas: { alignItems: 'center' },
  lineaCabezas: { width: 1, height: 0 },

  rama: { alignItems: 'center' },
  bajada: { width: 2, height: ALTO_RAMA, backgroundColor: C.line },

  // El travesano se estira al ancho de la fila de hijos, y los extremos se
  // recortan para que no sobresalga de la primera y la ultima caja.
  travesanoWrap: { width: '100%', alignItems: 'center' },
  travesano: {
    height: 2, backgroundColor: C.line,
    width: '100%', maxWidth: 4000,
  },
  subida: { width: 2, height: ALTO_RAMA, backgroundColor: C.line, alignSelf: 'center' },

  filaHijos: { flexDirection: 'row', alignItems: 'flex-start' },
  hijo: { alignItems: 'center', paddingHorizontal: SEPARACION / 2 },

  caja: {
    width: ANCHO_CAJA, backgroundColor: '#fff', borderRadius: R.md,
    borderTopWidth: 3, paddingHorizontal: 9, paddingTop: 11, paddingBottom: 10,
    alignItems: 'center',
    shadowColor: '#072D40', shadowOpacity: 0.09, shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cajaYo: { borderWidth: 1.5, borderColor: C.teal, borderTopWidth: 3 },
  nombre: {
    fontSize: 12.5, fontWeight: '700', color: C.ink,
    textAlign: 'center', marginTop: 7, lineHeight: 16,
  },
  puesto: {
    fontSize: 10, color: C.ink3, textAlign: 'center', marginTop: 2, lineHeight: 13,
  },
  aCargo: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, marginTop: 7,
  },
  aCargoN: { fontSize: 10, fontWeight: '700' },
});
