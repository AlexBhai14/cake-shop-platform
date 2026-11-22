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

  it('shows the crossed-out price and the discount badge when the cake has a discount', () => {
    const discounted: Cake = {
      ...cake,
      discountPercent: 30,
      variants: [{ id: 'v1', cakeId: 'c1', flavour: 'Pineapple', weightGrams: 500, eggless: true, price: '70.00', mrp: '100.00', isActive: true }],
    };
    render(<MemoryRouter><CakeCard cake={discounted} /></MemoryRouter>);
    expect(screen.getByLabelText('Original price')).toHaveTextContent('100.00');
    expect(screen.getByText(/70\.00/)).toBeInTheDocument();
    expect(screen.getByText('30% OFF')).toBeInTheDocument();
  });

  it('shows no discount badge for a cake without a discount', () => {
    render(<MemoryRouter><CakeCard cake={cake} /></MemoryRouter>);
    expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Original price')).not.toBeInTheDocument();
  });
});
