"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",

    primary: {
      main: "#c5a66d",
      contrastText: "#090909",
    },

    background: {
      default: "#090909",
      paper: "#111111",
    },

    text: {
      primary: "#f5f1e8",
      secondary: "rgba(245, 241, 232, 0.5)",
    },

    divider: "rgba(255, 255, 255, 0.10)",
  },

  shape: {
    borderRadius: 18,
  },

  typography: {
    fontFamily:
      "var(--font-geist-sans, Arial), sans-serif",

    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },

  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },

      styleOverrides: {
        root: {
          minHeight: 54,
          borderRadius: 999,
          transition:
            "transform 120ms ease, background-color 120ms ease, border-color 120ms ease",

          "&:active": {
            transform: "scale(0.97)",
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          transition:
            "transform 120ms ease, background-color 120ms ease",

          "&:active": {
            transform: "scale(0.9)",
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          backgroundColor:
            "rgba(255, 255, 255, 0.035)",

          "& fieldset": {
            borderColor:
              "rgba(255, 255, 255, 0.10)",
          },

          "&:hover fieldset": {
            borderColor:
              "rgba(197, 166, 109, 0.35)",
          },

          "&.Mui-focused fieldset": {
            borderColor: "#c5a66d",
          },
        },
      },
    },

    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          backgroundColor: "#1a1a1a",
          color: "#f5f1e8",
        },
      },
    },
  },
});

export default theme;