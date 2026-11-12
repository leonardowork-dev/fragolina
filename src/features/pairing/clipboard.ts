import { Platform, Share } from "react-native";

/** Appunti e condivisione. Mai eccezioni verso l'interfaccia. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const Clipboard = await import("expo-clipboard");
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

export async function pasteText(): Promise<string> {
  try {
    if (Platform.OS === "web") return await navigator.clipboard.readText();
    const Clipboard = await import("expo-clipboard");
    return await Clipboard.getStringAsync();
  } catch {
    return "";
  }
}

export async function shareText(message: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) await nav.share({ text: message });
      else await navigator.clipboard.writeText(message);
      return;
    }
    await Share.share({ message });
  } catch {
    /* annullato dall'utente */
  }
}
