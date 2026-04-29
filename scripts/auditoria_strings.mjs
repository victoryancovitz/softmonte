import { readdir, readFile } from "fs/promises";
import { join, extname } from "path";

// ---------------------------------------------------------------------------
// 1. Palavras portuguesas sem acento (só flaggear em JSX text / string literals)
// ---------------------------------------------------------------------------
const PALAVRAS_ACENTO = [
  { errado: "Descricao", correto: "Descrição" },
  { errado: "Lancamento", correto: "Lançamento" },
  { errado: "Composicao", correto: "Composição" },
  { errado: "Situacao", correto: "Situação" },
  { errado: "Funcao", correto: "Função" },
  { errado: "Provisao", correto: "Provisão" },
  { errado: "Conciliacao", correto: "Conciliação" },
  { errado: "Renegociacao", correto: "Renegociação" },
];

// Build a single case-insensitive regex for all words
const accentRe = new RegExp(
  PALAVRAS_ACENTO.map((p) => `\\b${p.errado}\\b`).join("|"),
  "gi"
);

// Map lowercase → correto for quick lookup
const correcaoMap = Object.fromEntries(
  PALAVRAS_ACENTO.map((p) => [p.errado.toLowerCase(), p.correto])
);

// 2. console.log
const consoleRe = /console\.log\s*\(/g;

// 3. Hardcoded hex colors (#RGB, #RRGGBB, #RRGGBBAA)
const hexColorRe = /#[0-9A-Fa-f]{3,8}\b/g;

// Allowed design-token colors (lowercase, no #). Add more as needed.
const ALLOWED_COLORS = new Set([
  // Common Tailwind / shadcn defaults that show up as literals
  "000",
  "000000",
  "fff",
  "ffffff",
  "transparent",
]);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  ".turbo",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when the match sits inside a JS/TS string literal or JSX text content */
function isInStringOrJSX(line, matchIndex) {
  // Heuristic: check if the match is inside quotes or between > ... <
  const before = line.slice(0, matchIndex);

  // Count unescaped quotes before the match
  const singleQuotes = (before.match(/(?<!\\)'/g) || []).length;
  const doubleQuotes = (before.match(/(?<!\\)"/g) || []).length;
  const backticks = (before.match(/(?<!\\)`/g) || []).length;

  // Inside a string literal if odd number of that quote type
  if (singleQuotes % 2 === 1) return true;
  if (doubleQuotes % 2 === 1) return true;
  if (backticks % 2 === 1) return true;

  // JSX text: last significant char before is > and no { after it
  const lastAngle = before.lastIndexOf(">");
  const lastBrace = before.lastIndexOf("{");
  if (lastAngle > lastBrace && lastAngle !== -1) return true;

  return false;
}

/** True if line looks like it contains a variable name / SQL column, not user-facing text */
function isCodeIdentifier(line, matchIndex, matchLen) {
  const charBefore = matchIndex > 0 ? line[matchIndex - 1] : " ";
  const charAfter =
    matchIndex + matchLen < line.length ? line[matchIndex + matchLen] : " ";

  // Part of snake_case, dot-access or camelCase identifier
  if (charBefore === "_" || charBefore === ".") return true;
  if (charAfter === "_" || charAfter === "(") return true;

  // Inside an import / from statement
  if (/\b(import|from)\b/.test(line)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

async function collectTsxFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsxFiles(full)));
    } else if (extname(entry.name) === ".tsx") {
      files.push(full);
    }
  }
  return files;
}

async function auditFile(filePath, rootDir) {
  const relPath = filePath.replace(rootDir + "/", "");
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  const acentuacao = [];
  const consoleLogs = [];
  const coresHardcoded = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // --- Acentuacao ---
    let m;
    const acRe = new RegExp(accentRe.source, accentRe.flags);
    while ((m = acRe.exec(line)) !== null) {
      if (
        isInStringOrJSX(line, m.index) &&
        !isCodeIdentifier(line, m.index, m[0].length)
      ) {
        acentuacao.push({
          file: relPath,
          line: lineNum,
          text: m[0],
          sugestao: correcaoMap[m[0].toLowerCase()],
        });
      }
    }

    // --- console.log ---
    const clRe = new RegExp(consoleRe.source, consoleRe.flags);
    while ((m = clRe.exec(line)) !== null) {
      consoleLogs.push({
        file: relPath,
        line: lineNum,
        text: line.trim().slice(0, 80),
      });
    }

    // --- Hex colors ---
    const hRe = new RegExp(hexColorRe.source, hexColorRe.flags);
    while ((m = hRe.exec(line)) !== null) {
      const raw = m[0].replace("#", "").toLowerCase();
      if (ALLOWED_COLORS.has(raw)) continue;
      // Skip Tailwind class-like contexts  e.g. text-[#xxx] bg-[#xxx] — still flag them
      coresHardcoded.push({
        file: relPath,
        line: lineNum,
        text: m[0],
      });
    }
  }

  return { acentuacao, console_log: consoleLogs, cores_hardcoded: coresHardcoded };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ROOT = join(process.cwd(), "src");

const files = await collectTsxFiles(ROOT);

const result = {
  acentuacao: [],
  console_log: [],
  cores_hardcoded: [],
  totals: { acentuacao: 0, console_log: 0, cores_hardcoded: 0 },
};

for (const f of files) {
  const r = await auditFile(f, process.cwd());
  result.acentuacao.push(...r.acentuacao);
  result.console_log.push(...r.console_log);
  result.cores_hardcoded.push(...r.cores_hardcoded);
}

result.totals.acentuacao = result.acentuacao.length;
result.totals.console_log = result.console_log.length;
result.totals.cores_hardcoded = result.cores_hardcoded.length;

console.log(JSON.stringify(result, null, 2));
