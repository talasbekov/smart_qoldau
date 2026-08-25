import { render, screen } from '@testing-library/react';
import App from './App';

describe('App (scaffold)', () => {
  it('рендерится без ошибок', () => {
    render(<App />);
    expect(screen.getByText('SmartQoldau Admin')).toBeInTheDocument();
  });
});
