import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { appVersionInterceptor } from './app/interceptors/app-version.interceptor';

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
}).catch(err => console.error(err));
