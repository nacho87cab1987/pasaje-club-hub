// ============================================================================
// Sesion, bootstrap y permisos
// ----------------------------------------------------------------------------
// El bootstrap del servidor es la unica fuente de verdad sobre que ve y que
// puede hacer la persona. La app nunca decide eso por su cuenta: solo dibuja
// lo que le llega. Asi habilitar un modulo desde el panel se refleja en el
// proximo refresh, sin publicar una version nueva.
// ============================================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { auth as authApi, setToken, onNoAutorizado } from '../api/client';
import { registrarPush } from '../push';

const CLAVE_TOKEN = 'pc_hub_token';
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [cargando, setCargando] = useState(true);
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);

  const cerrar = useCallback(async () => {
    setToken(null);
    setBoot(null);
    await SecureStore.deleteItemAsync(CLAVE_TOKEN).catch(() => {});
  }, []);

  // Token vencido en medio del uso: el cliente avisa y cerramos sesion.
  useEffect(() => { onNoAutorizado(() => { cerrar(); }); }, [cerrar]);

  // Al abrir la app: si hay token guardado, lo revalidamos contra el servidor.
  // No confiamos en el token local, porque los permisos pudieron cambiar.
  useEffect(() => {
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(CLAVE_TOKEN);
        if (!t) return;
        setToken(t);
        const b = await authApi.me();
        setBoot(b);
        registrarPush().catch(() => {});
      } catch {
        setToken(null);
        await SecureStore.deleteItemAsync(CLAVE_TOKEN).catch(() => {});
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const entrar = useCallback(async (email, password) => {
    setError(null);
    const r = await authApi.login(email.trim().toLowerCase(), password);
    setToken(r.token);
    await SecureStore.setItemAsync(CLAVE_TOKEN, r.token).catch(() => {});
    setBoot(r);
    registrarPush().catch(() => {});
    return r;
  }, []);

  /** Vuelve a pedir el bootstrap. Se llama al volver del panel de admin. */
  const refrescar = useCallback(async () => {
    try {
      const b = await authApi.me();
      setBoot(b);
      return b;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  const valor = useMemo(() => ({
    cargando,
    boot,
    error,
    persona: boot?.persona || null,
    modulos: boot?.modulos || [],
    tabs: boot?.tabs || [],
    entrar,
    cerrar,
    refrescar,
    /** Tiene el modulo habilitado. */
    tieneModulo: (slug) => (boot?.modulos || []).some((m) => m.slug === slug),
    /** Puede ejecutar la accion. admin_total pasa siempre. */
    puede: (permiso) => {
      const p = boot?.permisos || [];
      return p.includes('hub.admin_total') || p.includes(permiso);
    },
    modulo: (slug) => (boot?.modulos || []).find((m) => m.slug === slug) || null,
  }), [cargando, boot, error, entrar, cerrar, refrescar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth necesita estar dentro de AuthProvider');
  return c;
}
