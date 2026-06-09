import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: {
      email: ADMIN_EMAIL,
    },
    update: {
      passwordHash,
      role: "admin",
      nickname: "管理员",
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      nickname: "管理员",
    },
  });

  await prisma.userStats.upsert({
    where: {
      userId: user.id,
    },
    update: {},
    create: {
      userId: user.id,
      xp: 0,
      streakDays: 0,
      answeredToday: 0,
      correctCount: 0,
      totalAnswered: 0,
    },
  });

  console.log("Admin user is ready");
  console.log(`email: ${ADMIN_EMAIL}`);
  console.log(`role: ${user.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
