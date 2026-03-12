import { useState, useMemo } from "react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { useTranslation } from "react-i18next";
import { Star, Heart, Briefcase, Coins, TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  { id: "aries", symbol: "♈", element: "fire", dateRange: "3/21 - 4/19", rulingPlanet: "mars", color: "#e53935", startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { id: "taurus", symbol: "♉", element: "earth", dateRange: "4/20 - 5/20", rulingPlanet: "venus", color: "#43a047", startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { id: "gemini", symbol: "♊", element: "air", dateRange: "5/21 - 6/21", rulingPlanet: "mercury", color: "#fdd835", startMonth: 5, startDay: 21, endMonth: 6, endDay: 21 },
  { id: "cancer", symbol: "♋", element: "water", dateRange: "6/22 - 7/22", rulingPlanet: "moon", color: "#90caf9", startMonth: 6, startDay: 22, endMonth: 7, endDay: 22 },
  { id: "leo", symbol: "♌", element: "fire", dateRange: "7/23 - 8/22", rulingPlanet: "sun", color: "#ff9800", startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { id: "virgo", symbol: "♍", element: "earth", dateRange: "8/23 - 9/22", rulingPlanet: "mercury", color: "#8d6e63", startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { id: "libra", symbol: "♎", element: "air", dateRange: "9/23 - 10/23", rulingPlanet: "venus", color: "#ec407a", startMonth: 9, startDay: 23, endMonth: 10, endDay: 23 },
  { id: "scorpio", symbol: "♏", element: "water", dateRange: "10/24 - 11/22", rulingPlanet: "pluto", color: "#7b1fa2", startMonth: 10, startDay: 24, endMonth: 11, endDay: 22 },
  { id: "sagittarius", symbol: "♐", element: "fire", dateRange: "11/23 - 12/21", rulingPlanet: "jupiter", color: "#5c6bc0", startMonth: 11, startDay: 23, endMonth: 12, endDay: 21 },
  { id: "capricorn", symbol: "♑", element: "earth", dateRange: "12/22 - 1/19", rulingPlanet: "saturn", color: "#546e7a", startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { id: "aquarius", symbol: "♒", element: "air", dateRange: "1/20 - 2/18", rulingPlanet: "uranus", color: "#00bcd4", startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { id: "pisces", symbol: "♓", element: "water", dateRange: "2/19 - 3/20", rulingPlanet: "neptune", color: "#26a69a", startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
];

const ELEMENT_COLORS: Record<string, string> = {
  fire: "#e53935",
  earth: "#8d6e63",
  air: "#fdd835",
  water: "#1e88e5",
};

// 基于日期的伪随机种子生成器（使每天运势固定）
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateDailyFortune(signIndex: number, date: Date) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate() + signIndex * 137;
  const rng = seededRandom(seed);

  const overall = Math.floor(rng() * 5) + 1;      // 1-5 stars
  const love = Math.floor(rng() * 5) + 1;
  const career = Math.floor(rng() * 5) + 1;
  const wealth = Math.floor(rng() * 5) + 1;

  const luckyNumber = Math.floor(rng() * 99) + 1;

  const luckyColors = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "white", "gold", "silver"];
  const luckyColor = luckyColors[Math.floor(rng() * luckyColors.length)];

  const luckyDirections = ["east", "south", "west", "north", "southeast", "northeast", "southwest", "northwest"];
  const luckyDirection = luckyDirections[Math.floor(rng() * luckyDirections.length)];

  // 配对星座
  const matchIdx = Math.floor(rng() * 12);

  // 运势趋势
  const trendVal = rng();
  const trend: "up" | "down" | "stable" = trendVal > 0.6 ? "up" : trendVal > 0.3 ? "stable" : "down";

  // 今日提示索引
  const tipIndex = Math.floor(rng() * 6);

  return { overall, love, career, wealth, luckyNumber, luckyColor, luckyDirection, matchIdx, trend, tipIndex };
}

function getSignByDate(month: number, day: number): number {
  for (let i = 0; i < ZODIAC_SIGNS.length; i++) {
    const s = ZODIAC_SIGNS[i];
    if (s.startMonth <= s.endMonth) {
      if ((month === s.startMonth && day >= s.startDay) || (month === s.endMonth && day <= s.endDay)) return i;
      if (month > s.startMonth && month < s.endMonth) return i;
    } else {
      if ((month === s.startMonth && day >= s.startDay) || (month === s.endMonth && day <= s.endDay)) return i;
      if (month > s.startMonth || month < s.endMonth) return i;
    }
  }
  return 0;
}

// ========== 组件 ==========
function StarRating({ count, max = 5, color }: { count: number; max?: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={16}
          fill={i < count ? color : "transparent"}
          stroke={i < count ? color : "var(--text-muted)"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function FortuneItem({ icon, label, stars, color }: { icon: React.ReactNode; label: string; stars: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-(--text-main) font-medium">{label}</span>
      </div>
      <StarRating count={stars} color={color} />
    </div>
  );
}

export default function ZodiacHoroscope() {
  const { t } = useTranslation();
  const now = new Date();
  const todaySign = getSignByDate(now.getMonth() + 1, now.getDate());
  const [selectedSign, setSelectedSign] = useState(todaySign);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const sign = ZODIAC_SIGNS[selectedSign];
  const dateObj = useMemo(() => new Date(selectedDate), [selectedDate]);
  const fortune = useMemo(() => generateDailyFortune(selectedSign, dateObj), [selectedSign, dateObj]);
  const matchSign = ZODIAC_SIGNS[fortune.matchIdx];

  const TrendIcon = fortune.trend === "up" ? TrendingUp : fortune.trend === "down" ? TrendingDown : Minus;
  const trendColor = fortune.trend === "up" ? "#4caf50" : fortune.trend === "down" ? "#f44336" : "#ff9800";

  return (
    <ToolLayout title={t("tools.zodiac.name")} description={t("tools.zodiac.description")}>
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* 日期选择 */}
        <div className="flex justify-center">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-lg border border-(--border-color) bg-(--card-bg) text-(--text-main) text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* 星座选择网格 */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
          {ZODIAC_SIGNS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedSign(i)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all border ${
                selectedSign === i
                  ? "border-blue-500 bg-blue-500/10 shadow-sm"
                  : "border-transparent hover:bg-(--bg-main)"
              }`}
            >
              <span className="text-2xl">{s.symbol}</span>
              <span className="text-[10px] text-(--text-muted) font-medium">{t(`tools.zodiac.signs.${s.id}`)}</span>
            </button>
          ))}
        </div>

        {/* 当前星座卡片 */}
        <div className="rounded-xl border border-(--border-color) bg-(--card-bg) overflow-hidden">
          {/* 星座头部 */}
          <div
            className="px-6 py-5 flex items-center gap-5"
            style={{ background: `linear-gradient(135deg, ${sign.color}20, ${sign.color}08)` }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl shadow-sm border"
              style={{ background: `${sign.color}15`, borderColor: `${sign.color}30` }}
            >
              {sign.symbol}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-(--text-main)">{t(`tools.zodiac.signs.${sign.id}`)}</h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ color: ELEMENT_COLORS[sign.element], background: `${ELEMENT_COLORS[sign.element]}20` }}
                >
                  {t(`tools.zodiac.elements.${sign.element}`)}
                </span>
              </div>
              <div className="text-sm text-(--text-muted) mt-1 space-x-4">
                <span>{sign.dateRange}</span>
                <span>{t("tools.zodiac.ruling_planet")}：{t(`tools.zodiac.planets.${sign.rulingPlanet}`)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-(--text-muted)">{t("tools.zodiac.overall")}：</span>
                <StarRating count={fortune.overall} color={sign.color} />
                <TrendIcon size={16} color={trendColor} className="ml-2" />
                <span className="text-xs font-medium" style={{ color: trendColor }}>
                  {t(`tools.zodiac.trend_${fortune.trend}`)}
                </span>
              </div>
            </div>
          </div>

          {/* 详细运势 */}
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <FortuneItem
                icon={<Heart size={16} className="text-pink-500" />}
                label={t("tools.zodiac.love")}
                stars={fortune.love}
                color="#ec407a"
              />
              <FortuneItem
                icon={<Briefcase size={16} className="text-blue-500" />}
                label={t("tools.zodiac.career")}
                stars={fortune.career}
                color="#1e88e5"
              />
              <FortuneItem
                icon={<Coins size={16} className="text-yellow-600" />}
                label={t("tools.zodiac.wealth")}
                stars={fortune.wealth}
                color="#f9a825"
              />
            </div>

            {/* 幸运信息 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-(--bg-main) text-center">
                <div className="text-xs text-(--text-muted) mb-1">{t("tools.zodiac.lucky_number")}</div>
                <div className="text-xl font-bold text-(--text-main)">{fortune.luckyNumber}</div>
              </div>
              <div className="p-3 rounded-lg bg-(--bg-main) text-center">
                <div className="text-xs text-(--text-muted) mb-1">{t("tools.zodiac.lucky_color")}</div>
                <div className="text-base font-bold text-(--text-main)">{t(`tools.zodiac.colors.${fortune.luckyColor}`)}</div>
              </div>
              <div className="p-3 rounded-lg bg-(--bg-main) text-center">
                <div className="text-xs text-(--text-muted) mb-1">{t("tools.zodiac.lucky_direction")}</div>
                <div className="text-base font-bold text-(--text-main)">{t(`tools.zodiac.directions.${fortune.luckyDirection}`)}</div>
              </div>
              <div className="p-3 rounded-lg bg-(--bg-main) text-center">
                <div className="text-xs text-(--text-muted) mb-1">{t("tools.zodiac.best_match")}</div>
                <div className="text-xl font-bold text-(--text-main)">{matchSign.symbol} {t(`tools.zodiac.signs.${matchSign.id}`)}</div>
              </div>
            </div>

            {/* 今日提示 */}
            <div className="mt-5 p-4 rounded-lg border border-(--border-color) bg-(--bg-main)">
              <h4 className="text-sm font-bold text-(--text-main) mb-2">{t("tools.zodiac.daily_tip")}</h4>
              <p className="text-sm text-(--text-muted) leading-relaxed">
                {t(`tools.zodiac.tips.${sign.id}_${fortune.tipIndex}`)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
