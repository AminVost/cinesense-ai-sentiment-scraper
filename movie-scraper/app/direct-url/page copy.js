"use client";

import { useState, useEffect, useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  CssBaseline,
  Container,
  TextField,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Slide,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "./page.module.css";

export default function DirectUrlPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [showButton, setShowButton] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [maxComments, setMaxComments] = useState(20);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("darkMode");
    if (savedTheme !== null) {
      setDarkMode(savedTheme === "true");
    }
  }, []);

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

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleStart = async () => {
    setComments([]);
    setLoading(true);
    setHasSearched(true); 

    if (!isValidUrl(inputValue)) {
      toast.error("🚨 Invalid URL. Please enter a correct link.");
      setLoading(false);
      return;
    }

    const maxCount = parseInt(maxComments, 10) || 20;

    try {
      const response = await fetch("http://localhost:5000/api/fetch-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputValue, maxComments: maxCount }),
      });

      const data = await response.json();
      console.log("Extracted Comments:", data.comments);

      if (data.error) {
        toast.error(`🚨 Error: ${data.error}`);
      } else {
        setComments(data.comments || []);
      }
    } catch (error) {
      toast.error("🚨 Server error, please try again.");
    }

    setLoading(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        theme={darkMode ? "dark" : "light"}
        hideProgressBar
      />

      <AppBar position="static" elevation={2}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: "bold" }}>
            LOGO
          </Typography>

          <IconButton
            onClick={() => {
              setDarkMode((prev) => {
                const newMode = !prev;
                localStorage.setItem("darkMode", newMode);
                return newMode;
              });
            }}
            color="inherit"
          >
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "90vh",
          textAlign: "center",
        }}
      >
        <TextField
          variant="outlined"
          placeholder="Enter URL..."
          sx={{
            width: "100%",
            maxWidth: "400px",
            backgroundColor: theme.palette.background.paper,
            borderRadius: "10px",
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: darkMode ? "#90caf9" : "#1976d2" },
              "&:hover fieldset": {
                borderColor: darkMode ? "#64b5f6" : "#1565c0",
              },
              "&.Mui-focused fieldset": {
                borderColor: darkMode ? "#42a5f5" : "#0d47a1",
              },
            },
          }}
          onFocus={() => setShowButton(true)}
          onChange={(e) => setInputValue(e.target.value)}
          value={inputValue}
        />

        <TextField
          variant="outlined"
          type="number"
          placeholder="Enter max comments (default: 20)"
          sx={{
            width: "100%",
            maxWidth: "400px",
            marginTop: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: "10px",
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: darkMode ? "#90caf9" : "#1976d2" },
              "&:hover fieldset": {
                borderColor: darkMode ? "#64b5f6" : "#1565c0",
              },
              "&.Mui-focused fieldset": {
                borderColor: darkMode ? "#42a5f5" : "#0d47a1",
              },
            },
          }}
          onChange={(e) => setMaxComments(e.target.value)}
          value={maxComments}
        />

        <Slide direction="up" in={showButton} mountOnEnter unmountOnExit>
          <Button
            variant="contained"
            color="primary"
            sx={{ marginTop: 2, paddingX: 4, paddingY: 1 }}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: "white" }} />
            ) : (
              "🚀 Start"
            )}
          </Button>
        </Slide>

        <div className="container mt-4">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className={`list-group ${styles.resultCont}`}>
                {loading ? (
                  <div className="container mt-4">
                    <div className="row justify-content-center">
                      <div className="col-lg-8">
                        {[...Array(5)].map((_, index) => (
                          <Skeleton
                            key={index}
                            variant="rectangular"
                            height={60}
                            animation="wave"
                            className="mb-2 rounded"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : comments.length > 0 ? (
                  comments.map((comment, index) => (
                    <div
                      key={index}
                      className={`list-group-item list-group-item-action p-3 shadow-sm rounded mb-2 text-end ${styles.commentItem}`}
                      style={{
                        border: `2px solid ${
                          comment.sentiment === "Positive"
                            ? "#90ee90"
                            : "#ffcccb"
                        }`,
                        backgroundColor: theme.palette.background.paper,
                      }}
                    >
                      <p
                        className={`mb-0 fw-semibold cairo-text ${
                          darkMode ? "text-white" : "text-dark"
                        }`}
                      >
                        {comment.text}
                      </p>
                      <small className="text-muted">
                        Sentiment:{" "}
                        <strong
                          style={{
                            color:
                              comment.sentiment === "Positive"
                                ? "lightgreen"
                                : "red",
                          }}
                        >
                          {comment.sentiment}
                        </strong>{" "}
                        (Positive: {comment.positive}, Negative:{" "}
                        {comment.negative})
                      </small>
                    </div>
                  ))
                ) : hasSearched ? (
                  <div className="alert alert-info text-center">
                    No comments found
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </ThemeProvider>
  );
}