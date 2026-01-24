# Transports Library

This library provides a generic messaging transport layer with pluggable implementations for AMPS and Solace.

## Features

- **Generic Interface**: `ITransportService` provides a unified API for messaging operations
- **Multiple Implementations**: 
  - `AmpsTransportService` - AMPS messaging implementation
  - `SolaceTransportService` - Solace PubSub+ implementation
- **Configuration-Driven**: Transport type is selected automatically based on application configuration
- **Dependency Injection**: Uses Angular's DI system with `InjectionToken` for flexibility

## Usage

### Basic Setup

The transport service is configured automatically based on your application's configuration. Simply inject `TRANSPORT_SERVICE`:

```typescript
import { Component, inject } from '@angular/core';
import { TRANSPORT_SERVICE, ITransportService } from '@rates-trading/transports';

@Component({
  selector: 'app-example',
  template: '<div>Example</div>'
})
export class ExampleComponent {
  private transport = inject(TRANSPORT_SERVICE);

  async subscribe() {
    const subscription = await this.transport.subscribe('/topic/rates', (message) => {
      console.log('Received:', message);
    });
  }

  async publish() {
    await this.transport.publish('/topic/rates', { rate: 1.234 });
  }
}
```

### Configuration

Configure the transport in your `config-{env}.json`:

```json
{
  "transport": {
    "type": "amps",
    "amps": {
      "url": "ws://localhost:9000/amps/json",
      "user": "rates-user",
      "messageType": "json"
    }
  }
}
```

Or for Solace:

```json
{
  "transport": {
    "type": "solace",
    "solace": {
      "url": "ws://localhost:8008",
      "vpnName": "default",
      "userName": "rates-user",
      "clientName": "rates-desktop"
    }
  }
}
```

## API Reference

### ITransportService

- `connect(): Promise<void>` - Establish connection to the messaging server
- `disconnect(): Promise<void>` - Disconnect from the messaging server
- `subscribe<T>(topic: string, callback: MessageCallback<T>, options?: SubscriptionOptions): Promise<Subscription>` - Subscribe to a topic
- `publish<T>(topic: string, message: T, options?: PublishOptions): Promise<void>` - Publish a message
- `isConnected(): boolean` - Check connection status
- `connectionStatus$: Observable<ConnectionStatus>` - Observable for connection status changes

## Running unit tests

Run `nx test transports` to execute the unit tests.
