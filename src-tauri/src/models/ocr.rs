use serde::{Deserialize, Serialize};

/// 坐标点
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

/// 文字框 - 包含识别的文字内容和位置坐标
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TextBox {
    /// 识别的文字内容
    pub text: String,
    /// 置信度 (0.0 - 1.0)
    pub confidence: f32,
    /// 文字框坐标(4个顶点,顺时针: 左上、右上、右下、左下)
    pub polygon: Vec<Point>,
}

/// OCR详细结果 - 包含原图和识别的文字框
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OcrDetailResult {
    /// 原始截图的base64编码
    pub image_base64: String,
    /// 图片宽度
    pub width: u32,
    /// 图片高度
    pub height: u32,
    /// 识别的文字框列表
    pub text_boxes: Vec<TextBox>,
}
