use crate::errors::{AppError, AppResult};
use base64::{engine::general_purpose, Engine as _};
use image::codecs::{
    bmp::BmpEncoder, ico::IcoEncoder, jpeg::JpegEncoder, png::PngEncoder, tiff::TiffEncoder,
    webp::WebPEncoder,
};
use image::{ColorType, DynamicImage, ImageEncoder, ImageReader, RgbaImage};
use serde::Deserialize;
use std::fs;
use std::process::Command;
use uuid::Uuid;

/// Render SVG to raster image using resvg
fn render_svg_to_image(
    svg_data: &[u8],
    width: Option<u32>,
    height: Option<u32>,
) -> Result<DynamicImage, String> {
    let opt = usvg::Options::default();
    let tree =
        usvg::Tree::from_data(svg_data, &opt).map_err(|e| format!("Failed to parse SVG: {}", e))?;

    let size = tree.size();
    let (target_w, target_h) = match (width, height) {
        (Some(w), Some(h)) => (w, h),
        (Some(w), None) => {
            let aspect = size.height() / size.width();
            (w, (w as f32 * aspect) as u32)
        }
        (None, Some(h)) => {
            let aspect = size.width() / size.height();
            ((h as f32 * aspect) as u32, h)
        }
        (None, None) => (size.width() as u32, size.height() as u32),
    };

    let mut pixmap =
        resvg::tiny_skia::Pixmap::new(target_w, target_h).ok_or("Failed to create pixmap")?;

    let transform = resvg::tiny_skia::Transform::from_scale(
        target_w as f32 / size.width(),
        target_h as f32 / size.height(),
    );

    resvg::render(&tree, transform, &mut pixmap.as_mut());

    // Convert pixmap to RgbaImage
    let rgba_img = RgbaImage::from_raw(target_w, target_h, pixmap.data().to_vec())
        .ok_or("Failed to create RGBA image from pixmap")?;

    Ok(DynamicImage::ImageRgba8(rgba_img))
}

#[derive(Deserialize)]
pub struct InputFile {
    pub name: String,
    pub data_base64: String,
}

