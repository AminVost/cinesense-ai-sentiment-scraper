import { useState } from "react";
import { TextField, Button, Slide, CircularProgress } from "@mui/material";
import { toast } from "react-toastify";

export default function CommentForm() {
  const [url, setUrl] = useState("");
  const [maxComments, setMaxComments] = useState(20);
  const [loading, setLoading] = useState(false);

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  };

  const fetchComments = async (url, maxComments) => {
    setLoading(true);
    const maxCount = parseInt(maxComments, 10) || 20; // ✅ Ensure valid number

    try {
      // Remove localhost completely
      const response = await fetch("/api/fetch-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url, maxComments: maxCount }),
      });

      const data = await response.json();
      console.log("✅ Extracted Comments:", data.comments);

      if (data.error) {
        toast.error(`🚨 خطا: ${data.error}`);
      } else {
        setComments(data.comments || []);
      }
    } catch (error) {
      toast.error("🚨 خطای سرور، لطفاً دوباره اfdsfdsfdsمتحان کنید." , error);
    }

    setLoading(false);
  };

  const handleStart = async () => {
    if (!isValidUrl(url)) {
      toast.error("🚨 URL نامعتبر است.");
      return;
    }

    setLoading(true);
    await fetchComments(url, maxComments);
    setLoading(false);
  };

  return (
    <>
      <TextField
        variant="outlined"
        placeholder="Enter URL..."
        sx={{ width: "100%", maxWidth: "400px", marginBottom: 2 }}
        onChange={(e) => setUrl(e.target.value)}
        value={url}
      />

      <TextField
        variant="outlined"
        type="number"
        placeholder="Enter max comments (default: 20)"
        sx={{ width: "100%", maxWidth: "400px", marginBottom: 2 }}
        onChange={(e) => setMaxComments(e.target.value)}
        value={maxComments}
      />

      <Slide direction="up" in={true} mountOnEnter unmountOnExit>
        <Button
          variant="contained"
          color="primary"
          sx={{ marginTop: 2, paddingX: 4, paddingY: 1 }}
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} sx={{ color: "white" }} /> : "🚀 Start"}
        </Button>
      </Slide>
    </>
  );
}
