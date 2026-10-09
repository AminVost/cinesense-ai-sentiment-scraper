function summarize(comments) {
  const counts = { positive: 0, negative: 0, neutral: 0, unclassified: 0 };
  for (const comment of comments) {
    const label = String(comment.sentiment || "").toLowerCase();
    if (label === "positive") counts.positive++;
    else if (label === "negative") counts.negative++;
    else if (label === "neutral") counts.neutral++;
    else counts.unclassified++;
  }
  const classified = counts.positive + counts.negative + counts.neutral;
  return {
    ...counts, total: comments.length, classified,
    positivePercent: classified ? Math.round(counts.positive * 100 / classified) : null,
    negativePercent: classified ? Math.round(counts.negative * 100 / classified) : null,
    neutralPercent: classified ? Math.round(counts.neutral * 100 / classified) : null,
  };
}
module.exports = { summarize };
