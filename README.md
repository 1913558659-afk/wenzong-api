# wenzong-api

Node.js + Express + TypeScript + Prisma + PostgreSQL backend for Wenzong.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your local `DATABASE_URL`, `JWT_SECRET`, and optional `FRONTEND_ORIGIN`.

3. Create the PostgreSQL database referenced by `DATABASE_URL`.

4. Run database migrations:

   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

## Production

Build and start the compiled server:

```bash
npm run build
npm run start
```

Run production migrations with:

```bash
npm run prisma:migrate
```

## Health Check

```http
GET /health
```

Returns a JSON response when the API is running.

## Question Bank API

Public endpoints:

```http
GET /api/questions
GET /api/questions/:id
GET /api/subjects
```

Admin endpoints require a JWT for a user with `role=admin`:

```http
POST /api/admin/questions
PUT /api/admin/questions/:id
DELETE /api/admin/questions/:id
```

Bulk import endpoints also require an admin JWT:

```http
POST /api/admin/questions/import/preview
POST /api/admin/questions/import/confirm
```

Request body:

```json
{
  "format": "auto",
  "text": "question bank text"
}
```

JSON example:

```json
[
  {
    "questionCode": "history-test-001",
    "subjectCode": "history",
    "subjectName": "历史",
    "chapterCode": "pre-qin",
    "chapterTitle": "先秦时期",
    "stem": "西周分封制的主要作用是？",
    "optionA": "加强王室对地方的控制",
    "optionB": "促进商品经济发展",
    "optionC": "废除贵族政治",
    "optionD": "推动科举制度形成",
    "correctAnswer": "A",
    "explanation": "分封制通过封邦建国维系统治秩序。",
    "difficulty": "easy",
    "tags": ["先秦", "分封制"]
  }
]
```

Markdown example:

```markdown
---
学科：历史
章节：先秦时期
难度：easy
标签：先秦,分封制

题干：西周分封制的主要作用是？
A. 加强王室对地方的控制
B. 促进商品经济发展
C. 废除贵族政治
D. 推动科举制度形成
答案：A
解析：分封制通过封邦建国维系统治秩序。
---
```

CSV example:

```csv
questionCode,subjectCode,subjectName,chapterCode,chapterTitle,stem,optionA,optionB,optionC,optionD,correctAnswer,explanation,difficulty,tags
history-test-001,history,历史,pre-qin,先秦时期,西周分封制的主要作用是？,加强王室对地方的控制,促进商品经济发展,废除贵族政治,推动科举制度形成,A,分封制通过封邦建国维系统治秩序。,easy,"先秦|分封制"
```

Seed example question data:

```bash
npm run seed:questions
```

Import question bank JSON from `data/questions-export.json`:

```bash
npm run import:questions
```
