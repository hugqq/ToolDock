import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X as CloseIcon, Search, X as ClearIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TitleBarProps {
    searchText: string;
    setSearchText: (text: string) => void;
    isSearchOpen: boolean;
    setIsSearchOpen: (open: boolean) => void;
}

/**
 * 自定义窗口标题栏组件
 * 提供最小化、最大化/还原、退出功能
 * 支持拖拽移动窗口
 * 集成搜索功能
 */
export function TitleBar({ searchText, setSearchText, isSearchOpen, setIsSearchOpen }: TitleBarProps) {
    const { t } = useTranslation();
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const appWindow = getCurrentWindow();

        // 初始化时检查窗口状态
        appWindow.isMaximized().then(setIsMaximized);

        // 监听窗口大小变化事件
        const unlisten = appWindow.onResized(async () => {
            const maximized = await appWindow.isMaximized();
            setIsMaximized(maximized);
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    // ESC键监听:关闭搜索框
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSearchOpen) {
                setIsSearchOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSearchOpen, setIsSearchOpen]);

    const handleMinimize = async () => {
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
    };

    const handleMaximize = async () => {
        const appWindow = getCurrentWindow();
        if (isMaximized) {
            await appWindow.unmaximize();
        } else {
            await appWindow.maximize();
        }
    };

    const handleClose = async () => {
        const appWindow = getCurrentWindow();
        await appWindow.close();
    };

    const handleSearchClick = () => {
        setIsSearchOpen(!isSearchOpen);
        if (!isSearchOpen) {
            // 展开时自动聚焦搜索框
            setTimeout(() => {
                document.getElementById("titlebar-search-input")?.focus();
            }, 100);
        }
    };

    return (
        <div
            data-tauri-drag-region
            className="h-8 flex items-center justify-between px-4 bg-(--bg-main) border-b border-(--border-color) select-none"
        >
            {/* 应用标题 */}
            <div
                data-tauri-drag-region
                className="flex-1 text-[13px] font-semibold tracking-wide text-(--text-main)"
                style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}
            >
                <span data-tauri-drag-region>ToolDock</span>
            </div>

            {/* 搜索区域 */}
            <div className="flex items-center gap-2 mr-2">
                {!isSearchOpen ? (
                    <button
                        onClick={handleSearchClick}
                        className="p-1 rounded-md hover:bg-(--hover-bg) transition-colors"
                        title={t("common.search")}
                    >
                        <Search size={14} className="text-(--text-muted)" />
                    </button>
                ) : (
                    <div className="relative flex items-center">
                        <Search size={14} className="absolute left-2 text-(--text-muted)" />
                        <input
                            id="titlebar-search-input"
                            type="text"
                            placeholder={t("common.search")}
                            className="w-64 pl-7 pr-7 py-0.5 text-xs bg-(--bg-main) border border-(--border-color) rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                        {searchText && (
                            <button
                                onClick={() => setSearchText("")}
                                className="absolute right-2 p-0.5 rounded-full hover:bg-(--hover-bg) transition-colors"
                                title={t("common.clear")}
                            >
                                <ClearIcon size={12} className="text-(--text-muted)" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 窗口控制按钮 */}
            <div className="flex items-center gap-0">
                {/* 最小化按钮 */}
                <button
                    onClick={handleMinimize}
                    className="h-8 w-12 flex items-center justify-center hover:bg-(--hover-bg) transition-colors"
                    aria-label="最小化"
                >
                    <Minus size={16} className="text-(--text-main)" />
                </button>

                {/* 最大化/还原按钮 */}
                <button
                    onClick={handleMaximize}
                    className="h-8 w-12 flex items-center justify-center hover:bg-(--hover-bg) transition-colors"
                    aria-label={isMaximized ? "还原" : "最大化"}
                >
                    {isMaximized ? (
                        <Copy size={14} className="text-(--text-main)" />
                    ) : (
                        <Square size={14} className="text-(--text-main)" />
                    )}
                </button>

                {/* 退出按钮 */}
                <button
                    onClick={handleClose}
                    className="h-8 w-12 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors"
                    aria-label="退出"
                >
                    <CloseIcon size={16} />
                </button>
            </div>
        </div>
    );
}
