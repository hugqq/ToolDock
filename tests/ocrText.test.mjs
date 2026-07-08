import assert from "node:assert/strict";
import test from "node:test";
import { formatOcrText } from "../src/lib/ocrText.ts";

const box = (text, x1, y1, x2, y2) => ({
  text,
  confidence: 1,
  polygon: [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ],
});

test("formats OCR boxes as one result while preserving detected lines", () => {
  const text = formatOcrText(
    [
      box("App", 80, 60, 120, 80),
      box("0", 20, 60, 40, 80),
      box("githup/ISSUE_TEMPLATE", 80, 20, 240, 40),
      box("0", 20, 20, 40, 40),
    ],
    true
  );

  assert.equal(text, "0 githup/ISSUE_TEMPLATE\n0 App");
});

test("formats OCR boxes as one line when line breaks are disabled", () => {
  const text = formatOcrText(
    [
      box("0", 20, 20, 40, 40),
      box("githup/ISSUE_TEMPLATE", 80, 20, 240, 40),
      box("0", 20, 60, 40, 80),
      box("App", 80, 60, 120, 80),
    ],
    false
  );

  assert.equal(text, "0 githup/ISSUE_TEMPLATE 0 App");
});
