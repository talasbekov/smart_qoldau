import { categoriesForAuthor } from './support';

describe('support contract helpers', () => {
  it('does not expose expert-only categories to clients', () => {
    expect(categoriesForAuthor('client')).toEqual([
      'CONSULTATIONS',
      'PAYMENT',
      'TECHNICAL',
      'ACCOUNT_DATA',
      'SECURITY',
      'OTHER',
    ]);
  });

  it('offers the exact backend category set to experts', () => {
    expect(categoriesForAuthor('expert')).toEqual([
      'CONSULTATIONS',
      'PAYMENT',
      'PAYOUTS',
      'TECHNICAL',
      'VERIFICATION',
      'SECURITY',
      'CLIENT_QUESTION',
    ]);
  });
});
