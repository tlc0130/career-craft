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
        <ul key={`ul-${elements.length}`} style={{ margin: '2px 0', paddingLeft: '16px' }}>
          {bulletItems.map((item, i) => (
            <li key={i} style={{ marginBottom: '1px', color: textColor, fontSize: '9.5pt', lineHeight: '1.35' }}>{item}</li>
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
          <p key={i} style={{ margin: '1px 0', color: textColor, fontSize: '9.5pt', lineHeight: '1.35' }}>{trimmed}</p>
        );
      }
    }
  });
  flushBullets();
  return <>{elements}</>;
}

export default function Compact({ data, theme }: TemplateProps) {
  const { contact, experience, education, skills } = data;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  const containerStyle: React.CSSProperties = {
    fontFamily: theme.fontFamily,
    color: theme.text,
    backgroundColor: '#ffffff',
    width: '794px',
    minHeight: '1123px',
    padding: '32px 48px',
    boxSizing: 'border-box',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '8.5pt',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.accent,
    borderBottom: `1.5px solid ${theme.accent}`,
    paddingBottom: '2px',
    marginBottom: '6px',
    marginTop: '14px',
  };

  return (
    <div style={containerStyle}>
      {/* Two-line header: name left, contact right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '20pt', fontWeight: 700, color: theme.text, margin: 0, lineHeight: 1.1 }}>
          {fullName || 'Your Name'}
        </h1>
        <div style={{ textAlign: 'right' }}>
          {contact.title && (
            <p style={{ fontSize: '9.5pt', color: theme.accent, margin: '0 0 1px 0', fontWeight: 600 }}>{contact.title}</p>
          )}
          <p style={{ fontSize: '8.5pt', color: theme.muted, margin: 0 }}>
            {[contact.email, contact.phone].filter(Boolean).join('  |  ')}
          </p>
          {(contact.location || contact.linkedin || contact.website) && (
            <p style={{ fontSize: '8pt', color: theme.muted, margin: '2px 0 0 0' }}>
              {[
                contact.location ? `📍 ${contact.location}` : null,
                contact.linkedin ? `🔗 ${contact.linkedin}` : null,
                contact.website ? `🌐 ${contact.website}` : null,
              ].filter(Boolean).join('  |  ')}
            </p>
          )}
        </div>
      </div>

      {/* Thin rule */}
      <div style={{ height: '2px', backgroundColor: theme.accent, marginBottom: '10px' }} />

      {/* Summary */}
      {contact.summary && (
        <div>
          <h2 style={{ ...headingStyle, marginTop: 0 }}>Summary</h2>
          <p style={{ fontSize: '9.5pt', color: theme.text, lineHeight: '1.4', margin: 0 }}>{contact.summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div>
          <h2 style={headingStyle}>Experience</h2>
          {experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: '10pt', fontWeight: 700, color: theme.text }}>{exp.jobTitle}</span>
                  {exp.company && (
                    <span style={{ fontSize: '9.5pt', color: theme.accent, marginLeft: '5px' }}>@ {exp.company}</span>
                  )}
                </div>
                <span style={{ fontSize: '8.5pt', color: theme.muted, whiteSpace: 'nowrap' }}>
                  {exp.startDate ? formatDate(exp.startDate) : ''}{exp.startDate ? ' – ' : ''}{exp.endDate ? formatDate(exp.endDate) : 'Present'}
                </span>
              </div>
              <div style={{ marginTop: '2px' }}>
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
            <div key={edu.id} style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: '10pt', fontWeight: 700, color: theme.text }}>{edu.degree}</span>
                  {edu.school && (
                    <span style={{ fontSize: '9.5pt', color: theme.accent, marginLeft: '5px' }}>@ {edu.school}</span>
                  )}
                </div>
                <span style={{ fontSize: '8.5pt', color: theme.muted, whiteSpace: 'nowrap' }}>
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
          <p style={{ fontSize: '9.5pt', color: theme.text, margin: 0, lineHeight: '1.5' }}>
            {skills.join('  •  ')}
          </p>
        </div>
      )}
    </div>
  );
}
