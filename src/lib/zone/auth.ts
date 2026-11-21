import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { isValidPin } from "./gate";

const PIN_KEY = "fragolina.zone.pin";

/** Sul web (solo prove nel browser) il PIN sta in localStorage; sul telefono nel Portachiavi (SecureStore). */
const kv = {
  get: async (): Promise<string | null> => (Platform.OS === "web" ? globalThis.localStorage?.getItem(PIN_KEY) ?? null : SecureStore.getItemAsync(PIN_KEY)),
  set: async (v: string): Promise<void> => (Platform.OS === "web" ? void globalThis.localStorage?.setItem(PIN_KEY, v) : SecureStore.setItemAsync(PIN_KEY, v)),
  del: async (): Promise<void> => (Platform.OS === "web" ? void globalThis.localStorage?.removeItem(PIN_KEY) : SecureStore.deleteItemAsync(PIN_KEY)),
};

/** Face ID / Touch ID / codice del telefono disponibili? Mai lancia. */
export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Chiede Face ID (con ripiego sul codice del telefono). `true` solo se riuscito. Mai lancia. */
export async function authenticateDevice(prompt: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  }
}

export async function hasPin(): Promise<boolean> {
  try {
    return (await kv.get()) !== null;
  } catch {
    return false;
  }
}
export async function setPin(pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  try {
    await kv.set(pin);
    return true;
  } catch {
    return false;
  }
}
export async function checkPin(pin: string): Promise<boolean> {
  try {
    return (await kv.get()) === pin;
  } catch {
    return false;
  }
}
export async function clearPin(): Promise<void> {
  try {
    await kv.del();
  } catch {
    /* niente */
  }
}
