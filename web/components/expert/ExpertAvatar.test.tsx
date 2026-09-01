import { render, screen } from '@testing-library/react';
import ExpertAvatar from './ExpertAvatar';

describe('ExpertAvatar', () => {
  it('показывает фото специалиста, когда оно есть', () => {
    render(<ExpertAvatar photoUrl="https://cdn.example/a.webp" size={56} />);

    const img = screen.getByRole('presentation');
    expect(img).toHaveAttribute('src', 'https://cdn.example/a.webp');
  });

  it('задаёт размеры явно: иначе страница дёргается при загрузке', () => {
    render(<ExpertAvatar photoUrl="https://cdn.example/a.webp" size={56} />);

    const img = screen.getByRole('presentation');
    expect(img).toHaveAttribute('width', '56');
    expect(img).toHaveAttribute('height', '56');
  });

  it('грузит лениво: в каталоге таких карточек дюжина', () => {
    render(<ExpertAvatar photoUrl="https://cdn.example/a.webp" size={56} />);

    expect(screen.getByRole('presentation')).toHaveAttribute('loading', 'lazy');
  });

  it('без фото показывает заглушку, а не битую картинку', () => {
    const { container } = render(<ExpertAvatar photoUrl={null} size={56} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('фото декоративно: имя стоит рядом и читается скринридером отдельно', () => {
    render(<ExpertAvatar photoUrl="https://cdn.example/a.webp" size={56} />);

    // Пустой alt, а не «фото психолога» — иначе имя прозвучит дважды.
    expect(screen.getByRole('presentation')).toHaveAttribute('alt', '');
  });
});
