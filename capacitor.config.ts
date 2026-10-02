import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: "io.ionic.demo.pg.cap.ng",
  appName: "Photo Gallery Cap Ng",
  npmClient: "npm",
  webDir: "www",
  server: {
    // Tus APIs de XAMPP usan http (sin "s"). Con esto Android no las bloquea.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
