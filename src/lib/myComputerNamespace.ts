const SUSPICIOUS_KEYWORDS = [
  "百度网盘",
  "夸克网盘",
  "阿里云盘",
  "天翼云盘",
  "迅雷",
  "115",
  "网盘",
  "cloud drive",
  "aliyun drive",
  "baidu",
  "quark",
];

export function isSuspiciousNamespaceIcon(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return false;

  return SUSPICIOUS_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );
}

