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
  Card,
  CardContent,
  Chip,
  Box,
} from "@mui/material";
import { Brightness4, Brightness7, ThumbUpAlt, ThumbDownAlt, MovieFilter } from "@mui/icons-material";
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
          primary: { main: darkMode ? "#90caf9" : "#1976d2" },
          success: { main: "#4caf50" },
          error: { main: "#f44336" },
          background: {
            default: darkMode ? "#0a0a0a" : "#f0f2f5",
            paper: darkMode ? "#1a1a1a" : "#ffffff",
          },
        },
        typography: { fontFamily: "Arial, sans-serif" },
        shape: { borderRadius: 16 },
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
      toast.error("🚨 لینک وارد شده نامعتبر است.");
      setLoading(false);
      return;
    }

    const maxCount = parseInt(maxComments, 10) || 20;

    try {
      const response = await fetch("/api/fetch-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputValue, maxComments: maxCount }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(`🚨 خطا: ${data.error}`);
      } else {
        setComments(data.comments || []);
      }
    } catch (error) {
      toast.error("🚨 خطای ارتباط با سرور. لطفا دوباره تلاش کنید.");
    }

    setLoading(false);
  };

  // محاسبه آمار کلی
  const totalComments = comments.length;
  const positiveCount = comments.filter((c) => c.sentiment === "Positive").length;
  const negativeCount = totalComments - positiveCount;
  const positivePercent = totalComments > 0 ? Math.round((positiveCount / totalComments) * 100) : 0;
  const negativePercent = totalComments > 0 ? 100 - positivePercent : 0;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer position="bottom-center" autoClose={3000} theme={darkMode ? "dark" : "light"} hideProgressBar />

      {/* Header */}
      <AppBar position="sticky" elevation={0} sx={{ background: darkMode ? 'rgba(10,10,10,0.8)' : 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${darkMode ? '#333' : '#ddd'}` }}>
        <Toolbar>
          <MovieFilter color="primary" sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: "900", color: darkMode ? '#fff' : '#000', letterSpacing: 1 }}>
            AI Movie Scraper
          </Typography>
          <IconButton onClick={() => {
            setDarkMode((prev) => {
              const newMode = !prev;
              localStorage.setItem("darkMode", newMode);
              return newMode;
            });
          }} color="inherit">
            {darkMode ? <Brightness7 sx={{ color: '#ffd54f' }} /> : <Brightness4 sx={{ color: '#5c6bc0' }} />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ pt: 6, pb: 10 }}>
        {/* بخش دریافت اطلاعات (Hero Section) */}
        <Box className={styles.heroSection} textAlign="center">
          <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
            تحلیل هوشمند کامنت‌های فیلم
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            لینک صفحه فیلم را وارد کنید تا هوش مصنوعی احساسات کاربران را تحلیل کند.
          </Typography>

          <TextField
            fullWidth
            variant="outlined"
            placeholder="لینک فیلم را اینجا قرار دهید..."
            onFocus={() => setShowButton(true)}
            onChange={(e) => setInputValue(e.target.value)}
            value={inputValue}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />

          <TextField
            fullWidth
            variant="outlined"
            type="number"
            placeholder="حداکثر تعداد کامنت (پیش‌فرض: ۲۰)"
            onChange={(e) => setMaxComments(e.target.value)}
            value={maxComments}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />

          <Slide direction="up" in={showButton} mountOnEnter unmountOnExit>
            <Button
              variant="contained"
              size="large"
              sx={{ px: 6, py: 1.5, borderRadius: '30px', fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'none', boxShadow: '0 8px 20px rgba(25, 118, 210, 0.4)' }}
              onClick={handleStart}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <MovieFilter />}
            >
              {loading ? "در حال تحلیل..." : "شروع استخراج و تحلیل"}
            </Button>
          </Slide>
        </Box>

        {/* بخش نمایش آمار کلی (Progress Bar) */}
        {comments.length > 0 && !loading && (
          <Box className={styles.statCard}>
            <Typography variant="h6" fontWeight="bold" mb={2} textAlign="center">
              نتیجه کلی تحلیل احساسات ({totalComments} کامنت)
            </Typography>
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box display="flex" alignItems="center">
                <ThumbUpAlt color="success" sx={{ mr: 1 }} />
                <Typography variant="body1" fontWeight="bold" color="success.main">
                  {positivePercent}% مثبت
                </Typography>
              </Box>
              <Box display="flex" alignItems="center">
                <Typography variant="body1" fontWeight="bold" color="error.main">
                  {negativePercent}% منفی
                </Typography>
                <ThumbDownAlt color="error" sx={{ ml: 1 }} />
              </Box>
            </Box>

            <div className={styles.dualProgressBar}>
              <div className={styles.progressPositive} style={{ width: `${positivePercent}%` }}></div>
              <div className={styles.progressNegative} style={{ width: `${negativePercent}%` }}></div>
            </div>
          </Box>
        )}

        {/* بخش نمایش لیست کامنت‌ها */}
        <Box mt={4}>
          {loading ? (
            <Box>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} variant="rounded" height={100} sx={{ mb: 2, borderRadius: '16px' }} animation="wave" />
              ))}
            </Box>
          ) : comments.length > 0 ? (
            comments.map((comment, index) => {
              const isPositive = comment.sentiment === "Positive";
              return (
                <Card 
                  key={index} 
                  className={styles.commentCard}
                  sx={{ 
                    mb: 2, 
                    borderLeft: `6px solid ${isPositive ? '#4caf50' : '#f44336'}`,
                    background: theme.palette.background.paper
                  }}
                >
                  <CardContent sx={{ pb: "16px !important" }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Chip 
                        icon={isPositive ? <ThumbUpAlt /> : <ThumbDownAlt />} 
                        label={isPositive ? "مثبت" : "منفی"} 
                        color={isPositive ? "success" : "error"} 
                        variant={darkMode ? "outlined" : "filled"}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
                        👍 {comment.positive} | 👎 {comment.negative}
                      </Typography>
                    </Box>
                    <Typography 
                      variant="body1" 
                      className="cairo-text" 
                      sx={{ 
                        lineHeight: 1.8, 
                        direction: 'rtl', 
                        textAlign: 'right',
                        color: darkMode ? '#e0e0e0' : '#2c3e50',
                        fontSize: '1.05rem'
                      }}
                    >
                      {comment.text}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })
          ) : hasSearched ? (
            <Box textAlign="center" py={5}>
              <Typography variant="h6" color="text.secondary">
                هیچ کامنتی برای این لینک یافت نشد. 🕵️‍♂️
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Container>
    </ThemeProvider>
  );
}