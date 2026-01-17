import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';
import { UiComponentsModule } from '@rates-trading/ui-components';

@NgModule({
  declarations: [App],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes), UiComponentsModule],
  bootstrap: [App],
})
export class AppModule {}
