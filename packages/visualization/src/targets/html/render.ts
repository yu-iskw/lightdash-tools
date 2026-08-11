/**
 * Standalone HTML renderer. Data is not embedded unless caller asks.
 */

import { escapeHtml } from '../../format/escape';
import { resolveTheme } from '../../theme/lightdash';
import { renderSvg } from '../svg/render';

import type { VisualizationDataset } from '../../data/dataset';
import type { LayoutDocument } from '../../layout/types';

export interface RenderHtmlOptions {
  /** When true, embed dataset rows in a JSON script tag (sensitive). Default false. */
  embedData?: boolean;
  dataset?: VisualizationDataset;
}

function embedDatasetScript(dataset: VisualizationDataset): string {
  // Script-safe JSON: escape `<` so `</script>` in values cannot break out.
  const json = JSON.stringify(dataset).replace(/</g, '\\u003c');
  return `<script type="application/json" id="lvs-data">${json}</script>
<p class="warn">This file embeds query result rows. Protect it according to data sensitivity.</p>`;
}

export function renderHtml(layout: LayoutDocument, options: RenderHtmlOptions = {}): string {
  const theme = resolveTheme();
  const svg = renderSvg(layout);
  const embedData = options.embedData === true;
  const dataBlock = embedData && options.dataset ? embedDatasetScript(options.dataset) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(layout.title)}</title>
<style>
  :root {
    --bg: ${theme.palette.background};
    --text: ${theme.palette.text};
    --muted: ${theme.palette.mutedText};
    --accent: ${theme.palette.accent};
    --font: ${theme.typography.fontFamily};
  }
  body {
    margin: 0;
    padding: 24px;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
  }
  .frame { max-width: ${layout.width}px; margin: 0 auto; }
  .warn { color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<main class="frame">
${svg}
${dataBlock}
</main>
</body>
</html>
`;
}
