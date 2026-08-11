/**
 * Standalone HTML renderer. Data is not embedded unless caller asks.
 */

import { escapeHtml } from '../../format/escape';
import { resolveTheme } from '../../theme/lightdash';
import { renderSvg } from '../svg/render';

import type { VisualizationDataset } from '../../data/dataset';
import type { LayoutDocument, LayoutNode } from '../../layout/types';

function layoutHasBars(root: LayoutNode): boolean {
  if (root.kind === 'bar') return true;
  if (root.kind === 'group' || root.kind === 'card') {
    return root.children.some((child) => layoutHasBars(child));
  }
  return false;
}

export interface RenderHtmlOptions {
  /** When true, embed dataset rows in a JSON script tag (sensitive). Default false. */
  embedData?: boolean;
  dataset?: VisualizationDataset;
}

export function renderHtml(layout: LayoutDocument, options: RenderHtmlOptions = {}): string {
  const theme = resolveTheme();
  const svg = renderSvg(layout);
  const hasBars = layoutHasBars(layout.root);
  const embedData = options.embedData === true;
  const dataBlock =
    embedData && options.dataset
      ? `<script type="application/json" id="lvs-data">${escapeHtml(JSON.stringify(options.dataset))}</script>
<p class="warn">This file embeds query result rows. Protect it according to data sensitivity.</p>`
      : '';

  const selectionScript = hasBars
    ? `<script>
(function () {
  var bars = document.querySelectorAll('[data-bar]');
  bars.forEach(function (el) {
    el.addEventListener('click', function () {
      bars.forEach(function (b) { b.classList.remove('selected'); });
      el.classList.add('selected');
    });
  });
})();
</script>`
    : '';

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
  .selected { outline: 2px solid var(--accent); }
</style>
</head>
<body>
<main class="frame">
${svg}
${dataBlock}
</main>
${selectionScript}
</body>
</html>
`;
}
