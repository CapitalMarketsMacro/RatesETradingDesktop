import { Component, inject, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigurationService } from '@rates-trading/configuration';
import { TRANSPORT_SERVICE, ConnectionStatus } from '@rates-trading/transports';
import { OpenFinService, OpenFinConnectionStatus } from '@rates-trading/openfin';
import { Subscription } from 'rxjs';

/**
 * Status Bar Component
 *
 * A compact horizontal bar designed to sit as the first row in an OpenFin layout.
 * Displays real-time connection statuses, environment info, and a clock.
 */
@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.css',
})
export class StatusBarComponent implements OnInit, OnDestroy {
  private configService = inject(ConfigurationService);
  private transport = inject(TRANSPORT_SERVICE);
  private openfinService = inject(OpenFinService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  private subscriptions: Subscription[] = [];
  private clockInterval?: ReturnType<typeof setInterval>;

  // App info
  appName = '';
  appVersion = '';
  environment = '';

  // Transport status
  transportStatus: ConnectionStatus = ConnectionStatus.Disconnected;
  transportType = '';

  // OpenFin status
  openfinStatus: OpenFinConnectionStatus = OpenFinConnectionStatus.Disconnected;

  // Clock
  currentTime = '';

  ngOnInit(): void {
    // Load config
    const config = this.configService.getConfiguration();
    if (config) {
      this.appName = config.app?.name || 'Rates E-Trading';
      this.appVersion = config.app?.version || '';
      this.environment = config.app?.environment || 'dev';
      this.transportType = (config.transport?.type || 'amps').toUpperCase();
    }

    // Subscribe to transport status (may fire outside Angular zone)
    this.subscriptions.push(
      this.transport.connectionStatus$.subscribe((status) => {
        this.ngZone.run(() => {
          this.transportStatus = status;
          this.cdr.detectChanges();
        });
      })
    );

    // Subscribe to OpenFin status (connectAsView resolves outside zone)
    this.subscriptions.push(
      this.openfinService.connectionStatus$.subscribe((status) => {
        this.ngZone.run(() => {
          this.openfinStatus = status;
          this.cdr.detectChanges();
        });
      })
    );

    // Start clock
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  get transportStatusLabel(): string {
    switch (this.transportStatus) {
      case ConnectionStatus.Connected:
        return 'Connected';
      case ConnectionStatus.Connecting:
        return 'Connecting…';
      case ConnectionStatus.Reconnecting:
        return 'Reconnecting…';
      case ConnectionStatus.Disconnected:
        return 'Disconnected';
      case ConnectionStatus.Error:
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  get transportStatusClass(): string {
    switch (this.transportStatus) {
      case ConnectionStatus.Connected:
        return 'status-ok';
      case ConnectionStatus.Connecting:
      case ConnectionStatus.Reconnecting:
        return 'status-warn';
      default:
        return 'status-error';
    }
  }

  get openfinStatusLabel(): string {
    switch (this.openfinStatus) {
      case OpenFinConnectionStatus.Connected:
        return 'Connected';
      case OpenFinConnectionStatus.Connecting:
        return 'Connecting…';
      case OpenFinConnectionStatus.Disconnected:
        return 'Disconnected';
      case OpenFinConnectionStatus.Error:
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  get openfinStatusClass(): string {
    switch (this.openfinStatus) {
      case OpenFinConnectionStatus.Connected:
        return 'status-ok';
      case OpenFinConnectionStatus.Connecting:
        return 'status-warn';
      default:
        return 'status-error';
    }
  }

  get envClass(): string {
    switch (this.environment) {
      case 'prod':
        return 'env-prod';
      case 'staging':
        return 'env-staging';
      default:
        return 'env-dev';
    }
  }
}
