import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ConfigurationService } from './configuration.service';
import { RatesAppConfiguration } from './rates-app-configuration';
import { LoggerService } from '@rates-trading/logger';

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let httpMock: HttpTestingController;

  const mockConfig: RatesAppConfiguration = {
    app: {
      name: 'Rates E-Trading',
      version: '1.0.0',
      environment: 'dev',
    },
    api: {
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ConfigurationService,
        {
          provide: LoggerService,
          useValue: {
            child: () => ({
              info: vi.fn(),
              debug: vi.fn(),
              warn: vi.fn(),
              error: vi.fn(),
            }),
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(ConfigurationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getEnvironmentFromUrl', () => {
    it('should return "dev" as default environment', () => {
      expect(service.getEnvironmentFromUrl()).toBe('dev');
    });
  });

  describe('loadConfiguration', () => {
    it('should load configuration for dev environment', async () => {
      const promise = firstValueFrom(service.loadConfiguration('dev'));

      const req = httpMock.expectOne('assets/config-dev.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockConfig);

      const config = await promise;
      expect(config).toBeDefined();
      expect(config.app.environment).toBe('dev');
    });

    it('should load configuration for prod environment', async () => {
      const promise = firstValueFrom(service.loadConfiguration('prod'));

      const req = httpMock.expectOne('assets/config-prod.json');
      req.flush(mockConfig);

      const config = await promise;
      expect(config).toBeDefined();
      expect(config.app.environment).toBe('prod');
    });

    it('should inject environment into config', async () => {
      const promise = firstValueFrom(service.loadConfiguration('uat'));

      const req = httpMock.expectOne('assets/config-uat.json');
      req.flush(mockConfig);

      const config = await promise;
      expect(config.app.environment).toBe('uat');
    });

    it('should return cached config if environment has not changed', async () => {
      // First load
      const promise1 = firstValueFrom(service.loadConfiguration('dev'));
      const req = httpMock.expectOne('assets/config-dev.json');
      req.flush(mockConfig);
      const config1 = await promise1;

      // Second load should return cached config
      const config2 = await firstValueFrom(service.loadConfiguration('dev'));
      expect(config2).toBe(config1);
    });

    it('should fallback to dev config when non-dev environment fails', async () => {
      const promise = firstValueFrom(service.loadConfiguration('staging'));

      // Fail the staging request
      const stagingReq = httpMock.expectOne('assets/config-staging.json');
      stagingReq.flush(null, { status: 404, statusText: 'Not Found' });

      // Respond with dev fallback
      const devReq = httpMock.expectOne('assets/config-dev.json');
      devReq.flush(mockConfig);

      const config = await promise;
      expect(config.app.environment).toBe('dev');
    });

    it('should throw error when dev config also fails on fallback', async () => {
      const promise = firstValueFrom(service.loadConfiguration('staging'));

      // Fail the staging request
      const stagingReq = httpMock.expectOne('assets/config-staging.json');
      stagingReq.flush(null, { status: 404, statusText: 'Not Found' });

      // Fail the dev fallback too
      const devReq = httpMock.expectOne('assets/config-dev.json');
      devReq.flush(null, { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toThrow('Unable to load configuration');
    });

    it('should throw error when dev config fails (no fallback)', async () => {
      const promise = firstValueFrom(service.loadConfiguration('dev'));

      const req = httpMock.expectOne('assets/config-dev.json');
      req.flush(null, { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toBeDefined();
    });
  });

  describe('getConfiguration', () => {
    it('should return undefined before loading', () => {
      expect(service.getConfiguration()).toBeUndefined();
    });

    it('should return config after loading', async () => {
      const promise = firstValueFrom(service.loadConfiguration('dev'));
      const req = httpMock.expectOne('assets/config-dev.json');
      req.flush(mockConfig);
      await promise;

      expect(service.getConfiguration()).toBeDefined();
      expect(service.getConfiguration()!.app.name).toBe('Rates E-Trading');
    });
  });

  describe('getConfiguration$', () => {
    it('should return cached config as observable when already loaded', async () => {
      const promise = firstValueFrom(service.loadConfiguration('dev'));
      const req = httpMock.expectOne('assets/config-dev.json');
      req.flush(mockConfig);
      await promise;

      const config = await firstValueFrom(service.getConfiguration$());
      expect(config).toBeDefined();
      expect(config.app.name).toBe('Rates E-Trading');
    });

    it('should load configuration when not yet loaded', async () => {
      const promise = firstValueFrom(service.getConfiguration$());

      const req = httpMock.expectOne('assets/config-dev.json');
      req.flush(mockConfig);

      const config = await promise;
      expect(config).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear config cache', async () => {
      const promise = firstValueFrom(service.loadConfiguration('dev'));
      const req = httpMock.expectOne('assets/config-dev.json');
      req.flush(mockConfig);
      await promise;

      expect(service.getConfiguration()).toBeDefined();
      service.clearCache();
      expect(service.getConfiguration()).toBeUndefined();
    });
  });

  describe('getCurrentEnvironment', () => {
    it('should return environment from URL when not loaded', () => {
      expect(service.getCurrentEnvironment()).toBe('dev');
    });

    it('should return current environment after loading', async () => {
      const promise = firstValueFrom(service.loadConfiguration('prod'));
      const req = httpMock.expectOne('assets/config-prod.json');
      req.flush(mockConfig);
      await promise;

      expect(service.getCurrentEnvironment()).toBe('prod');
    });
  });
});
