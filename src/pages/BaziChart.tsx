import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/useSettingsStore";
import { invokeWrapper } from "../api";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";

// ========== 天干地支数据 ==========
const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const DI_ZHI = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
];
const SHENG_XIAO = [
  "鼠",
  "牛",
  "虎",
  "兔",
  "龙",
  "蛇",
  "马",
  "羊",
  "猴",
  "鸡",
  "狗",
  "猪",
];
const WU_XING_GAN: Record<string, string> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};
const WU_XING_ZHI: Record<string, string> = {
  子: "水",
  丑: "土",
  寅: "木",
  卯: "木",
  辰: "土",
  巳: "火",
  午: "火",
  未: "土",
  申: "金",
  酉: "金",
  戌: "土",
  亥: "水",
};
const YIN_YANG_GAN: Record<string, string> = {
  甲: "阳",
  乙: "阴",
  丙: "阳",
  丁: "阴",
  戊: "阳",
  己: "阴",
  庚: "阳",
  辛: "阴",
  壬: "阳",
  癸: "阴",
};
const YIN_YANG_ZHI: Record<string, string> = {
  子: "阳",
  丑: "阴",
  寅: "阳",
  卯: "阴",
  辰: "阳",
  巳: "阴",
  午: "阳",
  未: "阴",
  申: "阳",
  酉: "阴",
  戌: "阳",
  亥: "阴",
};
const NAYINWUXING: string[] = [
  "海中金",
  "海中金",
  "炉中火",
  "炉中火",
  "大林木",
  "大林木",
  "路旁土",
  "路旁土",
  "剑锋金",
  "剑锋金",
  "山头火",
  "山头火",
  "涧下水",
  "涧下水",
  "城头土",
  "城头土",
  "白蜡金",
  "白蜡金",
  "杨柳木",
  "杨柳木",
  "泉中水",
  "泉中水",
  "屋上土",
  "屋上土",
  "霹雳火",
  "霹雳火",
  "松柏木",
  "松柏木",
  "长流水",
  "长流水",
  "沙中金",
  "沙中金",
  "山下火",
  "山下火",
  "平地木",
  "平地木",
  "壁上土",
  "壁上土",
  "金箔金",
  "金箔金",
  "覆灯火",
  "覆灯火",
  "天河水",
  "天河水",
  "大驿土",
  "大驿土",
  "钗钏金",
  "钗钏金",
  "桑柘木",
  "桑柘木",
  "大溪水",
  "大溪水",
  "沙中土",
  "沙中土",
  "天上火",
  "天上火",
  "石榴木",
  "石榴木",
  "大海水",
  "大海水",
];

const DIZHI_HOUR = [
  { name: "子", range: "23:00-00:59" },
  { name: "丑", range: "01:00-02:59" },
  { name: "寅", range: "03:00-04:59" },
  { name: "卯", range: "05:00-06:59" },
  { name: "辰", range: "07:00-08:59" },
  { name: "巳", range: "09:00-10:59" },
  { name: "午", range: "11:00-12:59" },
  { name: "未", range: "13:00-14:59" },
  { name: "申", range: "15:00-16:59" },
  { name: "酉", range: "17:00-18:59" },
  { name: "戌", range: "19:00-20:59" },
  { name: "亥", range: "21:00-22:59" },
];

// 十神对照
const SHI_SHEN_MAP: Record<string, Record<string, string>> = {
  甲: {
    甲: "比肩",
    乙: "劫财",
    丙: "食神",
    丁: "伤官",
    戊: "偏财",
    己: "正财",
    庚: "七杀",
    辛: "正官",
    壬: "偏印",
    癸: "正印",
  },
  乙: {
    乙: "比肩",
    甲: "劫财",
    丁: "食神",
    丙: "伤官",
    己: "偏财",
    戊: "正财",
    辛: "七杀",
    庚: "正官",
    癸: "偏印",
    壬: "正印",
  },
  丙: {
    丙: "比肩",
    丁: "劫财",
    戊: "食神",
    己: "伤官",
    庚: "偏财",
    辛: "正财",
    壬: "七杀",
    癸: "正官",
    甲: "偏印",
    乙: "正印",
  },
  丁: {
    丁: "比肩",
    丙: "劫财",
    己: "食神",
    戊: "伤官",
    辛: "偏财",
    庚: "正财",
    癸: "七杀",
    壬: "正官",
    乙: "偏印",
    甲: "正印",
  },
  戊: {
    戊: "比肩",
    己: "劫财",
    庚: "食神",
    辛: "伤官",
    壬: "偏财",
    癸: "正财",
    甲: "七杀",
    乙: "正官",
    丙: "偏印",
    丁: "正印",
  },
  己: {
    己: "比肩",
    戊: "劫财",
    辛: "食神",
    庚: "伤官",
    癸: "偏财",
    壬: "正财",
    乙: "七杀",
    甲: "正官",
    丁: "偏印",
    丙: "正印",
  },
  庚: {
    庚: "比肩",
    辛: "劫财",
    壬: "食神",
    癸: "伤官",
    甲: "偏财",
    乙: "正财",
    丙: "七杀",
    丁: "正官",
    戊: "偏印",
    己: "正印",
  },
  辛: {
    辛: "比肩",
    庚: "劫财",
    癸: "食神",
    壬: "伤官",
    乙: "偏财",
    甲: "正财",
    丁: "七杀",
    丙: "正官",
    己: "偏印",
    戊: "正印",
  },
  壬: {
    壬: "比肩",
    癸: "劫财",
    甲: "食神",
    乙: "伤官",
    丙: "偏财",
    丁: "正财",
    戊: "七杀",
    己: "正官",
    庚: "偏印",
    辛: "正印",
  },
  癸: {
    癸: "比肩",
    壬: "劫财",
    乙: "食神",
    甲: "伤官",
    丁: "偏财",
    丙: "正财",
    己: "七杀",
    戊: "正官",
    辛: "偏印",
    庚: "正印",
  },
};

