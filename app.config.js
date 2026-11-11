// Config dinamica: l'icona personale (assets/user-art/app-icon.png) vince su quella generata se presente.
const fs = require("fs");
const path = require("path");

const userIcon = path.join(__dirname, "assets/user-art/app-icon.png");
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
      deploymentTarget: "17.0",
      infoPlist: {
        CADisableMinimumFrameDurationOnPhone: true,
        ITSAppUsesNonExemptEncryption: false,
        UIViewControllerBasedStatusBarAppearance: true,
      },
      entitlements: { "com.apple.security.application-groups": [APP_GROUP] },
    },
    web: { bundler: "metro", output: "single", favicon: "./assets/icon.png" },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      [
        "expo-splash-screen",
        { backgroundColor: "#FF2D55", image: "./assets/splash-mark.png", imageWidth: 200 },
      ],
      "@bacons/apple-targets",
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
  },
};
