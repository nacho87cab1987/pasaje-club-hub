// ============================================================================
// Navegacion
// ----------------------------------------------------------------------------
// Las solapas NO estan escritas a mano: salen de boot.tabs, que arma el
// servidor segun los modulos de la persona. Quien vende tiene CRM abajo;
// quien no, tiene Reconocimientos en ese lugar. Cambiar eso es cambiar un
// permiso en el panel, no publicar una version nueva en las tiendas.
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { escucharToques, rutaAPantalla } from '../push';
import { C } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import InicioScreen from '../screens/InicioScreen';
import AppsScreen from '../screens/AppsScreen';
import PerfilScreen from '../screens/PerfilScreen';
import PersonasScreen from '../screens/PersonasScreen';
import PendienteScreen from '../screens/PendienteScreen';
import EditarPerfilScreen from '../screens/EditarPerfilScreen';
import CrearPostScreen from '../screens/CrearPostScreen';
import PostScreen from '../screens/PostScreen';
import AltaPersonaScreen from '../screens/AltaPersonaScreen';
import CambiarClaveScreen from '../screens/CambiarClaveScreen';
import CrmScreen from '../screens/CrmScreen';
import CrmChatScreen from '../screens/CrmChatScreen';
import GestionScreen from '../screens/GestionScreen';
import TareaScreen from '../screens/TareaScreen';
import TareaFormScreen from '../screens/TareaFormScreen';
import DocumentosScreen from '../screens/DocumentosScreen';
import CarpetaScreen from '../screens/CarpetaScreen';
import SubirDocumentoScreen from '../screens/SubirDocumentoScreen';
import AcademiaScreen from '../screens/AcademiaScreen';
import CursoScreen from '../screens/CursoScreen';
import CertificadosScreen from '../screens/CertificadosScreen';
import OrganigramaScreen from '../screens/OrganigramaScreen';
import PersonaScreen from '../screens/PersonaScreen';
import NotificacionesScreen from '../screens/NotificacionesScreen';
import PresupuestosScreen from '../screens/PresupuestosScreen';
import CumpleanosScreen from '../screens/CumpleanosScreen';
import ExpedientesScreen from '../screens/ExpedientesScreen';
import ExpedienteScreen from '../screens/ExpedienteScreen';
import EquipoScreen from '../screens/EquipoScreen';
import ComisionesScreen from '../screens/ComisionesScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import VentasScreen from '../screens/VentasScreen';
import PasajitoScreen from '../screens/PasajitoScreen';
import DesempenoScreen from '../screens/DesempenoScreen';
import ReconocimientosScreen from '../screens/ReconocimientosScreen';
import EncuestasScreen from '../screens/EncuestasScreen';
import EncuestaScreen from '../screens/EncuestaScreen';
import EncuestaResultadosScreen from '../screens/EncuestaResultadosScreen';
import EncuestaFormScreen from '../screens/EncuestaFormScreen';
import EditarPersonaScreen from '../screens/EditarPersonaScreen';
import CatalogosScreen from '../screens/CatalogosScreen';
import ReconocerFormScreen from '../screens/ReconocerFormScreen';
import EventosScreen from '../screens/EventosScreen';
import EventoScreen from '../screens/EventoScreen';
import EventoFormScreen from '../screens/EventoFormScreen';
import DesempenoEquipoScreen from '../screens/DesempenoEquipoScreen';
import DesempenoEvaluarScreen from '../screens/DesempenoEvaluarScreen';
import OnboardingGenteScreen from '../screens/OnboardingGenteScreen';
import { AdminScreen, AdminPersonaScreen } from '../screens/AdminScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Catalogo de solapas posibles. El servidor elige cuales van.
const TABS = {
  inicio:          { titulo: 'Inicio',    icono: 'home',      componente: InicioScreen },
  crm:             { titulo: 'CRM',       icono: 'forum',     componente: CrmScreen },
  apps:            { titulo: 'Apps',      icono: 'grid-view', componente: AppsScreen },
  reconocimientos: { titulo: 'Reconoc.',  icono: 'star',      componente: PendienteScreen },
  perfil:          { titulo: 'Perfil',    icono: 'person',    componente: PerfilScreen },
};

const tema = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, card: '#fff', primary: C.teal, border: C.line, text: C.ink },
};

