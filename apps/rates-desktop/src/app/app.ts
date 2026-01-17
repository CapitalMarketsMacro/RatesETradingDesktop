import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { RatesData } from '@rates-trading/data-access';
import { UiComponentsModule } from '@rates-trading/ui-components';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MenubarModule,
    ButtonModule,
    UiComponentsModule,
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
