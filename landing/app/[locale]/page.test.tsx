import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage (scaffold)', () => {
  it('рендерится без ошибок', () => {
    render(<HomePage />);
    expect(screen.getByText('SmartQoldau')).toBeInTheDocument();
  });
});
