import { TestBed } from '@angular/core/testing';
import { provideTransport, provideTransportWithConfig } from './transport.factory';
import { TRANSPORT_SERVICE } from './transport.tokens';
import { ITransportService } from './interfaces/transport.interface';
import { AmpsTransportService } from './services/amps';
import { SolaceTransportService } from './services/solace';

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

      expect(ampsService).toBeDefined();
      expect(solaceService).toBeDefined();
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
