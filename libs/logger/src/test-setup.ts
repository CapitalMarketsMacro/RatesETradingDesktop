import { vi } from 'vitest';

// Mock console methods for tests
global.console = {
  ...console,
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};
