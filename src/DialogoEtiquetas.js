// ============================================================================
// Elegir las etiquetas de una tarea
// ----------------------------------------------------------------------------
// Solo se eligen entre las que ya existen: crearlas se hace desde el panel,
// donde se define el color y a que espacio pertenecen.
// ============================================================================

import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R } from './theme';

export default function DialogoEtiquetas({ visible, todas, puestas, onGuardar, onCerrar }) {
  const [sel, setSel] = useState((puestas || []).map((e) => e.id));

  const alternar = (id) => {
    setSel((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={s.fondo} onPress={onCerrar}>
        <Pressable style={s.caja} onPress={(e) => e.stopPropagation()}>
          <Text style={s.tit}>Etiquetas</Text>

          <ScrollView style={{ maxHeight: 340 }}>
            {(todas || []).map((e) => {
              const on = sel.includes(e.id);
              return (
                <Pressable key={e.id} style={s.fila} onPress={() => alternar(e.id)}>
                  <View style={[s.punto, { backgroundColor: e.color || C.ink3 }]} />
                  <Text style={s.nombre}>{e.nombre}</Text>
                  <MaterialIcons
                    name={on ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={on ? C.tealDeep : C.ink3}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={s.guardar} onPress={() => onGuardar(sel)}>
            <Text style={s.guardarT}>Guardar</Text>
          </Pressable>
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
  caja: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: R.lg, padding: 20 },
  tit: { fontSize: 16.5, fontWeight: '700', color: C.ink, marginBottom: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  punto: { width: 12, height: 12, borderRadius: 6 },
  nombre: { flex: 1, fontSize: 14.5, color: C.ink },
  guardar: {
    alignItems: 'center', paddingVertical: 13, borderRadius: R.md,
    backgroundColor: C.navy, marginTop: 16,
  },
  guardarT: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
