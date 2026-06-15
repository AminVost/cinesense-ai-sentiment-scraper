import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { useState, useEffect } from "react";

export default function ThemeProviderWrapper({ children }) {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("darkMode");
    setDarkMode(savedTheme === "true");
  }, []);

  const theme = createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      primary: { main: darkMode ? "#90caf9" : "#1976d2" },
      background: {
        default: darkMode ? "#121212" : "#f5f5f5",
        paper: darkMode ? "#1e1e1e" : "#ffffff",
      },
    },
    typography: { fontFamily: "Arial, sans-serif" },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
