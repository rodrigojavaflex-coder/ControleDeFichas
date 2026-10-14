import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sistemasfarmamais.app',
  appName: 'App Farma +',
  webDir: 'dist/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      hidden: false,
    },
  },
};

export default config;
