import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { RatesData } from '@rates-trading/data-access';
import { RateCard, DataGrid, ColDef } from '@rates-trading/ui-components';
import { ValueFormatterParams } from 'ag-grid-community';

export interface TreasurySecurity {
  cusip: string;
  security: string;
  maturityDate: string;
  coupon: number;
  price: string;
  yield: number;
  change: string;
  changeBps: number;
  bid: string;
  ask: string;
  spread: string;
  volume: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MenubarModule,
    ButtonModule,
    RateCard,
    DataGrid,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private ratesData = inject(RatesData);
  title = 'Rates E-Trading Desktop';
  protected rates: { symbol: string; rate: number; change: number }[] = [];
  menuItems: MenuItem[] = [
    { label: 'Market Data', icon: 'pi pi-chart-line', routerLink: ['/market-data'] },
    { label: 'Trading', icon: 'pi pi-briefcase', routerLink: ['/trading'] },
    { label: 'Preferences', icon: 'pi pi-cog', routerLink: ['/preferences'] },
  ];
  isDarkTheme = false;

  // Treasury grid columns
  treasuryColumns: ColDef[] = [
    {
      field: 'security',
      headerName: 'Security',
      width: 150,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'cusip',
      headerName: 'CUSIP',
      width: 120,
    },
    {
      field: 'maturityDate',
      headerName: 'Maturity',
      width: 120,
    },
    {
      field: 'coupon',
      headerName: 'Coupon',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => `${params.value?.toFixed(3)}%`,
      type: 'numericColumn',
    },
    {
      field: 'price',
      headerName: 'Price',
      width: 100,
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'yield',
      headerName: 'Yield',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => `${params.value?.toFixed(3)}%`,
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'change',
      headerName: 'Change',
      width: 100,
      cellStyle: (params: any) => {
        const changeBps = params.data?.changeBps || 0;
        return {
          textAlign: 'right',
          color: changeBps > 0 ? '#d32f2f' : changeBps < 0 ? '#2e7d32' : 'inherit',
        };
      },
    },
    {
      field: 'changeBps',
      headerName: 'Change (bps)',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => {
        const value = params.value || 0;
        return value > 0 ? `+${value}` : `${value}`;
      },
      type: 'numericColumn',
      cellStyle: (params: any) => {
        const value = params.value || 0;
        return {
          textAlign: 'right',
          color: value > 0 ? '#d32f2f' : value < 0 ? '#2e7d32' : 'inherit',
          fontWeight: value !== 0 ? 'bold' : 'normal',
        };
      },
    },
    {
      field: 'bid',
      headerName: 'Bid',
      width: 100,
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'ask',
      headerName: 'Ask',
      width: 100,
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'spread',
      headerName: 'Spread',
      width: 100,
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'volume',
      headerName: 'Volume',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => {
        const value = params.value || 0;
        return value.toLocaleString();
      },
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
    },
  ];

  // Mock on-the-run treasury data
  treasuryData: TreasurySecurity[] = [
    {
      cusip: '91282CJQ8',
      security: '2Y',
      maturityDate: '2026-01-31',
      coupon: 4.625,
      price: '99-16+',
      yield: 4.452,
      change: '+0-02',
      changeBps: 2,
      bid: '99-16',
      ask: '99-16+',
      spread: '0-00+',
      volume: 1250000000,
    },
    {
      cusip: '91282CJR6',
      security: '5Y',
      maturityDate: '2029-01-31',
      coupon: 4.375,
      price: '99-08',
      yield: 4.387,
      change: '-0-01',
      changeBps: -1,
      bid: '99-07+',
      ask: '99-08',
      spread: '0-00+',
      volume: 980000000,
    },
    {
      cusip: '91282CJS4',
      security: '10Y',
      maturityDate: '2034-01-31',
      coupon: 4.125,
      price: '98-24+',
      yield: 4.298,
      change: '+0-03',
      changeBps: 3,
      bid: '98-24',
      ask: '98-24+',
      spread: '0-00+',
      volume: 1520000000,
    },
    {
      cusip: '91282CJT2',
      security: '30Y',
      maturityDate: '2054-01-31',
      coupon: 4.250,
      price: '97-18',
      yield: 4.402,
      change: '-0-02',
      changeBps: -2,
      bid: '97-17+',
      ask: '97-18',
      spread: '0-00+',
      volume: 875000000,
    },
    {
      cusip: '91282CJU0',
      security: '3Y',
      maturityDate: '2027-01-31',
      coupon: 4.500,
      price: '99-12+',
      yield: 4.418,
      change: '+0-01',
      changeBps: 1,
      bid: '99-12',
      ask: '99-12+',
      spread: '0-00+',
      volume: 750000000,
    },
    {
      cusip: '91282CJV8',
      security: '7Y',
      maturityDate: '2031-01-31',
      coupon: 4.250,
      price: '99-00',
      yield: 4.342,
      change: '+0-02',
      changeBps: 2,
      bid: '98-31+',
      ask: '99-00',
      spread: '0-00+',
      volume: 650000000,
    },
  ];

  constructor() {
    this.rates = this.ratesData.getRates();
  }

  ngOnInit() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkTheme = true;
      document.documentElement.classList.add('app-dark');
    }
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    const html = document.documentElement;
    if (this.isDarkTheme) {
      html.classList.add('app-dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('app-dark');
      localStorage.setItem('theme', 'light');
    }
  }

  get themeLabel(): string {
    return this.isDarkTheme ? 'Light Mode' : 'Dark Mode';
  }

  get themeIcon(): string {
    return this.isDarkTheme ? 'pi pi-sun' : 'pi pi-moon';
  }
}
