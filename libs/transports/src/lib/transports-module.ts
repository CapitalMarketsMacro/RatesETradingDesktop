import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransportModuleConfig, createTransportProviders } from './transport.factory';

/**
 * Angular module for transport services
 *
 * @example
 * ```typescript
 * // In your AppModule or feature module
 * @NgModule({
 *   imports: [
 *     TransportsModule.forRoot({
 *       config: {
 *         type: 'solace',
 *         solace: {
 *           url: 'ws://localhost:8008',
 *           vpnName: 'default',
 *           userName: 'rates-user'
 *         }
 *       }
 *     })
 *   ]
 * })
 * export class AppModule { }
 * ```
 *
 * @example Using ConfigurationService
 * ```typescript
 * @NgModule({
 *   imports: [
 *     TransportsModule.forRoot() // Uses ConfigurationService automatically
 *   ]
 * })
 * export class AppModule { }
 * ```
 */
@NgModule({
  imports: [CommonModule],
})
export class TransportsModule {
  /**
   * Configures the TransportsModule with providers
   * Use this in your root module (AppModule)
   *
   * @param options Optional configuration options
   */
  static forRoot(options?: TransportModuleConfig): ModuleWithProviders<TransportsModule> {
    return {
      ngModule: TransportsModule,
      providers: createTransportProviders(options),
    };
  }
}
