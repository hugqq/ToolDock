import React, { useEffect, useRef } from "react";
import { TextBox } from "../../types/ocr";

interface ImagePreviewProps {
    imageBase64: string;
    textBoxes: TextBox[];
    width: number;
    height: number;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
    imageBase64,
    textBoxes,
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

            // 绘制图片
            ctx.drawImage(img, 0, 0, width, height);

            // 绘制文字框
            textBoxes.forEach((box, index) => {
                const { polygon } = box;
                if (polygon.length < 4) return;

                // 绘制边框
                ctx.strokeStyle = "#00ff00";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(polygon[0].x, polygon[0].y);
                for (let i = 1; i < polygon.length; i++) {
                    ctx.lineTo(polygon[i].x, polygon[i].y);
                }
                ctx.closePath();
                ctx.stroke();

                // 绘制序号标签
                ctx.fillStyle = "#00ff00";
                ctx.fillRect(polygon[0].x, polygon[0].y - 20, 30, 20);
                ctx.fillStyle = "#000";
                ctx.font = "12px monospace";
                ctx.fillText(`${index + 1}`, polygon[0].x + 5, polygon[0].y - 6);
            });
        };

        img.src = `data:image/png;base64,${imageBase64}`;
    }, [imageBase64, textBoxes, width, height]);

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
