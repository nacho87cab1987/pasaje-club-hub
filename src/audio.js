// ============================================================================
// Audio: grabar y reproducir
// ----------------------------------------------------------------------------
// Usa expo-audio, que es el paquete vigente desde SDK 53 (expo-av quedo
// deprecado). Todo esta envuelto en try/catch: si el modulo no esta
// disponible —por ejemplo en un Expo Go viejo— el resto del chat sigue
// funcionando y solo se oculta el boton de audio.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, R } from './theme';

let Audio = null;
try {
  Audio = require('expo-audio');
} catch (e) {
  Audio = null;
}

export const hayAudio = !!(Audio && Audio.useAudioRecorder);

export function segundos(s) {
  const n = Math.max(0, Math.round(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/**
 * Grabador. Devuelve null si expo-audio no esta disponible, para que la
 * pantalla pueda decidir no mostrar el boton en vez de romperse.
 */
export function useGrabador() {
  const recorder = hayAudio
    ? Audio.useAudioRecorder(Audio.RecordingPresets.HIGH_QUALITY)
    : null;
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const arrancar = async () => {
    if (!recorder) return false;
    try {
      const permiso = await Audio.requestRecordingPermissionsAsync();
      if (!permiso.granted) return 'sin_permiso';

      // En iOS hay que habilitar la grabacion explicitamente, si no el
      // archivo sale vacio y sin ningun error.
      await Audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setGrabando(true);
      setSeg(0);
      timer.current = setInterval(() => setSeg((x) => x + 1), 1000);
      return true;
    } catch (e) {
      return false;
    }
  };

  const parar = async () => {
    if (!recorder) return null;
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setGrabando(false);
    try {
      await recorder.stop();
      await Audio.setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      const dur = seg;
      setSeg(0);
      if (!uri || dur < 1) return null;   // toques accidentales
      return {
        uri,
        fileName: `audio_${Date.now()}.m4a`,
        mimeType: 'audio/mp4',
        duracion: dur,
      };
    } catch (e) {
      return null;
    }
  };

  const cancelar = async () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setGrabando(false);
    setSeg(0);
    try {
      if (recorder) {
        await recorder.stop();
        await Audio.setAudioModeAsync({ allowsRecording: false });
      }
    } catch (e) { /* nada que hacer */ }
  };

  return { disponible: hayAudio, grabando, seg, arrancar, parar, cancelar };
}


/** Burbuja de audio con play/pausa y barra de progreso. */
export function Reproductor({ uri, duracion, claro }) {
  const player = hayAudio ? Audio.useAudioPlayer({ uri }) : null;
  const estado = hayAudio && Audio.useAudioPlayerStatus
    ? Audio.useAudioPlayerStatus(player)
    : null;
  const [cargando, setCargando] = useState(false);

  const sonando = !!(estado && estado.playing);
  const total = (estado && estado.duration) || duracion || 0;
  const actual = (estado && estado.currentTime) || 0;
  const avance = total > 0 ? Math.min(1, actual / total) : 0;

  const alternar = async () => {
    if (!player) return;
    try {
      if (sonando) {
        player.pause();
      } else {
        setCargando(true);
        // Si termino, volver al principio antes de reproducir.
        if (total && actual >= total - 0.3) await player.seekTo(0);
        player.play();
        setCargando(false);
      }
    } catch (e) {
      setCargando(false);
    }
  };

  const fg = claro ? '#fff' : C.tealDeep;
  const track = claro ? 'rgba(255,255,255,0.3)' : C.line;

  return (
    <View style={s.audio}>
      <Pressable onPress={alternar} hitSlop={8} style={[s.play, { backgroundColor: claro ? 'rgba(255,255,255,0.2)' : C.tealSoft }]}>
        {cargando
          ? <ActivityIndicator size="small" color={fg} />
          : <MaterialIcons name={sonando ? 'pause' : 'play-arrow'} size={22} color={fg} />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={[s.barra, { backgroundColor: track }]}>
          <View style={[s.avance, { width: `${avance * 100}%`, backgroundColor: fg }]} />
        </View>
        <Text style={[s.tiempo, { color: claro ? 'rgba(255,255,255,0.75)' : C.ink3 }]}>
          {segundos(sonando || actual > 0 ? actual : total)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  audio: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180, paddingVertical: 2 },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  barra: { height: 4, borderRadius: 2, overflow: 'hidden' },
  avance: { height: 4, borderRadius: 2 },
  tiempo: { fontSize: 11, marginTop: 5 },
});
