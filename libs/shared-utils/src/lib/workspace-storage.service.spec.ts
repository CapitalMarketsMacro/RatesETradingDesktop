import { TestBed } from '@angular/core/testing';
import { WorkspaceStorageService } from './workspace-storage.service';
import { LoggerService } from '@rates-trading/logger';

describe('WorkspaceStorageService', () => {
  let service: WorkspaceStorageService;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};

    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => mockLocalStorage[key] ?? null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => {
        mockLocalStorage[key] = value;
      }
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key: string) => {
        delete mockLocalStorage[key];
      }
    );

    TestBed.configureTestingModule({
      providers: [
        WorkspaceStorageService,
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
    service = TestBed.inject(WorkspaceStorageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveState', () => {
    it('should save state for an instance', () => {
      service.saveState('view-1', { columnWidths: [100, 200] });
      const raw = mockLocalStorage['ws-component-states'];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw);
      expect(parsed['view-1']).toEqual({ columnWidths: [100, 200] });
    });

    it('should overwrite existing state for the same instance', () => {
      service.saveState('view-1', { columnWidths: [100] });
      service.saveState('view-1', { columnWidths: [200, 300] });
      const parsed = JSON.parse(mockLocalStorage['ws-component-states']);
      expect(parsed['view-1']).toEqual({ columnWidths: [200, 300] });
    });

    it('should preserve other instance states when saving', () => {
      service.saveState('view-1', { a: 1 });
      service.saveState('view-2', { b: 2 });
      const parsed = JSON.parse(mockLocalStorage['ws-component-states']);
      expect(parsed['view-1']).toEqual({ a: 1 });
      expect(parsed['view-2']).toEqual({ b: 2 });
    });
  });

  describe('loadState', () => {
    it('should return null when no state exists', () => {
      expect(service.loadState('nonexistent')).toBeNull();
    });

    it('should load saved state', () => {
      service.saveState('view-1', { filter: 'active' });
      const state = service.loadState('view-1');
      expect(state).toEqual({ filter: 'active' });
    });

    it('should return null when localStorage is empty', () => {
      expect(service.loadState('view-1')).toBeNull();
    });

    it('should return null for non-object state values', () => {
      mockLocalStorage['ws-component-states'] = JSON.stringify({ 'view-1': 'not-an-object' });
      expect(service.loadState('view-1')).toBeNull();
    });

    it('should return null for null state values', () => {
      mockLocalStorage['ws-component-states'] = JSON.stringify({ 'view-1': null });
      expect(service.loadState('view-1')).toBeNull();
    });
  });

  describe('removeState', () => {
    it('should remove state for a specific instance', () => {
      service.saveState('view-1', { a: 1 });
      service.saveState('view-2', { b: 2 });
      service.removeState('view-1');

      const parsed = JSON.parse(mockLocalStorage['ws-component-states']);
      expect(parsed['view-1']).toBeUndefined();
      expect(parsed['view-2']).toEqual({ b: 2 });
    });

    it('should handle removing non-existent state', () => {
      expect(() => service.removeState('nonexistent')).not.toThrow();
    });
  });

  describe('collectAllStates', () => {
    it('should return empty object when no states exist', () => {
      expect(service.collectAllStates()).toEqual({});
    });

    it('should return all saved states', () => {
      service.saveState('view-1', { a: 1 });
      service.saveState('view-2', { b: 2 });

      const all = service.collectAllStates();
      expect(all['view-1']).toEqual({ a: 1 });
      expect(all['view-2']).toEqual({ b: 2 });
    });
  });

  describe('restoreAllStates', () => {
    it('should replace all live states', () => {
      service.saveState('old-view', { old: true });

      const newStates = {
        'new-view-1': { x: 1 },
        'new-view-2': { y: 2 },
      };
      service.restoreAllStates(newStates);

      const result = service.collectAllStates();
      expect(result).toEqual(newStates);
    });
  });

  describe('clearAllStates', () => {
    it('should remove all states from localStorage', () => {
      service.saveState('view-1', { a: 1 });
      service.clearAllStates();
      expect(mockLocalStorage['ws-component-states']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle localStorage.getItem throwing', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });
      expect(service.loadState('view-1')).toBeNull();
    });

    it('should handle localStorage.setItem throwing in saveState', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      expect(() => service.saveState('view-1', { a: 1 })).not.toThrow();
    });

    it('should handle corrupted JSON in localStorage', () => {
      mockLocalStorage['ws-component-states'] = 'invalid-json';
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('invalid-json');
      expect(service.loadState('view-1')).toBeNull();
    });
  });
});
