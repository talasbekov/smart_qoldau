import { render, screen, fireEvent } from '@testing-library/react';
import FaqAccordion from './FaqAccordion';

const faqs = [
  { question: 'Вопрос 1', answer: 'Ответ 1' },
  { question: 'Вопрос 2', answer: 'Ответ 2' },
];

describe('FaqAccordion', () => {
  it('изначально все ответы скрыты', () => {
    render(<FaqAccordion faqs={faqs} />);
    expect(screen.queryByText('Ответ 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Ответ 2')).not.toBeInTheDocument();
  });

  it('клик по вопросу открывает его ответ', () => {
    render(<FaqAccordion faqs={faqs} />);
    fireEvent.click(screen.getByText('Вопрос 1'));
    expect(screen.getByText('Ответ 1')).toBeInTheDocument();
  });

  it('открытие второго вопроса закрывает первый', () => {
    render(<FaqAccordion faqs={faqs} />);
    fireEvent.click(screen.getByText('Вопрос 1'));
    fireEvent.click(screen.getByText('Вопрос 2'));
    expect(screen.queryByText('Ответ 1')).not.toBeInTheDocument();
    expect(screen.getByText('Ответ 2')).toBeInTheDocument();
  });

  it('повторный клик по открытому вопросу закрывает его', () => {
    render(<FaqAccordion faqs={faqs} />);
    fireEvent.click(screen.getByText('Вопрос 1'));
    fireEvent.click(screen.getByText('Вопрос 1'));
    expect(screen.queryByText('Ответ 1')).not.toBeInTheDocument();
  });
});
