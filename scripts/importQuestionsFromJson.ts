import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type ExportedQuestion = {
  questionCode: string;
  subjectCode: string;
  subjectName: string;
  chapterCode: string;
  chapterTitle: string;
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation?: string | null;
  difficulty?: string | null;
  tags?: Prisma.InputJsonValue | null;
};

function assertQuestionArray(value: unknown): asserts value is ExportedQuestion[] {
  if (!Array.isArray(value)) {
    throw new Error("questions-export.json must contain an array");
  }
}

function requireText(value: unknown, field: string, questionIndex: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Question #${questionIndex + 1} is missing ${field}`);
  }

  return value.trim();
}

async function main() {
  const filePath = path.join(process.cwd(), "data", "questions-export.json");
  const raw = await readFile(filePath, "utf8");
  const questions = JSON.parse(raw) as unknown;

  assertQuestionArray(questions);

  console.log(`读取到 ${questions.length} 道题`);

  const subjects = new Map<string, { id: string; code: string }>();
  const chapters = new Map<string, { id: string; code: string }>();
  let subjectCount = 0;
  let chapterCount = 0;
  let questionCount = 0;

  for (const [index, item] of questions.entries()) {
    const questionCode = requireText(item.questionCode, "questionCode", index);
    const subjectCode = requireText(item.subjectCode, "subjectCode", index);
    const subjectName = requireText(item.subjectName, "subjectName", index);
    const chapterCode = requireText(item.chapterCode, "chapterCode", index);
    const chapterTitle = requireText(item.chapterTitle, "chapterTitle", index);

    let subject = subjects.get(subjectCode);

    if (!subject) {
      const savedSubject = await prisma.subject.upsert({
        where: {
          code: subjectCode,
        },
        update: {
          name: subjectName,
        },
        create: {
          code: subjectCode,
          name: subjectName,
        },
      });

      subject = {
        id: savedSubject.id,
        code: savedSubject.code,
      };
      subjects.set(subjectCode, subject);
      subjectCount += 1;
    }

    const chapterKey = `${subjectCode}:${chapterCode}`;
    let chapter = chapters.get(chapterKey);

    if (!chapter) {
      const existingChapter = await prisma.chapter.findFirst({
        where: {
          subjectId: subject.id,
          code: chapterCode,
        },
      });

      const savedChapter = existingChapter
        ? await prisma.chapter.update({
            where: {
              id: existingChapter.id,
            },
            data: {
              title: chapterTitle,
            },
          })
        : await prisma.chapter.create({
            data: {
              subjectId: subject.id,
              code: chapterCode,
              title: chapterTitle,
            },
          });

      chapter = {
        id: savedChapter.id,
        code: savedChapter.code || "",
      };
      chapters.set(chapterKey, chapter);
      chapterCount += 1;
    }

    await prisma.question.upsert({
      where: {
        questionCode,
      },
      update: {
        subjectId: subject.id,
        chapterId: chapter.id,
        stem: requireText(item.stem, "stem", index),
        optionA: requireText(item.optionA, "optionA", index),
        optionB: requireText(item.optionB, "optionB", index),
        optionC: requireText(item.optionC, "optionC", index),
        optionD: requireText(item.optionD, "optionD", index),
        correctAnswer: requireText(item.correctAnswer, "correctAnswer", index),
        explanation: item.explanation ?? null,
        difficulty: item.difficulty ?? null,
        tags: item.tags ?? Prisma.JsonNull,
        isActive: true,
      },
      create: {
        questionCode,
        subjectId: subject.id,
        chapterId: chapter.id,
        stem: requireText(item.stem, "stem", index),
        optionA: requireText(item.optionA, "optionA", index),
        optionB: requireText(item.optionB, "optionB", index),
        optionC: requireText(item.optionC, "optionC", index),
        optionD: requireText(item.optionD, "optionD", index),
        correctAnswer: requireText(item.correctAnswer, "correctAnswer", index),
        explanation: item.explanation ?? null,
        difficulty: item.difficulty ?? null,
        tags: item.tags ?? Prisma.JsonNull,
      },
    });

    questionCount += 1;
  }

  console.log(`创建或更新了 ${subjectCount} 个学科`);
  console.log(`创建或更新了 ${chapterCount} 个章节`);
  console.log(`创建或更新了 ${questionCount} 道题`);
  console.log("题库 JSON 导入完成");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
