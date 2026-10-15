import { getArchiveDb } from "../../db";
import { saveArchive } from "./archive-store";
import { collectHeadlines } from "./headline-index";
import { currentDeskDate } from "./rss";
// Callers MUST authorize the owner before invoking this shared writer.
export async function collectAndSave(date: string) {
  if (date !== currentDeskDate()) throw new Error("Only today's Beijing date may be collected");
  const result = await collectHeadlines(date);
  const unavailable = result.sources.filter(source => source.status !== "ok").length;
  const status = result.articles.length ? (unavailable || result.gdeltStatus === "error" ? "partial" : "ok") : "incomplete";
  const saved = await saveArchive(getArchiveDb(), date, result.articles, {sources:result.sources,gdeltStatus:result.gdeltStatus}, status);
  return {...saved,collectionStatus:status};
}
