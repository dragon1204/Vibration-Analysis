const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const floors = await prisma.floor.findMany();
  let count = 0;
  for (const f of floors) {
    if (f.name.startsWith('tang_')) {
      const newName = f.name.replace('tang_', 'floor_');
      await prisma.floor.update({
        where: { id: f.id },
        data: { name: newName }
      });
      console.log(`Renamed: ${f.name} -> ${newName}`);
      count++;
    }
  }
  console.log(`Successfully renamed ${count} floors.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
