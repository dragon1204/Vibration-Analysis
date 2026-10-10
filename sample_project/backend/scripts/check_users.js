const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findFirst().then(u => {
  console.log('email:', u.email);
  console.log('password hash:', u.password);
  console.log('fullName:', u.fullName);
}).finally(() => p.$disconnect());
