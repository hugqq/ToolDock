// OCR相关类型定义

export interface Point {
    x: number;
    y: number;
}

export interface TextBox {
    text: string;
    confidence: number;
    polygon: Point[];
}

export interface OcrDetailResult {
    image_base64: string;
    width: number;
    height: number;
    text_boxes: TextBox[];
}

export interface EditAction {
    type: 'erase' | 'replace';
    boxIndex: number;
    newText?: string; // 仅替换时需要
}
