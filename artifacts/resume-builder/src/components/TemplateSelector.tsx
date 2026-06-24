import { useState } from 'react';
import { TEMPLATES } from './templates';
import { ResumeContent, TemplateConfig } from './templates/types';
import TemplateRenderer from './TemplateRenderer';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  data: ResumeContent;
}

const CATEGORIES = ['All', 'classic', 'modern', 'creative', 'tech', 'executive'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_LABELS: Record<Category, string> = {
  All: 'All',
  classic: 'Classic',
  modern: 'Modern',
  creative: 'Creative',
  tech: 'Tech',
  executive: 'Executive',
};

// The inner preview div is 794px wide, scaled to fit in a 143px container
// scale = 143 / 794 ≈ 0.18
const PREVIEW_SCALE = 143 / 794;
const PREVIEW_HEIGHT = Math.round(1123 * PREVIEW_SCALE); // ~202px

export default function TemplateSelector({ selectedId, onSelect, data }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const filtered: TemplateConfig[] = activeCategory === 'All'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory);

  return (
    <div>
      {/* Category filter row */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={
              activeCategory === cat
                ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground'
                : 'px-3 py-1.5 rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '16px',
        }}
      >
        {filtered.map((template) => {
          const isSelected = template.id === selectedId;
          return (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                outline: 'none',
              }}
            >
              <div
                style={{
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: isSelected
                    ? `3px solid hsl(var(--primary))`
                    : '2px solid transparent',
                  boxShadow: isSelected
                    ? '0 0 0 2px hsl(var(--primary) / 0.3)'
                    : '0 1px 4px rgba(0,0,0,0.12)',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
              >
                {/* Scaled preview thumbnail */}
                <div
                  style={{
                    width: '143px',
                    height: `${PREVIEW_HEIGHT}px`,
                    overflow: 'hidden',
                    position: 'relative',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      width: '794px',
                      transformOrigin: 'top left',
                      transform: `scale(${PREVIEW_SCALE})`,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    <TemplateRenderer templateId={template.id} data={data} />
                  </div>
                </div>

                {/* Template name */}
                <div
                  style={{
                    padding: '8px 10px',
                    backgroundColor: isSelected ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--card))',
                    borderTop: '1px solid hsl(var(--border))',
                  }}
                >
                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {template.name}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
