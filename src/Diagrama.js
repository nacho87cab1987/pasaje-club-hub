import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Avatar } from './components/UI';
import { C, R, iniciales } from './theme';

const ANCHO = 208;

// Las lineas del arbol. Mas gruesas y mas oscuras que el borde de las
// tarjetas: son lo que explica quien depende de quien, no un separador.
const GROSOR = 3;
const LINEA = '#B9CBD4';

function antiguedad(meses) {
  if (meses === null || meses === undefined) return null;
  if (meses < 1) return 'Recién entró';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const a = Math.floor(meses / 12);
  return `${a} ${a === 1 ? 'año' : 'años'}`;
}

/**
 * El organigrama, creciendo hacia abajo y a la derecha.
 *
 * Antes crecia a lo ancho: cada nivel abria en abanico y con quince personas
 * habia que desplazarse de costado para ver un solo nivel. Asi cada rama baja
 * en vertical y solo se corre a la derecha al entrar un nivel, que es como se
 * lee una lista.
 *
 * Cada persona con equipo se pliega tocando el numero. Arranca plegado a
 * partir del tercer nivel: mostrar la empresa entera de una no deja ver nada.
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

  const hijosDireccion = useMemo(() => {
    const r = [];
    raices.forEach((x) => {
      (porJefe[x.id] || []).forEach((h) => {
        if (!r.some((y) => y.id === h.id)) r.push(h);
      });
    });
    return r;
  }, [porJefe, raices]);

  const [plegados, setPlegados] = useState(() => {
    // Arranca mostrando dos niveles: las jefaturas y su gente directa. De ahi
    // para abajo viene plegado, porque desplegar la empresa entera de una no
    // deja ver nada.
    const cerrar = new Set();
    const bajar = (id, nivel) => {
      (porJefe[id] || []).forEach((h) => {
        if (nivel >= 1 && (porJefe[h.id] || []).length) cerrar.add(h.id);
        bajar(h.id, nivel + 1);
      });
    };
    const arranque = (porJefe.raiz || []).length > 1
      ? (porJefe.raiz || []).flatMap((r) => porJefe[r.id] || [])
      : (porJefe.raiz || []);
    arranque.forEach((h) => bajar(h.id, 1));
    return cerrar;
  });

  const [todoAbierto, setTodoAbierto] = useState(false);

  const alternar = (id) => {
    setPlegados((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const alternarTodo = () => {
    if (todoAbierto) {
      const conEquipo = (personas || [])
        .filter((p) => (porJefe[p.id] || []).length)
        .map((p) => p.id);
      setPlegados(new Set(conEquipo));
    } else {
      setPlegados(new Set());
    }
    setTodoAbierto(!todoAbierto);
  };

  const arriba = raices.length > 1 ? hijosDireccion : raices;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.acciones}>
        <Pressable style={s.accion} onPress={alternarTodo}>
          <MaterialIcons
            name={todoAbierto ? 'unfold-less' : 'unfold-more'}
            size={16}
            color={C.tealDeep}
          />
          <Text style={s.accionTxt}>
            {todoAbierto ? 'Contraer todo' : 'Expandir todo'}
          </Text>
        </Pressable>
        <Text style={s.total}>
          {(personas || []).filter((p) => !p.inactivo).length} personas
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 70 }}
        >
          {raices.length > 1 ? (
            <View style={[s.direccion, { alignSelf: 'center' }]}>
              {raices.map((p) => (
                <Tarjeta key={p.id} persona={p} esYo={p.id === yo} onTocar={onTocar} />
              ))}
            </View>
          ) : null}

          <View style={s.filaHijos}>
            {arriba.map((p) => (
              <View key={p.id} style={s.hijo}>
                <Rama
                  persona={p}
                  porJefe={porJefe}
                  yo={yo}
                  onTocar={onTocar}
                  plegados={plegados}
                  alternar={alternar}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}


function Rama({ persona, porJefe, yo, onTocar, plegados, alternar }) {
  const hijos = porJefe[persona.id] || [];
  const plegado = plegados.has(persona.id);

  // Cuando alguien tiene varias personas a cargo y ninguna tiene equipo
  // propio -una supervisora con sus vendedoras- se apilan en columna.
  //
  // El abanico se lee bien cuando hay ramas, pero con diez hojas al lado se
  // vuelve un diagrama de dos mil pixeles de ancho. En columna ocupa lo mismo
  // que una sola tarjeta.
  const todasHojas = hijos.every((h) => !(porJefe[h.id] || []).length);
  const enColumna = hijos.length >= 3 && todasHojas;

  return (
    <View style={{ alignItems: 'center' }}>
      <Tarjeta
        persona={persona}
        esYo={persona.id === yo}
        onTocar={onTocar}
        hijos={hijos.length}
        plegado={plegado}
        onPlegar={hijos.length ? () => alternar(persona.id) : null}
      />

      {hijos.length && !plegado && enColumna ? (
        <>
          <View style={s.bajada} />
          <View style={s.columna}>
            {hijos.map((h, i) => (
              <View key={h.id} style={s.enFila}>
                <View style={s.espinaWrap}>
                  <View style={[s.espinaTramo, i === hijos.length - 1 && s.espinaCorta]} />
                  <View style={s.tick} />
                </View>
                <Tarjeta
                  persona={h}
                  esYo={h.id === yo}
                  onTocar={onTocar}
                  compacta
                />
              </View>
            ))}
          </View>
        </>
      ) : hijos.length && !plegado ? (
        <>
          <View style={s.bajada} />
          <View style={s.filaHijos}>
            {hijos.map((h, i) => (
              <View key={h.id} style={s.hijo}>
                {/* Cada hijo dibuja su mitad del travesano: las mitades de
                    hermanos contiguos se tocan y forman la linea. Asi no hay
                    que medir el ancho de nada. */}
                <View style={s.conector}>
                  {hijos.length > 1 ? (
                    <>
                      <View style={[s.mitad, i === 0 && s.invisible]} />
                      <View style={[s.mitad, i === hijos.length - 1 && s.invisible]} />
                    </>
                  ) : null}
                  <View style={s.bajadaHijo} />
                </View>

                <Rama
                  persona={h}
                  porJefe={porJefe}
                  yo={yo}
                  onTocar={onTocar}
                  plegados={plegados}
                  alternar={alternar}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}


