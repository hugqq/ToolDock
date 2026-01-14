import { Info, Search, X, Star, Pin } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Tooltip } from "../components/mui";
import { CATEGORIES, TOOLS } from "../tools/registry";
import { useSettingsStore } from "../stores/useSettingsStore";
import { CATEGORY, CategoryType } from "../constants";

interface HomeProps {
  activeCategory: CategoryType;
  setActiveCategory: (category: CategoryType) => void;
}

export function Home({ activeCategory, setActiveCategory }: HomeProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();
  const favoriteTools = useSettingsStore((state) => state.favoriteTools);
  const pinnedTools = useSettingsStore((state) => state.pinnedTools);
  const toggleFavorite = useSettingsStore((state) => state.toggleFavorite);
  const togglePin = useSettingsStore((state) => state.togglePin);

  const filteredTools = useMemo(() => {
    let filtered = TOOLS.filter((tool) => {
      const name = t(tool.nameKey);
      const desc = t(tool.descriptionKey);
      const matchesSearch =
        name.toLowerCase().includes(searchText.toLowerCase()) ||
        desc.toLowerCase().includes(searchText.toLowerCase());

      // 获取分类的翻译名称进行匹配
      const categoryName = t(tool.categoryKey);

      // 如果选择收藏夹分类，只显示收藏的工具
      if (activeCategory === CATEGORY.FAVORITES) {
        return matchesSearch && favoriteTools.includes(tool.id);
      }

      const matchesCategory =
        activeCategory === CATEGORY.ALL ||
        categoryName === activeCategory ||
        tool.categoryKey === activeCategory;

      return matchesSearch && matchesCategory;
    });

    // 排序：置顶的在最前面，然后是其他工具（保持原始顺序）
    filtered.sort((a, b) => {
      const aIsPinned = pinnedTools.includes(a.id);
      const bIsPinned = pinnedTools.includes(b.id);

      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;

      // 保持原始顺序，避免不必要的重排
      const aIndex = TOOLS.findIndex((t) => t.id === a.id);
      const bIndex = TOOLS.findIndex((t) => t.id === b.id);
      return aIndex - bIndex;
    });

    return filtered;
  }, [searchText, activeCategory, t, favoriteTools, pinnedTools]);

  const handleToolClick = (route: string) => {
    navigate(route);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="h-16 px-8 flex items-center justify-between border-b border-(--border-color) bg-(--card-bg) sticky top-0 z-10">
        <div className="relative w-full max-w-md group">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted) group-focus-within:text-primary transition-colors"
          />
          <input
            type="text"
            placeholder={t("common.search")}
            className="w-full pl-10! pr-10! py-2 bg-(--bg-main) border border-(--border-color) rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <Button
              variant="text"
              size="small"
              className="absolute! right-3 top-1/2 -translate-y-1/2 p-1 rounded-full min-w-0"
              onClick={() => setSearchText("")}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-(--text-main) mb-2">
            {activeCategory === CATEGORY.ALL
              ? t("categories.all")
              : activeCategory === CATEGORY.FAVORITES
              ? t("categories.favorites")
              : t(CATEGORIES.find((c) => c.name === activeCategory)?.key || "")}
          </h1>
          <p className="text-(--text-muted) text-sm">
            {filteredTools.length} {t("common.all")}
          </p>
        </div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          layout
        >
          <AnimatePresence mode="popLayout">
            {filteredTools.map((tool) => {
              const isFavorited = favoriteTools.includes(tool.id);
              const isPinned = pinnedTools.includes(tool.id);

              return (
                <Tooltip key={tool.id} content={t(tool.descriptionKey)}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                      layout: { duration: 0.3, ease: "easeInOut" },
                      opacity: { duration: 0.2 },
                      scale: { duration: 0.2 },
                    }}
                    className="group relative flex flex-col gap-2 p-4 bg-(--card-bg) border border-(--border-color) rounded-2xl hover:border-primary hover:shadow-xl hover:shadow-primary/5 overflow-hidden cursor-pointer"
                    onClick={() => handleToolClick(tool.route)}
                  >
                    {/* 主内容区 */}
                    <div className="flex flex-col items-center w-full">
                      <div
                        className="flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 w-12 h-12 rounded-xl mb-2"
                        style={{
                          backgroundColor: `${tool.color}10`,
                          color: tool.color,
                        }}
                      >
                        <tool.icon size={28} />
                      </div>

                      <div className="flex-1 min-w-0 text-center w-full">
                        <h3 className="text-(--text-main) truncate font-bold">
                          {t(tool.nameKey)}
                        </h3>
                      </div>
                    </div>

                    {/* 悬停操作按钮 */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 transition-opacity">
                      {/* 置顶按钮 - 置顶时始终显示，未置顶时悬停显示 */}
                      <button
                        className={`p-1 rounded-md transition-colors ${
                          isPinned
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        } ${
                          isPinned
                            ? "text-orange-600 bg-orange-500/10 hover:bg-orange-500/20"
                            : "text-(--text-muted) hover:text-orange-600 hover:bg-orange-500/10"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(tool.id);
                        }}
                        title={isPinned ? t("common.unpin") : t("common.pin")}
                      >
                        <Pin
                          size={14}
                          fill={isPinned ? "currentColor" : "none"}
                          strokeWidth={2}
                        />
                      </button>

                      {/* 收藏按钮 - 仅悬停时显示 */}
                      <button
                        className={`p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${
                          isFavorited
                            ? "text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20"
                            : "text-(--text-muted) hover:text-yellow-600 hover:bg-yellow-500/10"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(tool.id);
                        }}
                        title={
                          isFavorited
                            ? t("common.unfavorite")
                            : t("common.favorite")
                        }
                      >
                        <Star
                          size={14}
                          fill={isFavorited ? "currentColor" : "none"}
                          strokeWidth={2}
                        />
                      </button>
                    </div>
                  </motion.div>
                </Tooltip>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {filteredTools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-(--text-muted)">
            <Info size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium mb-4">{t("common.error")}</p>
            <Button
              variant="contained"
              size="large"
              className="px-6 py-2 rounded-xl shadow-lg shadow-primary/20"
              onClick={() => {
                setSearchText("");
                setActiveCategory(CATEGORY.ALL);
              }}
            >
              {t("common.back")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
