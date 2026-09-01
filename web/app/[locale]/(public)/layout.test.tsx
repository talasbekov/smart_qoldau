import { render, screen } from '@testing-library/react';

// Header и Footer — асинхронные серверные компоненты с собственными
// тестами (Header.test.tsx). Здесь проверяется раскладка: что ориентиры
// на месте и что до содержимого можно дойти в обход навигации.
jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: () => <header>шапка</header>,
}));
jest.mock('@/components/Footer', () => ({
  __esModule: true,
  default: () => <footer>подвал</footer>,
}));

// eslint-disable-next-line import/first
import PublicLayout from './layout';

describe('PublicLayout', () => {
  it('оборачивает содержимое шапкой и подвалом', () => {
    render(<PublicLayout>{<p>содержимое</p>}</PublicLayout>);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('содержимое')).toBeInTheDocument();
  });

  it('первой в порядке обхода идёт ссылка к основному содержимому', () => {
    render(<PublicLayout>{<p>содержимое</p>}</PublicLayout>);

    const skip = screen.getByRole('link', { name: /основному содержимому/i });
    expect(skip).toHaveAttribute('href', '#main');
    // Ссылка стоит ДО шапки: иначе к содержимому пришлось бы идти
    // через всю навигацию, а смысл ссылки именно в том, чтобы её обойти.
    expect(skip.compareDocumentPosition(screen.getByRole('banner'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('содержимое лежит в элементе, на который указывает ссылка', () => {
    render(<PublicLayout>{<p>содержимое</p>}</PublicLayout>);

    const main = document.getElementById('main');
    expect(main).not.toBeNull();
    expect(main).toContainElement(screen.getByText('содержимое'));
  });
});
