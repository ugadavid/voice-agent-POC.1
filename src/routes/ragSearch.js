// src/routes/ragSearch.js
import { pool } from "../db.js";

// q: string
// returns: { chunks: [{ id, source, title, chunk_index, content, score }] }
export function registerRagSearchRoute(app, { openai }) {
  app.get("/api/rag/search", async (req, res) => {
    try {
      const q = (req.query.q || "").toString().trim();
      const k = Math.min(parseInt(req.query.k || "5", 10) || 5, 12);

      if (!q) return res.json({ chunks: [] });

      // 1) embedding de la requête
      const emb = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: q,
      });

      const vec = emb.data[0].embedding; // array[1536]

      // 2) recherche cosine distance via pgvector
      // On passe le vecteur en string "[...]" compatible pgvector
      const vecLiteral = `[${vec.join(",")}]`;

      const sql = `
        SELECT
          c.id,
          d.source,
          d.title,
          c.chunk_index,
          c.content,
          (1 - (c.embedding <=> $1::vector)) AS score
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> $1::vector
        LIMIT $2;
      `;

      const { rows } = await pool.query(sql, [vecLiteral, k]);
      res.json({ chunks: rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "rag_search_failed" });
    }
  });
}
