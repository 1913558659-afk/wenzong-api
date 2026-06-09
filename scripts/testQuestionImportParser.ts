import { parseQuestionImportText } from "../src/utils/questionImportParser";

const sampleText = `学科：历史
章节：先秦时期
难度：easy
标签：先秦,分封制

题干：西周实行分封制的主要目的是什么？
A. 扩大商品经济
B. 巩固周王朝统治
C. 推行郡县制
D. 促进思想统一
答案：B
解析：西周通过分封诸侯拱卫王室，以巩固统治秩序。
---
学科：历史
章节：先秦时期
难度：easy
标签：先秦,宗法制

题干：西周宗法制的核心纽带是什么？
A. 血缘关系
B. 地域关系
C. 商品交换
D. 官僚任命
答案：A
解析：宗法制以血缘关系为核心，强调嫡长子继承制。
---
学科：历史
章节：先秦时期
难度：easy
标签：先秦,礼乐制度

题干：西周礼乐制度的主要作用是什么？
A. 推动海外贸易
B. 维护等级秩序
C. 废除贵族特权
D. 建立郡县体制
答案：B
解析：礼乐制度通过礼仪和音乐规范等级秩序，维护宗法分封体系。
---`;

const result = parseQuestionImportText(sampleText, "markdown");

if (result.total !== 3 || result.validCount !== 3 || result.invalidCount !== 0) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error("Expected total: 3, validCount: 3, invalidCount: 0");
}

console.log(JSON.stringify(result, null, 2));
