"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  TextField,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "./page.module.css";

const mockMovies = [
  { id: 1, title: "تایتانیک (1997)" },
  { id: 2, title: "جدایی نادر از سیمین" },
  { id: 3, title: "ابد و یک روز" },
  { id: 4, title: "انگل (Parasite)" },
  { id: 5, title: "شوالیه تاریکی (The Dark Knight)" },
];

const fetcher = async (url, query) => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    return data.results;
  } catch (error) {
    console.warn("❗️استفاده از داده فرضی به دلیل خطا در API");
    return mockMovies.filter((movie) => movie.title.includes(query));
  }
};

export default function DirectNamePage() {
  const [darkMode, setDarkMode] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [maxComments, setMaxComments] = useState(20);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: {
            main: darkMode ? "#90caf9" : "#1976d2",
          },
          background: {
            default: darkMode ? "#121212" : "#f5f5f5",
            paper: darkMode ? "#1e1e1e" : "#ffffff",
          },
        },
        typography: {
          fontFamily: "Arial, sans-serif",
        },
      }),
    [darkMode]
  );

  const { data: movieOptions, isLoading: autoLoading } = useSWR(
    query.length >= 2 ? ["/api/search-movie", query] : null,
    ([url, q]) => fetcher(url, q),
    { revalidateOnFocus: false, dedupingInterval: 3000 }
  );

  const handleStart = async () => {
    if (!selectedMovie) {
      toast.error("🚨 لطفاً یک فیلم را انتخاب کنید.");
      return;
    }
    setComments([]);
    setLoading(true);
    try {
      // Use relative path for fetching comments
      const response = await fetch("/api/fetch-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selectedMovie.title, maxComments }),
      });
      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      toast.error("🚨 خطای سرور، لطفاً دوباره امتحان11111 کنید.");
    }
    setLoading(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        theme="dark"
        hideProgressBar
      />
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: "bold" }}>
            جستجوی فیلم بر اساس نام
          </Typography>
          <IconButton
            onClick={() => {
              setDarkMode((prev) => {
                const newMode = !prev;
                localStorage.setItem("darkMode", newMode);
                return newMode;
              });
            }}
          >
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 5 }}>
        <Autocomplete
          freeSolo
          loading={autoLoading}
          options={movieOptions || []}
          getOptionLabel={(option) => option.title || ""}
          onInputChange={(event, newInputValue) => setQuery(newInputValue)}
          onChange={(event, newValue) => setSelectedMovie(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="نام فیلم را وارد کنید"
              variant="outlined"
              fullWidth
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {autoLoading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              sx={{ mb: 3 }}
            />
          )}
        />

        <TextField
          label="تعداد کامنت‌ها"
          type="number"
          value={maxComments}
          onChange={(e) => setMaxComments(e.target.value)}
          fullWidth
          sx={{ mb: 3 }}
        />

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleStart}
        >
          شروع تحلیل
        </Button>

        {loading && <CircularProgress sx={{ mt: 3 }} />}

        {comments.length > 0 && (
          <div className={styles.commentContainer}>
            {comments.map((comment, index) => (
              <div
                key={index}
                className={styles.commentBox}
                style={{
                  borderColor:
                    comment.sentiment === "Positive" ? "#4caf50" : "#f44336",
                }}
              >
                <p>
                  <strong>{comment.sentiment}</strong> - {comment.text}
                </p>
                <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                  👍 {comment.positive} / 👎 {comment.negative}
                </p>
              </div>
            ))}
          </div>
        )}
      </Container>
    </ThemeProvider>
  );
}