// 地支藏干
const DIZHI_CANGGAN: Record<string, string[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

const WU_XING_COLORS: Record<string, string> = {
  金: "#d4a017",
  木: "#2e7d32",
  水: "#1565c0",
  火: "#c62828",
  土: "#8d6e63",
};

// ========== 排盘算法 ==========
function getYearPillar(year: number) {
  const ganIdx = (year - 4) % 10;
  const zhiIdx = (year - 4) % 12;
  return { gan: TIAN_GAN[ganIdx], zhi: DI_ZHI[zhiIdx] };
}

// 根据节气定月柱（简化版：以每月节气为界）
// 节气月份对应：立春(2月) -> 寅月，惊蛰(3月) -> 卯月...
const JIEQI_SOLAR = [
  { month: 2, day: 4 }, // 立春 -> 寅
  { month: 3, day: 6 }, // 惊蛰 -> 卯
  { month: 4, day: 5 }, // 清明 -> 辰
  { month: 5, day: 6 }, // 立夏 -> 巳
  { month: 6, day: 6 }, // 芒种 -> 午
  { month: 7, day: 7 }, // 小暑 -> 未
  { month: 8, day: 7 }, // 立秋 -> 申
  { month: 9, day: 8 }, // 白露 -> 酉
  { month: 10, day: 8 }, // 寒露 -> 戌
  { month: 11, day: 7 }, // 立冬 -> 亥
  { month: 12, day: 7 }, // 大雪 -> 子
  { month: 1, day: 5 }, // 小寒 -> 丑
];

function getMonthPillar(year: number, month: number, day: number) {
  // 确定月支（基于节气）
  let monthZhiIdx: number;
  // 按节气判断属于哪个月
  if (month === 1 && day < JIEQI_SOLAR[11].day) {
    // 小寒前，属于上一年丑月之前的子月
    monthZhiIdx = 0; // 子
  } else if (month === 1) {
    monthZhiIdx = 1; // 丑
  } else if (month === 2 && day < JIEQI_SOLAR[0].day) {
    monthZhiIdx = 1; // 丑
  } else {
    // 寻找对应节气月份
    let found = false;
    for (let i = 0; i < 11; i++) {
      const curr = JIEQI_SOLAR[i];
      const next = JIEQI_SOLAR[i + 1];
      if (month === curr.month && day >= curr.day) {
        if (i + 1 < 11 && month === next.month) {
          continue;
        }
        monthZhiIdx = i + 2; // 寅=2
        found = true;
        break;
      } else if (month > curr.month && (i + 1 >= 11 || month < next.month)) {
        monthZhiIdx = i + 2;
        found = true;
        break;
      } else if (month === curr.month && day < curr.day && i > 0) {
        monthZhiIdx = i + 1;
        found = true;
        break;
      }
    }
    if (!found) {
      monthZhiIdx = 0; // 子 (12月7日后)
    }
  }
  monthZhiIdx = monthZhiIdx % 12;

  // 月干计算：年干决定月干起点
  // 甲己年起丙寅，乙庚年起戊寅，丙辛年起庚寅，丁壬年起壬寅，戊癸年起甲寅
  const yearGanIdx = (year - 4) % 10;
  const monthGanBase = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0]; // 对应年干的月干起点
  const monthGanIdx = (monthGanBase[yearGanIdx] + monthZhiIdx - 2 + 120) % 10;

  return { gan: TIAN_GAN[monthGanIdx], zhi: DI_ZHI[monthZhiIdx] };
}

