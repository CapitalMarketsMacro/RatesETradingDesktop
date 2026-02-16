import { TestBed } from '@angular/core/testing';
import { RatesData } from './rates-data';

describe('RatesData', () => {
  let service: RatesData;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RatesData);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return an array of rates', () => {
    const rates = service.getRates();
    expect(Array.isArray(rates)).toBe(true);
  });

  it('should return 3 rates', () => {
    const rates = service.getRates();
    expect(rates.length).toBe(3);
  });

  it('should include US10Y rate', () => {
    const rates = service.getRates();
    const us10y = rates.find((r) => r.symbol === 'US10Y');
    expect(us10y).toBeDefined();
    expect(us10y!.rate).toBe(4.25);
    expect(us10y!.change).toBe(0.05);
  });

  it('should include US2Y rate', () => {
    const rates = service.getRates();
    const us2y = rates.find((r) => r.symbol === 'US2Y');
    expect(us2y).toBeDefined();
    expect(us2y!.rate).toBe(4.45);
    expect(us2y!.change).toBe(0.02);
  });

  it('should include US30Y rate', () => {
    const rates = service.getRates();
    const us30y = rates.find((r) => r.symbol === 'US30Y');
    expect(us30y).toBeDefined();
    expect(us30y!.rate).toBe(4.40);
    expect(us30y!.change).toBe(0.03);
  });

  it('should have symbol, rate, and change fields on each entry', () => {
    const rates = service.getRates();
    for (const rate of rates) {
      expect(rate).toHaveProperty('symbol');
      expect(rate).toHaveProperty('rate');
      expect(rate).toHaveProperty('change');
      expect(typeof rate.symbol).toBe('string');
      expect(typeof rate.rate).toBe('number');
      expect(typeof rate.change).toBe('number');
    }
  });
});
