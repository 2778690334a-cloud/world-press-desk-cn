import type { IndexedArticle } from "./rss";

type TopicConcept = {
  id: string;
  label: string;
  canonical: string;
  aliases: string[];
  related?: string[];
  queryTerms?: string[];
};

export type TopicIntent = {
  original: string;
  canonicalQuery: string;
  conceptIds: string[];
  termGroups: string[][];
  expandedTerms: string[];
  gdeltQuery: string;
};

export type TopicMatch = {
  score: number;
  matchedTerms: string[];
};

const TOPIC_CONCEPTS: TopicConcept[] = [
  {
    id: "iran",
    label: "伊朗",
    canonical: "Iran",
    aliases: [
      "伊朗",
      "伊朗伊斯兰共和国",
      "Iran",
      "Iranian",
      "Tehran",
      "德黑兰",
      "イラン",
      "ایران",
      "Irán",
      "Irã",
      "l'Iran",
    ],
    related: [
      "IRGC",
      "Islamic Revolutionary Guard",
      "Revolutionary Guards",
      "革命卫队",
      "Khamenei",
      "哈梅内伊",
      "Strait of Hormuz",
      "Hormuz",
      "霍尔木兹海峡",
    ],
    queryTerms: [
      "Iran",
      "Iranian",
      "Tehran",
      "IRGC",
      "\"Revolutionary Guard\"",
      "\"Strait of Hormuz\"",
      "伊朗",
      "イラン",
    ],
  },
  {
    id: "israel",
    label: "以色列",
    canonical: "Israel",
    aliases: [
      "以色列",
      "Israel",
      "Israeli",
      "Jerusalem",
      "耶路撒冷",
      "イスラエル",
      "إسرائيل",
      "Israël",
    ],
    related: ["IDF", "以军", "Netanyahu", "内塔尼亚胡"],
  },
  {
    id: "palestine",
    label: "巴勒斯坦",
    canonical: "Palestine",
    aliases: [
      "巴勒斯坦",
      "Palestine",
      "Palestinian",
      "West Bank",
      "约旦河西岸",
      "パレスチナ",
      "فلسطين",
    ],
  },
  {
    id: "gaza",
    label: "加沙",
    canonical: "Gaza",
    aliases: ["加沙", "Gaza", "Gaza Strip", "ガザ", "غزة"],
    related: ["Hamas", "哈马斯"],
  },
  {
    id: "ukraine",
    label: "乌克兰",
    canonical: "Ukraine",
    aliases: [
      "乌克兰",
      "俄乌",
      "Ukraine",
      "Ukrainian",
      "Kyiv",
      "Kiev",
      "基辅",
      "ウクライナ",
      "Україна",
    ],
    related: ["Zelensky", "Zelenskyy", "泽连斯基"],
  },
  {
    id: "russia",
    label: "俄罗斯",
    canonical: "Russia",
    aliases: [
      "俄罗斯",
      "俄国",
      "Russia",
      "Russian",
      "Moscow",
      "莫斯科",
      "ロシア",
      "Россия",
    ],
    related: ["Kremlin", "克里姆林宫", "Putin", "普京"],
  },
  {
    id: "united-states",
    label: "美国",
    canonical: "United States",
    aliases: [
      "美国",
      "美方",
      "United States",
      "U.S.",
      "USA",
      "Washington",
      "华盛顿",
      "米国",
      "États-Unis",
    ],
  },
  {
    id: "china",
    label: "中国",
    canonical: "China",
    aliases: [
      "中国",
      "中方",
      "China",
      "Chinese",
      "Beijing",
      "北京",
      "中国政府",
      "中国経済",
      "Chine",
    ],
  },
  {
    id: "japan",
    label: "日本",
    canonical: "Japan",
    aliases: ["日本", "Japan", "Japanese", "Tokyo", "东京", "東京", "Japon"],
  },
  {
    id: "taiwan",
    label: "台湾与台海",
    canonical: "Taiwan",
    aliases: [
      "台湾",
      "台海",
      "Taiwan",
      "Taiwanese",
      "Taiwan Strait",
      "台灣",
      "台湾海峡",
    ],
  },
  {
    id: "middle-east",
    label: "中东",
    canonical: "Middle East",
    aliases: [
      "中东",
      "中東",
      "Middle East",
      "Mideast",
      "Moyen-Orient",
      "Oriente Médio",
      "الشرق الأوسط",
    ],
    related: [
      "Israel",
      "Gaza",
      "Iran",
      "Palestine",
      "Lebanon",
      "Syria",
      "以色列",
      "加沙",
      "伊朗",
      "巴勒斯坦",
      "黎巴嫩",
      "叙利亚",
    ],
  },
  {
    id: "artificial-intelligence",
    label: "人工智能",
    canonical: "artificial intelligence",
    aliases: [
      "人工智能",
      "生成式人工智能",
      "大模型",
      "artificial intelligence",
      "generative AI",
      "machine learning",
      "AI",
      "生成AI",
      "intelligence artificielle",
      "inteligência artificial",
    ],
    related: ["OpenAI", "ChatGPT", "Gemini", "Claude"],
  },
  {
    id: "supply-chain",
    label: "供应链",
    canonical: "supply chain",
    aliases: [
      "供应链",
      "产业链",
      "supply chain",
      "logistics",
      "供应網",
      "サプライチェーン",
      "chaîne d'approvisionnement",
    ],
    related: ["shipping", "manufacturing", "物流", "制造业"],
  },
  {
    id: "climate",
    label: "气候变化",
    canonical: "climate change",
    aliases: [
      "气候变化",
      "气候",
      "全球变暖",
      "climate change",
      "global warming",
      "climate crisis",
      "気候変動",
      "changement climatique",
      "mudanças climáticas",
    ],
    related: ["emissions", "carbon", "排放", "碳中和"],
  },
  {
    id: "economy",
    label: "经济",
    canonical: "economy",
    aliases: [
      "全球经济",
      "经济",
      "economy",
      "economic",
      "経済",
      "économie",
      "economia",
    ],
    related: [
      "inflation",
      "growth",
      "interest rate",
      "通胀",
      "增长",
      "利率",
      "インフレ",
    ],
  },
  {
    id: "energy",
    label: "能源",
    canonical: "energy",
    aliases: ["能源", "energy", "énergie", "energia", "エネルギー"],
    related: [
      "oil",
      "gas",
      "electricity",
      "renewable",
      "石油",
      "天然气",
      "电力",
      "原油",
    ],
  },
  {
    id: "trade",
    label: "贸易",
    canonical: "trade",
    aliases: ["贸易", "trade", "commerce", "comércio", "貿易"],
    related: ["exports", "imports", "出口", "进口"],
  },
  {
    id: "tariffs",
    label: "关税",
    canonical: "tariffs",
    aliases: ["关税", "tariff", "tariffs", "tarif", "tarifs", "関税"],
    related: ["trade war", "贸易战"],
  },
  {
    id: "election",
    label: "选举",
    canonical: "election",
    aliases: [
      "选举",
      "大选",
      "election",
      "elections",
      "vote",
      "選挙",
      "élection",
      "eleição",
    ],
  },
  {
    id: "nuclear",
    label: "核议题",
    canonical: "nuclear",
    aliases: [
      "核问题",
      "核计划",
      "核设施",
      "核武器",
      "nuclear",
      "nuclear programme",
      "nuclear program",
      "核開発",
      "nucléaire",
      "nuclear iraniano",
    ],
    related: ["IAEA", "国际原子能机构", "uranium", "铀浓缩"],
  },
];