function getDayPillar(year: number, month: number, day: number) {
  // 日柱计算使用儒略日数法
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  // 以甲子日为基准 (JDN 概算对齐)
  const offset = (jdn - 11 + 60000 * 60) % 60;
  const ganIdx = offset % 10;
  const zhiIdx = offset % 12;
  return { gan: TIAN_GAN[ganIdx], zhi: DI_ZHI[zhiIdx] };
}

function getHourPillar(dayGan: string, hour: number) {
  // 时支
  let zhiIdx: number;
  if (hour === 23 || hour === 0) zhiIdx = 0;
  else zhiIdx = Math.floor((hour + 1) / 2);

  // 时干：日干决定时干起点
  // 甲己日起甲子，乙庚日起丙子，丙辛日起戊子，丁壬日起庚子，戊癸日起壬子
  const dayGanIdx = TIAN_GAN.indexOf(dayGan);
  const hourGanBase = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
  const ganIdx = (hourGanBase[dayGanIdx] + zhiIdx) % 10;

  return { gan: TIAN_GAN[ganIdx], zhi: DI_ZHI[zhiIdx] };
}

function getNaYin(gan: string, zhi: string): string {
  const ganIdx = TIAN_GAN.indexOf(gan);
  const zhiIdx = DI_ZHI.indexOf(zhi);
  const jiaziIdx = ((ganIdx % 10) + ((zhiIdx - ganIdx + 120) % 12) * 5) % 60;
  // 简化计算纳音索引
  const idx60 = ((ganIdx % 10) * 12 + zhiIdx) % 60;
  // 映射到六十甲子顺序
  for (let i = 0; i < 60; i++) {
    const g = i % 10;
    const z = i % 12;
    if (g === ganIdx && z === zhiIdx) {
      return NAYINWUXING[i];
    }
  }
  return NAYINWUXING[0];
}

function analyzeWuXing(pillars: { gan: string; zhi: string }[]) {
  const counts: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  for (const p of pillars) {
    counts[WU_XING_GAN[p.gan]]++;
    counts[WU_XING_ZHI[p.zhi]]++;
  }
  return counts;
}

