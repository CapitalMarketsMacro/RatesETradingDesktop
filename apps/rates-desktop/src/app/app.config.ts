import { ApplicationConfig, APP_INITIALIZER, inject, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Nora from '@primeuix/themes/nora';
import { AngularSlickgridModule } from 'angular-slickgrid';
import { TranslateModule } from '@ngx-translate/core';
import { appRoutes } from './app.routes';
import { provideTransport } from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerService } from '@rates-trading/logger';
import { firstValueFrom } from 'rxjs';

const bluePreset = definePreset(Nora, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}',
    },
  },
});

/**
 * Factory function to initialize configuration before app starts
 */
function initializeApp(): () => Promise<void> {
  const configService = inject(ConfigurationService);
  const logger = inject(LoggerService).child({ component: 'AppConfig' });
  return async () => {
    await firstValueFrom(configService.loadConfiguration());
    logger.info('Configuration loaded successfully');
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideAnimations(),
    provideHttpClient(),
    // Load configuration before app starts
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true,
    },
    // ngx-translate required by angular-slickgrid (used only for grid internals)
    importProvidersFrom(TranslateModule.forRoot()),
    // SlickGrid for high-performance grids (log viewer, etc.)
    importProvidersFrom(AngularSlickgridModule.forRoot()),
    // Transport will use the already-loaded configuration
    provideTransport(),
    providePrimeNG({
      theme: {
        preset: bluePreset,
        options: {
          darkModeSelector: '.app-dark',
        },
      },
    }),
  ],
};
