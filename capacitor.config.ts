import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salachocolatte.app',
  appName: 'Sala Chocolatte',
  webDir: 'dist/discoteca/browser',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  android: {
    backgroundColor: '#101114',
  },
  ios: {
    backgroundColor: '#101114',
    contentInset: 'automatic',
  },
};

export default config;
