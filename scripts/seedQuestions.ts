import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const subject = await prisma.subject.upsert({
    where: {
      code: "history",
    },
    update: {
      name: "历史",
    },
    create: {
      name: "历史",
      code: "history",
    },
  });

  const existingChapter = await prisma.chapter.findFirst({
    where: {
      subjectId: subject.id,
      code: "pre-qin",
    },
  });

  const chapter = existingChapter
    ? await prisma.chapter.update({
        where: {
          id: existingChapter.id,
        },
        data: {
          title: "先秦时期",
          orderIndex: 1,
        },
      })
    : await prisma.chapter.create({
        data: {
          subjectId: subject.id,
          title: "先秦时期",
          code: "pre-qin",
          orderIndex: 1,
        },
      });

  await prisma.question.upsert({
    where: {
      questionCode: "history-001",
    },
    update: {
      subjectId: subject.id,
      chapterId: chapter.id,
    },
    create: {
      subjectId: subject.id,
      chapterId: chapter.id,
      questionCode: "history-001",
      stem: "商鞅变法发生在战国时期的哪个国家？",
      optionA: "秦国",
      optionB: "楚国",
      optionC: "齐国",
      optionD: "赵国",
      correctAnswer: "A",
      explanation: "商鞅变法发生在秦国，是秦国走向强盛的重要改革。",
      difficulty: "easy",
      tags: ["先秦", "战国", "商鞅变法"],
    },
  });

  await prisma.question.upsert({
    where: {
      questionCode: "history-002",
    },
    update: {
      subjectId: subject.id,
      chapterId: chapter.id,
    },
    create: {
      subjectId: subject.id,
      chapterId: chapter.id,
      questionCode: "history-002",
      stem: "下列哪一项制度与西周政治结构关系最密切？",
      optionA: "郡县制",
      optionB: "分封制",
      optionC: "科举制",
      optionD: "行省制",
      correctAnswer: "B",
      explanation: "西周通过分封制建立和维系统治秩序。",
      difficulty: "easy",
      tags: ["先秦", "西周", "分封制"],
    },
  });

  console.log("Question seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
