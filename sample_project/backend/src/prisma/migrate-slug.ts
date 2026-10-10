/**
 * Migration script: Populate slug field for existing Urban and Building records.
 * Run this after adding slug columns as optional, then make them required.
 * 
 * Usage: npx ts-node -r tsconfig-paths/register src/prisma/migrate-slug.ts
 */
const { PrismaClient } = require('@prisma/client');

function generateSlug(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('🔄 Migrating Urban slugs...');
    const urbans = await prisma.urban.findMany();
    const urbanSlugs = new Set();
    
    for (const urban of urbans) {
      if (urban.slug) continue; // Already has slug
      
      let slug = generateSlug(urban.name);
      let counter = 1;
      while (urbanSlugs.has(slug)) {
        slug = `${generateSlug(urban.name)}-${counter}`;
        counter++;
      }
      urbanSlugs.add(slug);

      await prisma.urban.update({
        where: { id: urban.id },
        data: { slug },
      });
      console.log(`  ✅ Urban "${urban.name}" → slug: "${slug}"`);
    }

    console.log('\n🔄 Migrating Building slugs...');
    const buildings = await prisma.building.findMany();
    // Track slugs per urbanId to ensure uniqueness within the same urban
    const buildingSlugsPerUrban = {};

    for (const building of buildings) {
      if (building.slug) continue;

      if (!buildingSlugsPerUrban[building.urbanId]) {
        buildingSlugsPerUrban[building.urbanId] = new Set();
      }

      let slug = generateSlug(building.name);
      let counter = 1;
      while (buildingSlugsPerUrban[building.urbanId].has(slug)) {
        slug = `${generateSlug(building.name)}-${counter}`;
        counter++;
      }
      buildingSlugsPerUrban[building.urbanId].add(slug);

      await prisma.building.update({
        where: { id: building.id },
        data: { slug },
      });
      console.log(`  ✅ Building "${building.name}" → slug: "${slug}"`);
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
