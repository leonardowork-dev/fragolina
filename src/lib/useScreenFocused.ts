import { useIsFocused } from "expo-router";

/**
 * true se la schermata che contiene il componente è quella in primo piano. Le tab restano montate quando non si
 * vedono: le animazioni che girano all'infinito (respiro del pet, dondolio della mascotte) si fermano quando la tab
 * non è in primo piano. Fuori da un navigatore (splash, laboratorio) vale sempre true.
 */
export function useScreenFocused(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}