interface PillarData {
  gan: string;
  zhi: string;
  ganWuXing: string;
  zhiWuXing: string;
  ganYinYang: string;
  zhiYinYang: string;
  naYin: string;
  cangGan: string[];
  shiShen: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BAZI_TOPICS = [
  {
    labelKey: "ai_topic_career",
    icon: "💼",
    prompt: "详细分析我的事业运势和适合的职业方向",
  },
  {
    labelKey: "ai_topic_love",
    icon: "💕",
    prompt: "分析我的感情婚姻运势，包括桃花运和姻缘",
  },
  { labelKey: "ai_topic_wealth", icon: "💰", prompt: "分析我的财运和理财建议" },
  {
    labelKey: "ai_topic_health",
    icon: "🏥",
    prompt: "分析我需要注意的健康问题和养生建议",
  },
  { labelKey: "ai_topic_year", icon: "📅", prompt: "分析我今年的整体运势走向" },
  {
    labelKey: "ai_topic_lucky",
    icon: "🍀",
    prompt: "给我开运建议，包括幸运颜色、方位、数字和注意事项",
  },
];

// ========== 组件 ==========
function FourPillarsTable({
  pillars,
  dayGan,
  titles,
}: {
  pillars: PillarData[];
  dayGan: string;
  titles: string[];
}) {
  const rows = [
    {
      label: "十神",
      render: (p: PillarData) => (
        <span
          className="text-xs font-medium"
          style={{ color: WU_XING_COLORS[p.ganWuXing] }}
        >
          {p.shiShen}
        </span>
      ),
    },
    {
      label: "天干",
      render: (p: PillarData) => (
        <span
          className="text-xl font-black"
          style={{ color: WU_XING_COLORS[p.ganWuXing] }}
        >
          {p.gan}
        </span>
      ),
    },
    {
      label: "",
      render: (p: PillarData) => (
        <span className="text-[10px] text-(--text-muted)">
          {p.ganYinYang}
          {p.ganWuXing}
        </span>
      ),
    },
    {
      label: "地支",
      render: (p: PillarData) => (
        <span
          className="text-xl font-black"
          style={{ color: WU_XING_COLORS[p.zhiWuXing] }}
        >
          {p.zhi}
        </span>
      ),
    },
    {
      label: "",
      render: (p: PillarData) => (
        <span className="text-[10px] text-(--text-muted)">
          {p.zhiYinYang}
          {p.zhiWuXing}
        </span>
      ),
    },
    {
      label: "藏干",
      render: (p: PillarData) => (
        <div className="flex gap-1 justify-center">
          {p.cangGan.map((g, i) => (
            <span
              key={i}
              className="text-xs font-bold"
              style={{ color: WU_XING_COLORS[WU_XING_GAN[g]] }}
            >
              {g}
            </span>
          ))}
        </div>
      ),
    },
    {
      label: "纳音",
      render: (p: PillarData) => (
        <span className="text-[10px] text-(--text-muted)">{p.naYin}</span>
      ),
    },
  ];

  return (
    <table className="w-full text-center border-collapse">
      <thead>
        <tr>
          <th className="w-12" />
          {titles.map((t, i) => (
            <th
              key={i}
              className="pb-2 text-xs font-medium text-(--text-muted)"
            >
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr
            key={ri}
            className={ri === 2 ? "border-b border-(--border-color)" : ""}
          >
            <td className="text-[10px] text-(--text-muted) pr-2 text-right py-0.5">
              {row.label}
            </td>
            {pillars.map((p, pi) => (
              <td key={pi} className="py-1">
                {row.render(p)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const BAZI_CACHE_KEY = "tooldock-bazi-birth";

function loadBirthCache() {
  try {
    const raw = localStorage.getItem(BAZI_CACHE_KEY);
    if (raw)
      return JSON.parse(raw) as {
        year: number;
        month: number;
        day: number;
        hour: number;
        gender: "male" | "female";
      };
  } catch {
    /* ignore */
  }
  return null;
}

function saveBirthCache(data: {
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: "male" | "female";
}) {
  localStorage.setItem(BAZI_CACHE_KEY, JSON.stringify(data));
}

export default function BaziChart() {
  const { t, i18n } = useTranslation();
  const cached = useMemo(() => loadBirthCache(), []);
  const now = new Date();
  const [year, setYear] = useState(cached?.year ?? now.getFullYear());
  const [month, setMonth] = useState(cached?.month ?? now.getMonth() + 1);
  const [day, setDay] = useState(cached?.day ?? now.getDate());
  const [hour, setHour] = useState(cached?.hour ?? now.getHours());
  const [gender, setGender] = useState<"male" | "female">(
    cached?.gender ?? "male",
  );

  useEffect(() => {
    saveBirthCache({ year, month, day, hour, gender });
  }, [year, month, day, hour, gender]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const ai = useSettingsStore((s) => s.ai);
  const [selectedProvider, setSelectedProvider] = useState<string>(
    ai?.activeProvider || "deepseek",
  );

  const availableProviders = useMemo(() => {
    const providers = ai?.providers || {};
    return Object.entries(providers)
      .filter(([, config]) => (config as any)?.apiKey?.trim())
      .map(([id]) => ({
        id,
        label:
          id === "deepseek"
            ? "DeepSeek"
            : id === "doubao"
              ? "豆包"
              : id === "openai"
                ? "OpenAI"
                : "SiliconFlow",
      }));
  }, [ai?.providers]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const result = useMemo(() => {
    if (year < 1900 || year > 2100) return null;

    const yearP = getYearPillar(year);
    const monthP = getMonthPillar(year, month, day);
    const dayP = getDayPillar(year, month, day);
    const hourP = getHourPillar(dayP.gan, hour);

    const dayGan = dayP.gan;

    const makePillarData = (p: { gan: string; zhi: string }): PillarData => ({
      ...p,
      ganWuXing: WU_XING_GAN[p.gan],
      zhiWuXing: WU_XING_ZHI[p.zhi],
      ganYinYang: YIN_YANG_GAN[p.gan],
      zhiYinYang: YIN_YANG_ZHI[p.zhi],
      naYin: getNaYin(p.gan, p.zhi),
      cangGan: DIZHI_CANGGAN[p.zhi],
      shiShen: SHI_SHEN_MAP[dayGan]?.[p.gan] || "",
    });

    const pillars = [yearP, monthP, dayP, hourP];
    const wuxing = analyzeWuXing(pillars);
    const shengXiao = SHENG_XIAO[(year - 4) % 12];

    // 日主强弱简析
    const dayElement = WU_XING_GAN[dayGan];
    const sameCount = wuxing[dayElement] || 0;
    // 生我者 (印)
    const shengMap: Record<string, string> = {
      金: "土",
      木: "水",
      水: "金",
      火: "木",
      土: "火",
    };
    const shengCount = wuxing[shengMap[dayElement]] || 0;
    const totalHelp = sameCount + shengCount;
    const isStrong = totalHelp >= 4;

    // 喜用神简析
    const xiMap: Record<string, string[]> = {
      金: ["水", "木"],
      木: ["火", "土"],
      水: ["木", "火"],
      火: ["土", "金"],
      土: ["金", "水"],
    };
    const jiMap: Record<string, string[]> = {
      金: ["土", "金"],
      木: ["水", "木"],
      水: ["金", "水"],
      火: ["木", "火"],
      土: ["火", "土"],
    };
    const xiyong = isStrong ? xiMap[dayElement] : jiMap[dayElement];

    // 缺失五行
    const queWuXing = Object.entries(wuxing)
      .filter(([, v]) => v === 0)
      .map(([k]) => k);

    return {
      pillars: [
        makePillarData(yearP),
        makePillarData(monthP),
        makePillarData(dayP),
        makePillarData(hourP),
      ],
      wuxing,
      shengXiao,
      dayGan,
      dayElement,
      isStrong,
      xiyong,
      queWuXing,
    };
  }, [year, month, day, hour]);

  const maxWuxing = result ? Math.max(...Object.values(result.wuxing), 1) : 1;

  const buildChartContext = useCallback(() => {
    if (!result) return "";
    const isZh = i18n.language.startsWith("zh");
    const genderStr =
      gender === "male" ? (isZh ? "男" : "Male") : isZh ? "女" : "Female";
    const [yP, mP, dP, hP] = result.pillars;
    const baziStr = `${yP.gan}${yP.zhi} ${mP.gan}${mP.zhi} ${dP.gan}${dP.zhi} ${hP.gan}${hP.zhi}`;
    const pillarsStr = result.pillars
      .map((p, i) => {
        const labels = ["年柱", "月柱", "日柱", "时柱"];
        return `${labels[i]}: ${p.gan}${p.zhi} (${p.ganYinYang}${p.ganWuXing}/${p.zhiYinYang}${p.zhiWuXing}) 纳音:${p.naYin} 藏干:[${p.cangGan.join(",")}] 十神:${p.shiShen}`;
      })
      .join("\n");
    const wuxingStr = Object.entries(result.wuxing)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    const hourZhi = DIZHI_HOUR.find((_, i) =>
      i === 0
        ? hour === 23 || hour === 0
        : hour >= i * 2 - 1 && hour < i * 2 + 1,
    );

    return isZh
      ? `性别：${genderStr}\n出生：${year}年${month}月${day}日 ${hourZhi?.name || ""}时\n八字：${baziStr}\n生肖：${result.shengXiao}\n\n四柱详情：\n${pillarsStr}\n\n五行分布：${wuxingStr}\n五行缺失：${result.queWuXing.length > 0 ? result.queWuXing.join("、") : "无"}\n日主：${result.dayGan}(${result.dayElement}) ${result.isStrong ? "身强" : "身弱"}\n喜神：${result.xiyong[0]} 用神：${result.xiyong[1]}`
      : `Gender: ${genderStr}\nBirth: ${year}-${month}-${day} Hour:${hour}\nBazi: ${baziStr}\nZodiac: ${result.shengXiao}\n\nFour Pillars:\n${pillarsStr}\n\nFive Elements: ${wuxingStr}\nMissing: ${result.queWuXing.length > 0 ? result.queWuXing.join(", ") : "None"}\nDay Master: ${result.dayGan}(${result.dayElement}) ${result.isStrong ? "Strong" : "Weak"}\nFavorable: ${result.xiyong[0]} Useful: ${result.xiyong[1]}`;
  }, [result, gender, year, month, day, hour, i18n.language]);

  const streamingRef = useRef("");

  const callAiStream = useCallback(
    async (
      systemPrompt: string,
      userPrompt: string,
      onUpdate: (text: string) => void,
    ): Promise<string | null> => {
      const config =
        ai?.providers?.[selectedProvider as keyof typeof ai.providers];
      if (!config?.apiKey) {
        setChatError(t("tools.bazi_chart.ai_no_key"));
        return null;
      }

      streamingRef.current = "";
      const unlisten = await listen<string>("ai-stream-chunk", (event) => {
        streamingRef.current += event.payload;
        onUpdate(streamingRef.current);
      });

      try {
        const res = await invokeWrapper<string>("ask_ai_stream", {
          provider: selectedProvider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: (config as any).baseUrl || null,
          systemPrompt,
          userPrompt,
        });
        unlisten();
        if (res.ok) return res.data;
        setChatError(res.message);
        return null;
      } catch (e: any) {
        unlisten();
        setChatError(e.message || String(e));
        return null;
      }
    },
    [ai, selectedProvider, t],
  );

  const handleStartAnalysis = useCallback(async () => {
    if (!result || chatLoading) return;
    setChatMessages([{ role: "assistant", content: "" }]);
    setChatLoading(true);
    setChatError("");

    const isZh = i18n.language.startsWith("zh");
    const chartContext = buildChartContext();

    const systemPrompt = isZh
      ? "你是一位精通中国传统命理学的八字分析大师。请根据用户提供的八字信息进行详细的命理分析。分析要专业、全面，涵盖性格特点、事业、财运、感情、健康等方面。请使用 Markdown 格式回复，使用标题和列表让内容更清晰。注意：分析仅供参考娱乐。"
      : "You are a master of Chinese Bazi (Four Pillars of Destiny) analysis. Analyze the given birth chart comprehensively, covering personality, career, wealth, relationships, and health. Reply in Markdown format with clear headings and lists. Note: This is for entertainment purposes only.";

    const userPrompt = isZh
      ? `请分析以下八字命盘：\n\n${chartContext}\n\n请从以下几个方面进行分析：\n1. 命格概述与性格特点\n2. 事业发展方向\n3. 财运分析\n4. 感情婚姻\n5. 健康建议\n6. 开运建议（颜色、方位、数字等）`
      : `Please analyze the following Bazi chart:\n\n${chartContext}\n\nPlease analyze:\n1. Overview & personality\n2. Career direction\n3. Wealth analysis\n4. Love & marriage\n5. Health advice\n6. Lucky tips (colors, directions, numbers)`;

    await callAiStream(systemPrompt, userPrompt, (text) => {
      setChatMessages([{ role: "assistant", content: text }]);
    });
    setChatLoading(false);
  }, [result, chatLoading, i18n.language, buildChartContext, callAiStream]);

  const handleAskQuestion = useCallback(
    async (question: string) => {
      if (!result || chatLoading || !question.trim()) return;

      const trimmed = question.trim();
      setChatMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setChatInput("");
      setChatLoading(true);
      setChatError("");

      const isZh = i18n.language.startsWith("zh");
      const chartContext = buildChartContext();

      const systemPrompt = isZh
        ? "你是一位精通中国传统命理学的八字分析大师。用户已提供八字命盘信息，请针对用户的具体问题进行专业解答。请使用 Markdown 格式回复。注意：分析仅供参考娱乐。"
        : "You are a master of Chinese Bazi analysis. The user has provided their birth chart. Answer their specific question professionally. Reply in Markdown format. Note: For entertainment only.";

      const recentMessages = chatMessages.slice(-6);
      const historyStr = recentMessages
        .map((m) =>
          m.role === "user"
            ? `用户问：${m.content}`
            : `大师答：${m.content.slice(0, 500)}${m.content.length > 500 ? "..." : ""}`,
        )
        .join("\n\n");

      const userPrompt = isZh
        ? `八字命盘信息：\n${chartContext}\n\n${historyStr ? `之前的对话摘要：\n${historyStr}\n\n` : ""}用户现在的问题：${trimmed}\n\n请针对这个问题，结合命盘信息进行详细解答。`
        : `Birth chart:\n${chartContext}\n\n${historyStr ? `Previous conversation:\n${historyStr}\n\n` : ""}User's question: ${trimmed}\n\nPlease answer based on the chart.`;

      const msgIndex = chatMessages.length + 1;
      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      await callAiStream(systemPrompt, userPrompt, (text) => {
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[msgIndex] = { role: "assistant", content: text };
          return updated;
        });
      });
      setChatLoading(false);
    },
    [
      result,
      chatLoading,
      chatMessages,
      i18n.language,
      buildChartContext,
      callAiStream,
    ],
  );

  return (
    <ToolLayout
      title={t("tools.bazi_chart.name")}
      description={t("tools.bazi_chart.description")}
    >
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* 输入区 */}
        <div className="rounded-xl p-5 border border-(--border-color) bg-(--card-bg)">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-(--text-muted) mb-1.5">
                {t("tools.bazi_chart.year")}
              </label>
              <input
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-main) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-(--text-muted) mb-1.5">
                {t("tools.bazi_chart.month")}
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-main) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                    {t("tools.bazi_chart.month_unit")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-(--text-muted) mb-1.5">
                {t("tools.bazi_chart.day")}
              </label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-main) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                    {t("tools.bazi_chart.day_unit")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-(--text-muted) mb-1.5">
                {t("tools.bazi_chart.hour")}
              </label>
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-main) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {DIZHI_HOUR.map((h, i) => (
                  <option key={i} value={i === 0 ? 23 : i * 2 - 1}>
                    {h.name}时 ({h.range})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-(--text-muted) mb-1.5">
                {t("tools.bazi_chart.gender")}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGender("male")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    gender === "male"
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-(--border-color) text-(--text-muted) hover:bg-(--bg-main)"
                  }`}
                >
                  {t("tools.bazi_chart.male")}
                </button>
                <button
                  onClick={() => setGender("female")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    gender === "female"
                      ? "bg-pink-500 text-white border-pink-500"
                      : "border-(--border-color) text-(--text-muted) hover:bg-(--bg-main)"
                  }`}
                >
                  {t("tools.bazi_chart.female")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <>
            {/* 概要信息条 */}
            <div className="rounded-xl p-4 border border-(--border-color) bg-(--card-bg) flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {[
                {
                  label: t("tools.bazi_chart.zodiac_animal"),
                  value: result.shengXiao,
                },
                {
                  label: t("tools.bazi_chart.day_master"),
                  value: `${result.dayGan}(${result.dayElement})`,
                  color: WU_XING_COLORS[result.dayElement],
                },
                {
                  label: t("tools.bazi_chart.strength"),
                  value: result.isStrong
                    ? t("tools.bazi_chart.strong")
                    : t("tools.bazi_chart.weak"),
                  color: result.isStrong ? "#22c55e" : "#f97316",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs text-(--text-muted)">
                    {item.label}
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={item.color ? { color: item.color } : undefined}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* 四柱排盘 */}
            <div className="rounded-xl p-5 border border-(--border-color) bg-(--card-bg)">
              <h3 className="text-sm font-bold text-(--text-main) mb-3">
                {t("tools.bazi_chart.four_pillars")}
              </h3>
              <FourPillarsTable
                pillars={result.pillars}
                dayGan={result.dayGan}
                titles={[
                  t("tools.bazi_chart.year_pillar"),
                  t("tools.bazi_chart.month_pillar"),
                  t("tools.bazi_chart.day_pillar"),
                  t("tools.bazi_chart.hour_pillar"),
                ]}
              />
            </div>

            {/* 五行 + 喜用神 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 五行分布 */}
              <div className="rounded-xl p-5 border border-(--border-color) bg-(--card-bg)">
                <h3 className="text-sm font-bold text-(--text-main) mb-3">
                  {t("tools.bazi_chart.wuxing_analysis")}
                </h3>
                <div className="space-y-2">
                  {(["金", "木", "水", "火", "土"] as const).map((wx) => {
                    const pct =
                      maxWuxing > 0 ? (result.wuxing[wx] / maxWuxing) * 100 : 0;
                    const c = WU_XING_COLORS[wx];
                    return (
                      <div key={wx} className="flex items-center gap-2">
                        <span
                          className="w-5 text-center text-sm font-bold"
                          style={{ color: c }}
                        >
                          {wx}
                        </span>
                        <div className="flex-1 h-5 rounded bg-(--bg-main) overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{
                              width: `${Math.max(pct, 6)}%`,
                              background: c,
                              opacity: 0.8,
                            }}
                          />
                        </div>
                        <span
                          className="w-5 text-xs font-bold text-right"
                          style={{ color: c }}
                        >
                          {result.wuxing[wx]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {result.queWuXing.length > 0 && (
                  <div className="mt-3 px-3 py-1.5 rounded bg-orange-500/10 text-orange-600 text-xs">
                    {t("tools.bazi_chart.missing_elements")}：
                    {result.queWuXing.join("、")}
                  </div>
                )}
              </div>

              {/* 喜用神 */}
              <div className="rounded-xl p-5 border border-(--border-color) bg-(--card-bg)">
                <h3 className="text-sm font-bold text-(--text-main) mb-3">
                  {t("tools.bazi_chart.xiyongshen")}
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    {
                      label: t("tools.bazi_chart.xi_shen"),
                      value: result.xiyong[0],
                    },
                    {
                      label: t("tools.bazi_chart.yong_shen"),
                      value: result.xiyong[1],
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3 border border-(--border-color) bg-(--bg-main) text-center"
                    >
                      <div className="text-[10px] text-(--text-muted) mb-1">
                        {item.label}
                      </div>
                      <div
                        className="text-2xl font-black"
                        style={{ color: WU_XING_COLORS[item.value] }}
                      >
                        {item.value}
                      </div>
                      <div
                        className="text-[10px] mt-0.5"
                        style={{ color: WU_XING_COLORS[item.value] }}
                      >
                        {WU_XING_COLORS[item.value]
                          ? Object.entries(WU_XING_GAN)
                              .filter(([, v]) => v === item.value)
                              .map(([k]) => k)
                              .join(" ")
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2.5 rounded-lg bg-(--bg-main) text-xs text-(--text-muted) leading-relaxed">
                  {t("tools.bazi_chart.analysis_hint")}
                </div>
              </div>
            </div>

            {/* AI 命理对话 */}
            <div className="rounded-xl border border-(--border-color) bg-(--card-bg) overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3 border-b border-(--border-color) flex items-center justify-between">
                <h3 className="text-base font-bold text-(--text-main)">
                  {t("tools.bazi_chart.ai_analysis")}
                </h3>
                <div className="flex items-center gap-2">
                  {availableProviders.length > 0 ? (
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="text-xs border border-(--border-color) bg-(--bg-main) text-(--text-main) rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40 cursor-pointer"
                    >
                      {availableProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-(--text-muted)">
                      {t("tools.bazi_chart.ai_no_key")}
                    </span>
                  )}
                  {chatMessages.length > 0 && (
                    <button
                      onClick={() => {
                        setChatMessages([]);
                        setChatError("");
                        setChatInput("");
                      }}
                      className="text-xs text-(--text-muted) hover:text-(--text-main) transition-colors px-2 py-1 rounded hover:bg-(--bg-main)"
                    >
                      {t("tools.bazi_chart.ai_clear_chat")}
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div
                className="p-5 space-y-4 max-h-[520px] overflow-y-auto"
                style={{ scrollBehavior: "smooth" }}
              >
                {/* Empty State */}
                {chatMessages.length === 0 && !chatLoading && !chatError && (
                  <div className="text-center py-6">
                    <div className="text-sm text-(--text-muted) mb-5">
                      {t("tools.bazi_chart.ai_hint")}
                    </div>
                    <button
                      onClick={handleStartAnalysis}
                      disabled={chatLoading}
                      className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors mb-5"
                    >
                      {t("tools.bazi_chart.ai_start")}
                    </button>
                    <div className="border-t border-(--border-color) pt-4 mt-2">
                      <div className="text-xs text-(--text-muted) mb-3">
                        {t("tools.bazi_chart.ai_quick_topics")}
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {BAZI_TOPICS.map((topic) => (
                          <button
                            key={topic.labelKey}
                            onClick={() => handleAskQuestion(topic.prompt)}
                            disabled={chatLoading}
                            className="px-3 py-1.5 rounded-full text-xs font-medium border border-(--border-color) text-(--text-muted) hover:bg-(--bg-main) hover:text-(--text-main) transition-colors"
                          >
                            {topic.icon}{" "}
                            {t(`tools.bazi_chart.${topic.labelKey}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages */}
                {chatMessages.map((msg, i) => {
                  if (msg.role === "assistant" && !msg.content) return null;
                  return (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[90%] ${
                          msg.role === "user"
                            ? "bg-blue-500/10 text-(--text-main) rounded-xl rounded-br-sm px-4 py-2.5 border border-blue-500/20"
                            : "bg-(--bg-main) rounded-xl rounded-bl-sm px-4 py-3 border border-(--border-color)"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <p className="text-sm">{msg.content}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none text-(--text-main) [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2 [&_ul]:text-sm [&_ul]:mb-2 [&_ol]:text-sm [&_ol]:mb-2 [&_li]:mb-1 [&_strong]:text-(--text-main)">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            {chatLoading && i === chatMessages.length - 1 && (
                              <span className="inline-block w-1.5 h-4 bg-(--text-muted) animate-pulse rounded-sm ml-0.5 align-middle" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Loading indicator (only when no streaming content yet) */}
                {chatLoading &&
                  (!chatMessages.length ||
                    !chatMessages[chatMessages.length - 1]?.content) && (
                    <div className="flex justify-start">
                      <div className="bg-(--bg-main) rounded-xl rounded-bl-sm px-4 py-3 border border-(--border-color)">
                        <div className="flex items-center gap-2 text-sm text-(--text-muted)">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {t("tools.bazi_chart.ai_analyzing")}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Error */}
                {chatError && (
                  <div className="px-4 py-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
                    {chatError}
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Quick Topics (after first message) */}
              {chatMessages.length > 0 && (
                <div className="px-5 pb-2">
                  <div className="text-xs font-medium text-(--text-muted) mb-2">
                    {t("tools.bazi_chart.ai_quick_topics")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAZI_TOPICS.map((topic) => (
                      <button
                        key={topic.labelKey}
                        onClick={() => handleAskQuestion(topic.prompt)}
                        disabled={chatLoading}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-(--border-color) text-(--text-muted) hover:bg-(--bg-main) hover:text-(--text-main) transition-colors disabled:opacity-50"
                      >
                        {topic.icon} {t(`tools.bazi_chart.${topic.labelKey}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              {chatMessages.length > 0 && (
                <div className="px-5 py-3 border-t border-(--border-color)">
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAskQuestion(chatInput);
                        }
                      }}
                      placeholder={t("tools.bazi_chart.ai_chat_placeholder")}
                      disabled={chatLoading}
                      className="flex-1 px-4 py-2 rounded-lg border border-(--border-color) bg-(--bg-main) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleAskQuestion(chatInput)}
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t("tools.bazi_chart.ai_send")}
                    </button>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-[10px] text-(--text-muted)">
                      {t("tools.bazi_chart.ai_disclaimer")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
