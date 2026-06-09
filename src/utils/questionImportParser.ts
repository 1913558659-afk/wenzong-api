export type QuestionImportFormat = "auto" | "json" | "markdown" | "csv";

export type ParsedImportQuestion = {
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
  explanation: string | null;
  difficulty: string;
  tags: string[];
};

export type ImportParseError = {
  index: number;
  message: string;
};

export type QuestionImportParseResult = {
  total: number;
  validCount: number;
  invalidCount: number;
  questions: ParsedImportQuestion[];
  errors: ImportParseError[];
};

type RawImportQuestion = Record<string, unknown>;

const subjectCodeMap: Record<string, string> = {
  历史: "history",
  政治: "politics",
  地理: "geography",
};

const chapterCodeMap: Record<string, string> = {
  先秦时期: "pre-qin",
  秦汉时期: "qin-han",
  隋唐时期: "sui-tang",
  宋元时期: "song-yuan",
  明清时期: "ming-qing",
};

const requiredFields = [
  "stem",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
];

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  const mapped = chapterCodeMap[value.trim()];
  if (mapped) return mapped;

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug) return slug;

  const codePointSlug = Array.from(value.trim())
    .map((char) => char.codePointAt(0)?.toString(36))
    .filter(Boolean)
    .join("-");

  return codePointSlug ? `chapter-${codePointSlug}` : "chapter";
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag).trim()).filter(Boolean);
    }
  } catch {
    // Fall through to delimiter parsing.
  }

  return trimmed
    .split(/[;,|，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeQuestion(
  raw: RawImportQuestion,
  index: number
): { question?: ParsedImportQuestion; error?: ImportParseError } {
  const subjectName = getText(raw.subjectName) || "历史";
  const subjectCode =
    getText(raw.subjectCode) || subjectCodeMap[subjectName] || slugify(subjectName);
  const chapterTitle = getText(raw.chapterTitle) || "默认章节";
  const chapterCode = getText(raw.chapterCode) || slugify(chapterTitle);
  const correctAnswer = getText(raw.correctAnswer).toUpperCase();

  const normalized: ParsedImportQuestion = {
    questionCode:
      getText(raw.questionCode) || `${subjectCode}-${chapterCode}-${Date.now()}-${index + 1}`,
    subjectCode,
    subjectName,
    chapterCode,
    chapterTitle,
    stem: getText(raw.stem),
    optionA: getText(raw.optionA),
    optionB: getText(raw.optionB),
    optionC: getText(raw.optionC),
    optionD: getText(raw.optionD),
    correctAnswer,
    explanation: getText(raw.explanation) || null,
    difficulty: getText(raw.difficulty) || "medium",
    tags: normalizeTags(raw.tags),
  };

  const missingFields = requiredFields.filter((field) => {
    const value = normalized[field as keyof ParsedImportQuestion];
    return typeof value !== "string" || !value;
  });

  if (missingFields.length > 0) {
    return {
      error: {
        index,
        message: `缺少 ${missingFields.join(", ")}`,
      },
    };
  }

  if (!["A", "B", "C", "D"].includes(normalized.correctAnswer)) {
    return {
      error: {
        index,
        message: "correctAnswer 只能是 A/B/C/D",
      },
    };
  }

  return {
    question: normalized,
  };
}

function parseJson(text: string) {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("JSON 内容必须是数组");
  }

  return parsed as RawImportQuestion[];
}

function parseMarkdown(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/^\s*---+\s*$/gm)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const raw: RawImportQuestion = {};
      const lines = block.split(/\r?\n/);
      let stemLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const fieldMatch = trimmed.match(/^([^：:]+)[：:]\s*(.*)$/);
        const optionMatch = trimmed.match(/^([A-D])[\.\、]\s*(.*)$/i);

        if (fieldMatch) {
          const [, label, value] = fieldMatch;
          const key = label.trim();

          if (key === "学科") raw.subjectName = value;
          else if (key === "学科代码") raw.subjectCode = value;
          else if (key === "章节") raw.chapterTitle = value;
          else if (key === "章节代码") raw.chapterCode = value;
          else if (key === "难度") raw.difficulty = value;
          else if (key === "标签") raw.tags = value;
          else if (key === "题干") {
            raw.stem = value;
            stemLines = [value];
          } else if (key === "答案") raw.correctAnswer = value;
          else if (key === "解析") raw.explanation = value;
          else if (key === "题号" || key === "questionCode") raw.questionCode = value;

          continue;
        }

        if (optionMatch) {
          const [, option, value] = optionMatch;
          raw[`option${option.toUpperCase()}`] = value;
          continue;
        }

        if (stemLines.length > 0 && !raw.optionA) {
          stemLines.push(trimmed);
          raw.stem = stemLines.join("\n");
        }
      }

      return raw;
    });
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const raw: RawImportQuestion = {};

    headers.forEach((header, index) => {
      raw[header] = cells[index] ?? "";
    });

    return raw;
  });
}

function detectFormat(format: QuestionImportFormat, text: string) {
  if (format !== "auto") return format;

  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return "json";
  if (trimmed.includes("---") || trimmed.includes("题干：")) return "markdown";
  return "csv";
}

export function parseQuestionImportText(
  text: string,
  format: QuestionImportFormat = "auto"
): QuestionImportParseResult {
  if (!text.trim()) {
    return {
      total: 0,
      validCount: 0,
      invalidCount: 1,
      questions: [],
      errors: [{ index: 0, message: "导入文本不能为空" }],
    };
  }

  const detectedFormat = detectFormat(format, text);
  let rawQuestions: RawImportQuestion[];

  if (detectedFormat === "json") rawQuestions = parseJson(text);
  else if (detectedFormat === "markdown") rawQuestions = parseMarkdown(text);
  else rawQuestions = parseCsv(text);

  const questions: ParsedImportQuestion[] = [];
  const errors: ImportParseError[] = [];

  rawQuestions.forEach((raw, index) => {
    const result = normalizeQuestion(raw, index);

    if (result.question) questions.push(result.question);
    if (result.error) errors.push(result.error);
  });

  return {
    total: rawQuestions.length,
    validCount: questions.length,
    invalidCount: errors.length,
    questions,
    errors,
  };
}
