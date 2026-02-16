import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RateCard } from './rate-card';

describe('RateCard', () => {
  let component: RateCard;
  let fixture: ComponentFixture<RateCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RateCard],
    }).compileComponents();

    fixture = TestBed.createComponent(RateCard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should have default empty symbol', () => {
    expect(component.symbol).toBe('');
  });

  it('should have default rate of 0', () => {
    expect(component.rate).toBe(0);
  });

  it('should have default change of 0', () => {
    expect(component.change).toBe(0);
  });

  it('should accept symbol input', () => {
    component.symbol = 'US10Y';
    fixture.detectChanges();
    expect(component.symbol).toBe('US10Y');
  });

  it('should accept rate input', () => {
    component.rate = 4.25;
    fixture.detectChanges();
    expect(component.rate).toBe(4.25);
  });

  it('should accept change input', () => {
    component.change = 0.05;
    fixture.detectChanges();
    expect(component.change).toBe(0.05);
  });

  it('should accept negative change', () => {
    component.change = -0.03;
    fixture.detectChanges();
    expect(component.change).toBe(-0.03);
  });
});
