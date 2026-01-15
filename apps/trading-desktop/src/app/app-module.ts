import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';
import { NxWelcome } from './nx-welcome';
import { UiComponentsModule } from '@rates-trading/ui-components';

@NgModule({
  declarations: [App, NxWelcome],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes), UiComponentsModule],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
