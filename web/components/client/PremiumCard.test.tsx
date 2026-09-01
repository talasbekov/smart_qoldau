import { render, screen } from '@testing-library/react';
import PremiumCard from './PremiumCard';

describe('PremiumCard', () => {
  it('без подписки зовёт оформить и не выдумывает цену в вёрстке', () => {
    render(<PremiumCard status={{ active: false, plan: null, currentPeriodEnd: null, cancelled: false, inGrace: false }} locale="ru" />);

    expect(screen.getByRole('link', { name: /Подключить Premium/ })).toHaveAttribute(
      'href',
      '/ru/premium',
    );
    // Цена берётся с публичной страницы тарифов, а не зашивается сюда:
    // расхождение прототипа по цене ещё не закрыто, и зашитая цена
    // сделала бы его правку правкой кода.
    expect(screen.queryByText(/₸/)).toBeNull();
  });

  it('с активной подпиской говорит, до какой даты она действует', () => {
    render(
      <PremiumCard
        status={{ active: true, plan: 'MONTH', currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelled: false, inGrace: false }}
        locale="ru"
      />,
    );

    expect(screen.getByText(/до 1 октября/i)).toBeInTheDocument();
  });

  it('после отмены объясняет, что доступ остаётся до конца периода', () => {
    render(
      <PremiumCard
        status={{ active: true, plan: 'MONTH', currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelled: true, inGrace: false }}
        locale="ru"
      />,
    );

    // Р-09: отменённая подписка продолжает работать до конца оплаченного
    // периода. Не сказать об этом — значит получить обращение в поддержку.
    expect(screen.getByText(/отменена.*доступ.*до 1 октября/i)).toBeInTheDocument();
  });

  it('в льготном периоде предупреждает о неудачном списании', () => {
    render(
      <PremiumCard
        status={{ active: true, plan: 'MONTH', currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelled: false, inGrace: true }}
        locale="ru"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/не удалось списать|проверьте карту/i);
  });

  it('активная подписка не предлагает подключить её ещё раз', () => {
    render(
      <PremiumCard
        status={{ active: true, plan: 'YEAR', currentPeriodEnd: '2027-01-01T00:00:00.000Z', cancelled: false, inGrace: false }}
        locale="ru"
      />,
    );

    expect(screen.queryByRole('link', { name: /Подключить Premium/ })).toBeNull();
  });
});
