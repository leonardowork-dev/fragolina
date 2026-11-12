import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

import { storageScope } from "./tabScope";

const scoped = (name: string) => name + storageScope();

/** Storage per zustand persist: mai solleva eccezioni (modalità privata, dati bloccati). */
export const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(scoped(name));
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(scoped(name), value);
    } catch {
      /* il dato non persiste, l'app funziona lo stesso */
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(scoped(name));
    } catch {
      /* niente */
    }
  },
};
