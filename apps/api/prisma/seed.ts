import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 10) throw new Error('Set DEMO_PASSWORD to at least 10 characters before seeding');
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const jashim = await db.user.upsert({
    where: { phoneNumber: '+8801711000000' }, update: {},
    create: { phoneNumber: '+8801711000000', fullName: 'Jashim', role: 'DRIVER', passwordHash },
  });
  await db.vehicle.upsert({
    where: { driverId: jashim.id }, update: {},
    create: { driverId: jashim.id, name: 'Bullet', licensePlate: 'DHA-TESLA-01', capacity: 3, driverStatus: 'ONLINE' },
  });
  for (const [phoneNumber, fullName] of [
    ['+8801711000001', 'Nusrat'], ['+8801711000002', 'Rafiq'],
    ['+8801711000003', 'Shirin'], ['+8801711000004', 'Ashik'],
  ]) {
    await db.user.upsert({ where: { phoneNumber }, update: {}, create: { phoneNumber, fullName, role: 'PASSENGER', passwordHash } });
  }
}

main().finally(() => db.$disconnect());
