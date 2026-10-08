import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTopicIntent,
  matchTopicArticle,
} from "../app/lib/topic-search.ts";

test("expands 伊朗 into multilingual entity terms", () => {
  const intent = buildTopicIntent("伊朗");

  assert.equal(intent.canonicalQuery, "Iran");
  assert.ok(intent.expandedTerms.includes("Iran"));
  assert.ok(intent.expandedTerms.includes("Iranian"));
  assert.ok(intent.expandedTerms.includes("イラン"));
  assert.ok(intent.expandedTerms.includes("Irã"));
  assert.match(intent.gdeltQuery, /Iran/);
  assert.match(intent.gdeltQuery, /Tehran/);
});

test("matches an English Iran headline from a Chinese query", () => {
  const intent = buildTopicIntent("伊朗");
  const match = matchTopicArticle(
    {
      title: "US launches new airstrikes against Iran",
      summary: "Officials in Tehran responded to the attack.",
      url: "https://example.com/iran",
      domain: "cnn.com",
      sourceType: "homepage",
    },
    intent,
  );

  assert.ok(match);
  assert.ok(match.score >= 12);
  assert.ok(match.matchedTerms.some((term) => /iran/i.test(term)));
});

test("matches Japanese and Portuguese spellings without substring false positives", () => {
  const intent = buildTopicIntent("伊朗");
  const japanese = matchTopicArticle(
    {
      title: "イラン情勢をめぐる各国の動き",
      url: "https://example.com/jp",
      domain: "nikkei.com",
    },
    intent,
  );
  const portuguese = matchTopicArticle(
    {
      title: "Novas negociações com o Irã começam hoje",
      url: "https://example.com/pt",
      domain: "folha.uol.com.br",
    },
    intent,
  );
  const falsePositive = matchTopicArticle(
    {
      title: "New transport plan announced in Tirana",
      url: "https://example.com/tirana",
      domain: "bbc.com",
    },
    intent,
  );

  assert.ok(japanese);
  assert.ok(portuguese);
  assert.equal(falsePositive, null);
});

test("requires every recognised concept for a compound query", () => {
  const intent = buildTopicIntent("伊朗核问题");
  const related = matchTopicArticle(
    {
      title: "Iran nuclear talks resume with IAEA observers",
      url: "https://example.com/related",
      domain: "aljazeera.com",
    },
    intent,
  );
  const onlyIran = matchTopicArticle(
    {
      title: "Iran announces a new transport policy",
      url: "https://example.com/only-iran",
      domain: "aljazeera.com",
    },
    intent,
  );

  assert.deepEqual(intent.conceptIds, ["iran", "nuclear"]);
  assert.ok(related);
  assert.equal(onlyIran, null);
});

test("does not discard unrecognised topic qualifiers",()=>{
 const intent=buildTopicIntent("伊朗足球");
 assert.ok(intent.termGroups.some(group=>group.includes("足球")));
 assert.equal(matchTopicArticle({title:"Iran transport policy",url:"https://bbc.com/x",domain:"bbc.com"},intent),null);
 assert.ok(matchTopicArticle({title:"伊朗足球比赛",url:"https://news.cn/x",domain:"news.cn"},intent));
});
