import { Route } from '@angular/router';
import { TopOfTheBookViewComponent, MarketDataBlotterComponent, ExecutionsBlotterComponent, StatusBarComponent } from './d2d';

export const appRoutes: Route[] = [
  // Status bar (thin row at top of layout)
  { path: 'status-bar', title: 'Status', component: StatusBarComponent },

  // D2D Market Data views
  { path: 'market-data/top-of-book', title: 'Top of the Book', component: TopOfTheBookViewComponent },
  { path: 'market-data/blotter', title: 'Market Data Blotter', component: MarketDataBlotterComponent },
  
  // D2D Executions
  { path: 'executions', title: 'Executions Blotter', component: ExecutionsBlotterComponent },
];
