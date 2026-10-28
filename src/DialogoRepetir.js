// ============================================================================
// Repetir una tarea todos los meses
// ----------------------------------------------------------------------------
// Es mensual y nada mas, igual que en el panel: se elige el dia y si la copia
// conserva los asignados y las subtareas.
//
// Mas opciones -semanal, cada x dias- harian el formulario mas largo sin que
// nadie las pida: lo que se repite en la agencia son los cierres de mes y los
// controles mensuales.
// ============================================================================

import React, { useState } from 'react';
import {
  View, Text, Modal, StyleSheet, Pressable, ScrollView, Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R } from './theme';

export default function DialogoRepetir({ visible, actual, onGuardar, onCerrar }) {
  const [dia, setDia] = useState(actual?.dia_mes || 1);
  const [asignados, setAsignados] = useState(actual?.mantener_asignados !== 0);
  const [subtareas, setSubtareas] = useState(actual?.mantener_subtareas !== 0);

  const activa = !!(actual && actual.activo);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={s.fondo} onPress={onCerrar}>
        <Pressable style={s.caja} onPress={(e) => e.stopPropagation()}>
          <View style={s.cab}>
            <MaterialIcons name="autorenew" size={20} color={C.tealDeep} />
            <Text style={s.tit}>Repetir todos los meses</Text>
          </View>

          <Text style={s.rot}>QUÉ DÍA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dias}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <Pressable
                key={d}
                style={[s.dia, dia === d && s.diaOn]}
                onPress={() => setDia(d)}
              >
                <Text style={[s.diaT, dia === d && { color: '#fff', fontWeight: '700' }]}>
                  {d}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {dia > 28 ? (
            <Text style={s.aviso}>
              Los meses que no llegan al {dia} se crea el último día.
            </Text>
          ) : null}

          <View style={s.opcion}>
            <Text style={s.opcionT}>Mantener a quienes están asignados</Text>
            <Switch value={asignados} onValueChange={setAsignados}
              trackColor={{ true: C.teal }} />
          </View>

          <View style={s.opcion}>
            <Text style={s.opcionT}>Copiar las subtareas</Text>
            <Switch value={subtareas} onValueChange={setSubtareas}
              trackColor={{ true: C.teal }} />
          </View>

          <Text style={s.nota}>
            Esta tarea cuenta como la de este mes. La próxima aparece el mes
            que viene.
          </Text>

          <View style={s.botones}>
            {activa ? (
              <Pressable
                style={s.quitar}
                onPress={() => onGuardar({ activo: 0, dia_mes: dia })}
              >
                <Text style={s.quitarT}>Dejar de repetir</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={s.guardar}
              onPress={() => onGuardar({
                activo: 1,
                dia_mes: dia,
                mantener_asignados: asignados ? 1 : 0,
                mantener_subtareas: subtareas ? 1 : 0,
              })}
            >
              <Text style={s.guardarT}>{activa ? 'Guardar' : 'Activar'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: {
    flex: 1, backgroundColor: 'rgba(7,45,64,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 22,
  },
  caja: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: R.lg, padding: 20 },
  cab: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  tit: { fontSize: 16.5, fontWeight: '700', color: C.ink },
  rot: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, color: C.ink3, marginBottom: 9 },
  dias: { gap: 7, paddingRight: 8 },
  dia: {
    width: 40, height: 40, borderRadius: 11, alignItems: 'center',
    justifyContent: 'center', backgroundColor: C.bg,
  },
  diaOn: { backgroundColor: C.navy },
  diaT: { fontSize: 14.5, color: C.ink2 },
  aviso: { fontSize: 11.5, color: C.ink3, marginTop: 9, fontStyle: 'italic' },
  opcion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, marginTop: 16,
  },
  opcionT: { flex: 1, fontSize: 14, color: C.ink },
  nota: { fontSize: 11.5, color: C.ink3, marginTop: 16, lineHeight: 17 },
  botones: { flexDirection: 'row', gap: 9, marginTop: 20 },
  quitar: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    borderRadius: R.md, backgroundColor: '#FBE9ED',
  },
  quitarT: { fontSize: 14, fontWeight: '600', color: '#9B2340' },
  guardar: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    borderRadius: R.md, backgroundColor: C.navy,
  },
  guardarT: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
