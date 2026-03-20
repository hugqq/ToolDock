import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/useSettingsStore";
import { invokeWrapper } from "../api";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import {
  Star,
  Heart,
  Briefcase,
  Coins,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Globe,
  Sparkles,
  Hash,
  Palette,
  Compass,
  Users,
  Activity,
  LineChart,
} from "lucide-react";

// ========== 星座数据 ==========
interface ZodiacSign {
  id: string;
  symbol: string;
  element: string;
  dateRange: string;
  rulingPlanet: string;
  color: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

const ZODIAC_SIGNS: ZodiacSign[] = [
  { id: "aries",       symbol: "♈", element: "fire",  dateRange: "3/21 - 4/19",   rulingPlanet: "mars",    color: "#e53935", startMonth: 3,  startDay: 21, endMonth: 4,  endDay: 19 },
  { id: "taurus",      symbol: "♉", element: "earth", dateRange: "4/20 - 5/20",   rulingPlanet: "venus",   color: "#43a047", startMonth: 4,  startDay: 20, endMonth: 5,  endDay: 20 },
  { id: "gemini",      symbol: "♊", element: "air",   dateRange: "5/21 - 6/21",   rulingPlanet: "mercury", color: "#f9a825", startMonth: 5,  startDay: 21, endMonth: 6,  endDay: 21 },
  { id: "cancer",      symbol: "♋", element: "water", dateRange: "6/22 - 7/22",   rulingPlanet: "moon",    color: "#64b5f6", startMonth: 6,  startDay: 22, endMonth: 7,  endDay: 22 },
  { id: "leo",         symbol: "♌", element: "fire",  dateRange: "7/23 - 8/22",   rulingPlanet: "sun",     color: "#ff9800", startMonth: 7,  startDay: 23, endMonth: 8,  endDay: 22 },
  { id: "virgo",       symbol: "♍", element: "earth", dateRange: "8/23 - 9/22",   rulingPlanet: "mercury", color: "#8d6e63", startMonth: 8,  startDay: 23, endMonth: 9,  endDay: 22 },
  { id: "libra",       symbol: "♎", element: "air",   dateRange: "9/23 - 10/23",  rulingPlanet: "venus",   color: "#ec407a", startMonth: 9,  startDay: 23, endMonth: 10, endDay: 23 },
  { id: "scorpio",     symbol: "♏", element: "water", dateRange: "10/24 - 11/22", rulingPlanet: "pluto",   color: "#7b1fa2", startMonth: 10, startDay: 24, endMonth: 11, endDay: 22 },
  { id: "sagittarius", symbol: "♐", element: "fire",  dateRange: "11/23 - 12/21", rulingPlanet: "jupiter", color: "#5c6bc0", startMonth: 11, startDay: 23, endMonth: 12, endDay: 21 },
  { id: "capricorn",   symbol: "♑", element: "earth", dateRange: "12/22 - 1/19",  rulingPlanet: "saturn",  color: "#546e7a", startMonth: 12, startDay: 22, endMonth: 1,  endDay: 19 },
  { id: "aquarius",    symbol: "♒", element: "air",   dateRange: "1/20 - 2/18",   rulingPlanet: "uranus",  color: "#00bcd4", startMonth: 1,  startDay: 20, endMonth: 2,  endDay: 18 },
  { id: "pisces",      symbol: "♓", element: "water", dateRange: "2/19 - 3/20",   rulingPlanet: "neptune", color: "#26a69a", startMonth: 2,  startDay: 19, endMonth: 3,  endDay: 20 },
];

const ELEMENT_COLORS: Record<string, string> = {
  fire: "#e53935",
  earth: "#8d6e63",
  air:   "#f9a825",
  water: "#1e88e5",
};



// ========== 算法 ==========
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateDailyFortune(signIndex: number, date: Date) {
  const seed =
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate() +
    signIndex * 137;
  const rng = seededRandom(seed);

  const overall  = Math.floor(rng() * 5) + 1;
  const love     = Math.floor(rng() * 5) + 1;
  const career   = Math.floor(rng() * 5) + 1;
  const wealth   = Math.floor(rng() * 5) + 1;

  const luckyNumber = Math.floor(rng() * 99) + 1;
  const luckyColors = ["red","blue","green","yellow","purple","orange","pink","white","gold","silver"];
  const luckyColor  = luckyColors[Math.floor(rng() * luckyColors.length)];
  const luckyDirections = ["east","south","west","north","southeast","northeast","southwest","northwest"];
  const luckyDirection  = luckyDirections[Math.floor(rng() * luckyDirections.length)];
  const matchIdx   = Math.floor(rng() * 12);
  const trendVal   = rng();
  const trend: "up" | "down" | "stable" =
    trendVal > 0.6 ? "up" : trendVal > 0.3 ? "stable" : "down";
  const tipIndex = Math.floor(rng() * 6);

  return { overall, love, career, wealth, luckyNumber, luckyColor, luckyDirection, matchIdx, trend, tipIndex };
}

function getSignByDate(month: number, day: number): number {
  for (let i = 0; i < ZODIAC_SIGNS.length; i++) {
    const s = ZODIAC_SIGNS[i];
    if (s.startMonth <= s.endMonth) {
      if (
        (month === s.startMonth && day >= s.startDay) ||
        (month === s.endMonth && day <= s.endDay)
      ) return i;
      if (month > s.startMonth && month < s.endMonth) return i;
    } else {
      if (
        (month === s.startMonth && day >= s.startDay) ||
        (month === s.endMonth && day <= s.endDay)
      ) return i;
      if (month > s.startMonth || month < s.endMonth) return i;
    }
  }
  return 0;
}

// ========== 子组件 ==========
function StarRating({ count, max = 5, color }: { count: number; max?: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < count ? color : "transparent"}
          stroke={i < count ? color : "var(--border-color)"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function FortuneBar({
  icon,
  label,
  stars,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  stars: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-(--border-color) bg-(--card-bg)">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-(--text-muted)">{label}</span>
        </div>
        <span className="text-sm font-bold" style={{ color }}>{stars} / 5</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-(--bg-main) overflow-hidden border border-(--border-color)">
        <div
          className="h-full rounded-full"
          style={{ width: `${(stars / 5) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ========== AI 快速话题 ==========
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ZODIAC_AI_TOPICS = [
  { labelKey: "ai_topic_today",  icon: <Activity size={14} />, prompt: "详细分析今日的整体运势走向和注意事项" },
  { labelKey: "ai_topic_love",   icon: <Heart size={14} />, prompt: "详细分析今日的爱情运势和感情方面的建议" },
  { labelKey: "ai_topic_career", icon: <Briefcase size={14} />, prompt: "分析今日的事业运势和财运，以及适合做的事情" },
  { labelKey: "ai_topic_week",   icon: <LineChart size={14} />, prompt: "预测本周的整体运势变化趋势和重点关注方向" },
  { labelKey: "ai_topic_match",  icon: <Users size={14} />, prompt: "分析与哪些星座最有缘分，以及如何改善人际关系" },
  { labelKey: "ai_topic_advice", icon: <Sparkles size={14} />, prompt: "给出具体的开运建议，包括幸运物品、注意事项和提升运势的方法" },
];

// ========== 主组件 ==========
export default function ZodiacHoroscope() {
  const { t, i18n } = useTranslation();
  const { ai } = useSettingsStore();
  const now = new Date();
  const todaySign = getSignByDate(now.getMonth() + 1, now.getDate());

  const [selectedSign, setSelectedSign] = useState(todaySign);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const sign      = ZODIAC_SIGNS[selectedSign];
  const dateObj   = useMemo(() => new Date(selectedDate), [selectedDate]);
  const fortune   = useMemo(() => generateDailyFortune(selectedSign, dateObj), [selectedSign, dateObj]);
  const matchSign = ZODIAC_SIGNS[fortune.matchIdx];

  const TrendIcon  = fortune.trend === "up" ? TrendingUp : fortune.trend === "down" ? TrendingDown : Minus;
  const trendColor = fortune.trend === "up" ? "#22c55e" : fortune.trend === "down" ? "#ef4444" : "#f97316";

  // ---- AI state ----
  const [selectedProvider, setSelectedProvider] = useState<string>(
    ai?.activeProvider || ""
  );
  const [chatMessages, setChatMessages]   = useState<ChatMessage[]>([]);
  const [chatInput,    setChatInput]      = useState("");
  const [chatLoading,  setChatLoading]    = useState(false);
  const [chatError,    setChatError]      = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamingRef  = useRef("");
  const abortRef      = useRef(false);
  const unlistenRef   = useRef<(() => void) | null>(null);

  const availableProviders = useMemo(() => {
    const providers = Array.isArray(ai?.providers) ? ai!.providers : [];
    return providers.filter((p) => p.apiKey?.trim()).map((p) => ({ id: p.id, label: p.name }));
  }, [ai?.providers]);

  useEffect(() => {
    if (!selectedProvider && availableProviders.length > 0) {
      setSelectedProvider(availableProviders[0].id);
    }
  }, [availableProviders, selectedProvider]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    unlistenRef.current?.();
    unlistenRef.current = null;
    setChatLoading(false);
  }, []);

  const callAiStream = useCallback(
    async (
      systemPrompt: string,
      userPrompt: string,
      onUpdate: (text: string) => void
    ): Promise<string | null> => {
      const providers = Array.isArray(ai?.providers) ? ai!.providers : [];
      const config = providers.find((p) => p.id === selectedProvider);
      if (!config?.apiKey) {
        setChatError(t("tools.zodiac.ai_no_key"));
        return null;
      }

      abortRef.current   = false;
      streamingRef.current = "";
      const unlisten = await listen<string>("ai-stream-chunk", (event) => {
        if (abortRef.current) return;
        streamingRef.current += event.payload;
        onUpdate(streamingRef.current);
      });
      unlistenRef.current = unlisten;

      try {
        const res = await invokeWrapper<string>("ask_ai_stream", {
          provider: selectedProvider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl || null,
          systemPrompt,
          userPrompt,
        });
        unlistenRef.current?.();
        unlistenRef.current = null;
        if (abortRef.current) return null;
        if (res.ok) return res.data;
        setChatError(res.message);
        return null;
      } catch (e: any) {
        unlistenRef.current?.();
        unlistenRef.current = null;
        if (abortRef.current) return null;
        setChatError(e.message || String(e));
        return null;
      }
    },
    [ai, selectedProvider, t]
  );

  const buildContext = useCallback(() => {
    const isZh    = i18n.language.startsWith("zh");
    const signName = t(`tools.zodiac.signs.${sign.id}`);
    const element  = t(`tools.zodiac.elements.${sign.element}`);
    const planet   = t(`tools.zodiac.planets.${sign.rulingPlanet}`);
    const datePart = selectedDate;
    const scoreStr = `综合${fortune.overall}星 爱情${fortune.love}星 事业${fortune.career}星 财运${fortune.wealth}星`;
    const trendStr = t(`tools.zodiac.trend_${fortune.trend}`);
    const luckyStr = `幸运数字${fortune.luckyNumber} 幸运颜色${t(`tools.zodiac.colors.${fortune.luckyColor}`)} 幸运方位${t(`tools.zodiac.directions.${fortune.luckyDirection}`)}`;
    const matchStr = `今日配对${t(`tools.zodiac.signs.${matchSign.id}`)}`;

    return isZh
      ? `星座：${signName}（${sign.dateRange}）\n四象属性：${element} | 守护星：${planet}\n日期：${datePart}\n今日运势评分：${scoreStr} | 趋势：${trendStr}\n幸运信息：${luckyStr} | ${matchStr}\n今日提示：${t(`tools.zodiac.tips.${sign.id}_${fortune.tipIndex}`)}`
      : `Sign: ${signName} (${sign.dateRange})\nElement: ${element} | Ruling Planet: ${planet}\nDate: ${datePart}\nFortune: Overall ${fortune.overall}★ Love ${fortune.love}★ Career ${fortune.career}★ Wealth ${fortune.wealth}★ | Trend: ${trendStr}\nLucky: Number ${fortune.luckyNumber} / ${t(`tools.zodiac.colors.${fortune.luckyColor}`)} / ${t(`tools.zodiac.directions.${fortune.luckyDirection}`)} | Best Match: ${t(`tools.zodiac.signs.${matchSign.id}`)}\nTip: ${t(`tools.zodiac.tips.${sign.id}_${fortune.tipIndex}`)}`;
  }, [sign, selectedDate, fortune, matchSign, t, i18n.language]);

  const handleStartAnalysis = useCallback(async () => {
    if (chatLoading) return;
    setChatMessages([{ role: "assistant", content: "" }]);
    setChatLoading(true);
    setChatError("");

    const isZh = i18n.language.startsWith("zh");
    const context = buildContext();

    const systemPrompt = isZh
      ? "你是一位精通西方占星学的星座大师。请根据用户提供的星座信息进行详细的今日运势解读。分析要专业、细致，涵盖各方面运势详情。请使用 Markdown 格式回复，用标题和列表让内容更清晰。注意：分析仅供参考娱乐。"
      : "You are a master Western astrologer. Provide a detailed daily horoscope reading based on the user's sign info. Cover all aspects of fortune in a professional and insightful way. Reply in Markdown format with clear headings. Note: For entertainment purposes only.";

    const userPrompt = isZh
      ? `请分析以下星座今日运势：\n\n${context}\n\n请从以下几个方面进行详细解读：\n1. 今日综合运势概述\n2. 爱情感情方面\n3. 事业财运方面\n4. 健康与状态\n5. 今日特别提示与建议`
      : `Please analyze this horoscope:\n\n${context}\n\nCover: 1) Overall overview, 2) Love & relationships, 3) Career & finances, 4) Health & wellbeing, 5) Special tips for today.`;

    await callAiStream(systemPrompt, userPrompt, (text) => {
      setChatMessages([{ role: "assistant", content: text }]);
    });
    setChatLoading(false);
  }, [chatLoading, i18n.language, buildContext, callAiStream]);

  const handleAskQuestion = useCallback(
    async (question: string) => {
      if (chatLoading || !question.trim()) return;

      const trimmed = question.trim();
      setChatMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setChatInput("");
      setChatLoading(true);
      setChatError("");

      const isZh = i18n.language.startsWith("zh");
      const context = buildContext();

      const systemPrompt = isZh
        ? "你是一位精通西方占星学的星座大师。用户已提供星座信息，请针对用户的具体问题进行专业解答。请使用 Markdown 格式回复。注意：分析仅供参考娱乐。"
        : "You are a master Western astrologer. The user has provided their sign info. Answer their specific question professionally in Markdown. For entertainment only.";

      const recentHistory = chatMessages
        .slice(-6)
        .map((m) =>
          m.role === "user"
            ? `用户问：${m.content}`
            : `大师答：${m.content.slice(0, 400)}${m.content.length > 400 ? "..." : ""}`
        )
        .join("\n\n");

      const userPrompt = isZh
        ? `星座信息：\n${context}\n\n${recentHistory ? `之前对话：\n${recentHistory}\n\n` : ""}用户问题：${trimmed}`
        : `Sign info:\n${context}\n\n${recentHistory ? `Previous:\n${recentHistory}\n\n` : ""}Question: ${trimmed}`;

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
    [chatLoading, chatMessages, i18n.language, buildContext, callAiStream]
  );

  return (
    <ToolLayout
      title={t("tools.zodiac.name")}
      description={t("tools.zodiac.description")}
    >
      <div className="max-w-4xl mx-auto w-full space-y-6">

        {/* ── 日期 + 星座选择 ── */}
        <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) p-5 space-y-4">
          {/* 日期 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-(--text-muted) shrink-0">日期</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-(--border-color) bg-(--bg-main) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* 星座选择 */}
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {ZODIAC_SIGNS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSelectedSign(i)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all border ${
                  selectedSign === i
                    ? "border-2 shadow-sm"
                    : "border-transparent hover:bg-(--bg-main)"
                }`}
                style={
                  selectedSign === i
                    ? { borderColor: s.color, background: `${s.color}12` }
                    : undefined
                }
              >
                <span className="text-xl leading-none">{s.symbol}</span>
                <span
                  className="text-[9px] font-semibold"
                  style={{ color: selectedSign === i ? s.color : undefined }}
                >
                  {t(`tools.zodiac.signs.${s.id}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 星座主卡片 ── */}
        <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm">
          {/* 头部 */}
          <div className="px-6 py-6 border-b border-(--border-color) bg-(--bg-main)/30">
            <div className="flex items-center gap-6">
              {/* 星座符号 */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl shrink-0 bg-(--bg-main) border border-(--border-color)"
                style={{ color: sign.color }}
              >
                {sign.symbol}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-(--text-main)">
                    {t(`tools.zodiac.signs.${sign.id}`)}
                  </h2>
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-md font-medium border"
                    style={{
                      color: ELEMENT_COLORS[sign.element],
                      borderColor: `${ELEMENT_COLORS[sign.element]}40`,
                      background: `${ELEMENT_COLORS[sign.element]}10`,
                    }}
                  >
                    {t(`tools.zodiac.elements.${sign.element}`)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-(--text-muted) mb-3">
                  <span className="flex items-center gap-1.5"><Calendar size={14} /> {sign.dateRange}</span>
                  <span className="flex items-center gap-1.5">
                    <Globe size={14} /> {t("tools.zodiac.ruling_planet")}：{t(`tools.zodiac.planets.${sign.rulingPlanet}`)}
                  </span>
                </div>

                {/* 综合运势 */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-(--text-main)">
                    {t("tools.zodiac.overall")}
                  </span>
                  <StarRating count={fortune.overall} color={sign.color} />
                  <div className="w-px h-3 bg-(--border-color) mx-1"></div>
                  <div
                    className="flex items-center gap-1 text-sm font-medium"
                    style={{ color: trendColor }}
                  >
                    <TrendIcon size={16} />
                    {t(`tools.zodiac.trend_${fortune.trend}`)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 详细运势 */}
          <div className="p-6 space-y-5">
            {/* 三项运势 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FortuneBar
                icon={<Heart size={15} className="text-pink-500" />}
                label={t("tools.zodiac.love")}
                stars={fortune.love}
                color="#ec407a"
              />
              <FortuneBar
                icon={<Briefcase size={15} className="text-blue-500" />}
                label={t("tools.zodiac.career")}
                stars={fortune.career}
                color="#1e88e5"
              />
              <FortuneBar
                icon={<Coins size={15} className="text-yellow-600" />}
                label={t("tools.zodiac.wealth")}
                stars={fortune.wealth}
                color="#f9a825"
              />
            </div>

            {/* 幸运信息 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: t("tools.zodiac.lucky_number"),
                  value: String(fortune.luckyNumber),
                  icon: <Hash size={20} className="text-blue-500" />,
                },
                {
                  label: t("tools.zodiac.lucky_color"),
                  value: t(`tools.zodiac.colors.${fortune.luckyColor}`),
                  icon: <Palette size={20} className="text-pink-500" />,
                },
                {
                  label: t("tools.zodiac.lucky_direction"),
                  value: t(`tools.zodiac.directions.${fortune.luckyDirection}`),
                  icon: <Compass size={20} className="text-emerald-500" />,
                },
                {
                  label: t("tools.zodiac.best_match"),
                  value: `${matchSign.symbol} ${t(`tools.zodiac.signs.${matchSign.id}`)}`,
                  icon: <Heart size={20} className="text-red-500" />,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-xl border border-(--border-color) bg-(--bg-main)"
                >
                  <div className="p-2 rounded-lg bg-(--card-bg) shadow-xs border border-(--border-color)">
                    {item.icon}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-(--text-muted) mb-0.5">
                      {item.label}
                    </span>
                    <span className="text-sm font-medium text-(--text-main) truncate">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 今日提示 */}
            <div className="p-4 rounded-xl border border-(--border-color) bg-(--bg-main)">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Sparkles size={18} style={{ color: sign.color }} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-(--text-main) mb-1.5">
                    {t("tools.zodiac.daily_tip")}
                  </h4>
                  <p className="text-sm text-(--text-muted) leading-relaxed">
                    {t(`tools.zodiac.tips.${sign.id}_${fortune.tipIndex}`)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI 分析区 ── */}
        <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-(--border-color) flex items-center justify-between">
            <h3 className="text-base font-bold text-(--text-main)">
              {t("tools.zodiac.ai_analysis")}
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
                  {t("tools.zodiac.ai_no_key")}
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
                  {t("tools.zodiac.ai_clear_chat")}
                </button>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div
            className="p-5 space-y-4 max-h-[480px] overflow-y-auto"
            style={{ scrollBehavior: "smooth" }}
          >
            {/* Empty state */}
            {chatMessages.length === 0 && !chatLoading && !chatError && (
              <div className="text-center py-8">
                <div className="text-sm text-(--text-muted) mb-5">
                  {t("tools.zodiac.ai_hint")}
                </div>
                
                <button
                  onClick={handleStartAnalysis}
                  disabled={chatLoading}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors mb-6 shadow-sm"
                >
                  {t("tools.zodiac.ai_start")}
                </button>

                <div className="border-t border-(--border-color) pt-5">
                  <div className="text-xs text-(--text-muted) mb-3">
                    {t("tools.zodiac.ai_quick_topics")}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {ZODIAC_AI_TOPICS.map((topic) => (
                      <button
                        key={topic.labelKey}
                        onClick={() => handleAskQuestion(topic.prompt)}
                        disabled={chatLoading}
                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-(--border-color) text-(--text-muted) hover:bg-(--bg-main) hover:text-(--text-main) transition-colors"
                      >
                        <span className="mr-1.5 opacity-80">{topic.icon}</span>
                        {t(`tools.zodiac.${topic.labelKey}`)}
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

            {/* Loading spinner */}
            {chatLoading &&
              (!chatMessages.length ||
                !chatMessages[chatMessages.length - 1]?.content) && (
                <div className="flex justify-start">
                  <div className="bg-(--bg-main) rounded-xl rounded-bl-sm px-4 py-3 border border-(--border-color)">
                    <div className="flex items-center gap-2 text-sm text-(--text-muted)">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t("tools.zodiac.ai_analyzing")}
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

          {/* Quick topics (after first message) */}
          {chatMessages.length > 0 && (
            <div className="px-5 pb-2">
              <div className="text-xs text-(--text-muted) mb-2">
                {t("tools.zodiac.ai_quick_topics")}
              </div>
              <div className="flex flex-wrap gap-2">
                {ZODIAC_AI_TOPICS.map((topic) => (
                  <button
                    key={topic.labelKey}
                    onClick={() => handleAskQuestion(topic.prompt)}
                    disabled={chatLoading}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-(--border-color) text-(--text-muted) hover:bg-(--bg-main) hover:text-(--text-main) transition-colors disabled:opacity-50"
                  >
                    <span className="mr-1 opacity-80">{topic.icon}</span>
                    {t(`tools.zodiac.${topic.labelKey}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
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
                  placeholder={t("tools.zodiac.ai_chat_placeholder")}
                  disabled={chatLoading}
                  className="flex-1 px-4 py-2 rounded-lg border border-(--border-color) bg-(--bg-main) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                />
                {chatLoading ? (
                  <button
                    onClick={handleStop}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    {t("tools.zodiac.ai_stop")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleAskQuestion(chatInput)}
                    disabled={!chatInput.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("tools.zodiac.ai_send")}
                  </button>
                )}
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-(--text-muted)">
                  {t("tools.zodiac.ai_disclaimer")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
