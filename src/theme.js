import { createTheme } from "@mui/material/styles";
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#000269", light: "#e8efff" },
    secondary: { main: "#255293" },
    background: { default: "#f4f7fc", paper: "#ffffff" },
    text: { primary: "#172440", secondary: "#5c6c83" },
    divider: "#e4eaf3",
    error: { main: "#c71430" },
    warning: { main: "#805300" },
    success: { main: "#255293" },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif",
    h1: { fontFamily: "Manrope, sans-serif", fontWeight: 750 },
    h2: { fontFamily: "Manrope, sans-serif", fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 24, minHeight: 44, paddingInline: 20 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
  },
});
