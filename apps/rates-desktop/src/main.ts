import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { LoggerService } from '@rates-trading/logger';

// Create a logger instance for bootstrap errors
const logger = new LoggerService();

bootstrapApplication(App, appConfig).catch((err) => {
  logger.error(err as Error, 'Failed to bootstrap application');
});
