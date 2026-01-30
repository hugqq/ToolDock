import { Info, Star, Pin, List, LayoutGrid, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Tooltip } from "../components/mui";
import { CATEGORIES, TOOLS, Tool } from "../tools/registry";
import { useSettingsStore } from "../stores/useSettingsStore";
import { CATEGORY, CategoryType } from "../constants";

interface HomeProps {
  activeCategory: CategoryType;
  setActiveCategory: (category: CategoryType) => void;
  searchText: string;
  setSearchText: (text: string) => void;
}

export function Home({ activeCategory, setActiveCategory, searchText, setSearchText }: HomeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const favoriteTools = useSettingsStore((state) => state.favoriteTools);
  const pinnedTools = useSettingsStore((state) => state.pinnedTools);
  const toggleFavorite = useSettingsStore((state) => state.toggleFavorite);
  const togglePin = useSettingsStore((state) => state.togglePin);
  const homeViewMode = useSettingsStore((state) => state.homeViewMode);
  const setHomeViewMode = useSettingsStore((state) => state.setHomeViewMode);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const filteredTools = useMemo(() => {
    let filtered = TOOLS.filter((tool) => {
      const name = t(tool.nameKey);
      const desc = t(tool.descriptionKey);
      const matchesSearch =
        name.toLowerCase().includes(searchText.toLowerCase()) ||
        desc.toLowerCase().includes(searchText.toLowerCase());

      const categoryName = t(tool.categoryKey);

      if (activeCategory === CATEGORY.FAVORITES) {
        return matchesSearch && favoriteTools.includes(tool.id);
      }

      const matchesCategory =
        activeCategory === CATEGORY.ALL ||
        categoryName === activeCategory ||
        tool.categoryKey === activeCategory;

      return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
      const aIsPinned = pinnedTools.includes(a.id);
      const bIsPinned = pinnedTools.includes(b.id);

      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;

      const aIndex = TOOLS.findIndex((t) => t.id === a.id);
      const bIndex = TOOLS.findIndex((t) => t.id === b.id);
      return aIndex - bIndex;
    });

    return filtered;
  }, [searchText, activeCategory, t, favoriteTools, pinnedTools]);

  // 按分类分组工具
  const groupedTools = useMemo(() => {
    const groups: Record<string, Tool[]> = {};

    // 置顶工具单独分组
    const pinnedList = filteredTools.filter(tool => pinnedTools.includes(tool.id));
    if (pinnedList.length > 0) {
      groups["pinned"] = pinnedList;
    }

    // 其他工具按分类分组
    filteredTools.forEach((tool) => {
      if (pinnedTools.includes(tool.id)) return; // 已在置顶组，跳过
      const categoryKey = tool.categoryKey;
      if (!groups[categoryKey]) {
        groups[categoryKey] = [];
      }
      groups[categoryKey].push(tool);
    });

    return groups;
  }, [filteredTools, pinnedTools]);

  const handleToolClick = (route: string) => {
    navigate(route);
  };

  const toggleCategory = (categoryKey: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  };

  const renderToolActions = (tool: Tool, isFavorited: boolean, isPinned: boolean) => (
    <div className="flex items-center gap-1">
      <button
        className={`p-1 rounded-md transition-colors ${
          isPinned
            ? "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20"
            : "text-(--text-muted) opacity-0 group-hover:opacity-100 hover:text-orange-500 hover:bg-orange-500/10"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          togglePin(tool.id);
        }}
        title={isPinned ? t("common.unpin") : t("common.pin")}
      >
        <Pin size={14} fill={isPinned ? "currentColor" : "none"} strokeWidth={2} />
      </button>
      <button
        className={`p-1 rounded-md transition-colors ${
          isFavorited
            ? "text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
            : "text-(--text-muted) opacity-0 group-hover:opacity-100 hover:text-yellow-500 hover:bg-yellow-500/10"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(tool.id);
        }}
        title={isFavorited ? t("common.unfavorite") : t("common.favorite")}
      >
        <Star size={14} fill={isFavorited ? "currentColor" : "none"} strokeWidth={2} />
      </button>
    </div>
  );

  // 列表视图
  const renderListView = () => (
    <div className="flex flex-col gap-1">
      <AnimatePresence mode="popLayout">
        {filteredTools.map((tool) => {
          const isFavorited = favoriteTools.includes(tool.id);
          const isPinned = pinnedTools.includes(tool.id);

          return (
            <motion.div
              key={tool.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="group flex items-center gap-3 px-3 py-2 bg-(--card-bg) border border-(--border-color) rounded-lg hover:border-primary hover:bg-(--hover-bg) cursor-pointer"
              onClick={() => handleToolClick(tool.route)}
            >
              <div
                className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg"
                style={{
                  backgroundColor: `${tool.color}15`,
                  color: tool.color,
                }}
              >
                <tool.icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-(--text-main) font-medium truncate">
                    {t(tool.nameKey)}
                  </span>
                  {isPinned && (
                    <Pin size={12} className="text-orange-500 shrink-0" fill="currentColor" />
                  )}
                </div>
                <p className="text-xs text-(--text-muted) truncate">
                  {t(tool.descriptionKey)}
                </p>
              </div>
              {renderToolActions(tool, isFavorited, isPinned)}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  // 分组卡片视图
  const renderGroupedView = () => {
    const categoryOrder = ["pinned", ...CATEGORIES.filter(c => c.name !== CATEGORY.ALL).map(c => c.key)];
    const sortedGroups = Object.entries(groupedTools).sort((a, b) => {
      return categoryOrder.indexOf(a[0]) - categoryOrder.indexOf(b[0]);
    });

    return (
      <div className="flex flex-col gap-6">
        {sortedGroups.map(([categoryKey, tools]) => {
          const isCollapsed = collapsedCategories.has(categoryKey);
          const categoryInfo = CATEGORIES.find(c => c.key === categoryKey);
          const categoryName = categoryKey === "pinned"
            ? t("common.pinned")
            : t(categoryKey);
          const CategoryIcon = categoryKey === "pinned"
            ? Pin
            : categoryInfo?.icon || LayoutGrid;

          return (
            <div key={categoryKey} className="flex flex-col gap-3">
              <button
                className="flex items-center gap-2 text-left group/header hover:opacity-80 transition-opacity"
                onClick={() => toggleCategory(categoryKey)}
              >
                {isCollapsed ? (
                  <ChevronRight size={16} className="text-(--text-muted)" />
                ) : (
                  <ChevronDown size={16} className="text-(--text-muted)" />
                )}
                <CategoryIcon size={18} className="text-(--text-muted)" />
                <span className="text-sm font-semibold text-(--text-main)">
                  {categoryName}
                </span>
                <span className="text-xs text-(--text-muted) bg-(--hover-bg) px-2 py-0.5 rounded-full">
                  {tools.length}
                </span>
              </button>

              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                      {tools.map((tool) => {
                        const isFavorited = favoriteTools.includes(tool.id);
                        const isPinned = pinnedTools.includes(tool.id);

                        return (
                          <motion.div
                            key={tool.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="group relative flex flex-col items-center gap-2 p-4 bg-(--card-bg) border border-(--border-color) rounded-xl hover:border-primary hover:shadow-lg hover:shadow-primary/5 cursor-pointer transition-all"
                            onClick={() => handleToolClick(tool.route)}
                          >
                            <div
                              className="flex items-center justify-center w-10 h-10 rounded-xl transition-transform group-hover:scale-110"
                              style={{
                                backgroundColor: `${tool.color}15`,
                                color: tool.color,
                              }}
                            >
                              <tool.icon size={22} />
                            </div>
                            <span className="text-sm text-(--text-main) font-medium text-center truncate w-full">
                              {t(tool.nameKey)}
                            </span>

                            {/* 悬停操作 */}
                            <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                              <button
                                className={`p-1 rounded transition-all ${
                                  isPinned
                                    ? "text-orange-500 opacity-100"
                                    : "text-(--text-muted) opacity-0 group-hover:opacity-100 hover:text-orange-500"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePin(tool.id);
                                }}
                              >
                                <Pin size={12} fill={isPinned ? "currentColor" : "none"} />
                              </button>
                              <button
                                className={`p-1 rounded transition-all ${
                                  isFavorited
                                    ? "text-yellow-500 opacity-100"
                                    : "text-(--text-muted) opacity-0 group-hover:opacity-100 hover:text-yellow-500"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(tool.id);
                                }}
                              >
                                <Star size={12} fill={isFavorited ? "currentColor" : "none"} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-(--text-main)">
            {activeCategory === CATEGORY.ALL
              ? t("categories.all")
              : activeCategory === CATEGORY.FAVORITES
                ? t("categories.favorites")
                : t(CATEGORIES.find((c) => c.name === activeCategory)?.key || "")}
          </h1>
          <p className="text-(--text-muted) text-xs mt-1">
            {filteredTools.length} {t("home.toolsCount")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
            <input
              type="text"
              placeholder={t("common.search")}
              className="w-64 pl-9 pr-8 py-1.5 text-sm bg-(--card-bg) border border-(--border-color) rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-(--hover-bg) transition-colors"
                title={t("common.clear")}
              >
                <X size={14} className="text-(--text-muted)" />
              </button>
            )}
          </div>

          {/* 视图切换 */}
          <div className="flex items-center gap-1 p-1 bg-(--hover-bg) rounded-lg">
            <Tooltip content={t("home.listView")}>
              <button
                className={`p-1.5 rounded-md transition-all ${
                  homeViewMode === "list"
                    ? "bg-(--card-bg) text-primary shadow-sm"
                    : "text-(--text-muted) hover:text-(--text-main)"
                }`}
                onClick={() => setHomeViewMode("list")}
              >
                <List size={18} />
              </button>
            </Tooltip>
            <Tooltip content={t("home.groupedView")}>
              <button
                className={`p-1.5 rounded-md transition-all ${
                  homeViewMode === "grouped"
                    ? "bg-(--card-bg) text-primary shadow-sm"
                    : "text-(--text-muted) hover:text-(--text-main)"
                }`}
                onClick={() => setHomeViewMode("grouped")}
              >
                <LayoutGrid size={18} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* 工具列表 */}
      {filteredTools.length > 0 ? (
        homeViewMode === "list" ? renderListView() : renderGroupedView()
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-(--text-muted)">
          <Info size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium mb-4">{t("home.noToolsFound")}</p>
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
  );
}
