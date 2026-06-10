-- Add question type support while keeping existing questions as single choice.
ALTER TABLE "questions" ADD COLUMN "questionType" TEXT NOT NULL DEFAULT 'single_choice';

-- Fill-in-the-blank questions do not need option fields.
ALTER TABLE "questions" ALTER COLUMN "optionA" DROP NOT NULL;
ALTER TABLE "questions" ALTER COLUMN "optionB" DROP NOT NULL;
ALTER TABLE "questions" ALTER COLUMN "optionC" DROP NOT NULL;
ALTER TABLE "questions" ALTER COLUMN "optionD" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "questions_questionType_idx" ON "questions"("questionType");
