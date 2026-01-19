# configuration

This library provides configuration management for the Rates E-Trading Desktop application.

## Features

- Reads environment-specific configuration files based on URL query parameters
- Type-safe configuration with `RatesAppConfiguration` interface
- Supports multiple environments (dev, staging, prod, etc.)

## Usage

```typescript
import { ConfigurationService, RatesAppConfiguration } from '@rates-trading/configuration';

// Inject the service
constructor(private configService: ConfigurationService) {}

// Get configuration
const config = this.configService.getConfiguration();
```

## Configuration Files

Configuration files should be placed in the `assets` folder of your application:
- `config-dev.json` - Development environment
- `config-staging.json` - Staging environment
- `config-prod.json` - Production environment

## URL Query Parameter

The environment is determined by the `env` query parameter in the URL:
- `?env=dev` - Loads `config-dev.json`
- `?env=staging` - Loads `config-staging.json`
- `?env=prod` - Loads `config-prod.json`
- Default: `dev` if no parameter is provided
