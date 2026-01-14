/**
 * Base64/URL 编解码器页面组件
 * 功能：提供 Base64 和 URL 编码解码功能
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Copy, RefreshCw, Trash2, ArrowLeftRight } from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import toast from "react-hot-toast";

type TabType =
  | "base64"
  | "url"
  | "hex"
  | "html"
  | "unicode"
  | "binary"
  | "jwt"
  | "punycode"
  | "morse";
type ActionType = "encode" | "decode";

export default function Base64Encoder() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("base64");
  const [action, setAction] = useState<ActionType>("encode");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [urlEncodeAll, setUrlEncodeAll] = useState(false);
  const [base64LineBreak, setBase64LineBreak] = useState(false);
  const [base64UrlSafe, setBase64UrlSafe] = useState(false);
  const [hexUppercase, setHexUppercase] = useState(false);
  const [autoTransform, setAutoTransform] = useState(true);

  // Base64 编码
  const base64Encode = (text: string): string => {
    try {
      let encoded = btoa(unescape(encodeURIComponent(text)));
      if (base64UrlSafe) {
        encoded = encoded
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      }
      if (base64LineBreak) {
        return encoded.match(/.{1,76}/g)?.join("\n") || encoded;
      }
      return encoded;
    } catch (error) {
      throw new Error("编码失败");
    }
  };

  // Base64 解码
  const base64Decode = (text: string): string => {
    try {
      let cleaned = text.replace(/\s/g, "");
      if (base64UrlSafe) {
        cleaned = cleaned.replace(/-/g, "+").replace(/_/g, "/");
        while (cleaned.length % 4) cleaned += "=";
      }
      return decodeURIComponent(escape(atob(cleaned)));
    } catch (error) {
      throw new Error("解码失败：无效的 Base64 格式");
    }
  };

  // URL 编码
  const urlEncode = (text: string): string => {
    if (urlEncodeAll) {
      return text
        .split("")
        .map(
          (c) =>
            "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")
        )
        .join("");
    }
    return encodeURIComponent(text);
  };

  // URL 解码
  const urlDecode = (text: string): string => {
    try {
      return decodeURIComponent(text);
    } catch (error) {
      throw new Error("解码失败：无效的 URL 编码格式");
    }
  };

  // Hex 编码
  const hexEncode = (text: string): string => {
    const hex = Array.from(text)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
    return hexUppercase ? hex.toUpperCase() : hex.toLowerCase();
  };

  // Hex 解码
  const hexDecode = (text: string): string => {
    try {
      const cleaned = text.replace(/[^0-9a-fA-F]/g, "");
      if (cleaned.length % 2 !== 0) throw new Error("无效的十六进制");
      return (
        cleaned
          .match(/.{2}/g)
          ?.map((byte) => String.fromCharCode(parseInt(byte, 16)))
          .join("") || ""
      );
    } catch (error) {
      throw new Error("解码失败：无效的十六进制格式");
    }
  };

  // HTML 实体编码
  const htmlEncode = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\//g, "&#x2F;");
  };

  // HTML 实体解码
  const htmlDecode = (text: string): string => {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Unicode 转义编码
  const unicodeEncode = (text: string): string => {
    return Array.from(text)
      .map((c) => {
        const code = c.charCodeAt(0);
        return code > 127 ? `\\u${code.toString(16).padStart(4, "0")}` : c;
      })
      .join("");
  };

  // Unicode 转义解码
  const unicodeDecode = (text: string): string => {
    try {
      return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    } catch (error) {
      throw new Error("解码失败：无效的 Unicode 格式");
    }
  };

  // Binary 编码
  const binaryEncode = (text: string): string => {
    return Array.from(text)
      .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
      .join(" ");
  };

  // Binary 解码
  const binaryDecode = (text: string): string => {
    try {
      return text
        .split(/\s+/)
        .filter((b) => b)
        .map((b) => String.fromCharCode(parseInt(b, 2)))
        .join("");
    } catch (error) {
      throw new Error("解码失败：无效的二进制格式");
    }
  };

  // JWT 解码（仅解码）
  const jwtDecode = (text: string): string => {
    try {
      const parts = text.split(".");
      if (parts.length !== 3) throw new Error("无效的 JWT 格式");

      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      const signature = parts[2];

      return JSON.stringify({ header, payload, signature }, null, 2);
    } catch (error) {
      throw new Error("解码失败：无效的 JWT 格式");
    }
  };

  // Punycode 编码
  const punycodeEncode = (text: string): string => {
    try {
      // 简化实现：只处理域名部分
      return text
        .split(".")
        .map((part) => {
          if (/[^\x00-\x7F]/.test(part)) {
            return "xn--" + punycodePart(part);
          }
          return part;
        })
        .join(".");
    } catch (error) {
      throw new Error("编码失败");
    }
  };

  // 简化的 Punycode 实现
  const punycodePart = (input: string): string => {
    const output = [];
    const inputLength = input.length;
    let n = 128;
    let delta = 0;
    let bias = 72;
    let h = 0;

    for (let i = 0; i < inputLength; i++) {
      const c = input.charCodeAt(i);
      if (c < 128) {
        output.push(input.charAt(i));
        h++;
      }
    }

    const b = h;
    if (b > 0) output.push("-");

    while (h < inputLength) {
      let m = 0x10ffff;
      for (let i = 0; i < inputLength; i++) {
        const c = input.charCodeAt(i);
        if (c >= n && c < m) m = c;
      }

      delta += (m - n) * (h + 1);
      n = m;

      for (let i = 0; i < inputLength; i++) {
        const c = input.charCodeAt(i);
        if (c < n) delta++;
        if (c === n) {
          let q = delta;
          for (let k = 36; ; k += 36) {
            const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
            if (q < t) break;
            output.push(
              String.fromCharCode(((q - t) % (36 - t)) + (q - t < 26 ? 97 : 22))
            );
            q = Math.floor((q - t) / (36 - t));
          }
          output.push(String.fromCharCode(q + (q < 26 ? 97 : 22)));
          bias = adapt(delta, h + 1, h === b);
          delta = 0;
          h++;
        }
      }
      delta++;
      n++;
    }
    return output.join("");
  };

  const adapt = (
    delta: number,
    numPoints: number,
    firstTime: boolean
  ): number => {
    delta = firstTime ? Math.floor(delta / 700) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > 455) {
      delta = Math.floor(delta / 35);
      k += 36;
    }
    return Math.floor(k + (36 * delta) / (delta + 38));
  };

  // Morse 编码
  const morseMap: { [key: string]: string } = {
    A: ".-",
    B: "-...",
    C: "-.-.",
    D: "-..",
    E: ".",
    F: "..-.",
    G: "--.",
    H: "....",
    I: "..",
    J: ".---",
    K: "-.-",
    L: ".-..",
    M: "--",
    N: "-.",
    O: "---",
    P: ".--.",
    Q: "--.-",
    R: ".-.",
    S: "...",
    T: "-",
    U: "..-",
    V: "...-",
    W: ".--",
    X: "-..-",
    Y: "-.--",
    Z: "--..",
    "0": "-----",
    "1": ".----",
    "2": "..---",
    "3": "...--",
    "4": "....-",
    "5": ".....",
    "6": "-....",
    "7": "--...",
    "8": "---..",
    "9": "----.",
    " ": "/",
  };

  const morseEncode = (text: string): string => {
    return text
      .toUpperCase()
      .split("")
      .map((c) => morseMap[c] || c)
      .join(" ");
  };

  const morseDecode = (text: string): string => {
    const reverseMap: { [key: string]: string } = {};
    Object.entries(morseMap).forEach(([k, v]) => (reverseMap[v] = k));
    return text
      .split(" ")
      .map((code) => reverseMap[code] || "")
      .join("");
  };

  // 执行转换
  const handleTransform = () => {
    if (!inputText.trim()) {
      toast.error("输入不能为空");
      return;
    }

    try {
      let result = "";

      switch (activeTab) {
        case "base64":
          result =
            action === "encode"
              ? base64Encode(inputText)
              : base64Decode(inputText);
          break;
        case "url":
          result =
            action === "encode" ? urlEncode(inputText) : urlDecode(inputText);
          break;
        case "hex":
          result =
            action === "encode" ? hexEncode(inputText) : hexDecode(inputText);
          break;
        case "html":
          result =
            action === "encode" ? htmlEncode(inputText) : htmlDecode(inputText);
          break;
        case "unicode":
          result =
            action === "encode"
              ? unicodeEncode(inputText)
              : unicodeDecode(inputText);
          break;
        case "binary":
          result =
            action === "encode"
              ? binaryEncode(inputText)
              : binaryDecode(inputText);
          break;
        case "jwt":
          if (action === "decode") {
            result = jwtDecode(inputText);
          } else {
            toast.error("JWT 仅支持解码");
            return;
          }
          break;
        case "punycode":
          if (action === "encode") {
            result = punycodeEncode(inputText);
          } else {
            toast.error("Punycode 仅支持编码");
            return;
          }
          break;
        case "morse":
          result =
            action === "encode"
              ? morseEncode(inputText)
              : morseDecode(inputText);
          break;
      }

      setOutputText(result);
      toast.success(
        action === "encode"
          ? t("tools.base64_encoder.encode_success")
          : t("tools.base64_encoder.decode_success")
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tools.base64_encoder.decode_error")
      );
    }
  };

  // 复制结果
  const handleCopy = async () => {
    if (!outputText) {
      toast.error("输出为空");
      return;
    }
    try {
      await navigator.clipboard.writeText(outputText);
      toast.success(t("tools.base64_encoder.copy_success"));
    } catch (error) {
      toast.error("复制失败");
    }
  };

  // 清空
  const handleClear = () => {
    setInputText("");
    setOutputText("");
  };

  // 交换输入输出
  const handleSwap = () => {
    const temp = inputText;
    setInputText(outputText);
    setOutputText(temp);
    setAction(action === "encode" ? "decode" : "encode");
  };

  // 监听输入自动转换
  useEffect(() => {
    if (!autoTransform) return;

    // 如果输入为空，直接清空输出
    if (!inputText.trim()) {
      setOutputText("");
      return;
    }

    const timer = setTimeout(() => {
      try {
        // 直接调用 handleTransform 的核心逻辑，不弹出 toast
        let result = "";
        switch (activeTab) {
          case "base64":
            result =
              action === "encode"
                ? base64Encode(inputText)
                : base64Decode(inputText);
            break;
          case "url":
            result =
              action === "encode" ? urlEncode(inputText) : urlDecode(inputText);
            break;
          case "hex":
            result =
              action === "encode" ? hexEncode(inputText) : hexDecode(inputText);
            break;
          case "html":
            result =
              action === "encode"
                ? htmlEncode(inputText)
                : htmlDecode(inputText);
            break;
          case "unicode":
            result =
              action === "encode"
                ? unicodeEncode(inputText)
                : unicodeDecode(inputText);
            break;
          case "binary":
            result =
              action === "encode"
                ? binaryEncode(inputText)
                : binaryDecode(inputText);
            break;
          case "jwt":
            if (action === "decode") result = jwtDecode(inputText);
            break;
          case "punycode":
            if (action === "encode") result = punycodeEncode(inputText);
            break;
          case "morse":
            result =
              action === "encode"
                ? morseEncode(inputText)
                : morseDecode(inputText);
            break;
        }
        setOutputText(result);
      } catch (e) {
        // 自动转换模式下不弹错
        setOutputText("");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [
    inputText,
    action,
    activeTab,
    urlEncodeAll,
    base64LineBreak,
    base64UrlSafe,
    hexUppercase,
    autoTransform,
  ]);

  // 获取当前编码方式的描述
  const getDescription = () => {
    const descriptionKeys: Record<TabType, string> = {
      base64: "tools.base64_encoder.desc_base64",
      url: "tools.base64_encoder.desc_url",
      hex: "tools.base64_encoder.desc_hex",
      html: "tools.base64_encoder.desc_html",
      unicode: "tools.base64_encoder.desc_unicode",
      binary: "tools.base64_encoder.desc_binary",
      jwt: "tools.base64_encoder.desc_jwt",
      punycode: "tools.base64_encoder.desc_punycode",
      morse: "tools.base64_encoder.desc_morse",
    };
    return t(descriptionKeys[activeTab]);
  };

  return (
    <ToolLayout title={t("tools.base64_encoder.name")}>
      {/* 顶部工具栏 */}
      <div className="mb-6">
        {/* 标签页切换 */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Button
            variant={activeTab === "base64" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("base64")}
          >
            Base64
          </Button>
          <Button
            variant={activeTab === "url" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("url")}
          >
            URL
          </Button>
          <Button
            variant={activeTab === "hex" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("hex")}
          >
            Hex
          </Button>
          <Button
            variant={activeTab === "html" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("html")}
          >
            HTML
          </Button>
          <Button
            variant={activeTab === "unicode" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("unicode")}
          >
            Unicode
          </Button>
          <Button
            variant={activeTab === "binary" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("binary")}
          >
            Binary
          </Button>
          <Button
            variant={activeTab === "jwt" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("jwt")}
          >
            JWT
          </Button>
          <Button
            variant={activeTab === "punycode" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("punycode")}
          >
            Punycode
          </Button>
          <Button
            variant={activeTab === "morse" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveTab("morse")}
          >
            Morse
          </Button>
        </div>

        {/* 描述说明 */}
        <div className="mt-3 p-3 bg-(--card-bg) rounded-lg border border-(--border-color)">
          <p className="text-sm text-(--text-muted) leading-relaxed">
            💡 {getDescription()}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap mt-4">
          {/* 编码/解码切换 */}
          <div className="flex items-center gap-2">
            <Button
              variant={action === "encode" ? "contained" : "outlined"}
              color="success"
              size="small"
              onClick={() => setAction("encode")}
            >
              {t("tools.base64_encoder.encode")}
            </Button>
            <Button
              variant={action === "decode" ? "contained" : "outlined"}
              color="primary"
              size="small"
              onClick={() => setAction("decode")}
            >
              {t("tools.base64_encoder.decode")}
            </Button>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleTransform}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              {action === "encode"
                ? t("tools.base64_encoder.encode")
                : t("tools.base64_encoder.decode")}
            </Button>
            <Button
              onClick={handleSwap}
              variant="outlined"
              className="flex items-center gap-2"
            >
              <ArrowLeftRight size={16} />
              {t("tools.base64_encoder.swap")}
            </Button>
            <Button
              onClick={handleClear}
              color="error"
              variant="contained"
              className="flex items-center gap-2"
            >
              <Trash2 size={16} />
              {t("tools.base64_encoder.clear")}
            </Button>
          </div>
        </div>
      </div>

      {/* 选项区域 */}
      <div className="mb-6 p-4 bg-(--card-bg) rounded-xl border border-(--border-color)">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="text-sm font-medium text-(--text-main)">
            {t("tools.base64_encoder.options")}
          </span>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoTransform}
              onChange={(e) => setAutoTransform(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-(--text-main)">
              {t("tools.base64_encoder.auto_transform")}
            </span>
          </label>

          {(activeTab === "base64" ||
            activeTab === "url" ||
            activeTab === "jwt" ||
            activeTab === "hex") && (
            <div className="flex items-center gap-6">
              {activeTab === "base64" && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={base64LineBreak}
                      onChange={(e) => setBase64LineBreak(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-(--text-main)">
                      {t("tools.base64_encoder.base64_line_break")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={base64UrlSafe}
                      onChange={(e) => setBase64UrlSafe(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-(--text-main)">
                      {t("tools.base64_encoder.url_safe")}
                    </span>
                  </label>
                </>
              )}
              {activeTab === "url" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={urlEncodeAll}
                    onChange={(e) => setUrlEncodeAll(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-(--text-main)">
                    {t("tools.base64_encoder.url_encode_all")}
                  </span>
                </label>
              )}
              {activeTab === "hex" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hexUppercase}
                    onChange={(e) => setHexUppercase(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-(--text-main)">
                    {t("tools.base64_encoder.uppercase")}
                  </span>
                </label>
              )}
              {activeTab === "jwt" && (
                <span className="text-sm text-(--text-muted)">
                  仅解码，可查看 Header、Payload 和 Signature
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 输入输出区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 输入区域 */}
        <div>
          <label className="block text-sm font-medium text-(--text-main) mb-2">
            {t("common.input")}
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t("tools.base64_encoder.input_placeholder")}
            className="w-full h-125 p-4 bg-(--card-bg) border border-(--border-color) rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* 输出区域 */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-(--text-main) mb-2">
              {t("common.output")}
            </label>
            <Button
              onClick={handleCopy}
              variant="outlined"
              size="small"
              className="flex items-center gap-1.5"
            >
              <Copy size={14} />
              {t("tools.base64_encoder.copy_result")}
            </Button>
          </div>
          <textarea
            value={outputText}
            readOnly
            placeholder={t("tools.base64_encoder.output_placeholder")}
            className="w-full h-125 p-4 bg-(--card-bg) border border-(--border-color) rounded-xl text-sm font-mono resize-none focus:outline-none"
          />
        </div>
      </div>
    </ToolLayout>
  );
}
