import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RateCard } from './rate-card';
import { DataGrid } from './data-grid/data-grid';

@NgModule({
  imports: [CommonModule, RateCard, DataGrid],
  exports: [RateCard, DataGrid, CommonModule],
})
export class UiComponentsModule {}
