import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import Bienvenida from './src/Bienvenida';

export default function App() {
  const [mostrarLogo, setMostrarLogo] = useState(true);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />

        {/* La app se monta debajo mientras corre la animacion: para cuando
            el logo se va, la sesion ya se verifico y la pantalla esta lista.
            Si se mostrara una cosa despues de la otra, la espera se sumaria
            en vez de aprovecharse. */}
        <View style={{ flex: 1 }}>
          <RootNavigator />
          {mostrarLogo ? <Bienvenida onTerminar={() => setMostrarLogo(false)} /> : null}
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
