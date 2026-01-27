import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerService } from '@rates-trading/logger';
import { TRANSPORT_SERVICE } from '@rates-trading/transports';
import { of } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    // Mock configuration service
    const mockConfigService = {
      loadConfiguration: () => of({
        app: { name: 'Rates E-Trading Desktop', version: '1.0.0', environment: 'test' },
        transport: { type: 'amps' as const },
      }),
      getConfiguration: () => ({
        app: { name: 'Rates E-Trading Desktop', version: '1.0.0', environment: 'test' },
        transport: { type: 'amps' as const },
      }),
    };

    // Mock transport service
    const mockTransportService = {
      connectionStatus$: of({}),
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      isConnected: () => false,
    };

    // Mock logger service
    const mockLoggerService = {
      child: () => ({
        info: () => {},
        debug: () => {},
        error: () => {},
        warn: () => {},
      }),
    };

    await TestBed.configureTestingModule({
      imports: [App, RouterModule.forRoot([])],
      providers: [
        provideHttpClient(),
        { provide: ConfigurationService, useValue: mockConfigService },
        { provide: TRANSPORT_SERVICE, useValue: mockTransportService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have title', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.title).toBe('Rates E-Trading Desktop');
  });
});
