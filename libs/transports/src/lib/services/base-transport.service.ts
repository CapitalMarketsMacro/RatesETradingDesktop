import { BehaviorSubject, Subject, Observable } from 'rxjs';
import {
  ConnectionStatus,
  ConnectionEvent,
  ErrorCallback,
  TransportError,
} from '../interfaces/transport.interface';

/**
 * Base class for transport implementations
 * Provides common functionality for connection status management and error handling
 */
export abstract class BaseTransportService {
  protected readonly connectionStatusSubject = new BehaviorSubject<ConnectionStatus>(
    ConnectionStatus.Disconnected
  );
  protected readonly connectionEventsSubject = new Subject<ConnectionEvent>();
  protected errorCallbacks: ErrorCallback[] = [];
  protected subscriptionCounter = 0;

  /**
   * Observable that emits connection status changes
   */
  readonly connectionStatus$: Observable<ConnectionStatus> =
    this.connectionStatusSubject.asObservable();

  /**
   * Observable that emits connection events
   */
  readonly connectionEvents$: Observable<ConnectionEvent> =
    this.connectionEventsSubject.asObservable();

  /**
   * Gets the current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatusSubject.getValue();
  }

  /**
   * Checks if the transport is currently connected
   */
  isConnected(): boolean {
    return this.connectionStatusSubject.getValue() === ConnectionStatus.Connected;
  }

  /**
   * Registers an error handler for transport-level errors
   * @param callback Function called when an error occurs
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Updates the connection status and emits appropriate events
   */
  protected updateConnectionStatus(
    status: ConnectionStatus,
    details?: string,
    error?: TransportError
  ): void {
    this.connectionStatusSubject.next(status);

    let eventType: ConnectionEvent['type'];
    switch (status) {
      case ConnectionStatus.Connected:
        eventType = 'connected';
        break;
      case ConnectionStatus.Disconnected:
        eventType = 'disconnected';
        break;
      case ConnectionStatus.Reconnecting:
        eventType = 'reconnecting';
        break;
      case ConnectionStatus.Error:
        eventType = 'error';
        break;
      default:
        return;
    }

    this.connectionEventsSubject.next({
      type: eventType,
      timestamp: new Date(),
      details,
      error,
    });
  }

  /**
   * Notifies all registered error callbacks
   */
  protected notifyError(error: TransportError): void {
    this.errorCallbacks.forEach((callback) => {
      try {
        callback(error);
      } catch (e) {
        // Silently ignore errors in error callbacks to prevent infinite loops
        // Child classes should handle logging if needed
      }
    });
  }

  /**
   * Generates a unique subscription ID
   */
  protected generateSubscriptionId(): string {
    return `sub_${++this.subscriptionCounter}_${Date.now()}`;
  }

  /**
   * Creates a TransportError from an unknown error
   */
  protected createTransportError(
    error: unknown,
    code = 'UNKNOWN_ERROR',
    recoverable = false
  ): TransportError {
    if (error instanceof Error) {
      return {
        code,
        message: error.message,
        cause: error,
        recoverable,
      };
    }
    return {
      code,
      message: String(error),
      recoverable,
    };
  }
}
