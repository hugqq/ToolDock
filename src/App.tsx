import { useState, useEffect, lazy, Suspense } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "./stores/useSettingsStore";
import { Home } from "./pages/Home";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/layout/TitleBar";
import { ModalProvider } from "./components/ModalContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "react-hot-toast";
import { CATEGORY, CategoryType, UI } from "./constants";

// Lazy load all tool pages for better memory efficiency
const FolderSize = lazy(() => import("./pages/FolderSize"));
const JsonFormat = lazy(() => import("./pages/JsonFormat"));
const NodeCleaner = lazy(() => import("./pages/NodeCleaner"));
const ColorPicker = lazy(() => import("./pages/ColorPicker"));
const ProcessManager = lazy(() => import("./pages/ProcessManager"));
const DnsTool = lazy(() => import("./pages/DnsTool"));
const NginxEditor = lazy(() => import("./pages/NginxEditor"));
const ClipboardManager = lazy(() => import("./pages/ClipboardManager"));
const Translator = lazy(() => import("./pages/Translator"));
const VariableNaming = lazy(() => import("./pages/VariableNaming"));
const HashCalculator = lazy(() => import("./pages/HashCalculator"));
const BatchRenamer = lazy(() => import("./pages/BatchRenamer"));
const Base64Encoder = lazy(() => import("./pages/Base64Encoder"));
const UnitConverter = lazy(() => import("./pages/UnitConverter"));
const CronGenerator = lazy(() => import("./pages/CronGenerator"));
const QRCodeTool = lazy(() => import("./pages/QRCodeTool"));
const DiffTool = lazy(() => import("./pages/DiffTool"));
const ScreenOcr = lazy(() => import("./pages/ScreenOcr"));
const Settings = lazy(() => import("./pages/Settings"));
const ImageConverter = lazy(() => import("./pages/ImageConverter"));
const Magnifier = lazy(() => import("./pages/Magnifier"));
const FloatingWidget = lazy(() => import("./pages/FloatingWidget"));
const ScreenshotSelector = lazy(() => import("./pages/ScreenshotSelector"));
const TimestampConverter = lazy(() => import("./pages/TimestampConverter"));
const IpLookup = lazy(() => import("./pages/IpLookup"));
const Clicker = lazy(() => import("./pages/Clicker"));
const WeChatAssistant = lazy(() => import("./pages/WeChatAssistant"));
const SimpleWebServer = lazy(() => import("./pages/SimpleWebServer"));
const PortScanner = lazy(() => import("./pages/PortScanner"));
const PipPlayer = lazy(() => import("./pages/PipPlayer"));
const PipWindow = lazy(() => import("./pages/PipWindow"));
const BilibiliLogin = lazy(() => import("./pages/BilibiliLogin"));
const WeReadBook = lazy(() => import("./pages/WeReadBook"));
const Othello = lazy(() => import("./pages/Othello"));
const Game2048 = lazy(() => import("./pages/Game2048"));
const NotePad = lazy(() => import("./pages/NotePad"));
const BaziChart = lazy(() => import("./pages/BaziChart"));
const ZodiacHoroscope = lazy(() => import("./pages/ZodiacHoroscope"));
const PdfToImage = lazy(() => import("./pages/PdfToImage"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text-main)"></div>
    </div>
  );
}

// 独立窗口路由配置（不显示主布局）
const STANDALONE_ROUTES: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  "/magnifier": Magnifier,
  "/floating-widget": FloatingWidget,
  "/screenshot-selector": ScreenshotSelector,
  "/pip-window": PipWindow,
  "/bilibili-login": BilibiliLogin,
};

