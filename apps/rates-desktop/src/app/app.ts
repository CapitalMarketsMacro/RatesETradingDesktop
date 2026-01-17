import { Component, inject } from '@angular/core';
import { RatesData } from '@rates-trading/data-access';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private ratesData = inject(RatesData);
  title = 'Rates E-Trading Desktop';
  protected rates: { symbol: string; rate: number; change: number }[] = [];

  constructor() {
    this.rates = this.ratesData.getRates();
  }
}
