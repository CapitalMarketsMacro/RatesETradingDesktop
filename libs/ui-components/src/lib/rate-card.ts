import { Component, Input } from '@angular/core';

@Component({
  selector: 'lib-rate-card',
  standalone: false,
  templateUrl: './rate-card.html',
  styleUrl: './rate-card.css',
})
export class RateCard {
  @Input() symbol = '';
  @Input() rate = 0;
  @Input() change = 0;
}
