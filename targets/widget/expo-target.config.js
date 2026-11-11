/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = (config) => ({
  type: "widget",
  name: "FragolinaWidget",
  displayName: "Fragolina",
  deploymentTarget: "17.0",
  colors: {
    $widgetBackground: "#FFF4F6",
    $accent: "#FF2D55",
  },
  // Stesso gruppo dell'app. A runtime il gruppo vero lo sceglie GroupResolver.swift,
  // perché i tool di sideloading possono riscriverlo.
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
