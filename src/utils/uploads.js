import fs from "fs";
import path from "path";
import multer from "multer";
import { PATHS } from "../constants.js";


const UPLOAD_DIR = PATHS.UPLOAD_DIR;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer: store uploaded audio as temp file
export const upload = multer({ dest: `${UPLOAD_DIR}/` });

// Rename temp file to keep original extension (helps OpenAI format detection)
export function renameWithOriginalExtension(file) {
  const tempPath = file.path;
  const original = (file.originalname || "recording.webm").toLowerCase();
  const ext = path.extname(original) || ".webm";
  const renamedPath = `${tempPath}${ext}`;
  fs.renameSync(tempPath, renamedPath);
  return renamedPath;
}
