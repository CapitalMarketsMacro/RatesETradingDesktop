# Rates E-Trading Desktop

An Nx mono-repo workspace for the Rates E-Trading Desktop application built with Angular.

## Project Structure

This is an Nx mono-repo containing:

### Applications
- **trading-desktop** - Main Angular application for rates e-trading
- **trading-desktop-e2e** - End-to-end tests using Playwright

### Libraries
- **shared-utils** - Shared utility functions and helpers
- **ui-components** - Reusable UI components library
- **data-access** - Data access layer and API services

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Installation
```bash
npm install
```

### Development

Start the development server:
```bash
npm start
# or
nx serve trading-desktop
```

The application will be available at `http://localhost:4200/`

### Building

Build the main application:
```bash
npm run build
# or
nx build trading-desktop
```

Build all projects:
```bash
npm run build:all
```

### Testing

Run tests for the main application:
```bash
npm test
# or
nx test trading-desktop
```

Run all tests:
```bash
npm run test:all
```

Run end-to-end tests:
```bash
npm run e2e
# or
nx e2e trading-desktop-e2e
```

### Linting

Lint the main application:
```bash
npm run lint
# or
nx lint trading-desktop
```

Lint all projects:
```bash
npm run lint:all
```

### Nx Commands

View project dependency graph:
```bash
npm run graph
# or
nx graph
```

Show project details:
```bash
nx show project trading-desktop
```

Run affected commands (only test/build/lint changed projects):
```bash
nx affected -t test
nx affected -t build
nx affected -t lint
```

## Workspace Organization

This mono-repo follows Nx best practices:
- **apps/** - Contains applications that can be deployed
- **libs/** - Contains reusable libraries shared across applications

## Technology Stack

- **Nx** - Mono-repo build system
- **Angular 21** - Frontend framework
- **TypeScript** - Programming language
- **SCSS** - Styling
- **Vitest** - Unit testing
- **Playwright** - E2E testing
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Learn More

- [Nx Documentation](https://nx.dev)
- [Angular Documentation](https://angular.dev)
- [Nx Angular Plugin](https://nx.dev/nx-api/angular)
