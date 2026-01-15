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
});
