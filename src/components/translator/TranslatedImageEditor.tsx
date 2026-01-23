import React, { useEffect, useRef } from "react";
import { TextBox } from "../../types/ocr";

interface TranslatedImageEditorProps {
    imageBase64: string;
    textBoxes: TextBox[];
    translations: string[];
    width: number;
    height: number;
}

export const TranslatedImageEditor: React.FC<TranslatedImageEditorProps> = ({
    imageBase64,
    textBoxes,
    translations,
    width,
    height,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 创建图片对象
        const img = new Image();
        img.onload = () => {
            // 设置canvas尺寸
            canvas.width = width;
            canvas.height = height;

            // 绘制原图
            ctx.drawImage(img, 0, 0, width, height);

            // 处理每个文字框
            textBoxes.forEach((box, index) => {
                const { polygon } = box;
                if (polygon.length < 4) return;

                // 计算文字框的矩形区域
                const minX = Math.min(...polygon.map((p) => p.x));
                const minY = Math.min(...polygon.map((p) => p.y));
                const maxX = Math.max(...polygon.map((p) => p.x));
                const maxY = Math.max(...polygon.map((p) => p.y));

                const boxWidth = maxX - minX;
                const boxHeight = maxY - minY;

                // 1. 擦除原文 - 用白色矩形填充
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(minX, minY, boxWidth, boxHeight);

                // 2. 绘制译文
                const translation = translations[index] || box.text;

                // 自动计算合适的字体大小
                let fontSize = Math.floor(boxHeight * 0.7);
                ctx.font = `${fontSize}px sans-serif`;

                // 检查文字是否超出框宽,如果超出则缩小字体
                let textWidth = ctx.measureText(translation).width;
                while (textWidth > boxWidth && fontSize > 8) {
                    fontSize -= 1;
                    ctx.font = `${fontSize}px sans-serif`;
                    textWidth = ctx.measureText(translation).width;
                }

                // 绘制文字
                ctx.fillStyle = "#000000";
                ctx.textBaseline = "top";
                ctx.fillText(translation, minX + 2, minY + 2);
            });
        };

        img.src = `data:image/png;base64,${imageBase64}`;
    }, [imageBase64, textBoxes, translations, width, height]);

    return (
        <div className="relative w-full h-full overflow-auto bg-(--bg-main) rounded-xl border border-(--border-color)">
            <canvas
                ref={canvasRef}
                className="max-w-full h-auto"
                style={{ imageRendering: "crisp-edges" }}
            />
        </div>
    );
};
