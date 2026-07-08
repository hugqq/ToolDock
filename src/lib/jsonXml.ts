type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const XML_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const unescapeXml = (value: string): string =>
  value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

const assertXmlName = (name: string) => {
  if (!XML_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid XML tag name: ${name}`);
  }
};

const valueToXml = (value: JsonValue, name: string): string => {
  assertXmlName(name);

  if (Array.isArray(value)) {
    return value.map((item) => valueToXml(item, name)).join("");
  }

  if (typeof value === "object" && value !== null) {
    const children = Object.entries(value)
      .map(([key, childValue]) => valueToXml(childValue, key))
      .join("");
    return `<${name}>${children}</${name}>`;
  }

  return `<${name}>${escapeXml(String(value))}</${name}>`;
};

export const jsonToXml = (value: JsonValue): string => {
  const body =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.entries(value)
          .map(([key, childValue]) => valueToXml(childValue, key))
          .join("")
      : valueToXml(value, "item");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>${body}</root>`;
};

const coerceTextValue = (value: string): JsonValue => {
  const text = unescapeXml(value);
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(text)) {
    const numberValue = Number(text);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return text;
};

const parseAttributesFreeElement = (
  xml: string,
  startIndex: number
): { name: string; value: JsonValue; nextIndex: number } => {
  if (xml[startIndex] !== "<" || xml[startIndex + 1] === "/") {
    throw new Error("Expected XML element");
  }

  const openEnd = xml.indexOf(">", startIndex);
  if (openEnd === -1) throw new Error("Unclosed XML tag");

  const name = xml.slice(startIndex + 1, openEnd).trim();
  assertXmlName(name);

  let cursor = openEnd + 1;
  const children: Array<{ name: string; value: JsonValue }> = [];
  let text = "";

  while (cursor < xml.length) {
    const closeTag = `</${name}>`;
    if (xml.startsWith(closeTag, cursor)) {
      const nextIndex = cursor + closeTag.length;

      if (children.length === 0) {
        return { name, value: coerceTextValue(text), nextIndex };
      }

      const grouped = children.reduce<Record<string, JsonValue>>((acc, child) => {
        const existing = acc[child.name];
        if (existing === undefined) {
          acc[child.name] = child.value;
        } else if (Array.isArray(existing)) {
          existing.push(child.value);
        } else {
          acc[child.name] = [existing, child.value];
        }
        return acc;
      }, {});

      return { name, value: grouped, nextIndex };
    }

    if (xml[cursor] === "<") {
      const child = parseAttributesFreeElement(xml, cursor);
      children.push({ name: child.name, value: child.value });
      cursor = child.nextIndex;
      continue;
    }

    text += xml[cursor];
    cursor += 1;
  }

  throw new Error(`Missing closing tag: ${name}`);
};

export const xmlToJson = (xml: string): JsonValue => {
  const normalized = xml.replace(/^\s*<\?xml[\s\S]*?\?>\s*/, "").trim();
  const parsed = parseAttributesFreeElement(normalized, 0);

  if (parsed.nextIndex !== normalized.length) {
    throw new Error("Unexpected content after root element");
  }

  return parsed.name === "root" ? parsed.value : { [parsed.name]: parsed.value };
};

export const isXmlText = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith("<?xml") || /^<[A-Za-z_][A-Za-z0-9_.-]*>/.test(trimmed);
};
