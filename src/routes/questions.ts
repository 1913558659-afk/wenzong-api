import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import {
  parseQuestionImportText,
  QuestionImportFormat,
  ParsedImportQuestion,
} from "../utils/questionImportParser";

const router = Router();

const questionInclude = {
  subject: true,
  chapter: true,
};

const requiredQuestionFields = [
  "questionCode",
  "subjectCode",
  "subjectName",
  "chapterCode",
  "chapterTitle",
  "stem",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
];

function parsePage(value: unknown) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseLimit(value: unknown) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) return 20;
  return Math.min(limit, 100);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getMissingFields(body: any) {
  return requiredQuestionFields.filter((field) => {
    const value = body[field];
    return typeof value !== "string" || !value.trim();
  });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeTags(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null || value === "") {
    return Prisma.JsonNull;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return Prisma.JsonNull;

    try {
      return JSON.parse(trimmed) as Prisma.InputJsonValue;
    } catch {
      return trimmed.includes(",")
        ? trimmed.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [trimmed];
    }
  }

  return value as Prisma.InputJsonValue;
}

async function findQuestionByIdOrCode(id: string) {
  return (
    (await prisma.question.findUnique({
      where: { id },
      include: questionInclude,
    })) ||
    (await prisma.question.findUnique({
      where: { questionCode: id },
      include: questionInclude,
    }))
  );
}

async function upsertSubjectAndChapter(body: any, fallback?: {
  subject: { code: string; name: string };
  chapter: { code: string | null; title: string } | null;
}) {
  const subjectCode = String(
    normalizeText(body.subjectCode ?? fallback?.subject.code)
  );
  const subjectName = String(
    normalizeText(body.subjectName ?? fallback?.subject.name)
  );
  const chapterCode = String(
    normalizeText(body.chapterCode ?? fallback?.chapter?.code)
  );
  const chapterTitle = String(
    normalizeText(body.chapterTitle ?? fallback?.chapter?.title)
  );

  const subject = await prisma.subject.upsert({
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

  const existingChapter = await prisma.chapter.findFirst({
    where: {
      subjectId: subject.id,
      code: chapterCode,
    },
  });

  const chapter = existingChapter
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

  return {
    subject,
    chapter,
  };
}

async function saveImportedQuestion(item: ParsedImportQuestion) {
  const { subject, chapter } = await upsertSubjectAndChapter(item);

  return prisma.question.upsert({
    where: {
      questionCode: item.questionCode,
    },
    update: {
      subjectId: subject.id,
      chapterId: chapter.id,
      stem: item.stem,
      optionA: item.optionA,
      optionB: item.optionB,
      optionC: item.optionC,
      optionD: item.optionD,
      correctAnswer: item.correctAnswer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      tags: item.tags,
      isActive: true,
    },
    create: {
      questionCode: item.questionCode,
      subjectId: subject.id,
      chapterId: chapter.id,
      stem: item.stem,
      optionA: item.optionA,
      optionB: item.optionB,
      optionC: item.optionC,
      optionD: item.optionD,
      correctAnswer: item.correctAnswer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      tags: item.tags,
    },
  });
}

function getImportPayload(body: any) {
  return {
    format: (body.format || "auto") as QuestionImportFormat,
    text: typeof body.text === "string" ? body.text : "",
  };
}

router.get("/questions", async (req, res) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const where: Prisma.QuestionWhereInput = {
      isActive: true,
    };

    if (typeof req.query.subject === "string" && req.query.subject) {
      where.subject = {
        code: req.query.subject,
      };
    }

    if (typeof req.query.chapter === "string" && req.query.chapter) {
      where.chapter = {
        code: req.query.chapter,
      };
    }

    if (typeof req.query.difficulty === "string" && req.query.difficulty) {
      where.difficulty = req.query.difficulty;
    }

    const [questions, total] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        include: questionInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    return res.json({
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "获取题目列表失败",
    });
  }
});

router.get("/questions/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    const question =
      (await prisma.question.findUnique({
        where: { id },
        include: questionInclude,
      })) ||
      (await prisma.question.findUnique({
        where: { questionCode: id },
        include: questionInclude,
      }));

    if (!question || !question.isActive) {
      return res.status(404).json({
        message: "题目不存在",
      });
    }

    return res.json({
      question,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "获取题目详情失败",
    });
  }
});

router.get("/subjects", async (_req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        chapters: {
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.json({
      subjects,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "获取学科列表失败",
    });
  }
});

router.post(
  "/admin/questions/import/preview",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { format, text } = getImportPayload(req.body);
      const result = parseQuestionImportText(text, format);

      return res.json({
        message: "解析完成",
        ...result,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "服务器错误",
        error: getErrorMessage(error),
      });
    }
  }
);

router.post(
  "/admin/questions/import/confirm",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { format, text } = getImportPayload(req.body);
      const result = parseQuestionImportText(text, format);
      const errors = [...result.errors];
      let importedCount = 0;

      for (const [index, question] of result.questions.entries()) {
        try {
          await saveImportedQuestion(question);
          importedCount += 1;
        } catch (error) {
          console.error(error);
          errors.push({
            index,
            message: getErrorMessage(error),
          });
        }
      }

      return res.json({
        message: "批量导入完成",
        total: result.total,
        importedCount,
        failedCount: result.total - importedCount,
        errors,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "服务器错误",
        error: getErrorMessage(error),
      });
    }
  }
);

