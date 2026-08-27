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

  // Quienes cuelgan de cualquiera de las cabezas. Se juntan en una sola fila
  // porque el equipo depende de la direccion, no de uno u otro director: si
  // cada uno lleva su propia rama, el mismo nivel jerarquico queda dibujado
  // a dos alturas distintas y no se entiende.
  const hijosDeDireccion = [];
  raices.forEach((r) => {
    (porJefe[r.id] || []).forEach((h) => {
      if (!hijosDeDireccion.some((x) => x.id === h.id)) {
        // Se guarda de que director cuelga: al juntarlos en un bloque se
        // perderia el dato, y con dos directores importa saberlo.
        hijosDeDireccion.push({ ...h, _director: r.id });
      }
    });
  });

  const colorDirector = {};
  raices.forEach((r, i) => {
    colorDirector[r.id] = r.area_color || (i === 0 ? C.tealDeep : '#790F35');
  });

  const variasCabezas = raices.length > 1;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scrollH}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollV}>
        {variasCabezas ? (
          <View style={s.rama}>
            {/* La direccion como un bloque, no como cajas sueltas. */}
            <View style={s.bloque}>
              <Text style={s.bloqueTit}>DIRECCIÓN</Text>
              <View style={s.bloqueCajas}>
                {raices.map((p) => (
                  <View key={p.id} style={s.cabeza}>
                    <Caja persona={p} esYo={p.id === yo} onTocar={onTocar} />
                    <View style={[s.marcaDirector, { backgroundColor: colorDirector[p.id] }]} />
                  </View>
                ))}
              </View>
            </View>

            {hijosDeDireccion.length ? (
              <>
                <View style={s.bajada} />
                {hijosDeDireccion.length > 1 ? (
                  <View style={s.travesanoWrap}>
                    <View style={s.travesano} />
                  </View>
                ) : null}
                <View style={s.filaHijos}>
                  {hijosDeDireccion.map((h) => (
                    <View key={h.id} style={s.hijo}>
                      {hijosDeDireccion.length > 1 ? (
                        <View style={[s.subida,
                                      { backgroundColor: colorDirector[h._director] || C.line }]} />
                      ) : null}
                      <Rama persona={h} porJefe={porJefe} yo={yo} onTocar={onTocar} />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
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

      <View style={s.marcas}>
        {aCargo > 0 ? (
          <View style={[s.aCargo, { backgroundColor: `${color}1F` }]}>
            <MaterialIcons name="group" size={10} color={color} />
            <Text style={[s.aCargoN, { color }]}>{aCargo}</Text>
          </View>
        ) : null}

        {/* Quien depende de dos areas se marca aca. En el arbol sigue
            colgando de su jefa principal: dos ramas para la misma persona
            harian ilegible el diagrama. */}
        {persona.jefes_extra && persona.jefes_extra.length ? (
          <View style={[s.aCargo, { backgroundColor: '#EEEDFE' }]}>
            <MaterialIcons name="alt-route" size={10} color="#5B52C4" />
            <Text style={[s.aCargoN, { color: '#5B52C4' }]}>
              {persona.jefes_extra.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrollH: { paddingHorizontal: 20, paddingVertical: 8 },
  scrollV: { paddingBottom: 40, alignItems: 'center' },

  bloque: {
    backgroundColor: '#fff', borderRadius: R.lg, paddingHorizontal: 14,
    paddingTop: 9, paddingBottom: 13, borderWidth: 2, borderColor: C.navy,
    alignItems: 'center',
    shadowColor: '#072D40', shadowOpacity: 0.12, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  bloqueTit: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: C.navy,
    marginBottom: 9,
  },
  bloqueCajas: { flexDirection: 'row', gap: 12 },
  cabeza: { alignItems: 'center' },
  // La barrita bajo cada director se repite en la linea de sus ramas: con
  // dos directores, es lo que dice quien lleva que.
  marcaDirector: { width: 30, height: 3, borderRadius: 2, marginTop: 6 },

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
    alignItems: 'center', borderWidth: 1, borderColor: C.line,
  },
  cajaYo: { borderWidth: 1.5, borderColor: C.teal, borderTopWidth: 3 },
  nombre: {
    fontSize: 12.5, fontWeight: '700', color: C.ink,
    textAlign: 'center', marginTop: 7, lineHeight: 16,
  },
  puesto: {
    fontSize: 10, color: C.ink3, textAlign: 'center', marginTop: 2, lineHeight: 13,
  },
  marcas: { flexDirection: 'row', gap: 5, marginTop: 7 },
  aCargo: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2,
  },
  aCargoN: { fontSize: 10, fontWeight: '700' },
});