function Tabs() {
  const { tabs, modulo } = useAuth();
  const visibles = (tabs.length ? tabs : ['inicio', 'apps', 'perfil']).filter((k) => TABS[k]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: C.ink },
        headerShadowVisible: false,
        tabBarActiveTintColor: C.navy,
        tabBarInactiveTintColor: C.ink3,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: C.line, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      {visibles.map((clave) => {
        const t = TABS[clave];
        // Las solapas que apuntan a un modulo sin pantalla propia reciben su
        // ficha para poder mostrar nombre e icono correctos.
        const inicial = t.componente === PendienteScreen ? { modulo: modulo(clave) || { nombre: t.titulo } } : undefined;
        return (
          <Tab.Screen
            key={clave}
            name={t.titulo}
            component={t.componente}
            initialParams={inicial}
            options={{
              tabBarIcon: ({ color, size }) => <MaterialIcons name={t.icono} size={size} color={color} />,
            }}
          />
        );
      })}
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { cargando, boot } = useAuth();
  const nav = useRef(null);

  // Tocar una notificacion abre la pantalla que indica su `ruta`.
  useEffect(() => {
    if (!boot) return;
    return escucharToques((ruta) => {
      const [pantalla, params] = rutaAPantalla(ruta);
      const destino = TABS[pantalla.toLowerCase()] ? TABS[pantalla.toLowerCase()].titulo : pantalla;
      nav.current?.navigate(destino, params);
    });
  }, [boot]);

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.teal} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={nav} theme={tema}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: C.ink },
          headerShadowVisible: false,
          headerTintColor: C.navy,
        }}
      >
        {!boot ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Personas" component={PersonasScreen} options={{ title: 'Personas' }} />
            <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen} options={{ title: 'Editar perfil' }} />
            <Stack.Screen name="CrearPost" component={CrearPostScreen} options={{ title: 'Nueva publicacion' }} />
            <Stack.Screen name="Post" component={PostScreen} options={{ title: 'Comentarios' }} />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Administracion' }} />
            <Stack.Screen name="AdminPersona" component={AdminPersonaScreen} options={{ title: 'Ficha' }} />
            <Stack.Screen name="AltaPersona" component={AltaPersonaScreen} options={{ title: 'Dar de alta' }} />
            <Stack.Screen name="CambiarClave" component={CambiarClaveScreen} options={{ title: 'Cambiar contrasena' }} />
            <Stack.Screen name="CrmChat" component={CrmChatScreen} options={{ title: 'Conversacion' }} />
            <Stack.Screen name="Gestion" component={GestionScreen} options={{ title: 'Gestion' }} />
            <Stack.Screen name="Tarea" component={TareaScreen} options={{ title: 'Tarea' }} />
            <Stack.Screen name="TareaForm" component={TareaFormScreen} options={{ title: 'Nueva tarea' }} />
            <Stack.Screen name="Documentos" component={DocumentosScreen} options={{ title: 'Documentos' }} />
            <Stack.Screen name="Carpeta" component={CarpetaScreen} options={{ title: '' }} />
            <Stack.Screen name="SubirDocumento" component={SubirDocumentoScreen} options={{ title: 'Subir documento' }} />
            <Stack.Screen name="Academia" component={AcademiaScreen} options={{ title: 'Academia' }} />
            <Stack.Screen name="Curso" component={CursoScreen} options={{ title: '' }} />
            <Stack.Screen name="Certificados" component={CertificadosScreen} options={{ title: 'Mis certificados' }} />
            <Stack.Screen name="Organigrama" component={OrganigramaScreen} options={{ title: 'Organigrama' }} />
            <Stack.Screen name="Persona" component={PersonaScreen} options={{ title: '' }} />
            <Stack.Screen name="Notificaciones" component={NotificacionesScreen} options={{ title: 'Novedades' }} />
            <Stack.Screen name="Presupuestos" component={PresupuestosScreen} options={{ title: 'Presupuestos' }} />
            <Stack.Screen name="Cumpleanos" component={CumpleanosScreen} options={{ title: 'Cumpleaños' }} />
            <Stack.Screen name="Expedientes" component={ExpedientesScreen} options={{ title: 'Expedientes' }} />
            <Stack.Screen name="Expediente" component={ExpedienteScreen} options={{ title: '' }} />
            <Stack.Screen name="Equipo" component={EquipoScreen} options={{ title: 'Mi equipo' }} />
            <Stack.Screen name="Comisiones" component={ComisionesScreen} options={{ title: 'Comisiones' }} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Onboarding' }} />
            <Stack.Screen name="Ventas" component={VentasScreen} options={{ title: 'Ventas' }} />
            <Stack.Screen name="Pasajito" component={PasajitoScreen} options={{ title: 'Pasajito' }} />
            <Stack.Screen name="Desempeno" component={DesempenoScreen} options={{ title: 'Desempeño' }} />
            <Stack.Screen name="Reconocimientos" component={ReconocimientosScreen} options={{ title: 'Reconocimientos' }} />
            <Stack.Screen name="Encuestas" component={EncuestasScreen} options={{ title: 'Encuestas' }} />
            <Stack.Screen name="Encuesta" component={EncuestaScreen} options={{ title: '' }} />
            <Stack.Screen name="EncuestaResultados" component={EncuestaResultadosScreen} options={{ title: 'Resultados' }} />
            <Stack.Screen name="EncuestaForm" component={EncuestaFormScreen} options={{ title: 'Nueva encuesta' }} />
            <Stack.Screen name="EditarPersona" component={EditarPersonaScreen} options={{ title: 'Editar' }} />
            <Stack.Screen name="Catalogos" component={CatalogosScreen} options={{ title: 'Áreas y puestos' }} />
            <Stack.Screen name="ReconocerForm" component={ReconocerFormScreen} options={{ title: 'Reconocer a alguien' }} />
            <Stack.Screen name="Eventos" component={EventosScreen} options={{ title: 'Eventos' }} />
            <Stack.Screen name="Evento" component={EventoScreen} options={{ title: '' }} />
            <Stack.Screen name="EventoForm" component={EventoFormScreen} options={{ title: 'Nuevo evento' }} />
            <Stack.Screen name="DesempenoEquipo" component={DesempenoEquipoScreen} options={{ title: 'Evaluar al equipo' }} />
            <Stack.Screen name="DesempenoEvaluar" component={DesempenoEvaluarScreen} options={{ title: '' }} />
            <Stack.Screen name="OnboardingGente" component={OnboardingGenteScreen} options={{ title: 'Onboarding del equipo' }} />
            <Stack.Screen name="Pendiente" component={PendienteScreen} options={{ title: '' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
