import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getYesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateKey(yesterday);
}

async function ensureUserStats(userId: string) {
  const existing = await prisma.userStats.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return prisma.userStats.create({
    data: {
      userId,
      xp: 0,
      streakDays: 0,
      answeredToday: 0,
      correctCount: 0,
      totalAnswered: 0,
    },
  });
}

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const authUser = (req as any).user;

    const stats = await ensureUserStats(authUser.id);

    const completedQuestions = await prisma.completedQuestion.findMany({
      where: {
        userId: authUser.id,
      },
      orderBy: {
        completedAt: "desc",
      },
    });

    const wrongQuestions = await prisma.wrongQuestion.findMany({
      where: {
        userId: authUser.id,
        isResolved: false,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.json({
      stats,
      completedQuestions,
      wrongQuestions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "获取学习进度失败",
    });
  }
});

router.post("/answer", authMiddleware, async (req, res) => {
  try {
    const authUser = (req as any).user;

    const {
      questionId,
      subject,
      chapter,
      selectedAnswer,
      correctAnswer,
    } = req.body;

    if (!questionId || !subject || !chapter || !selectedAnswer || !correctAnswer) {
      return res.status(400).json({
        message: "缺少必要的答题参数",
      });
    }

    const isCorrect = selectedAnswer === correctAnswer;
    const now = new Date();
    const todayKey = getDateKey(now);
    const yesterdayKey = getYesterdayKey();

    const result = await prisma.$transaction(async (tx) => {
      let stats = await tx.userStats.findUnique({
        where: {
          userId: authUser.id,
        },
      });

      if (!stats) {
        stats = await tx.userStats.create({
          data: {
            userId: authUser.id,
            xp: 0,
            streakDays: 0,
            answeredToday: 0,
            correctCount: 0,
            totalAnswered: 0,
          },
        });
      }

      const lastStudyKey = stats.lastStudyDate
        ? getDateKey(stats.lastStudyDate)
        : null;

      let nextStreakDays = stats.streakDays;

      if (lastStudyKey === todayKey) {
        nextStreakDays = stats.streakDays || 1;
      } else if (lastStudyKey === yesterdayKey) {
        nextStreakDays = stats.streakDays + 1;
      } else {
        nextStreakDays = 1;
      }

      const nextAnsweredToday =
        lastStudyKey === todayKey ? stats.answeredToday + 1 : 1;

      const xpGain = isCorrect ? 10 : 2;

      const answerAttempt = await tx.answerAttempt.create({
        data: {
          userId: authUser.id,
          questionId,
          subject,
          chapter,
          selectedAnswer,
          correctAnswer,
          isCorrect,
        },
      });

      await tx.completedQuestion.upsert({
        where: {
          userId_questionId: {
            userId: authUser.id,
            questionId,
          },
        },
        update: {
          subject,
          chapter,
          completedAt: now,
        },
        create: {
          userId: authUser.id,
          questionId,
          subject,
          chapter,
          completedAt: now,
        },
      });

      if (isCorrect) {
        await tx.wrongQuestion.updateMany({
          where: {
            userId: authUser.id,
            questionId,
          },
          data: {
            isResolved: true,
          },
        });
      } else {
        await tx.wrongQuestion.upsert({
          where: {
            userId_questionId: {
              userId: authUser.id,
              questionId,
            },
          },
          update: {
            selectedAnswer,
            correctAnswer,
            subject,
            chapter,
            wrongCount: {
              increment: 1,
            },
            isResolved: false,
          },
          create: {
            userId: authUser.id,
            questionId,
            subject,
            chapter,
            selectedAnswer,
            correctAnswer,
            wrongCount: 1,
            isResolved: false,
          },
        });
      }

      const updatedStats = await tx.userStats.update({
        where: {
          userId: authUser.id,
        },
        data: {
          xp: {
            increment: xpGain,
          },
          streakDays: nextStreakDays,
          answeredToday: nextAnsweredToday,
          correctCount: {
            increment: isCorrect ? 1 : 0,
          },
          totalAnswered: {
            increment: 1,
          },
          lastStudyDate: now,
        },
      });

      return {
        answerAttempt,
        stats: updatedStats,
        xpGain,
        isCorrect,
      };
    });

    return res.json({
      message: "答题记录已保存",
      ...result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "保存答题记录失败",
    });
  }
});

router.post("/wrong-questions/:questionId/resolve", authMiddleware, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const questionId = String(req.params.questionId);

    const wrongQuestion = await prisma.wrongQuestion.updateMany({
      where: {
        userId: authUser.id,
        questionId,
      },
      data: {
        isResolved: true,
      },
    });

    return res.json({
      message: "错题已标记为掌握",
      result: wrongQuestion,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "标记错题失败",
    });
  }
});

router.delete("/wrong-questions/:questionId", authMiddleware, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const questionId = String(req.params.questionId);

    await prisma.wrongQuestion.deleteMany({
      where: {
        userId: authUser.id,
        questionId,
      },
    });

    return res.json({
      message: "错题已删除",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "删除错题失败",
    });
  }
});

export default router;
