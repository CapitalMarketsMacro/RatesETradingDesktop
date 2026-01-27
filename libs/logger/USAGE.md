# Logger Library Usage Examples

## Basic Usage in Components

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { LoggerService } from '@rates-trading/logger';

@Component({
  selector: 'app-example',
  standalone: true,
})
export class ExampleComponent implements OnInit {
  private logger = inject(LoggerService);

  ngOnInit() {
    this.logger.info('Component initialized');
    this.logger.debug({ userId: 123 }, 'User data loaded');
  }
}
```

## Usage in Services

```typescript
import { Injectable, inject } from '@angular/core';
import { LoggerService } from '@rates-trading/logger';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private logger = inject(LoggerService);

  fetchData() {
    this.logger.debug('Fetching data...');
    try {
      // ... fetch logic
      this.logger.info({ recordCount: 100 }, 'Data fetched successfully');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to fetch data');
      throw error;
    }
  }
}
```

## Using Child Loggers for Context

```typescript
import { Component, inject } from '@angular/core';
import { LoggerService } from '@rates-trading/logger';

@Component({
  selector: 'app-user-profile',
  standalone: true,
})
export class UserProfileComponent {
  private logger = inject(LoggerService).child({ component: 'UserProfile' });

  loadProfile(userId: string) {
    const componentLogger = this.logger.child({ userId });
    componentLogger.info('Loading user profile');
    // All logs will include component and userId context
  }
}
```

## Configuring the Logger

### In App Module

```typescript
import { NgModule } from '@angular/core';
import { LoggerModule } from '@rates-trading/logger';

@NgModule({
  imports: [
    LoggerModule.forRoot({
      level: 'debug',
      enableConsole: true,
      enableRemote: false,
      prettyPrint: false,
      base: {
        app: 'rates-desktop',
        version: '1.0.0',
      },
    }),
  ],
})
export class AppModule {}
```

### Using Configuration Service

```typescript
import { Injectable, inject } from '@angular/core';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerModule, LoggerConfig } from '@rates-trading/logger';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private configService = inject(ConfigurationService);

  configureLogger(): LoggerConfig {
    const config = this.configService.getConfiguration();
    return {
      level: config?.logging?.level || 'info',
      enableConsole: config?.logging?.enableConsole ?? true,
      enableRemote: config?.logging?.enableRemote ?? false,
    };
  }
}
```

## Log Levels

```typescript
logger.trace('Very detailed trace information');
logger.debug({ data: 'value' }, 'Debug information');
logger.info('Informational message');
logger.warn('Warning message');
logger.error(new Error('Error'), 'Error message');
logger.fatal('Fatal error message');
```

## Checking Log Levels

```typescript
if (logger.isLevelEnabled('debug')) {
  logger.debug('This will only log if debug is enabled');
}
```

## Setting Log Level Dynamically

```typescript
// Set to debug for development
logger.level = 'debug';

// Set to error for production
logger.level = 'error';
```
