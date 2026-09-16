import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.almadjd.app",
  appName: "مجمع المجد",
  webDir: "build",
  server: {
    url: "https://almadjdapp.vercel.app/",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["almadjdapp.vercel.app"],
  },
  android: {
    backgroundColor: "#14324D",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: "#14324D",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;