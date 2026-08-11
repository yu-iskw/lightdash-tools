/**
 * Deterministic SVG renderer from internal layout.
 */

import { escapeXml } from '../../format/escape';
import { LIGHTDASH_THEME } from '../../theme/lightdash';

import type { LayoutDocument, LayoutNode } from '../../layout/types';
import type { VisualizationTheme } from '../../theme/lightdash';

function textStyle(
  role: string,
  theme: VisualizationTheme,
): { size: number; weight: number; fill: string } {
  switch (role) {
    case 'title':
      return { size: theme.typography.titleSize, weight: 700, fill: theme.palette.text };
    case 'kpi':
      return { size: theme.typography.kpiSize, weight: 700, fill: theme.palette.text };
    case 'subtitle':
      return { size: theme.typography.bodySize, weight: 500, fill: theme.palette.mutedText };
    case 'label':
      return { size: theme.typography.bodySize, weight: 600, fill: theme.palette.text };
    case 'muted':
      return { size: theme.typography.bodySize - 1, weight: 400, fill: theme.palette.mutedText };
    default:
      return { size: theme.typography.bodySize, weight: 400, fill: theme.palette.text };
  }
}

interface RenderState {
  y: number;
  parts: string[];
  theme: VisualizationTheme;
  width: number;
}

function renderNode(node: LayoutNode, state: RenderState, x: number): void {
  const { theme } = state;
  switch (node.kind) {
    case 'spacer': {
      state.y += node.size;
      return;
    }
    case 'text': {
      const style = textStyle(node.role, theme);
      state.y += style.size;
      state.parts.push(
        `<text id="${escapeXml(node.id)}" x="${x}" y="${state.y}" font-size="${style.size}" font-weight="${style.weight}" fill="${style.fill}" font-family="${escapeXml(theme.typography.fontFamily)}">${escapeXml(node.text)}</text>`,
      );
      state.y += 6;
      return;
    }
    case 'bar': {
      const barMax = state.width - x * 2 - 180;
      const barWidth = Math.max(2, Math.round(barMax * node.ratio));
      const fill = node.emphasized ? theme.palette.accent : theme.palette.bar;
      state.y += 14;
      state.parts.push(
        `<text id="${escapeXml(node.id)}-label" x="${x}" y="${state.y}" font-size="${theme.typography.bodySize}" font-weight="600" fill="${theme.palette.text}" font-family="${escapeXml(theme.typography.fontFamily)}">${escapeXml(node.label)}</text>`,
      );
      state.y += 10;
      state.parts.push(
        `<rect id="${escapeXml(node.id)}" x="${x}" y="${state.y}" width="${barWidth}" height="12" rx="3" fill="${fill}" />`,
      );
      state.parts.push(
        `<text id="${escapeXml(node.id)}-value" x="${x + barMax + 12}" y="${state.y + 11}" font-size="${theme.typography.bodySize}" fill="${theme.palette.text}" font-family="${escapeXml(theme.typography.fontFamily)}">${escapeXml(node.valueLabel)}${node.secondaryLabel ? ` · ${escapeXml(node.secondaryLabel)}` : ''}</text>`,
      );
      state.y += 22;
      return;
    }
    case 'card': {
      const startY = state.y;
      const inner: string[] = [];
      const nested: RenderState = { ...state, parts: inner, y: state.y + theme.spacing.unit };
      for (const child of node.children) {
        renderNode(child, nested, x + theme.spacing.unit);
      }
      const endY = nested.y + theme.spacing.unit;
      state.parts.push(
        `<rect id="${escapeXml(node.id)}-bg" x="${x}" y="${startY}" width="${state.width - x * 2}" height="${endY - startY}" rx="${theme.radius.card}" fill="${theme.palette.surface}" />`,
      );
      state.parts.push(...inner);
      state.y = endY + theme.spacing.unit;
      return;
    }
    case 'group': {
      for (const child of node.children) {
        renderNode(child, state, x);
        state.y += node.gap ?? 0;
      }
      return;
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function renderSvg(layout: LayoutDocument): string {
  const theme = LIGHTDASH_THEME;
  const state: RenderState = {
    y: theme.spacing.padding,
    parts: [],
    theme,
    width: layout.width,
  };
  renderNode(layout.root, state, theme.spacing.padding);
  const height = Math.max(layout.height, Math.ceil(state.y + theme.spacing.padding));
  const title = escapeXml(layout.title);
  const desc = layout.description ? `<desc>${escapeXml(layout.description)}</desc>` : '';
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${height}" viewBox="0 0 ${layout.width} ${height}" role="img" aria-labelledby="title">`,
    `<title id="title">${title}</title>`,
    desc,
    `<rect width="100%" height="100%" fill="${theme.palette.background}" />`,
    ...state.parts,
    `</svg>`,
  ].join('\n');
}
