import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('без сессии показывает форму входа', () => {
    render(<App />);
    expect(screen.getByText('SmartQoldau Admin')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });
});
