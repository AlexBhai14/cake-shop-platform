import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Birthday Cakes', slug: 'birthday-cakes', description: 'Cakes for birthday celebrations' },
  { name: 'Wedding Cakes', slug: 'wedding-cakes', description: 'Multi-tier cakes for weddings' },
  { name: 'Cupcakes', slug: 'cupcakes', description: 'Small individual cakes' },
];

const cakes = [
  { name: 'Chocolate Truffle', slug: 'chocolate-truffle', category: 'birthday-cakes',
    description: 'Rich dark chocolate sponge layered with truffle ganache.',
    variants: [
      { flavour: 'Chocolate', weightGrams: 500, eggless: false, price: '549.00' },
      { flavour: 'Chocolate', weightGrams: 500, eggless: true, price: '599.00' },
      { flavour: 'Chocolate', weightGrams: 1000, eggless: false, price: '999.00' },
    ] },
  { name: 'Black Forest', slug: 'black-forest', category: 'birthday-cakes',
    description: 'Chocolate sponge, whipped cream and cherries.',
    variants: [
      { flavour: 'Chocolate Cherry', weightGrams: 500, eggless: false, price: '499.00' },
      { flavour: 'Chocolate Cherry', weightGrams: 1000, eggless: false, price: '899.00' },
    ] },
  { name: 'Red Velvet', slug: 'red-velvet', category: 'birthday-cakes',
    description: 'Velvety red sponge with cream cheese frosting.',
    variants: [
      { flavour: 'Red Velvet', weightGrams: 500, eggless: false, price: '699.00' },
      { flavour: 'Red Velvet', weightGrams: 500, eggless: true, price: '749.00' },
    ] },
  { name: 'Pineapple Delight', slug: 'pineapple-delight', category: 'birthday-cakes',
    description: 'Light vanilla sponge with fresh pineapple and cream.',
    variants: [
      { flavour: 'Pineapple', weightGrams: 500, eggless: true, price: '449.00' },
      { flavour: 'Pineapple', weightGrams: 1000, eggless: true, price: '799.00' },
    ] },
];

async function main() {
  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
    catIds[c.slug] = row.id;
  }
  for (const cake of cakes) {
    const exists = await prisma.cake.findUnique({ where: { slug: cake.slug } });
    if (exists) continue;
    await prisma.cake.create({
      data: {
        name: cake.name,
        slug: cake.slug,
        description: cake.description,
        categoryId: catIds[cake.category],
        variants: { create: cake.variants },
      },
    });
  }
  console.log('Product seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
