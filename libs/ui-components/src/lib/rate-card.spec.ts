import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RateCard } from './rate-card';

describe('RateCard', () => {
  let component: RateCard;
  let fixture: ComponentFixture<RateCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RateCard],
    }).compileComponents();

    fixture = TestBed.createComponent(RateCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
