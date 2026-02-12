import { Route } from '@angular/router';
import { TopOfTheBookViewComponent, MarketDataBlotterComponent, ExecutionsBlotterComponent } from './d2d';

export const appRoutes: Route[] = [
  // Default route redirects to top-of-book
  //{ path: '', redirectTo: 'market-data/top-of-book', pathMatch: 'full' },
  
  // D2D Market Data views
  { path: 'market-data/top-of-book', component: TopOfTheBookViewComponent },
  { path: 'market-data/blotter', component: MarketDataBlotterComponent },
  
  // D2D Executions
  { path: 'executions', component: ExecutionsBlotterComponent },
  
  // // Catch-all redirect
  // { path: '**', redirectTo: 'market-data/top-of-book' },
];