function normalise(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text: string, term: string) {
  const source = normalise(text);
  const needle = normalise(term.replaceAll('"', ""));
  if (!needle) return false;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Arabic}]/u.test(needle)) {
    return source.includes(needle);
  }
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ).test(source);
}

// Hotspots classify actual titles only; source focus labels and summaries are not evidence.
export function matchTitleTopics(title: string): { id: string; label: string }[] {
  return TOPIC_CONCEPTS.filter(concept =>
    [...concept.aliases, ...(concept.related ?? [])].some(term => containsTerm(title, term)),
  ).map(({ id, label }) => ({ id, label }));
}

function uniqueTerms(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalise(value.replaceAll('"', ""));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function quoteGdeltTerm(value: string) {
  const clean = value.trim().replaceAll('"', "");
  return /\s/.test(clean) ? `"${clean}"` : clean;
}

function conceptMatchesQuery(concept: TopicConcept, query: string) {
  return concept.aliases.some((term) => containsTerm(query, term));
}

export function buildTopicIntent(rawQuery: string): TopicIntent {
  const original = rawQuery.trim();
  const concepts = TOPIC_CONCEPTS.filter((concept) =>
    conceptMatchesQuery(concept, original),
  );

  const termGroups = concepts.length
    ? concepts.map((concept) =>
        uniqueTerms([...concept.aliases, ...(concept.related ?? [])]),
      )
    : [[original]];

  // Keep unknown qualifiers instead of silently widening “伊朗足球” to “伊朗”.
  let residual = original;
  const aliases = concepts.flatMap(concept => concept.aliases).sort((a,b)=>b.length-a.length);
  for (const alias of aliases) residual = residual.split(alias).join(" ");
  const qualifiers = concepts.length ? residual.split(/[\s，,、+]+/).filter(term => term && !["与","和","的","及","and"].includes(term.toLowerCase())) : [];
  for (const qualifier of qualifiers) termGroups.push([qualifier]);

  const expandedTerms = uniqueTerms([
    original,
    ...concepts.flatMap((concept) => [
      concept.label,
      concept.canonical,
      ...concept.aliases,
      ...(concept.related ?? []),
    ]),
  ]);

  const gdeltGroups = concepts.length
    ? concepts.map((concept) => {
        const terms = uniqueTerms(
          concept.queryTerms ?? [
            concept.canonical,
            ...concept.aliases.slice(0, 5),
          ],
        );
        return `(${terms.map(quoteGdeltTerm).join(" OR ")})`;
      })
    : [quoteGdeltTerm(original)];

  return {
    original,
    canonicalQuery: concepts.length
      ? concepts.map((concept) => concept.canonical).join(" + ")
      : original,
    conceptIds: concepts.map((concept) => concept.id),
    termGroups,
    expandedTerms,
    gdeltQuery: [...gdeltGroups, ...qualifiers.map(quoteGdeltTerm)].join(" "),
  };
}

function bestFieldMatch(
  field: string,
  terms: string[],
  directQuery: string,
  fieldWeight: number,
) {
  let score = 0;
  let matchedTerm = "";

  for (const term of terms) {
    if (!containsTerm(field, term)) continue;
    const exactBonus = normalise(term) === normalise(directQuery) ? 5 : 0;
    const specificityBonus = Math.min(normalise(term).length / 8, 3);
    const candidate = fieldWeight + exactBonus + specificityBonus;
    if (candidate > score) {
      score = candidate;
      matchedTerm = term.replaceAll('"', "");
    }
  }

  return { score, matchedTerm };
}

export function matchTopicArticle(
  article: IndexedArticle,
  intent: TopicIntent,
): TopicMatch | null {
  const title = article.title ?? "";
  const summary = article.summary ?? "";
  let score = 0;
  const matchedTerms: string[] = [];

  for (const group of intent.termGroups) {
    const titleMatch = bestFieldMatch(title, group, intent.original, 12);
    const summaryMatch = bestFieldMatch(summary, group, intent.original, 5);
    const best =
      titleMatch.score >= summaryMatch.score ? titleMatch : summaryMatch;
    if (!best.matchedTerm) return null;
    score += best.score;
    matchedTerms.push(best.matchedTerm);
  }

  if (article.sourceType === "rss" || article.sourceType === "homepage") {
    score += 1;
  }

  return { score: Math.round(score * 10) / 10, matchedTerms };
}
