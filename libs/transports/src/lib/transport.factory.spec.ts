import { TestBed } from '@angular/core/testing';
import { provideTransport, provideTransportWithConfig, createTransportProviders } from './transport.factory';
import { TRANSPORT_SERVICE, TRANSPORT_CONFIG } from './transport.tokens';
import { ITransportService } from './interfaces/transport.interface';
import { AmpsTransportService } from './services/amps';
import { SolaceTransportService } from './services/solace';
import { NatsTransportService } from './services/nats';

describe('Transport Factory', () => {
  describe('provideTransportWithConfig', () => {
    it('should provide AMPS transport when type is amps', () => {
      TestBed.configureTestingModule({
        providers: [
          provideTransportWithConfig({
            type: 'amps',
            amps: {
              url: 'ws://localhost:9000/amps/json',
              user: 'test-user',
            },
          }),
        ],
      });

      const transport = TestBed.inject(TRANSPORT_SERVICE);
      expect(transport).toBeInstanceOf(AmpsTransportService);
    });

    it('should provide Solace transport when type is solace', () => {
      TestBed.configureTestingModule({
        providers: [
          provideTransportWithConfig({
            type: 'solace',
            solace: {
              url: 'ws://localhost:8008',
              vpnName: 'dev-vpn',
              userName: 'test-user',
            },
          }),
        ],
      });

      const transport = TestBed.inject(TRANSPORT_SERVICE);
      expect(transport).toBeInstanceOf(SolaceTransportService);
    });

    it('should provide NATS transport when type is nats', () => {
      TestBed.configureTestingModule({
        providers: [
          provideTransportWithConfig({
            type: 'nats',
            nats: {
              url: 'nats://localhost:4222',
            },
          }),
        ],
      });

      const transport = TestBed.inject(TRANSPORT_SERVICE);
      expect(transport).toBeInstanceOf(NatsTransportService);
    });

    it('should throw error when AMPS config is missing', () => {
      expect(() => {
        TestBed.configureTestingModule({
          providers: [
            provideTransportWithConfig({
              type: 'amps',
            }),
          ],
        });
        TestBed.inject(TRANSPORT_SERVICE);
      }).toThrow('AMPS configuration is required when transport type is "amps"');
    });

    it('should throw error when Solace config is missing', () => {
      expect(() => {
        TestBed.configureTestingModule({
          providers: [
            provideTransportWithConfig({
              type: 'solace',
            }),
          ],
        });
        TestBed.inject(TRANSPORT_SERVICE);
      }).toThrow('Solace configuration is required when transport type is "solace"');
    });

    it('should throw error when NATS config is missing', () => {
      expect(() => {
        TestBed.configureTestingModule({
          providers: [
            provideTransportWithConfig({
              type: 'nats',
            }),
          ],
        });
        TestBed.inject(TRANSPORT_SERVICE);
      }).toThrow('NATS configuration is required when transport type is "nats"');
    });

    it('should throw error for websocket (not implemented)', () => {
      expect(() => {
        TestBed.configureTestingModule({
          providers: [
            provideTransportWithConfig({
              type: 'websocket',
              websocket: {
                url: 'ws://localhost:8080',
              },
            }),
          ],
        });
        TestBed.inject(TRANSPORT_SERVICE);
      }).toThrow('WebSocket transport is not yet implemented');
    });

    it('should throw error for unknown transport type', () => {
      expect(() => {
        TestBed.configureTestingModule({
          providers: [
            provideTransportWithConfig({
              type: 'unknown' as any,
            }),
          ],
        });
        TestBed.inject(TRANSPORT_SERVICE);
      }).toThrow('Unknown transport type: unknown');
    });
  });

  describe('provideTransport', () => {
    it('should provide transport with static config', () => {
      TestBed.configureTestingModule({
        providers: [
          provideTransport({
            config: {
              type: 'amps',
              amps: {
                url: 'ws://localhost:9000/amps/json',
                user: 'test-user',
              },
            },
          }),
        ],
      });

      const transport = TestBed.inject(TRANSPORT_SERVICE);
      expect(transport).toBeDefined();
    });

    it('should also provide concrete services', () => {
      TestBed.configureTestingModule({
        providers: [
          provideTransport({
            config: {
              type: 'solace',
              solace: {
                url: 'ws://localhost:8008',
                vpnName: 'dev-vpn',
                userName: 'test-user',
              },
            },
          }),
        ],
      });

      const ampsService = TestBed.inject(AmpsTransportService);
      const solaceService = TestBed.inject(SolaceTransportService);
      const natsService = TestBed.inject(NatsTransportService);

      expect(ampsService).toBeDefined();
      expect(solaceService).toBeDefined();
      expect(natsService).toBeDefined();
    });

    it('should provide TRANSPORT_CONFIG token with static config', () => {
      TestBed.configureTestingModule({
        providers: [
          provideTransport({
            config: {
              type: 'amps',
              amps: {
                url: 'ws://localhost:9000/amps/json',
                user: 'test-user',
              },
            },
          }),
        ],
      });

      const config = TestBed.inject(TRANSPORT_CONFIG);
      expect(config).toBeDefined();
      expect(config.type).toBe('amps');
    });
  });

  describe('createTransportProviders', () => {
    it('should create providers array with static config', () => {
      const providers = createTransportProviders({
        config: {
          type: 'amps',
          amps: {
            url: 'ws://localhost:9000/amps/json',
            user: 'test-user',
          },
        },
      });

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should create providers that work with TestBed when given static config', () => {
      TestBed.configureTestingModule({
        providers: createTransportProviders({
          config: {
            type: 'amps',
            amps: {
              url: 'ws://localhost:9000/amps/json',
              user: 'test-user',
            },
          },
        }),
      });

      const transport = TestBed.inject(TRANSPORT_SERVICE);
      expect(transport).toBeDefined();
      expect(transport).toBeInstanceOf(AmpsTransportService);

      const config = TestBed.inject(TRANSPORT_CONFIG);
      expect(config.type).toBe('amps');
    });

    it('should create providers for NATS transport with static config', () => {
      TestBed.configureTestingModule({
        providers: createTransportProviders({
          config: {
            type: 'nats',
            nats: {
              url: 'nats://localhost:4222',
            },
          },
        }),
      });

      const transport = TestBed.inject(TRANSPORT_SERVICE);
      expect(transport).toBeDefined();
      expect(transport).toBeInstanceOf(NatsTransportService);
    });

    it('should create providers without config (uses ConfigurationService factory)', () => {
      const providers = createTransportProviders();

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should create providers when options is provided without config', () => {
      const providers = createTransportProviders({ useConfigurationService: true });

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should include concrete service providers in both config paths', () => {
      const withConfig = createTransportProviders({
        config: {
          type: 'amps',
          amps: {
            url: 'ws://localhost:9000/amps/json',
            user: 'test-user',
          },
        },
      });

      const withoutConfig = createTransportProviders();

      // Both should have at least the concrete services
      expect(withConfig.length).toBeGreaterThanOrEqual(4); // TRANSPORT_CONFIG + TRANSPORT_SERVICE + 3 concrete
      expect(withoutConfig.length).toBeGreaterThanOrEqual(4); // TRANSPORT_SERVICE + 3 concrete
    });
  });

  describe('ITransportService interface', () => {
    let transport: ITransportService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideTransportWithConfig({
            type: 'amps',
            amps: {
              url: 'ws://localhost:9000/amps/json',
              user: 'test-user',
            },
          }),
        ],
      });

      transport = TestBed.inject(TRANSPORT_SERVICE);
    });

    it('should have all required methods', () => {
      expect(typeof transport.connect).toBe('function');
      expect(typeof transport.disconnect).toBe('function');
      expect(typeof transport.subscribe).toBe('function');
      expect(typeof transport.publish).toBe('function');
      expect(typeof transport.isConnected).toBe('function');
      expect(typeof transport.getConnectionStatus).toBe('function');
      expect(typeof transport.onError).toBe('function');
    });

    it('should have observables', () => {
      expect(transport.connectionStatus$).toBeDefined();
      expect(transport.connectionEvents$).toBeDefined();
    });
  });
});
