import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";
import { MANBO_INDEX_VERSION, normalizeManboIndexName } from "../manboIndexStore.js";

const inputPath = "F:/tempdownloads/manbostart.xlsx";
const outputPath = path.join(process.cwd(), "data", "manbo-index.seed.json");

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function buildSnapshotFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Excel sheet is empty");
  }

  const [headerTitle, headerId] = Array.isArray(rows[0]) ? rows[0].map(normalizeCell) : ["", ""];
  if (headerTitle !== "标题" || headerId !== "ID") {
    throw new Error(`Unexpected header: ${headerTitle}, ${headerId}`);
  }

  const recordMap = new Map();
  rows.slice(1).forEach((row) => {
    const [rawName, rawId] = Array.isArray(row) ? row : ["", ""];
    const name = normalizeCell(rawName);
    const dramaId = normalizeCell(rawId);
    if (!name || !/^\d+$/.test(dramaId) || recordMap.has(dramaId)) {
      return;
    }

    recordMap.set(dramaId, {
      dramaId,
      name,
      normalizedName: normalizeManboIndexName(name),
      aliases: [],
      cover: "",
    });
  });

  return {
    version: MANBO_INDEX_VERSION,
    updatedAt: Date.now(),
    records: Array.from(recordMap.values()),
  };
}

async function main() {
  const workbook = XLSX.readFile(inputPath, { cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Workbook has no sheets");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: "",
  });
  const snapshot = buildSnapshotFromRows(rows);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        recordCount: snapshot.records.length,
        sheetName: firstSheetName,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
