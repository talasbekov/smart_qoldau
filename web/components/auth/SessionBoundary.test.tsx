import { render } from '@testing-library/react';
import SessionBoundary from './SessionBoundary';
import { reloadSessionDocument } from '@/lib/auth/session-navigation';
jest.mock('@/lib/auth/session-navigation', () => ({ reloadSessionDocument: jest.fn() }));
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });
it('invalidates the old document when another tab changes session', () => {
  render(<SessionBoundary />);
  localStorage.setItem('sq:auth:epoch:v1', 'other-account');
  window.dispatchEvent(new StorageEvent('storage', { key: 'sq:auth:epoch:v1' }));
  expect(reloadSessionDocument).toHaveBeenCalledTimes(1);
});
it('checks restored bfcache documents even when no storage event was observed', () => {
  render(<SessionBoundary />);
  localStorage.setItem('sq:auth:epoch:v1', 'other-account');
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(reloadSessionDocument).toHaveBeenCalledTimes(1);
});
it('keeps the document when the session epoch has not changed', () => {
  render(<SessionBoundary />);
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(reloadSessionDocument).not.toHaveBeenCalled();
});
