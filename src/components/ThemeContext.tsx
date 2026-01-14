import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import {
  createTheme,
  ThemeProvider as MUIThemeProvider,
} from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme,
          primary: {
            main: "#3b82f6",
            contrastText: "#ffffff",
          },
          background: {
            default: theme === "dark" ? "#000000" : "#ffffff",
            paper: theme === "dark" ? "#000000" : "#ffffff",
          },
          text: {
            primary: theme === "dark" ? "#ffffff" : "#000000",
            secondary: theme === "dark" ? "#94a3b8" : "#64748b",
          },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "10px",
                transition: "all 0.2s ease-in-out",
              },
              containedPrimary: {
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)",
                "&:hover": {
                  boxShadow: "0 6px 16px rgba(59, 130, 246, 0.3)",
                  transform: "translateY(-1px)",
                },
              },
              outlinedPrimary: {
                borderColor: "rgba(59, 130, 246, 0.4)",
                "&:hover": {
                  backgroundColor: "rgba(59, 130, 246, 0.05)",
                  borderColor: "#3b82f6",
                },
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                },
              },
            },
          },
        },
      }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MUIThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