#[tauri::command]
pub async fn convert_images(
    files: Vec<InputFile>,
    output_format: String,
    quality: Option<f32>,
    ico_size: Option<u32>,
    custom_width: Option<u32>,
    custom_height: Option<u32>,
) -> AppResult<Vec<(String, String, String)>> {
    let mut results = Vec::new();

    for f in files {
        // decode base64
        let bytes = match general_purpose::STANDARD.decode(&f.data_base64) {
            Ok(b) => b,
            Err(e) => return Err(AppError::Internal(format!("base64 decode error: {}", e))),
        };

        // Check if it's SVG
        let is_svg = f.name.to_lowercase().ends_with(".svg")
            || String::from_utf8_lossy(&bytes).contains("<svg");

        let decode_result: Result<image::DynamicImage, image::ImageError> = if is_svg {
            // Parse SVG and render to raster
            render_svg_to_image(&bytes, custom_width, custom_height).map_err(|e| {
                image::ImageError::IoError(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
            })
        } else {
            // attempt to decode with image crate first
            match ImageReader::new(std::io::Cursor::new(&bytes)).with_guessed_format() {
                Ok(reader) => reader.decode(),
                Err(e) => Err(image::ImageError::IoError(e)),
            }
        };

        let fmt = output_format.to_lowercase();
        // helper to push encoded buffer
        let push_buf = |name: String,
                        buf: Vec<u8>,
                        mime: String,
                        results: &mut Vec<(String, String, String)>| {
            results.push((name, general_purpose::STANDARD.encode(&buf), mime));
        };

        if let Ok(mut img) = decode_result {
            // Apply custom resolution if specified
            if let (Some(w), Some(h)) = (custom_width, custom_height) {
                img = img.resize_exact(w, h, image::imageops::FilterType::Lanczos3);
            } else if let Some(w) = custom_width {
                let aspect = img.height() as f32 / img.width() as f32;
                let new_h = (w as f32 * aspect) as u32;
                img = img.resize_exact(w, new_h, image::imageops::FilterType::Lanczos3);
            } else if let Some(h) = custom_height {
                let aspect = img.width() as f32 / img.height() as f32;
                let new_w = (h as f32 * aspect) as u32;
                img = img.resize_exact(new_w, h, image::imageops::FilterType::Lanczos3);
            }

            let mut out_buf: Vec<u8> = Vec::new();
            match fmt.as_str() {
                "image/jpeg" | "jpg" | "jpeg" => {
                    let q = (quality.unwrap_or(0.9) * 100.0).clamp(1.0, 100.0) as u8;
                    let rgb = img.to_rgb8();
                    let w = rgb.width();
                    let h = rgb.height();
                    let raw = rgb.into_raw();
                    let mut cursor = std::io::Cursor::new(&mut out_buf);
                    let mut enc = JpegEncoder::new_with_quality(&mut cursor, q);
                    enc.encode(&raw, w, h, ColorType::Rgb8.into())
                        .map_err(|e| AppError::Internal(format!("encode error: {}", e)))?;
                    push_buf(f.name, out_buf, "image/jpeg".to_string(), &mut results);
                }
                "image/png" | "png" => {
                    let rgba = img.to_rgba8();
                    let w = rgba.width();
                    let h = rgba.height();
                    let raw = rgba.into_raw();
                    let mut cursor = std::io::Cursor::new(&mut out_buf);
                    let enc = PngEncoder::new(&mut cursor);
                    enc.write_image(&raw, w, h, ColorType::Rgba8.into())
                        .map_err(|e| AppError::Internal(format!("encode error: {}", e)))?;
                    push_buf(f.name, out_buf, "image/png".to_string(), &mut results);
                }
                "image/webp" | "webp" => {
                    let rgb = img.to_rgb8();
                    let w = rgb.width();
                    let h = rgb.height();
                    let raw = rgb.into_raw();
                    let mut cursor = std::io::Cursor::new(&mut out_buf);
                    let enc = WebPEncoder::new_lossless(&mut cursor);
                    enc.encode(&raw, w, h, ColorType::Rgb8.into())
                        .map_err(|e| AppError::Internal(format!("encode error: {}", e)))?;
                    push_buf(f.name, out_buf, "image/webp".to_string(), &mut results);
                }
                "image/bmp" | "bmp" => {
                    let rgb = img.to_rgb8();
                    let w = rgb.width();
                    let h = rgb.height();
                    let raw = rgb.into_raw();
                    let mut cursor = std::io::Cursor::new(&mut out_buf);
                    let enc = BmpEncoder::new(&mut cursor);
                    enc.write_image(&raw, w, h, ColorType::Rgb8.into())
                        .map_err(|e| AppError::Internal(format!("encode error: {}", e)))?;
                    push_buf(f.name, out_buf, "image/bmp".to_string(), &mut results);
                }
                "image/x-icon" | "ico" => {
                    // ICO format has a maximum size of 256x256
                    let target_size = ico_size.unwrap_or(256).min(256);
                    let final_img = if img.width() != target_size || img.height() != target_size {
                        img.resize_exact(
                            target_size,
                            target_size,
                            image::imageops::FilterType::Lanczos3,
                        )
                    } else {
                        img.clone()
                    };
                    let rgba = final_img.to_rgba8();
                    let w = rgba.width();
                    let h = rgba.height();
                    let raw = rgba.into_raw();
                    let mut cursor = std::io::Cursor::new(&mut out_buf);
                    let enc = IcoEncoder::new(&mut cursor);
                    enc.write_image(&raw, w, h, ColorType::Rgba8.into())
                        .map_err(|e| AppError::Internal(format!("encode error: {}", e)))?;
                    push_buf(f.name, out_buf, "image/x-icon".to_string(), &mut results);
                }
                "image/tiff" | "tiff" => {
                    let rgba = img.to_rgba8();
                    let w = rgba.width();
                    let h = rgba.height();
                    let raw = rgba.into_raw();
                    let mut cursor = std::io::Cursor::new(&mut out_buf);
                    let enc = TiffEncoder::new(&mut cursor);
                    enc.write_image(&raw, w, h, ColorType::Rgba8.into())
                        .map_err(|e| AppError::Internal(format!("encode error: {}", e)))?;
                    push_buf(f.name, out_buf, "image/tiff".to_string(), &mut results);
                }
                "image/svg+xml" | "svg" => {
                    // For SVG output, we need to convert raster back to SVG (not practical)
                    // Instead, save as PNG with high quality
                    let rgba = img.to_rgba8();
                    let w = rgba.width();
                    let h = rgba.height();
                    let raw = rgba.into_raw();
                    let mut cursor = std::io::Cursor::new(&mut out_buf);
                    let enc = PngEncoder::new(&mut cursor);
                    enc.write_image(&raw, w, h, ColorType::Rgba8.into())
                        .map_err(|e| AppError::Internal(format!("encode error: {}", e)))?;
                    // Note: Output as PNG since we can't convert raster to vector
                    push_buf(f.name, out_buf, "image/png".to_string(), &mut results);
                }
                _ => return Err(AppError::Internal("unsupported output format".to_string())),
            }
            continue;
        }

        // If decode failed, attempt to use external ImageMagick (magick) CLI as fallback.
        // This requires ImageMagick to be installed and `magick` available in PATH on Windows.
        let tmp_dir = std::env::temp_dir();
        let id = Uuid::new_v4().to_string();
        let in_path = tmp_dir.join(format!("{}_in", id)).with_extension(
            std::path::Path::new(&f.name)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("bin"),
        );
        let out_ext = match fmt.as_str() {
            "image/jpeg" | "jpg" | "jpeg" => "jpg",
            "image/png" | "png" => "png",
            "image/webp" | "webp" => "webp",
            "image/bmp" | "bmp" => "bmp",
            "image/x-icon" | "ico" => "ico",
            "image/tiff" | "tiff" => "tiff",
            _ => return Err(AppError::Internal("unsupported output format".to_string())),
        };
        let out_path = tmp_dir.join(format!("{}_out.{}", id, out_ext));

        // write input file
        fs::write(&in_path, &bytes)
            .map_err(|e| AppError::Internal(format!("write tmp input failed: {}", e)))?;

        // prepare command
        let mut cmd = Command::new("magick");
        // On some systems the CLI is `magick` or `magick.exe`. If not found, user must install ImageMagick.
        let quality_arg = (quality.unwrap_or(0.9) * 100.0).clamp(1.0, 100.0) as u8;
        // build args: magick input -quality Q output
        cmd.arg(in_path.to_string_lossy().to_string())
            .arg("-quality")
            .arg(format!("{}", quality_arg))
            .arg(out_path.to_string_lossy().to_string());

        let status = cmd.status();
        match status {
            Ok(st) if st.success() => {
                let out_bytes = fs::read(&out_path)
                    .map_err(|e| AppError::Internal(format!("read tmp output failed: {}", e)))?;
                let mime = match out_ext {
                    "jpg" => "image/jpeg",
                    "png" => "image/png",
                    "webp" => "image/webp",
                    "bmp" => "image/bmp",
                    "ico" => "image/x-icon",
                    "tiff" => "image/tiff",
                    _ => "application/octet-stream",
                };
                push_buf(f.name, out_bytes, mime.to_string(), &mut results);
            }
            Ok(st) => {
                return Err(AppError::Internal(format!(
                    "magick failed with code: {}",
                    st
                )));
            }
            Err(e) => {
                return Err(AppError::Internal(format!("failed to run magick: {}", e)));
            }
        }

        // cleanup
        let _ = fs::remove_file(&in_path);
        let _ = fs::remove_file(&out_path);
    }

    Ok(results)
}
