import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Linking, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { grupales } from '../api/client';
import { Cargando, ErrorBox, Card } from '../components/UI';
import { plata, fechaCorta } from './GrupalesScreen';
import { C, R, sombra } from '../theme';

/**
 * Reemplaza las variables de la plantilla con los datos del expediente.
 *
 * Son las mismas que usa el panel, así el pasajero recibe el mismo mensaje
 * lo mande quien lo mande y desde donde lo mande.
 */
function armarMensaje(plantilla, e, fecha) {
  return String(plantilla || '')
    .replace(/\{cliente\}/g, e.cliente_nombre || '')
    .replace(/\{destino\}/g, e.destino || 'tu destino')
    .replace(/\{salida\}/g, fechaCorta(fecha))
    .replace(/\{falta\}/g, plata(e.falta, e.moneda))
    .replace(/\{total\}/g, plata(e.monto_total, e.moneda));
}

export default function GrupalScreen({ route, navigation }) {
  const { fecha, nombre } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await grupales.detalle(fecha)); }
    catch (e) { setError(e.message); }
  }, [fecha]);

  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);
  useEffect(() => {
    navigation.setOptions({ title: nombre || 'Salida' });
  }, [nombre, navigation]);

  if (error) return <ErrorBox mensaje={error} onReintentar={cargar} />;
  if (!data) return <Cargando texto="Cargando" />;

  const r = data.resumen;
  if (!r) {
    return (
      <View style={s.vacioWrap}>
        <Text style={s.vacio}>Esta salida no tiene expedientes cargados.</Text>
      </View>
    );
  }

  /** Abre WhatsApp con el recordatorio ya escrito. */
  const recordar = (e) => {
    const tel = String(e.cliente_telefono || '').replace(/[^0-9]/g, '');
    if (!tel) {
      Alert.alert('Sin teléfono',
        `${e.cliente_nombre} no tiene teléfono cargado en el expediente.`);
      return;
    }
    const texto = armarMensaje(data.mensaje, e, fecha);
    Linking.openURL(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`);
  };

  const deben = data.items.filter((e) => e.falta > 0.5);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      <View style={[s.cab, sombra]}>
        <Text style={s.cabF}>{fechaCorta(fecha)}</Text>
        <View style={s.cabDatos}>
          <Dato n={r.pasajeros} t="pasajeros" />
          <Dato n={r.expedientes} t="expedientes" />
        </View>
        <View style={s.linea} />
        <View style={s.plataFila}>
          <View>
            <Text style={s.plataT}>Vendido</Text>
            <Text style={s.plataN}>{plata(r.venta)}</Text>
          </View>
          <View>
            <Text style={s.plataT}>Cobrado</Text>
            <Text style={[s.plataN, { color: C.teal }]}>{plata(r.cobrado)}</Text>
          </View>
          <View>
            <Text style={s.plataT}>Falta</Text>
            <Text style={[s.plataN, r.falta > 0.5 && { color: '#F0A0B4' }]}>
              {plata(r.falta)}
            </Text>
          </View>
        </View>
      </View>

      {data.notas ? (
        <View style={s.notas}>
          <MaterialIcons name="sticky-note-2" size={16} color="#854F0B" />
          <Text style={s.notasT}>{data.notas}</Text>
        </View>
      ) : null}

      {/* Los que deben van primero: es la razón por la que se entra acá. */}
      {deben.length ? (
        <>
          <Text style={s.seccion}>DEBEN · {deben.length}</Text>
          {deben.map((e) => (
            <Fila key={e.id} e={e} abierto={abierto === e.id}
              onTocar={() => setAbierto(abierto === e.id ? null : e.id)}
              onRecordar={() => recordar(e)} />
          ))}
        </>
      ) : null}

      <Text style={s.seccion}>TODOS · {data.items.length}</Text>
      {data.items.map((e) => (
        <Fila key={`t-${e.id}`} e={e} abierto={abierto === `t-${e.id}`}
          onTocar={() => setAbierto(abierto === `t-${e.id}` ? null : `t-${e.id}`)}
          onRecordar={() => recordar(e)} />
      ))}
    </ScrollView>
  );
}

function Fila({ e, abierto, onTocar, onRecordar }) {
  const debe = e.falta > 0.5;
  return (
    <View style={[s.exp, sombra]}>
      <Pressable style={s.expTop} onPress={onTocar}>
        <View style={{ flex: 1 }}>
          <Text style={s.cliente} numberOfLines={1}>{e.cliente_nombre}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {e.codigo}
            {e.pasajeros?.length ? ` · ${e.pasajeros.length} pax` : ''}
            {e.vendedora ? ` · ${e.vendedora}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.monto, debe ? { color: '#9B2340' } : { color: '#1B5E3F' }]}>
            {debe ? plata(e.falta, e.moneda) : 'al día'}
          </Text>
          {debe && e.pasajeros?.length > 1 ? (
            <Text style={s.porPax}>{plata(e.falta_persona, e.moneda)} c/u</Text>
          ) : null}
        </View>
        <MaterialIcons
          name={abierto ? 'expand-less' : 'expand-more'}
          size={20} color={C.ink3}
        />
      </Pressable>

      {abierto ? (
        <View style={s.detalle}>
          {e.pasajeros?.length ? e.pasajeros.map((p) => (
            <View key={p.id} style={s.pax}>
              <MaterialIcons
                name={p.falta_cargar?.length ? 'error-outline' : 'check-circle'}
                size={16}
                color={p.falta_cargar?.length ? '#9B2340' : '#1B5E3F'}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.paxN}>
                  {`${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre'}
                </Text>
                {p.falta_cargar?.length ? (
                  <Text style={s.paxF}>Falta {p.falta_cargar.join(', ')}</Text>
                ) : null}
              </View>
            </View>
          )) : (
            <Text style={s.sinPax}>Sin pasajeros cargados</Text>
          )}

          {e.comparten ? (
            <Text style={s.comparten}>Comparten habitación</Text>
          ) : null}

          {debe ? (
            <Pressable style={s.boton} onPress={onRecordar}>
              <MaterialIcons name="chat" size={17} color="#fff" />
              <Text style={s.botonT}>Mandar recordatorio</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Dato({ n, t }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
      <Text style={s.cabN}>{n}</Text>
      <Text style={s.cabT}>{t}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  cab: { backgroundColor: C.navy, borderRadius: R.lg, padding: 17 },
  cabF: { fontSize: 13, fontWeight: '700', color: C.teal, letterSpacing: 0.4 },
  cabDatos: { flexDirection: 'row', gap: 22, marginTop: 10 },
  cabN: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cabT: { fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  linea: { height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginVertical: 14 },
  plataFila: { flexDirection: 'row', justifyContent: 'space-between' },
  plataT: { fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  plataN: { fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 3 },
  notas: {
    flexDirection: 'row', gap: 8, backgroundColor: '#FAF3DF',
    borderRadius: R.md, padding: 12, marginTop: 12,
  },
  notasT: { flex: 1, fontSize: 12.5, color: '#854F0B', lineHeight: 18 },
  seccion: {
    fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: C.ink3,
    marginTop: 20, marginBottom: 8,
  },
  exp: { backgroundColor: '#fff', borderRadius: R.md, marginBottom: 8 },
  expTop: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  cliente: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  meta: { fontSize: 11.5, color: C.ink3, marginTop: 2 },
  monto: { fontSize: 14.5, fontWeight: '700' },
  porPax: { fontSize: 10.5, color: C.ink3, marginTop: 1 },
  detalle: {
    borderTopWidth: 1, borderTopColor: C.lineSoft, padding: 13, gap: 9,
  },
  pax: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  paxN: { fontSize: 13.5, color: C.ink },
  paxF: { fontSize: 11.5, color: '#9B2340', marginTop: 1 },
  sinPax: { fontSize: 12.5, color: C.ink3, fontStyle: 'italic' },
  comparten: { fontSize: 11.5, color: C.ink3, fontStyle: 'italic' },
  boton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#1B7F4C', borderRadius: R.sm,
    paddingVertical: 11, marginTop: 4,
  },
  botonT: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  vacioWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  vacio: { fontSize: 14, color: C.ink3, textAlign: 'center' },
});
