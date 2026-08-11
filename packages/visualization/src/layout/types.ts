/**
 * Internal layout nodes for SVG/HTML renderers (not a public IR).
 */

export type LayoutNode =
  | LayoutGroup
  | LayoutText
  | LayoutBar
  | LayoutSpacer
  | LayoutCard;

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
  role: 'title' | 'subtitle' | 'kpi' | 'label' | 'muted' | 'body';
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
