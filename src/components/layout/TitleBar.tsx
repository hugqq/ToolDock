import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X as CloseIcon } from "lucide-react";

/**
 * 自定义窗口标题栏组件
 * 提供最小化、最大化/还原、退出功能
 * 支持拖拽移动窗口
 */
export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const appWindow = getCurrentWindow();

        // 初始化时检查窗口状态
        appWindow.isMaximized().then(setIsMaximized).catch(() => setIsMaximized(false));
    }, []);

    const handleMinimize = async () => {
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
    };

    const handleMaximize = async () => {
        const appWindow = getCurrentWindow();
        const nextMaximized = !isMaximized;
        if (isMaximized) {
            await appWindow.unmaximize();
        } else {
            await appWindow.maximize();
        }
        setIsMaximized(nextMaximized);
    };

    const handleClose = async () => {
        const appWindow = getCurrentWindow();
        await appWindow.close();
    };

    return (
        <div
            data-tauri-drag-region
            className="h-8 flex items-center justify-between px-4 bg-(--bg-main) border-b border-(--border-color) select-none"
        >
            {/* 拖拽区域 */}
            <div
                data-tauri-drag-region
                className="flex-1"
            />

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
