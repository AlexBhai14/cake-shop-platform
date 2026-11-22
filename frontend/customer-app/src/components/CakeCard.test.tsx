import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Cake } from '../lib/types';
import { CakeCard } from './CakeCard';

const cake: Cake = {
  id: 'c1', name: 'Pineapple Delight', slug: 'pineapple-delight', description: 'Light vanilla sponge',
  imageUrl: null, isActive: true, categoryId: 'cat1',
  category: { id: 'cat1', name: 'Birthday Cakes', slug: 'birthday-cakes', description: null, isActive: true },
  variants: [
    { id: 'v1', cakeId: 'c1', flavour: 'Pineapple', weightGrams: 1000, eggless: true, price: '799.00', isActive: true },
    { id: 'v2', cakeId: 'c1', flavour: 'Pineapple', weightGrams: 500, eggless: true, price: '449.00', isActive: true },
  ],
};

describe('CakeCard', () => {
  it('shows the name, the category and the LOWEST price', () => {
    render(<MemoryRouter><CakeCard cake={cake} /></MemoryRouter>);
    expect(screen.getByText('Pineapple Delight')).toBeInTheDocument();
    expect(screen.getByText('Birthday Cakes')).toBeInTheDocument();
    expect(screen.getByText(/449\.00/)).toBeInTheDocument();
  });

  it('links to the detail page', () => {
    render(<MemoryRouter><CakeCard cake={cake} /></MemoryRouter>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/cakes/c1');
  });
});
