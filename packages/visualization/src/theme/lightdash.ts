/**
 * Single MVP theme tokens.
 */

export interface VisualizationTheme {
  id: 'lightdash';
  typography: {
    fontFamily: string;
    titleSize: number;
    bodySize: number;
    kpiSize: number;
  };
  spacing: {
    unit: number;
    padding: number;
  };
  radius: {
    card: number;
  };
  palette: {
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    accent: string;
    positive: string;
    negative: string;
    warning: string;
    bar: string;
    barMuted: string;
  };
}

export const LIGHTDASH_THEME: VisualizationTheme = {
  id: 'lightdash',
  typography: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    titleSize: 18,
    bodySize: 13,
    kpiSize: 36,
  },
  spacing: {
    unit: 8,
    padding: 24,
  },
  radius: {
    card: 8,
  },
  palette: {
    background: '#ffffff',
    surface: '#f7f8fa',
    text: '#1b1c1e',
    mutedText: '#5c6370',
    accent: '#0e7c86',
    positive: '#1b7f4a',
    negative: '#b42318',
    warning: '#b54708',
    bar: '#0e7c86',
    barMuted: '#c5d0d3',
  },
};
