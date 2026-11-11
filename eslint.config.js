const expo = require("eslint-config-expo/flat");

module.exports = [
  ...expo,
  { ignores: ["node_modules/", "ios/", "dist/", ".expo/", "docs/", "scripts/", "*.config.js"] },
  {
    rules: {
      // Regole del progetto: niente runOnJS (usa scheduleOnRN) e niente .value sugli shared value.
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.name='runOnJS']", message: "Usa scheduleOnRN da react-native-worklets." },
      ],
    },
  },
];
