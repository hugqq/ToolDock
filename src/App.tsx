import { useState, useEffect, useLayoutEffect, lazy, Suspense } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
const CommandPalette = lazy(() => import("./pages/CommandPalette"));
const TimestampConverter = lazy(() => import("./pages/TimestampConverter"));
const IpLookup = lazy(() => import("./pages/IpLookup"));
const Clicker = lazy(() => import("./pages/Clicker"));
const SimpleWebServer = lazy(() => import("./pages/SimpleWebServer"));
const PortScanner = lazy(() => import("./pages/PortScanner"));
const HttpDebugger = lazy(() => import("./pages/HttpDebugger"));
const Othello = lazy(() => import("./pages/Othello"));
const Game2048 = lazy(() => import("./pages/Game2048"));
const NotePad = lazy(() => import("./pages/NotePad"));
const PdfToImage = lazy(() => import("./pages/PdfToImage"));
const MyComputerNamespaceCleaner = lazy(
  () => import("./pages/MyComputerNamespaceCleaner")
);

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text-main)"></div>
    </div>
  );
}

function TransparentPageLoader() {
  return <div className="h-full w-full bg-transparent" />;
}

// 独立窗口路由配置（不显示主布局）
const STANDALONE_ROUTES: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  "/magnifier": Magnifier,
  "/floating-widget": FloatingWidget,
  "/screenshot-selector": ScreenshotSelector,
  "/command-palette": CommandPalette,
};

function AppContent() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>(CATEGORY.ALL);
  const [searchText, setSearchText] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { clipboardEnabled, clipboardPrefix, clipboardSuffix } =
    useSettingsStore();

  useLayoutEffect(() => {
    if (location.pathname !== "/magnifier") return;

    const bodyBackground = document.body.style.backgroundColor;
    const htmlBackground = document.documentElement.style.backgroundColor;
    const root = document.getElementById("root");
    const rootBackground = root?.style.backgroundColor;

    document.body.style.backgroundColor = "transparent";
    document.documentElement.style.backgroundColor = "transparent";
    if (root) root.style.backgroundColor = "transparent";

    return () => {
      document.body.style.backgroundColor = bodyBackground;
      document.documentElement.style.backgroundColor = htmlBackground;
      if (root) root.style.backgroundColor = rootBackground ?? "";
    };
  }, [location.pathname]);

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
    const unlisten = listen<string>("navigate-to-tool", (event) => navigate(event.payload));
    return () => { unlisten.then((fn) => fn()); };
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
  const standalonePath =
    getCurrentWindow().label === "command-palette"
      ? "/command-palette"
      : location.pathname;
  const StandaloneComponent = STANDALONE_ROUTES[standalonePath];
  if (StandaloneComponent) {
    const fallback =
      standalonePath === "/magnifier" ? <TransparentPageLoader /> : <PageLoader />;

    return (
      <Suspense fallback={fallback}>
        <StandaloneComponent />
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />
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
              <Route
                path="/tools/simple-web-server"
                element={<SimpleWebServer />}
              />
              <Route path="/tools/port-scanner" element={<PortScanner />} />
              <Route path="/tools/http-debugger" element={<HttpDebugger />} />
              <Route path="/tools/2048" element={<Game2048 />} />
              <Route path="/tools/notepad" element={<NotePad />} />
              <Route path="/tools/pdf-to-image" element={<PdfToImage />} />
              <Route
                path="/tools/my-computer-namespace"
                element={<MyComputerNamespaceCleaner />}
              />
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
          containerStyle={{
            top: "48px",
            right: "24px",
          }}
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
