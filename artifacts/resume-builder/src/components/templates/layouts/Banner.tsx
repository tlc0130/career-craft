import React from 'react';
import { TemplateProps } from '../types';

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Present';
  const [year, month] = dateStr.split('-');
  if (!month) return year;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = parseInt(month, 10);
  return `${monthNames[m - 1] || month} ${year}`;
}

function renderDescription(description: string, textColor: string): React.ReactNode {
  if (!description) return null;
  const lines = description.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletItems: string[] = [];

  function flushBullets() {
    if (bulletItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '4px 0', paddingLeft: '18px' }}>
          {bulletItems.map((item, i) => (
            <li key={i} style={{ marginBottom: '2px', color: textColor, fontSize: '10pt', lineHeight: '1.4' }}>{item}</li>
          ))}
        </ul>
      );
      bulletItems = [];
    }
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      bulletItems.push(trimmed.replace(/^[•\-]\s*/, ''));
    } else {
      flushBullets();
      if (trimmed) {
        elements.push(
          <p key={i} style={{ margin: '2px 0', color: textColor, fontSize: '10pt', lineHeight: '1.4' }}>{trimmed}</p>
        );
      }
    }
  });
  flushBullets();
  return <>{elements}</>;
}

export default function Banner({ data, theme }: TemplateProps) {
  const { contact, experience, education, skills } = data;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  const containerStyle: React.CSSProperties = {
    fontFamily: theme.fontFamily,
    color: theme.text,
    backgroundColor: '#ffffff',
    width: '794px',
    minHeight: '1123px',
    boxSizing: 'border-box',
  };

  const bannerStyle: React.CSSProperties = {
    backgroundColor: theme.accent,
    padding: '32px 48px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '32px 48px',
    boxSizing: 'border-box',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '9pt',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.accent,
    borderBottom: `2px solid ${theme.accent}`,
    paddingBottom: '3px',
    marginBottom: '10px',
    marginTop: '22px',
  };

  return (
    <div style={containerStyle}>
      {/* Banner header */}
      <div style={bannerStyle}>
        <h1 style={{ fontSize: '28pt', fontWeight: 700, color: theme.accentFg, margin: '0 0 6px 0', lineHeight: 1.1 }}>
          {fullName || 'Your Name'}
        </h1>
        {contact.title && (
          <p style={{ fontSize: '12pt', color: `${theme.accentFg}cc`, margin: '0 0 12px 0', fontWeight: 400, letterSpacing: '0.02em' }}>
            {contact.title}
          </p>
        )}
        <p style={{ fontSize: '9pt', color: `${theme.accentFg}bb`, margin: 0, letterSpacing: '0.02em' }}>
          {[contact.email, contact.phone].filter(Boolean).join('   |   ')}
        </p>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Summary */}
        {contact.summary && (
          <div>
            <h2 style={{ ...headingStyle, marginTop: 0 }}>Summary</h2>
            <p style={{ fontSize: '10pt', color: theme.text, lineHeight: '1.5', margin: 0 }}>{contact.summary}</p>
          </div>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <div>
            <h2 style={headingStyle}>Experience</h2>
            {experience.map((exp) => (
              <div key={exp.id} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <span style={{ fontSize: '11pt', fontWeight: 700, color: theme.text }}>{exp.jobTitle}</span>
                    {exp.company && (
                      <span style={{ fontSize: '10pt', color: theme.accent, marginLeft: '6px' }}>@ {exp.company}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '9pt', color: theme.muted, whiteSpace: 'nowrap' }}>
                    {exp.startDate ? formatDate(exp.startDate) : ''}{exp.startDate ? ' – ' : ''}{exp.endDate ? formatDate(exp.endDate) : 'Present'}
                  </span>
                </div>
                <div style={{ marginTop: '4px' }}>
                  {renderDescription(exp.description, theme.text)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        {education.length > 0 && (
          <div>
            <h2 style={headingStyle}>Education</h2>
            {education.map((edu) => (
              <div key={edu.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <span style={{ fontSize: '11pt', fontWeight: 700, color: theme.text }}>{edu.degree}</span>
                    {edu.school && (
                      <span style={{ fontSize: '10pt', color: theme.accent, marginLeft: '6px' }}>@ {edu.school}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '9pt', color: theme.muted, whiteSpace: 'nowrap' }}>
                    {[edu.startYear, edu.endYear].filter(Boolean).join(' – ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div>
            <h2 style={headingStyle}>Skills</h2>
            <p style={{ fontSize: '10pt', color: theme.text, margin: 0, lineHeight: '1.6' }}>
              {skills.join('  •  ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
