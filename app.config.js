// Config dinamica: l'icona personale (assets/user-art/app-icon.png) vince su quella generata se presente.
const fs = require("fs");
const path = require("path");
const { syncWidgetArt } = require("./scripts/widget-art");

const userIcon = path.join(__dirname, "assets/user-art/app-icon.png");
// Il disegno del widget (assets/user-art/widget-mascot.png) entra nel catalogo del target widget a ogni prebuild.
syncWidgetArt(__dirname);

const icon = fs.existsSync(userIcon) ? "./assets/user-art/app-icon.png" : "./assets/icon.png";

const BUNDLE_ID = "app.fragolina.couple";
const APP_GROUP = `group.${BUNDLE_ID}`;

module.exports = {
  expo: {
    name: "Fragolina",
    slug: "fragolina",
    version: "1.0.0",
    orientation: "portrait",
    icon,
    scheme: "fragolina",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: BUNDLE_ID,
      supportsTablet: false,
      deploymentTarget: "16.4",
      // Numero di build crescente (in CI = numero del run): senza, ogni reinstallazione ha la stessa versione e iOS può
      // tenere in cache l'elenco dei widget (un widget nuovo non compare nella galleria).
      buildNumber: process.env.BUILD_NUMBER || "1",
      infoPlist: {
        CADisableMinimumFrameDurationOnPhone: true,
        ITSAppUsesNonExemptEncryption: false,
        UIViewControllerBasedStatusBarAppearance: true,
        FragolinaBaseAppGroup: APP_GROUP,
      },
      entitlements: { "com.apple.security.application-groups": [APP_GROUP] },
    },
    web: { bundler: "metro", output: "single", favicon: "./assets/icon.png" },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      [
        "expo-location",
        {
          // Testi che iOS mostra nel permesso (in italiano). "Sempre" è facoltativo: serve solo per aggiornare la
          // distanza ad app chiusa (Noi → Distanza → "Aggiorna anche ad app chiusa").
          locationWhenInUsePermission:
            "Fragolina usa la posizione solo per misurare quanti chilometri ci sono fra voi due. Si manda una posizione arrotondata a circa 1 km, mai il percorso.",
          locationAlwaysAndWhenInUsePermission:
            "Con «Sempre» la distanza resta aggiornata anche senza aprire Fragolina. Si manda solo una posizione arrotondata a circa 1 km, mai il percorso.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-splash-screen",
        { backgroundColor: "#FF2D55", image: "./assets/splash-mark.png", imageWidth: 200 },
      ],
      "@bacons/apple-targets",
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
  },
};
