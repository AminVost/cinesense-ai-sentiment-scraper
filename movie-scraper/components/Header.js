import { AppBar, Toolbar, IconButton, Typography } from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";

export default function Header({ darkMode, toggleDarkMode }) {
  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: "bold" }}>
          LOGO
        </Typography>

        <IconButton onClick={toggleDarkMode} color="inherit">
          {darkMode ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
