import {
  formatTreasury32nds,
  parseTreasury32nds,
  formatSpread32nds,
  formatChange32nds,
  formatDecimalPrice,
} from './price-formatters';

describe('formatTreasury32nds', () => {
  it('should return "-" for null', () => {
    expect(formatTreasury32nds(null)).toBe('-');
  });

  it('should return "-" for undefined', () => {
    expect(formatTreasury32nds(undefined)).toBe('-');
  });

  it('should format whole number price', () => {
    expect(formatTreasury32nds(100.0)).toBe('100-000');
  });

  it('should format half tick (16/32)', () => {
    expect(formatTreasury32nds(99.5)).toBe('99-160');
  });

  it('should format half of a 32nd (4/8)', () => {
    expect(formatTreasury32nds(99.515625)).toBe('99-164');
  });

  it('should format quarter of a 32nd (2/8)', () => {
    expect(formatTreasury32nds(99.5078125)).toBe('99-162');
  });

  it('should format three-quarter of a 32nd (6/8)', () => {
    expect(formatTreasury32nds(99.5234375)).toBe('99-166');
  });

  it('should format 13/32', () => {
    expect(formatTreasury32nds(99.40625)).toBe('99-130');
  });

  it('should format 0/32 with leading zeros', () => {
    expect(formatTreasury32nds(100.0)).toBe('100-000');
  });

  it('should format 1/32', () => {
    expect(formatTreasury32nds(99.03125)).toBe('99-010');
  });

  it('should format 31/32', () => {
    expect(formatTreasury32nds(99.96875)).toBe('99-310');
  });

  it('should handle small handle values', () => {
    expect(formatTreasury32nds(1.5)).toBe('1-160');
  });

  it('should handle large handle values', () => {
    expect(formatTreasury32nds(150.25)).toBe('150-080');
  });

  it('should format zero', () => {
    expect(formatTreasury32nds(0)).toBe('0-000');
  });
});

describe('parseTreasury32nds', () => {
  it('should return null for empty string', () => {
    expect(parseTreasury32nds('')).toBeNull();
  });

  it('should return null for "-"', () => {
    expect(parseTreasury32nds('-')).toBeNull();
  });

  it('should return null for invalid format', () => {
    expect(parseTreasury32nds('abc')).toBeNull();
  });

  it('should parse whole number format', () => {
    expect(parseTreasury32nds('100-000')).toBe(100.0);
  });

  it('should parse 16/32 (half point)', () => {
    expect(parseTreasury32nds('99-160')).toBe(99.5);
  });

  it('should parse half tick (4/8)', () => {
    expect(parseTreasury32nds('99-164')).toBe(99.515625);
  });

  it('should parse quarter tick (2/8)', () => {
    expect(parseTreasury32nds('99-162')).toBe(99.5078125);
  });

  it('should parse three-quarter tick (6/8)', () => {
    expect(parseTreasury32nds('99-166')).toBe(99.5234375);
  });

  it('should parse 13/32', () => {
    expect(parseTreasury32nds('99-130')).toBe(99.40625);
  });

  it('should parse 1/32', () => {
    expect(parseTreasury32nds('99-010')).toBe(99.03125);
  });

  it('should parse 31/32', () => {
    expect(parseTreasury32nds('99-310')).toBe(99.96875);
  });

  it('should roundtrip with formatTreasury32nds', () => {
    const values = [99.5, 99.515625, 99.5078125, 99.5234375, 100.0, 99.40625];
    for (const val of values) {
      const formatted = formatTreasury32nds(val);
      const parsed = parseTreasury32nds(formatted);
      expect(parsed).toBeCloseTo(val, 8);
    }
  });

  // Legacy format tests
  it('should parse legacy format with + suffix (half tick)', () => {
    expect(parseTreasury32nds('99-16+')).toBe(99.515625);
  });

  it('should parse legacy format with no suffix', () => {
    expect(parseTreasury32nds('99-16')).toBe(99.5);
  });

  it('should return null for completely invalid string', () => {
    expect(parseTreasury32nds('not-a-price')).toBeNull();
  });
});

describe('formatSpread32nds', () => {
  it('should return "-" for null', () => {
    expect(formatSpread32nds(null)).toBe('-');
  });

  it('should return "-" for undefined', () => {
    expect(formatSpread32nds(undefined)).toBe('-');
  });

  it('should format 2/32 spread', () => {
    expect(formatSpread32nds(0.0625)).toBe('2.0/32');
  });

  it('should format 1/32 spread', () => {
    expect(formatSpread32nds(0.03125)).toBe('1.0/32');
  });

  it('should format zero spread', () => {
    expect(formatSpread32nds(0)).toBe('0.0/32');
  });

  it('should format fractional 32nds spread', () => {
    expect(formatSpread32nds(0.046875)).toBe('1.5/32');
  });
});

describe('formatChange32nds', () => {
  it('should return "-" for null', () => {
    expect(formatChange32nds(null)).toBe('-');
  });

  it('should return "-" for undefined', () => {
    expect(formatChange32nds(undefined)).toBe('-');
  });

  it('should format positive change', () => {
    expect(formatChange32nds(0.0625)).toBe('+0-02');
  });

  it('should format negative change', () => {
    expect(formatChange32nds(-0.03125)).toBe('-0-01');
  });

  it('should format zero change', () => {
    expect(formatChange32nds(0)).toBe('+0-00');
  });

  it('should format larger positive change', () => {
    expect(formatChange32nds(1.5)).toBe('+1-16');
  });

  it('should format larger negative change', () => {
    expect(formatChange32nds(-1.5)).toBe('-1-16');
  });
});

describe('formatDecimalPrice', () => {
  it('should return "-" for null', () => {
    expect(formatDecimalPrice(null)).toBe('-');
  });

  it('should return "-" for undefined', () => {
    expect(formatDecimalPrice(undefined)).toBe('-');
  });

  it('should format with default 4 decimal places', () => {
    expect(formatDecimalPrice(99.5)).toBe('99.5000');
  });

  it('should format with custom decimal places', () => {
    expect(formatDecimalPrice(99.5, 2)).toBe('99.50');
  });

  it('should format with 0 decimal places', () => {
    expect(formatDecimalPrice(99.5, 0)).toBe('100');
  });

  it('should format with 6 decimal places', () => {
    expect(formatDecimalPrice(99.515625, 6)).toBe('99.515625');
  });

  it('should format zero', () => {
    expect(formatDecimalPrice(0)).toBe('0.0000');
  });

  it('should format negative price', () => {
    expect(formatDecimalPrice(-1.5, 2)).toBe('-1.50');
  });
});