function AppContent() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryType>(CATEGORY.ALL);
  const [searchText, setSearchText] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { clipboardEnabled, clipboardPrefix, clipboardSuffix } =
    useSettingsStore();

  // 监听后端全局热键触发事件
  useEffect(() => {
    const unlisten = listen("hotkey_triggered", () => {
      // 导航到首页并设置收藏分类
      setActiveCategory(CATEGORY.FAVORITES);
      navigate("/");
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [navigate]);

  useEffect(() => {
    // 全局同步剪贴板监听状态
    invoke("set_clipboard_enabled", { enabled: clipboardEnabled }).catch(
      (err) => console.error("Failed to sync clipboard status:", err)
    );
  }, [clipboardEnabled]);

  useEffect(() => {
    // 全局同步剪贴板配置
    invoke("set_clipboard_config", {
      prefix: clipboardPrefix,
      suffix: clipboardSuffix,
    }).catch((err) => console.error("Failed to sync clipboard config:", err));
  }, [clipboardPrefix, clipboardSuffix]);

  // 独立窗口：不渲染主布局，直接渲染对应组件
  const StandaloneComponent = STANDALONE_ROUTES[location.pathname];
  if (StandaloneComponent) {
    return (
      <Suspense fallback={<PageLoader />}>
        <StandaloneComponent />
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TitleBar />
        <main className="flex-1 flex flex-col min-w-0 bg-(--bg-main) relative overflow-hidden">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    activeCategory={activeCategory}
                    setActiveCategory={setActiveCategory}
                    searchText={searchText}
                    setSearchText={setSearchText}
                  />
                }
              />
              <Route path="/tools/folder-size" element={<FolderSize />} />
              <Route path="/tools/json-format" element={<JsonFormat />} />
              <Route path="/tools/node-cleaner" element={<NodeCleaner />} />
              <Route path="/tools/color-picker" element={<ColorPicker />} />
              <Route path="/tools/process-manager" element={<ProcessManager />} />
              <Route path="/tools/dns-tool" element={<DnsTool />} />
              <Route path="/tools/nginx-editor" element={<NginxEditor />} />
              <Route
                path="/tools/clipboard-manager"
                element={<ClipboardManager />}
              />
              <Route path="/tools/translator" element={<Translator />} />
              <Route path="/tools/variable-naming" element={<VariableNaming />} />
              <Route path="/tools/hash-calculator" element={<HashCalculator />} />
              <Route path="/tools/batch-renamer" element={<BatchRenamer />} />
              <Route path="/tools/base64-encoder" element={<Base64Encoder />} />
              <Route path="/tools/unit-converter" element={<UnitConverter />} />
              <Route path="/tools/cron-generator" element={<CronGenerator />} />
              <Route path="/tools/qrcode" element={<QRCodeTool />} />
              <Route path="/tools/diff-tool" element={<DiffTool />} />
              <Route path="/tools/ocr" element={<ScreenOcr />} />
              <Route path="/tools/image-converter" element={<ImageConverter />} />
              <Route
                path="/tools/timestamp-converter"
                element={<TimestampConverter />}
              />
              <Route path="/tools/ip-lookup" element={<IpLookup />} />
              <Route path="/tools/clicker" element={<Clicker />} />
              <Route path="/tools/wechat-assistant" element={<WeChatAssistant />} />
              <Route
                path="/tools/simple-web-server"
                element={<SimpleWebServer />}
              />
              <Route path="/tools/port-scanner" element={<PortScanner />} />
              <Route path="/tools/pip-player" element={<PipPlayer />} />
              <Route path="/tools/weread-book" element={<WeReadBook />} />
              <Route path="/tools/2048" element={<Game2048 />} />
              <Route path="/tools/notepad" element={<NotePad />} />
              <Route path="/tools/bazi-chart" element={<BaziChart />} />
              <Route path="/tools/zodiac" element={<ZodiacHoroscope />} />
              <Route path="/tools/pdf-to-image" element={<PdfToImage />} />
              <Route path="/othello" element={<Othello />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ModalProvider>
        <Router>
          <AppContent />
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            className:
              "bg-(--card-bg) text-(--text-main) border border-(--border-color)",
            duration: UI.TOAST_DURATION_MS,
          }}
        />
      </ModalProvider>
    </ErrorBoundary>
  );
}

export default App;
