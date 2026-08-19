import { ClockService } from './clock.service';

describe('ClockService', () => {
  it('now() отдаёт текущее время (±1с)', () => {
    const s = new ClockService();
    expect(Math.abs(s.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
