// scripts/ingestDocs.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "../src/db.js";
import { openai } from "../src/openaiClient.js";

function chunkText(text, { maxChars = 1200, overlap = 150 } = {}) {
  const clean = text.replace(/\r/g, "").trim();
  const out = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + maxChars, clean.length);
    out.push(clean.slice(i, end));
    i = end - overlap;
    if (i < 0) i = 0;
    if (end === clean.length) break;
  }
  return out.filter((s) => s.trim().length > 0);
}

async function upsertDocument(source, title = null, meta = {}) {
  const { rows } = await pool.query(
    `
    INSERT INTO documents (source, title, meta)
    VALUES ($1, $2, $3::jsonb)
    RETURNING id;
  `,
    [source, title, JSON.stringify(meta)]
  );
  return rows[0].id;
}

async function insertChunk(documentId, chunkIndex, content, embedding, meta = {}) {
  const vecLiteral = `[${embedding.join(",")}]`;
  await pool.query(
    `
    INSERT INTO chunks (document_id, chunk_index, content, embedding, meta)
    VALUES ($1, $2, $3, $4::vector, $5::jsonb)
    ON CONFLICT (document_id, chunk_index)
    DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, meta = EXCLUDED.meta;
  `,
    [documentId, chunkIndex, content, vecLiteral, JSON.stringify(meta)]
  );
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: node scripts/ingestDocs.js <folder>");
    process.exit(1);
  }

  const abs = path.resolve(dir);
  const files = fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".md") || f.endsWith(".txt"))
    .map((f) => path.join(abs, f));

  console.log(`Found ${files.length} files in ${abs}`);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const rel = path.relative(process.cwd(), filePath);
    const title = path.basename(filePath);

    const docId = await upsertDocument(rel, title, { ext: path.extname(filePath) });

    const chunks = chunkText(content, { maxChars: 1200, overlap: 150 });

    console.log(`- ${title}: ${chunks.length} chunks`);

    // embeddings par batch (simple)
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks,
    });

    for (let i = 0; i < chunks.length; i++) {
      await insertChunk(docId, i, chunks[i], emb.data[i].embedding, {});
    }
  }

  console.log("Done.");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
