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
        <ul key={`ul-${elements.length}`} style={{ margin: '4px 0', paddingLeft: '16px' }}>
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

export default function SidebarRight({ data, theme }: TemplateProps) {
  const { contact, experience, education, skills } = data;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  const containerStyle: React.CSSProperties = {
    fontFamily: theme.fontFamily,
    color: theme.text,
    backgroundColor: '#ffffff',
    width: '794px',
    minHeight: '1123px',
    display: 'flex',
    boxSizing: 'border-box',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    padding: '36px 32px',
    boxSizing: 'border-box',
  };

  const sidebarStyle: React.CSSProperties = {
    width: '220px',
    minHeight: '1123px',
    backgroundColor: theme.accent,
    padding: '36px 20px',
    boxSizing: 'border-box',
    flexShrink: 0,
  };

  const sidebarHeadingStyle: React.CSSProperties = {
    fontSize: '8pt',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: theme.accentFg,
    borderBottom: `1px solid ${theme.accentFg}40`,
    paddingBottom: '4px',
    marginBottom: '10px',
    marginTop: '20px',
  };

  const mainHeadingStyle: React.CSSProperties = {
    fontSize: '9pt',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.accent,
    borderBottom: `2px solid ${theme.accent}`,
    paddingBottom: '3px',
    marginBottom: '10px',
    marginTop: '20px',
  };

  return (
    <div style={containerStyle}>
      {/* Main content */}
      <div style={mainStyle}>
        {/* Name/title header in main column */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22pt', fontWeight: 700, color: theme.text, margin: '0 0 4px 0', lineHeight: 1.15 }}>
            {fullName || 'Your Name'}
          </h1>
          {contact.title && (
            <p style={{ fontSize: '11pt', color: theme.accent, margin: 0, fontWeight: 500 }}>
              {contact.title}
            </p>
          )}
        </div>

        {/* Summary */}
        {contact.summary && (
          <div>
            <h2 style={{ ...mainHeadingStyle, marginTop: 0 }}>Summary</h2>
            <p style={{ fontSize: '10pt', color: theme.text, lineHeight: '1.5', margin: 0 }}>{contact.summary}</p>
          </div>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <div>
            <h2 style={mainHeadingStyle}>Experience</h2>
            {experience.map((exp) => (
              <div key={exp.id} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
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
            <h2 style={mainHeadingStyle}>Education</h2>
            {education.map((edu) => (
              <div key={edu.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
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
      </div>

      {/* Sidebar */}
      <div style={sidebarStyle}>
        {/* Name block repeated top of sidebar for visual balance */}
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${theme.accentFg}30` }}>
          <p style={{ fontSize: '8pt', color: `${theme.accentFg}cc`, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Contact
          </p>
        </div>

        {contact.email && (
          <p style={{ fontSize: '8.5pt', color: theme.accentFg, margin: '0 0 6px 0', wordBreak: 'break-all', lineHeight: 1.3 }}>{contact.email}</p>
        )}
        {contact.phone && (
          <p style={{ fontSize: '8.5pt', color: theme.accentFg, margin: '0 0 6px 0', lineHeight: 1.3 }}>{contact.phone}</p>
        )}
        {contact.location && (
          <p style={{ fontSize: '8.5pt', color: theme.accentFg, margin: '0 0 6px 0', lineHeight: 1.3 }}>📍 {contact.location}</p>
        )}
        {contact.linkedin && (
          <p style={{ fontSize: '8.5pt', color: theme.accentFg, margin: '0 0 6px 0', wordBreak: 'break-all', lineHeight: 1.3 }}>🔗 {contact.linkedin}</p>
        )}
        {contact.website && (
          <p style={{ fontSize: '8.5pt', color: theme.accentFg, margin: '0 0 6px 0', wordBreak: 'break-all', lineHeight: 1.3 }}>🌐 {contact.website}</p>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div>
            <h2 style={sidebarHeadingStyle}>Skills</h2>
            {skills.map((skill, i) => (
              <p key={i} style={{ fontSize: '8.5pt', color: theme.accentFg, margin: '0 0 4px 0', lineHeight: 1.3 }}>
                {skill}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