function Tarjeta({ persona, esYo, onTocar, hijos = 0, plegado, onPlegar, compacta }) {
  const color = persona.area_color || C.tealDeep;
  const tiempo = antiguedad(persona.meses);

  // Version en fila para las columnas: mismo contenido, menos alto.
  if (compacta) {
    return (
      <Pressable
        style={[s.compacta, esYo && { borderColor: C.teal, borderWidth: 1.5 },
                { borderLeftColor: color, borderLeftWidth: 3 }]}
        onPress={() => onTocar && onTocar(persona)}
      >
        <Avatar
          persona={persona}
          texto={iniciales(...String(persona.nombre).split(' '))}
          tam={30}
          fondo={`${color}22`}
          color={color}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nombreC} numberOfLines={1}>{persona.nombre}</Text>
          {persona.puesto ? (
            <Text style={s.puestoC} numberOfLines={1}>{persona.puesto}</Text>
          ) : null}
        </View>
        {persona.jefes_extra && persona.jefes_extra.length ? (
          <MaterialIcons name="alt-route" size={13} color="#5B52C4" />
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={[s.tarjeta, esYo && { borderColor: C.teal, borderWidth: 1.5 }]}>
      {/* El avatar sale por arriba: separa una tarjeta de la siguiente sin
          gastar espacio vertical. */}
      <View style={s.avatarCaja}>
        <Avatar
          persona={persona}
          texto={iniciales(...String(persona.nombre).split(' '))}
          tam={38}
          fondo={`${color}22`}
          color={color}
        />
      </View>

      <Pressable style={s.cuerpo} onPress={() => onTocar && onTocar(persona)}>
        <View style={s.encabezado}>
          <Text style={s.nombre} numberOfLines={1}>{persona.nombre}</Text>
          <MaterialIcons name="open-in-new" size={14} color={C.ink3} />
        </View>

        {persona.puesto ? (
          <Text style={[s.puesto, { color }]} numberOfLines={1}>{persona.puesto}</Text>
        ) : null}
        {persona.email ? (
          <Text style={s.email} numberOfLines={1}>{persona.email}</Text>
        ) : null}

        <View style={s.pie}>
          {tiempo ? (
            <View style={s.chip}><Text style={s.chipTxt}>{tiempo}</Text></View>
          ) : <View />}

          <View style={s.marcas}>
            {persona.jefes_extra && persona.jefes_extra.length ? (
              <MaterialIcons name="alt-route" size={14} color="#5B52C4" />
            ) : null}
            {hijos > 0 ? (
              <Pressable style={s.equipo} onPress={onPlegar} hitSlop={10}>
                <MaterialIcons
                  name={plegado ? 'add-circle-outline' : 'remove-circle-outline'}
                  size={15}
                  color={C.tealDeep}
                />
                <Text style={s.equipoN}>{hijos}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  acciones: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10,
  },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  accionTxt: { fontSize: 12.5, fontWeight: '600', color: C.tealDeep },
  total: { fontSize: 11.5, color: C.ink3 },

  direccion: {
    borderWidth: 1.5, borderColor: C.navy, borderRadius: R.lg,
    paddingHorizontal: 10, paddingTop: 8, paddingBottom: 12, marginBottom: 4,
    flexDirection: 'row', gap: 10,
  },
  direccionTit: {
    fontSize: 9.5, fontWeight: '800', letterSpacing: 1.3, color: C.navy,
    marginBottom: 4, marginLeft: 2,
  },

  tarjeta: {
    width: ANCHO, backgroundColor: '#fff', borderRadius: 13,
    borderWidth: 1, borderColor: C.line, marginTop: 18,
    shadowColor: '#072D40', shadowOpacity: 0.07, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatarCaja: {
    position: 'absolute', top: -16, left: 12, zIndex: 2,
    borderRadius: 22, borderWidth: 2.5, borderColor: '#fff',
  },
  cuerpo: { paddingTop: 26, paddingHorizontal: 12, paddingBottom: 10 },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: { flex: 1, fontSize: 13.5, fontWeight: '700', color: C.ink },
  puesto: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  email: { fontSize: 10.5, color: C.ink3, marginTop: 3 },
  pie: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 9,
  },
  chip: {
    backgroundColor: '#FAF3DF', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2.5,
  },
  chipTxt: { fontSize: 10, fontWeight: '600', color: '#7A6320' },
  marcas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  equipo: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  equipoN: { fontSize: 11.5, fontWeight: '700', color: C.tealDeep },

  // Las columnas, para equipos de hojas.
  columna: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  enFila: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 6 },
  espinaWrap: { width: 16, justifyContent: 'center' },
  espinaTramo: {
    position: 'absolute', left: 0, top: -6, bottom: 0, width: GROSOR,
    backgroundColor: LINEA,
  },
  espinaCorta: { bottom: '50%' },
  tick: { width: 14, height: GROSOR, backgroundColor: LINEA, marginLeft: 2 },
  compacta: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    width: ANCHO, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 8,
  },
  nombreC: { fontSize: 12.5, fontWeight: '600', color: C.ink },
  puestoC: { fontSize: 10, color: C.ink3, marginTop: 1 },

  // El abanico: los hijos van lado a lado debajo del padre.
  bajada: { width: GROSOR, height: 22, backgroundColor: LINEA },
  filaHijos: { flexDirection: 'row', alignItems: 'flex-start' },
  hijo: { alignItems: 'center', paddingHorizontal: 9 },
  // alignSelf stretch y no width 100%: dentro de un contenedor que se ajusta
  // al contenido, el porcentaje resuelve a cero y las lineas desaparecen.
  // Con stretch toma el ancho real de la rama que tiene debajo.
  conector: { height: 22, alignSelf: 'stretch', flexDirection: 'row' },
  mitad: { flex: 1, height: GROSOR, backgroundColor: LINEA },
  invisible: { backgroundColor: 'transparent' },
  bajadaHijo: {
    position: 'absolute', left: '50%', marginLeft: -GROSOR / 2, top: 0,
    width: GROSOR, height: 22, backgroundColor: LINEA,
  },
});
