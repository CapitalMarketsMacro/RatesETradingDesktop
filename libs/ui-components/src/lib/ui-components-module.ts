import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RateCard } from './rate-card';

@NgModule({
  imports: [CommonModule],
  declarations: [RateCard],
  exports: [RateCard, CommonModule],
})
export class UiComponentsModule {}