router.post("/admin/questions", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const missingFields = getMissingFields(req.body);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "字段缺失",
        missingFields,
      });
    }

    const { subject, chapter } = await upsertSubjectAndChapter(req.body);
    const existingQuestion = await prisma.question.findUnique({
      where: {
        questionCode: String(normalizeText(req.body.questionCode)),
      },
    });

    const question = await prisma.question.upsert({
      where: {
        questionCode: String(normalizeText(req.body.questionCode)),
      },
      update: {
        subjectId: subject.id,
        chapterId: chapter.id,
        stem: String(normalizeText(req.body.stem)),
        optionA: String(normalizeText(req.body.optionA)),
        optionB: String(normalizeText(req.body.optionB)),
        optionC: String(normalizeText(req.body.optionC)),
        optionD: String(normalizeText(req.body.optionD)),
        correctAnswer: String(normalizeText(req.body.correctAnswer)),
        explanation: req.body.explanation ?? null,
        difficulty: req.body.difficulty ?? null,
        tags: normalizeTags(req.body.tags),
        isActive: req.body.isActive ?? true,
      },
      create: {
        questionCode: String(normalizeText(req.body.questionCode)),
        subjectId: subject.id,
        chapterId: chapter.id,
        stem: String(normalizeText(req.body.stem)),
        optionA: String(normalizeText(req.body.optionA)),
        optionB: String(normalizeText(req.body.optionB)),
        optionC: String(normalizeText(req.body.optionC)),
        optionD: String(normalizeText(req.body.optionD)),
        correctAnswer: String(normalizeText(req.body.correctAnswer)),
        explanation: req.body.explanation ?? null,
        difficulty: req.body.difficulty ?? null,
        tags: normalizeTags(req.body.tags),
      },
      include: questionInclude,
    });

    return res.status(existingQuestion ? 200 : 201).json({
      message: "题目保存成功",
      question,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "服务器错误",
      error: getErrorMessage(error),
    });
  }
});

router.put("/admin/questions/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await findQuestionByIdOrCode(id);

    if (!existing) {
      return res.status(404).json({
        message: "题目不存在",
      });
    }

    const subjectCode = normalizeText(req.body.subjectCode ?? existing.subject.code);
    const subjectName = normalizeText(req.body.subjectName ?? existing.subject.name);
    const chapterCode = normalizeText(req.body.chapterCode ?? existing.chapter?.code);
    const chapterTitle = normalizeText(req.body.chapterTitle ?? existing.chapter?.title);

    const missingFields = [];
    if (typeof subjectCode !== "string" || !subjectCode) {
      missingFields.push("subjectCode");
    }
    if (typeof subjectName !== "string" || !subjectName) {
      missingFields.push("subjectName");
    }
    if (typeof chapterCode !== "string" || !chapterCode) {
      missingFields.push("chapterCode");
    }
    if (typeof chapterTitle !== "string" || !chapterTitle) {
      missingFields.push("chapterTitle");
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "字段缺失",
        missingFields,
      });
    }

    const { subject, chapter } = await upsertSubjectAndChapter(
      {
        subjectCode,
        subjectName,
        chapterCode,
        chapterTitle,
      },
      {
        subject: existing.subject,
        chapter: existing.chapter,
      }
    );

    const question = await prisma.question.update({
      where: {
        id: existing.id,
      },
      data: {
        subjectId: subject.id,
        chapterId: chapter.id,
        questionCode:
          req.body.questionCode === undefined
            ? existing.questionCode
            : String(normalizeText(req.body.questionCode)),
        stem:
          req.body.stem === undefined
            ? existing.stem
            : String(normalizeText(req.body.stem)),
        optionA:
          req.body.optionA === undefined
            ? existing.optionA
            : String(normalizeText(req.body.optionA)),
        optionB:
          req.body.optionB === undefined
            ? existing.optionB
            : String(normalizeText(req.body.optionB)),
        optionC:
          req.body.optionC === undefined
            ? existing.optionC
            : String(normalizeText(req.body.optionC)),
        optionD:
          req.body.optionD === undefined
            ? existing.optionD
            : String(normalizeText(req.body.optionD)),
        correctAnswer:
          req.body.correctAnswer === undefined
            ? existing.correctAnswer
            : String(normalizeText(req.body.correctAnswer)),
        explanation:
          req.body.explanation === undefined
            ? existing.explanation
            : req.body.explanation,
        difficulty:
          req.body.difficulty === undefined ? existing.difficulty : req.body.difficulty,
        tags:
          req.body.tags === undefined
            ? existing.tags ?? Prisma.JsonNull
            : normalizeTags(req.body.tags),
        isActive: req.body.isActive ?? existing.isActive,
      },
      include: questionInclude,
    });

    return res.json({
      message: "题目更新成功",
      question,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "服务器错误",
      error: getErrorMessage(error),
    });
  }
});

router.delete("/admin/questions/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await findQuestionByIdOrCode(id);

    if (!existing) {
      return res.status(404).json({
        message: "题目不存在",
      });
    }

    await prisma.question.update({
      where: {
        id: existing.id,
      },
      data: {
        isActive: false,
      },
    });

    return res.json({
      message: "题目已删除",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "服务器错误",
      error: getErrorMessage(error),
    });
  }
});

export default router;
