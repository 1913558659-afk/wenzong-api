import { parseQuestionImportText } from "../src/utils/questionImportParser";

const sampleText = `学科：英语
章节：词汇与语法
题型：填空题
难度：medium
标签：名词复数,语法填空,词形变化

题干：
The sun-dried clothes smell especially pleasant where I live, thanks to the absence of smog and plenty of blue sky ****64**** (afternoon) with lots of fresh air.

答案：afternoons
解析：
考查名词的数。此处表示很多个空气清新的下午，应使用复数形式 afternoons。`;

const result = parseQuestionImportText(sampleText, "markdown");

if (result.total !== 1 || result.validCount !== 1 || result.invalidCount !== 0) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error("Expected one valid fill_blank question");
}

const [question] = result.questions;

if (
  question.questionType !== "fill_blank" ||
  question.type !== "fill_blank" ||
  question.optionA !== null ||
  question.optionB !== null ||
  question.optionC !== null ||
  question.optionD !== null ||
  question.correctAnswer !== "afternoons"
) {
  console.error(JSON.stringify(question, null, 2));
  throw new Error("Fill blank question was not normalized correctly");
}

console.log(JSON.stringify(result, null, 2));
