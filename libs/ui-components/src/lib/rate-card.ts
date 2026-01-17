import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-rate-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rate-card.html',
  styleUrl: './rate-card.css',
})
export class RateCard {
  @Input() symbol = '';
  @Input() rate = 0;
  @Input() change = 0;
}
