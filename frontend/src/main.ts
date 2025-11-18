import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Bootstrap JS (ESM build to avoid CommonJS warning)
import 'bootstrap/dist/js/bootstrap.esm.js';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
