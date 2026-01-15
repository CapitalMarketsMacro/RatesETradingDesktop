import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class RatesData {
  getRates() {
    return [
      { symbol: 'US10Y', rate: 4.25, change: 0.05 },
      { symbol: 'US2Y', rate: 4.45, change: 0.02 },
      { symbol: 'US30Y', rate: 4.40, change: 0.03 },
    ];
  }
}
