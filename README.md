# Pasaje Club · Hub interno (app nativa)

App nativa en React Native + Expo. **No es Capacitor**: la UI se renderiza con
componentes nativos reales de iOS y Android, no dentro de un WebView.

## Requisitos

- Node 20 o superior
- Una cuenta de Expo (gratis) para compilar con EAS
- La API ya publicada en `pasajeclub.com.ar/socios/api/`:
  `hub_permisos.php`, `hub_auth.php`, `hub_admin.php`

## Arranque

```bash
npm install
npx expo start
```

Escaneás el QR con la app **Expo Go** y ya corre en tu celular. Para desarrollo
diario alcanza con eso: cada vez que guardás un archivo, el celular se
actualiza solo.

> Expo Go no recibe notificaciones push. Para probar push necesitás una
> development build (ver más abajo).

## Antes del primer login

La app apunta a producción desde el arranque. Verificá que la API responda:

```
https://pasajeclub.com.ar/socios/api/hub_auth.php?action=diag
```

Y que exista al menos una persona en `hub_personas` con su `usuario_id` o
`vendedor_id` apuntando a una fila real, si no el login devuelve
"todavía no tenés ficha en el hub".

## Compilar de verdad

```bash
npm install -g eas-cli
eas login
eas build:configure

# development build: permite probar push y módulos nativos
eas build --profile development --platform ios

# producción
eas build --profile production --platform ios
eas submit --platform ios
```

Se compila en la nube: **no hace falta una Mac** para generar el .ipa.

## Push

`app.json` ya declara `expo-notifications`. Falta:

1. Bajar `google-services.json` del proyecto Firebase `pasajeclub-push` y
   dejarlo en la raíz (Android).
2. Subir la APNs key a Firebase (ya está hecho: Key ID `B7LTT57A8T`).
3. Compilar una development build. En Expo Go el push no funciona.

El deep-linking ya está resuelto: cada notificación viaja con un campo
`data.ruta` (`/post/482`, `/persona/7`) y `src/push.js` la traduce a una
pantalla. El destino lo decide el servidor al crear la notificación.

## Estructura

```
App.js                        raíz
src/api/client.js             fetch con timeout y manejo de 401
src/context/AuthContext.js    sesión, bootstrap y helpers de permisos
src/navigation/RootNavigator  solapas dinámicas desde el servidor
src/push.js                   registro de push y deep-linking
src/theme.js                  colores de marca y traducción de íconos
src/screens/                  pantallas
src/components/UI.js          piezas compartidas
```

## Cómo funciona el gating

El login devuelve `modulos`, `permisos` y `tabs`. La app **solo dibuja lo que
recibe**: no tiene ninguna lista de módulos escrita a mano.

Consecuencia práctica: habilitar el CRM a alguien es un switch en el panel de
administración. En su próximo refresh le aparece el ícono abajo. No hay que
recompilar ni publicar una versión nueva en las tiendas.

## Pantallas ya construidas

- Login, Inicio, Apps (grilla por grupos), Perfil
- Personas (directorio con búsqueda contra el servidor)
- Administración: lista de personas y ficha con switches por módulo

El resto de los módulos habilitados abren una pantalla "en construcción" con
su nombre e ícono correctos. Es a propósito: si el servidor lo habilitó, la
persona tiene que verlo, aunque todavía no esté hecho.

## Notas

- El token se guarda en `expo-secure-store` (Keychain en iOS, Keystore en
  Android), no en AsyncStorage.
- Al abrir la app el token se revalida contra el servidor. No se confía en la
  copia local, porque los permisos pueden haber cambiado.
- Los íconos vienen de la base como nombres de Material Symbols
  (`account_tree`) y `theme.js` los traduce a MaterialIcons (`account-tree`),
  con excepciones a mano para los que no existen en ese set.
- Las versiones de `package.json` corresponden a Expo SDK 53. Si al instalar
  aparece un aviso de incompatibilidad, corré `npx expo install --fix`.
