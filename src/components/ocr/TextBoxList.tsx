import React from "react";
import { TextBox } from "../../types/ocr";
import { Copy } from "lucide-react";
import { Button } from "../mui";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

interface TextBoxListProps {
    textBoxes: TextBox[];
    selectedIndex: number | null;
    onSelect: (index: number) => void;
}

export const TextBoxList: React.FC<TextBoxListProps> = ({
    textBoxes,
    selectedIndex,
    onSelect,
}) => {
    const { t } = useTranslation();

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(t("common.copy_success"));
    };

    return (
        <div className="flex flex-col gap-2 h-full overflow-auto custom-scrollbar">
            {textBoxes.map((box, index) => (
                <div
                    key={index}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedIndex === index
                            ? "border-primary bg-primary/10"
                            : "border-(--border-color) bg-(--card-bg) hover:border-primary/50"
                        }`}
                    onClick={() => onSelect(index)}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-primary">
                                    #{index + 1}
                                </span>
                                <span className="text-xs text-(--text-muted)">
                                    置信度: {(box.confidence * 100).toFixed(0)}%
                                </span>
                            </div>
                            <p className="text-sm break-words">{box.text}</p>
                            <div className="text-xs text-(--text-muted) mt-1 font-mono">
                                ({box.polygon[0].x},{box.polygon[0].y}) → ({box.polygon[2].x},
                                {box.polygon[2].y})
                            </div>
                        </div>
                        <Button
                            variant="text"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(box.text);
                            }}
                            className="p-1.5 h-auto"
                        >
                            <Copy size={14} />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};
