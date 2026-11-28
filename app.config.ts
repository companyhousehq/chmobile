import type { ExpoConfig } from "expo/config";

/**
 * Used once by `expo prebuild` to generate ios/ and android/. After that the
 * native projects are owned and edited by hand (ADR 0021); prebuild is never
 * run again, so changes here do not reach the native code.
 */
const config: ExpoConfig = {
  name: "Company House",
  slug: "companyhouse",
  version: "0.1.0",
  scheme: "companyhouse",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "ng.companyhouse.app",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
    // Inert until the web serves apple-app-site-association (spec 0012 AC39).
    associatedDomains: ["applinks:www.companyhouse.ng"],
  },
  android: {
    package: "ng.companyhouse.app",
    // Inert until the web serves /.well-known/assetlinks.json (spec 0012 AC39).
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "www.companyhouse.ng" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        cameraPermission:
          "Company House uses the camera so you can photograph documents that show you act for your company.",
        photosPermission:
          "Company House reads photos you choose to attach as evidence for a company claim.",
      },
    ],
    "expo-document-picker",
    [
      "expo-local-authentication",
      {
        faceIDPermission: "Company House uses Face ID to unlock the app when you turn on app lock.",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 160,
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#08301f" },
      },
    ],
  ],
};

export default config;
