/**
 * Pure knowledge retrieval engine for vector search & keyword matching.
 */
export const retrieveKnowledge = ({ chunks = [], query = '', topK = 3 }) => {
  if (!query || chunks.length === 0) return [];

  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = chunks.map((chunk) => {
    const text = (chunk.content || chunk.text || '').toLowerCase();
    let score = 0;

    queryTerms.forEach((term) => {
      if (text.includes(term)) score += 1;
    });

    return { ...chunk, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

export default { retrieveKnowledge };
