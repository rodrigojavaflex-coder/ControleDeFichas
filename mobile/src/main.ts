import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { appVersionInterceptor } from './app/interceptors/app-version.interceptor';

const BOOT_LOADER_MINIMO_MS = 1500;
const bootLoaderInicio = Date.now();

function avisarBootNativoPronto(): void {
  try {
    const bridge = (window as unknown as { FarmaBoot?: { ready?: () => void } }).FarmaBoot;
    bridge?.ready?.();
  } catch {
    // Ambiente web / sem bridge nativo
  }
}

function ocultarBootLoader(): void {
  const loader = document.getElementById('app-boot-loader');
  const decorrido = Date.now() - bootLoaderInicio;
  const espera = Math.max(0, BOOT_LOADER_MINIMO_MS - decorrido);
  window.setTimeout(() => {
    avisarBootNativoPronto();
    if (!loader) {
      return;
    }
    loader.classList.add('is-hidden');
    loader.setAttribute('aria-busy', 'false');
    window.setTimeout(() => loader.remove(), 320);
  }, espera);
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([appVersionInterceptor, authInterceptor]),
    ),
    provideIonicAngular({
      mode: 'md', // ou 'ios' dependendo do seu caso
      // Permite renderizar HTML (ex.: <strong>, <br>) em mensagens de AlertController.
      innerHTMLTemplatesEnabled: true,
    })
  ]
})
  .then(() => ocultarBootLoader())
  .catch((err) => {
    console.error(err);
    ocultarBootLoader();
  });
