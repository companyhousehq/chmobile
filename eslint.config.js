const { defineConfig, globalIgnores } = require("eslint/config");
const expo = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores(["ios/**", "android/**", "node_modules/**", ".expo/**", "coverage/**"]),
  expo,
  {
    rules: {
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/companyhousefe/**", "**/companyhousebe/**"],
              message:
                "The app is an independent API client; never import from the web or the API (spec 0011 R8).",
            },
          ],
        },
      ],
    },
  },
]);
