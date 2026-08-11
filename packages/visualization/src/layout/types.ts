/**
 * Internal layout nodes for SVG/HTML renderers (not a public IR).
 */

export type LayoutNode = LayoutBar | LayoutCard | LayoutGroup | LayoutSpacer | LayoutText;

export interface LayoutGroup {
  kind: 'group';
  id: string;
  direction: 'column' | 'row';
  gap?: number;
  children: LayoutNode[];
}

export interface LayoutText {
  kind: 'text';
  id: string;
  text: string;
  role: 'body' | 'kpi' | 'label' | 'muted' | 'subtitle' | 'title';
}

export interface LayoutBar {
  kind: 'bar';
  id: string;
  label: string;
  valueLabel: string;
  secondaryLabel?: string;
  ratio: number;
  emphasized?: boolean;
}

export interface LayoutSpacer {
  kind: 'spacer';
  id: string;
  size: number;
}

export interface LayoutCard {
  kind: 'card';
  id: string;
  children: LayoutNode[];
}

export interface LayoutDocument {
  width: number;
  height: number;
  title: string;
  description?: string;
  root: LayoutGroup;
}
