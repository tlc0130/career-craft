import { TemplateConfig, TemplateTheme } from './types';

const serifFont = "Georgia, 'Times New Roman', serif";
const sansFont = "'Inter', 'Segoe UI', system-ui, sans-serif";

function makeTheme(accent: string, fontFamily: string): TemplateTheme {
  return {
    accent,
    accentFg: '#ffffff',
    text: '#1a1a1a',
    muted: '#666666',
    border: '#d1d5db',
    fontFamily,
  };
}

export const TEMPLATES: TemplateConfig[] = [
  // --- Single Column ---
  {
    id: 'classic',
    name: 'Classic',
    category: 'classic',
    layout: 'single',
    theme: makeTheme('#1a1a1a', serifFont),
  },
  {
    id: 'navy',
    name: 'Navy Blue',
    category: 'classic',
    layout: 'single',
    theme: makeTheme('#1e3a5f', sansFont),
  },
  {
    id: 'slate',
    name: 'Slate',
    category: 'modern',
    layout: 'single',
    theme: makeTheme('#475569', sansFont),
  },
  {
    id: 'emerald',
    name: 'Emerald',
    category: 'creative',
    layout: 'single',
    theme: makeTheme('#065f46', sansFont),
  },
  {
    id: 'rose',
    name: 'Rose',
    category: 'creative',
    layout: 'single',
    theme: makeTheme('#9f1239', sansFont),
  },

  // --- Sidebar Left ---
  {
    id: 'sidebar-classic',
    name: 'Sidebar Classic',
    category: 'classic',
    layout: 'sidebar-left',
    theme: makeTheme('#2d2d2d', serifFont),
  },
  {
    id: 'sidebar-navy',
    name: 'Executive Blue',
    category: 'executive',
    layout: 'sidebar-left',
    theme: makeTheme('#1e3a5f', sansFont),
  },
  {
    id: 'sidebar-slate',
    name: 'Metro',
    category: 'modern',
    layout: 'sidebar-left',
    theme: makeTheme('#475569', sansFont),
  },
  {
    id: 'sidebar-emerald',
    name: 'Verdant',
    category: 'creative',
    layout: 'sidebar-left',
    theme: makeTheme('#065f46', sansFont),
  },
  {
    id: 'sidebar-rose',
    name: 'Blush',
    category: 'creative',
    layout: 'sidebar-left',
    theme: makeTheme('#9f1239', sansFont),
  },

  // --- Sidebar Right ---
  {
    id: 'right-classic',
    name: 'Asymmetric',
    category: 'classic',
    layout: 'sidebar-right',
    theme: makeTheme('#2d2d2d', serifFont),
  },
  {
    id: 'right-navy',
    name: 'Corporate',
    category: 'executive',
    layout: 'sidebar-right',
    theme: makeTheme('#1e3a5f', sansFont),
  },
  {
    id: 'right-slate',
    name: 'Gray Matter',
    category: 'modern',
    layout: 'sidebar-right',
    theme: makeTheme('#475569', sansFont),
  },
  {
    id: 'right-emerald',
    name: 'Sage',
    category: 'creative',
    layout: 'sidebar-right',
    theme: makeTheme('#065f46', sansFont),
  },
  {
    id: 'right-rose',
    name: 'Coral',
    category: 'creative',
    layout: 'sidebar-right',
    theme: makeTheme('#be123c', sansFont),
  },

  // --- Banner ---
  {
    id: 'banner-classic',
    name: 'Bold Header',
    category: 'classic',
    layout: 'banner',
    theme: makeTheme('#1a1a1a', serifFont),
  },
  {
    id: 'banner-navy',
    name: 'Nautical',
    category: 'executive',
    layout: 'banner',
    theme: makeTheme('#1e3a5f', sansFont),
  },
  {
    id: 'banner-slate',
    name: 'Architect',
    category: 'modern',
    layout: 'banner',
    theme: makeTheme('#334155', sansFont),
  },
  {
    id: 'banner-emerald',
    name: 'Meadow',
    category: 'creative',
    layout: 'banner',
    theme: makeTheme('#065f46', sansFont),
  },
  {
    id: 'banner-rose',
    name: 'Aurora',
    category: 'creative',
    layout: 'banner',
    theme: makeTheme('#9f1239', sansFont),
  },

  // --- Compact ---
  {
    id: 'compact-classic',
    name: 'Minimal',
    category: 'classic',
    layout: 'compact',
    theme: makeTheme('#1a1a1a', serifFont),
  },
  {
    id: 'compact-navy',
    name: 'Clean Blue',
    category: 'tech',
    layout: 'compact',
    theme: makeTheme('#1e3a5f', sansFont),
  },
  {
    id: 'compact-slate',
    name: 'Streamline',
    category: 'tech',
    layout: 'compact',
    theme: makeTheme('#475569', sansFont),
  },
  {
    id: 'compact-emerald',
    name: 'Ivy',
    category: 'creative',
    layout: 'compact',
    theme: makeTheme('#065f46', sansFont),
  },
  {
    id: 'compact-rose',
    name: 'Petal',
    category: 'creative',
    layout: 'compact',
    theme: makeTheme('#9f1239', sansFont),
  },
];

export function getTemplate(id: string): TemplateConfig {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
