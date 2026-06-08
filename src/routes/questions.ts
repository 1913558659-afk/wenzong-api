import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

const questionInclude = {
  subject: true,
  chapter: true,
};

function parsePage(value: unknown) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseLimit(value: unknown) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) return 20;
  return Math.min(limit, 100);
}

function getQuestionData(body: any) {
  return {
    subjectId: body.subjectId,
    chapterId: body.chapterId ?? null,
    questionCode: body.questionCode,
    stem: body.stem,
    optionA: body.optionA,
    optionB: body.optionB,
    optionC: body.optionC,
    optionD: body.optionD,
    correctAnswer: body.correctAnswer,
    explanation: body.explanation ?? null,
    difficulty: body.difficulty ?? null,
    tags: body.tags ?? Prisma.JsonNull,
    isActive: body.isActive ?? true,
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

router.post("/admin/questions", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const data = getQuestionData(req.body);

    if (
      !data.subjectId ||
      !data.questionCode ||
      !data.stem ||
      !data.optionA ||
      !data.optionB ||
      !data.optionC ||
      !data.optionD ||
      !data.correctAnswer
    ) {
      return res.status(400).json({
        message: "缺少必要的题目参数",
      });
    }

    const question = await prisma.question.create({
      data,
      include: questionInclude,
    });

    return res.status(201).json({
      message: "题目已创建",
      question,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "创建题目失败",
    });
  }
});

router.put("/admin/questions/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing =
      (await prisma.question.findUnique({ where: { id } })) ||
      (await prisma.question.findUnique({ where: { questionCode: id } }));

    if (!existing) {
      return res.status(404).json({
        message: "题目不存在",
      });
    }

    const question = await prisma.question.update({
      where: {
        id: existing.id,
      },
      data: getQuestionData({
        ...existing,
        ...req.body,
      }),
      include: questionInclude,
    });

    return res.json({
      message: "题目已更新",
      question,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "更新题目失败",
    });
  }
});

router.delete("/admin/questions/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing =
      (await prisma.question.findUnique({ where: { id } })) ||
      (await prisma.question.findUnique({ where: { questionCode: id } }));

    if (!existing) {
      return res.status(404).json({
        message: "题目不存在",
      });
    }

    const question = await prisma.question.update({
      where: {
        id: existing.id,
      },
      data: {
        isActive: false,
      },
      include: questionInclude,
    });

    return res.json({
      message: "题目已删除",
      question,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "删除题目失败",
    });
  }
});

export default router;
