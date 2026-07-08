import type { TextBox } from "../types/ocr";

type PositionedTextBox = TextBox & {
  minX: number;
  minY: number;
  maxY: number;
  centerY: number;
  height: number;
};

type TextLine = {
  boxes: PositionedTextBox[];
  centerY: number;
  height: number;
};

const getPositionedBox = (box: TextBox): PositionedTextBox => {
  const xs = box.polygon.map((point) => point.x);
  const ys = box.polygon.map((point) => point.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const height = Math.max(maxY - minY, 1);

  return {
    ...box,
    minX: Math.min(...xs),
    minY,
    maxY,
    centerY: minY + height / 2,
    height,
  };
};

const belongsToLine = (line: TextLine, box: PositionedTextBox) => {
  const tolerance = Math.max(line.height, box.height) * 0.6;
  return Math.abs(line.centerY - box.centerY) <= Math.max(tolerance, 8);
};

const addBoxToLine = (line: TextLine, box: PositionedTextBox) => {
  line.boxes.push(box);
  const count = line.boxes.length;
  line.centerY = (line.centerY * (count - 1) + box.centerY) / count;
  line.height = (line.height * (count - 1) + box.height) / count;
};

export const formatOcrText = (
  textBoxes: TextBox[],
  preserveLineBreaks: boolean
) => {
  const boxes = textBoxes
    .filter((box) => box.text.trim())
    .map(getPositionedBox)
    .sort((a, b) => a.minY - b.minY || a.minX - b.minX);

  const lines = boxes.reduce<TextLine[]>((result, box) => {
    const line = result.find((item) => belongsToLine(item, box));

    if (line) {
      addBoxToLine(line, box);
    } else {
      result.push({
        boxes: [box],
        centerY: box.centerY,
        height: box.height,
      });
    }

    return result;
  }, []);

  const lineTexts = lines.map((line) =>
    line.boxes
      .sort((a, b) => a.minX - b.minX)
      .map((box) => box.text.trim())
      .join(" ")
  );

  return lineTexts.join(preserveLineBreaks ? "\n" : " ");
};
