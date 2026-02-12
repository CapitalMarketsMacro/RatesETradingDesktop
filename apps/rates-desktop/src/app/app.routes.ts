import { Route } from '@angular/router';
import { TopOfTheBookViewComponent, MarketDataBlotterComponent, ExecutionsBlotterComponent } from './d2d';

export const appRoutes: Route[] = [
  // Default route redirects to top-of-book
  //{ path: '', redirectTo: 'market-data/top-of-book', pathMatch: 'full' },
  
  // D2D Market Data views
  { path: 'market-data/top-of-book', title: 'Top of the Book', component: TopOfTheBookViewComponent },
  { path: 'market-data/blotter', title: 'Market Data Blotter', component: MarketDataBlotterComponent },
  
  // D2D Executions
  { path: 'executions', title: 'Executions Blotter', component: ExecutionsBlotterComponent },
  
  // // Catch-all redirect
  // { path: '**', redirectTo: 'market-data/top-of-book' },
];
