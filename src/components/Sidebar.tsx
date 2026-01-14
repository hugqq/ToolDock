import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Menu,
  ChevronRight as ChevronRightIcon,
  LayoutGrid,
  Languages,
  Sun,
  Moon,
  Settings as SettingsIcon,
  Info,
  Star,
} from "lucide-react";
import { CATEGORIES } from "../tools/registry";
import { useTheme } from "./ThemeContext";
import { AboutDialog } from "./AboutDialog";
import { useSettingsStore } from "../stores/useSettingsStore";
import { CATEGORY } from "../constants";
import logo from "../assets/logo.svg";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  activeCategory,
  setActiveCategory,
}) => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const favoriteTools = useSettingsStore((state) => state.favoriteTools);
  const hasFavorites = favoriteTools.length > 0;

  const handleCategoryClick = (catName: string) => {
    setActiveCategory(catName);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "zh-CN" ? "en" : "zh-CN";
    i18n.changeLanguage(newLang);
  };

  return (
    <aside
      className={`flex flex-col shrink-0 z-10 border-r border-sidebar-border bg-sidebar text-sidebar-text transition-all duration-200 ease-in-out overflow-hidden ${
        isCollapsed ? "w-[72px]" : "w-[240px]"
      }`}
    >
      <div
        className={`h-[72px] flex items-center transition-all duration-200 ${
          isCollapsed ? "justify-center px-0" : "justify-between px-6"
        }`}
      >
        <div
          className={`flex items-center cursor-pointer transition-all duration-200 ${
            isCollapsed ? "" : "gap-3"
          }`}
          onClick={() => navigate("/")}
        >
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <img src={logo} alt="ToolDock Logo" className="w-8 h-8" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
              ToolDock
            </span>
          )}
        </div>
        {!isCollapsed && (
          <button
            className="p-2 rounded-md hover:bg-sidebar-hover transition-all duration-200 shrink-0"
            onClick={() => setIsCollapsed(true)}
            title={t("common.collapse")}
          >
            <Menu size={20} />
          </button>
        )}
      </div>

      <nav
        className={`flex-1 py-4 flex flex-col gap-1 overflow-y-auto transition-all duration-200 ${
          isCollapsed ? "px-2" : "px-3"
        }`}
      >
        <button
          className={`flex items-center transition-all duration-200 group overflow-hidden ${
            isCollapsed ? "justify-center px-0" : "px-3 gap-3"
          } py-2.5 rounded-lg ${
            location.pathname === "/" && activeCategory === CATEGORY.ALL
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text"
          }`}
          onClick={() => handleCategoryClick(CATEGORY.ALL)}
          title={isCollapsed ? t("categories.all") : ""}
        >
          <LayoutGrid size={18} className="flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-medium whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
              {t("categories.all")}
            </span>
          )}
        </button>

        {hasFavorites && (
          <button
            className={`flex items-center transition-all duration-200 group overflow-hidden ${
              isCollapsed ? "justify-center px-0" : "px-3 gap-3"
            } py-2.5 rounded-lg ${
              location.pathname === "/" && activeCategory === CATEGORY.FAVORITES
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text"
            }`}
            onClick={() => handleCategoryClick(CATEGORY.FAVORITES)}
            title={isCollapsed ? t("categories.favorites") : ""}
          >
            <Star size={18} className="flex-shrink-0" />
            {!isCollapsed && (
              <span className="font-medium whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
                {t("categories.favorites")}
              </span>
            )}
          </button>
        )}

        {CATEGORIES.filter((c) => c.name !== CATEGORY.ALL).map((cat) => (
          <button
            key={cat.name}
            className={`flex items-center transition-all duration-200 group overflow-hidden ${
              isCollapsed ? "justify-center px-0" : "px-3 gap-3"
            } py-2.5 rounded-lg ${
              location.pathname === "/" && activeCategory === cat.name
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text"
            }`}
            onClick={() => handleCategoryClick(cat.name)}
            title={isCollapsed ? t(cat.key) : ""}
          >
            <cat.icon size={18} className="flex-shrink-0" />
            {!isCollapsed && (
              <span className="font-medium whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
                {t(cat.key)}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div
        className={`border-t border-sidebar-border flex flex-col gap-2 transition-all duration-200 ${
          isCollapsed ? "p-2" : "p-4"
        }`}
      >
        {isCollapsed && (
          <button
            className="flex items-center justify-center p-2 rounded-lg hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text transition-colors mb-2"
            onClick={() => setIsCollapsed(false)}
            title={t("common.expand")}
          >
            <ChevronRightIcon size={20} />
          </button>
        )}
        <div className="flex flex-col gap-1">
          <button
            className={`flex items-center transition-all duration-200 overflow-hidden ${
              isCollapsed ? "justify-center px-0" : "px-3 gap-3"
            } py-2 rounded-lg ${
              location.pathname === "/settings"
                ? "bg-primary text-white"
                : "hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text"
            }`}
            onClick={() => navigate("/settings")}
            title={t("tools.settings.name")}
          >
            <SettingsIcon size={18} className="flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-medium whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
                {t("tools.settings.name")}
              </span>
            )}
          </button>
          <button
            className={`flex items-center transition-all duration-200 overflow-hidden ${
              isCollapsed ? "justify-center px-0" : "px-3 gap-3"
            } py-2 rounded-lg hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text`}
            onClick={toggleLanguage}
            title={i18n.language === "zh-CN" ? "English" : "中文"}
          >
            <Languages size={18} className="flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-medium whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
                {i18n.language === "zh-CN" ? "English" : "中文"}
              </span>
            )}
          </button>
          <button
            className={`flex items-center transition-all duration-200 overflow-hidden ${
              isCollapsed ? "justify-center px-0" : "px-3 gap-3"
            } py-2 rounded-lg hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text`}
            onClick={toggleTheme}
            title={t("common.theme")}
          >
            {theme === "light" ? (
              <Moon size={18} className="flex-shrink-0" />
            ) : (
              <Sun size={18} className="flex-shrink-0" />
            )}
            {!isCollapsed && (
              <span className="text-sm font-medium whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
                {t("common.theme")}
              </span>
            )}
          </button>
          <button
            className={`flex items-center transition-all duration-200 overflow-hidden ${
              isCollapsed ? "justify-center px-0" : "px-3 gap-3"
            } py-2 rounded-lg hover:bg-sidebar-hover text-sidebar-muted hover:text-sidebar-text`}
            onClick={() => setIsAboutOpen(true)}
            title={t("common.about")}
          >
            <Info size={18} className="flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-medium whitespace-nowrap opacity-100 translate-x-0 transition-all duration-200">
                {t("common.about")}
              </span>
            )}
          </button>
        </div>
        <div
          className={`px-3 py-2 text-[10px] uppercase tracking-wider text-sidebar-muted font-bold transition-all duration-200 overflow-hidden ${
            isCollapsed ? "opacity-0 h-0 p-0" : "opacity-100 h-auto"
          }`}
        >
          {t("common.version")} v1.0.0
        </div>
      </div>
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </aside>
  );
};
