import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ConfigurationService } from './configuration.service';

@NgModule({
  imports: [CommonModule, HttpClientModule],
  providers: [ConfigurationService],
})
export class ConfigurationModule {}
