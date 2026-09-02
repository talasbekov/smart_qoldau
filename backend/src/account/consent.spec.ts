import { needsExpertVisibilityConsent, MAX_DISPLAY_NAME } from './consent';

describe('согласие на видимость психологу (Р-27)', () => {
  it('нужно, пока человек не согласился', () => {
    expect(needsExpertVisibilityConsent({ expertVisibilityAcceptedAt: null })).toBe(true);
  });

  it('не нужно после согласия', () => {
    expect(
      needsExpertVisibilityConsent({ expertVisibilityAcceptedAt: new Date('2026-09-02') }),
    ).toBe(false);
  });

  it('спрашивается один раз: повторная заявка согласия не требует', () => {
    const accepted = { expertVisibilityAcceptedAt: new Date('2026-01-01') };

    expect(needsExpertVisibilityConsent(accepted)).toBe(false);
    expect(needsExpertVisibilityConsent(accepted)).toBe(false);
  });

  it('длина имени ограничена: это подпись, а не сочинение', () => {
    expect(MAX_DISPLAY_NAME).toBeLessThanOrEqual(64);
  });
});
