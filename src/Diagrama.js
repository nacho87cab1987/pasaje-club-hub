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
      // Sin esto, al achicar con dos dedos el diagrama se recorta al ancho
      // original en vez de mostrar lo que ahora entra.
      style={{ flex: 1 }}
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
                <View style={s.filaHijos}>
                  {hijosDeDireccion.map((h, i) => (
                    <View key={h.id} style={s.hijo}>
                      <Conector
                        primero={i === 0}
                        ultimo={i === hijosDeDireccion.length - 1}
                        unico={hijosDeDireccion.length === 1}
                        color={colorDirector[h._director]}
                      />
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

  // Cuando alguien tiene varias personas a cargo y ninguna tiene equipo
  // propio -el caso de una supervisora con sus vendedoras- se apilan hacia
  // abajo en vez de abrirse a lo ancho.
  //
  // Un organigrama que crece a lo ancho obliga a desplazarse de costado para
  // ver un solo nivel; creciendo hacia abajo se recorre como cualquier lista.
  const todasHojas = hijos.every((h) => !(porJefe[h.id] || []).length);
  const enColumna = hijos.length >= 3 && todasHojas;

  if (enColumna) {
    return (
      <View style={s.rama}>
        <Caja persona={persona} esYo={persona.id === yo} onTocar={onTocar} />
        <View style={s.bajada} />

        <View style={s.columna}>
          {hijos.map((h, i) => (
            <View key={h.id} style={s.enFila}>
              {/* La vertical se dibuja por fila y no como una sola linea de
                  fondo: asi no depende de que el contenedor tenga un alto
                  ya calculado, que es lo que la hacia desaparecer. */}
              <View style={s.espinaWrap}>
                <View style={[s.espinaTramo, i === hijos.length - 1 && s.espinaCorta]} />
                <View style={s.tick} />
              </View>
              <Caja persona={h} esYo={h.id === yo} onTocar={onTocar} compacta />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={s.rama}>
      <Caja persona={persona} esYo={persona.id === yo} onTocar={onTocar} />

      {hijos.length ? (
        <>
          <View style={s.bajada} />
          <View style={s.filaHijos}>
            {hijos.map((h, i) => (
              <View key={h.id} style={s.hijo}>
                <Conector
                  primero={i === 0}
                  ultimo={i === hijos.length - 1}
                  unico={hijos.length === 1}
                />
                <Rama persona={h} porJefe={porJefe} yo={yo} onTocar={onTocar} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}


/**
 * El tramo de linea que une a un hijo con su padre.
 *
 * En vez de dibujar un travesano que abarque toda la fila -que obligaria a
 * medir el ancho de los hijos- cada hijo dibuja su propia mitad: la izquierda
 * salvo que sea el primero, la derecha salvo que sea el ultimo, y siempre la
 * bajada al centro. Las mitades de hermanos contiguos se tocan y forman la
 * linea completa.
 */
function Conector({ primero, ultimo, unico, color }) {
  const tinte = color ? { backgroundColor: color } : null;
  return (
    <View style={s.conector}>
      {!unico ? (
        <>
          <View style={[s.mitad, tinte, primero && s.invisible]} />
          <View style={[s.mitad, tinte, ultimo && s.invisible]} />
        </>
      ) : null}
      <View style={[s.bajadaHijo, tinte]} />
    </View>
  );
}


function Caja({ persona, esYo, onTocar, compacta }) {
  const color = persona.area_color || C.tealDeep;
  const aCargo = persona.a_cargo || 0;

  // Version en fila: ocupa menos alto y permite apilar muchas sin que el
  // diagrama se vuelva larguisimo.
  if (compacta) {
    return (
      <Pressable
        style={[s.cajaCompacta, esYo && s.cajaYo, { borderLeftColor: color }]}
        onPress={() => onTocar && onTocar(persona)}
      >
        <Avatar
          texto={iniciales(...String(persona.nombre).split(' '))}
          tam={28}
          fondo={`${color}1F`}
          color={color}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nombreCompacto} numberOfLines={1}>{persona.nombre}</Text>
          {persona.puesto ? (
            <Text style={s.puestoCompacto} numberOfLines={1}>{persona.puesto}</Text>
          ) : null}
        </View>
        {persona.jefes_extra && persona.jefes_extra.length ? (
          <MaterialIcons name="alt-route" size={13} color="#5B52C4" />
        ) : null}
      </Pressable>
    );
  }

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

  // Alto fijo para que todos los hijos arranquen a la misma altura, y ancho
  // completo para que las mitades de hermanos contiguos se toquen.
  conector: { height: ALTO_RAMA, width: '100%', flexDirection: 'row' },
  mitad: { flex: 1, height: 2, backgroundColor: C.line },
  invisible: { backgroundColor: 'transparent' },
  bajadaHijo: {
    position: 'absolute', left: '50%', marginLeft: -1, top: 0,
    width: 2, height: ALTO_RAMA, backgroundColor: C.line,
  },

  filaHijos: { flexDirection: 'row', alignItems: 'flex-start' },

  columna: { alignItems: 'flex-start' },
  enFila: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 6 },
  // Cada fila trae su tramo de vertical; encadenados forman la linea.
  espinaWrap: { width: 16, justifyContent: 'center' },
  espinaTramo: {
    position: 'absolute', left: 0, top: -6, bottom: 0, width: 2,
    backgroundColor: C.line,
  },
  // El ultimo corta a la mitad: la linea termina donde entra la caja, no
  // sigue de largo hacia abajo.
  espinaCorta: { bottom: '50%' },
  tick: { width: 14, height: 2, backgroundColor: C.line, marginLeft: 2 },
  hijo: { alignItems: 'center', paddingHorizontal: SEPARACION / 2 },

  caja: {
    width: ANCHO_CAJA, backgroundColor: '#fff', borderRadius: R.md,
    borderTopWidth: 3, paddingHorizontal: 9, paddingTop: 11, paddingBottom: 10,
    alignItems: 'center', borderWidth: 1, borderColor: C.line,
  },
  cajaYo: { borderWidth: 1.5, borderColor: C.teal, borderTopWidth: 3 },
  cajaCompacta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: ANCHO_CAJA + 46, backgroundColor: '#fff', borderRadius: R.sm,
    borderLeftWidth: 3, paddingHorizontal: 9, paddingVertical: 7,
    borderWidth: 1, borderColor: C.line,
  },
  nombreCompacto: { fontSize: 12, fontWeight: '600', color: C.ink },
  puestoCompacto: { fontSize: 9.5, color: C.ink3, marginTop: 1 },
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
