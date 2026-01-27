# Logger Library

A high-performance logging library for Angular applications using [Pino](https://getpino.io/) as the underlying logging engine.

## Features

- **Super Fast**: Built on Pino, one of the fastest JSON loggers for Node.js
- **Angular Integration**: Seamless integration with Angular's dependency injection
- **Configurable**: Supports different log levels and formatters
- **Browser Compatible**: Works in both browser and Node.js environments
- **Type Safe**: Full TypeScript support

## Installation

The logger library is already included in the workspace. To use it in your application:

```typescript
import { LoggerModule, LoggerService } from '@rates-trading/logger';
```

## Usage

### Basic Usage

```typescript
import { Component, inject } from '@angular/core';
import { LoggerService } from '@rates-trading/logger';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [LoggerModule],
})
export class ExampleComponent {
  private logger = inject(LoggerService);

  ngOnInit() {
    this.logger.info('Component initialized');
    this.logger.debug({ userId: 123 }, 'User data loaded');
    this.logger.error(new Error('Something went wrong'), 'Failed to load data');
  }
}
```

### Log Levels

The logger supports the following log levels (from most to least verbose):

- `trace` - Very detailed tracing information
- `debug` - Debug information
- `info` - Informational messages
- `warn` - Warning messages
- `error` - Error messages
- `fatal` - Fatal errors

### Logging Methods

```typescript
logger.trace('Trace message');
logger.debug({ data: 'value' }, 'Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error(new Error('Error'), 'Error message');
logger.fatal('Fatal error message');
```

### Child Loggers

Create child loggers with additional context:

```typescript
const childLogger = logger.child({ component: 'MyComponent' });
childLogger.info('Message with component context');
```

## Configuration

The logger can be configured through the application configuration:

```json
{
  "logging": {
    "level": "info",
    "enableConsole": true,
    "enableRemote": false
  }
}
```
