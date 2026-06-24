export interface ResumeContent {
  contact: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
    phone: string;
    summary: string;
    location?: string;    // e.g. "San Francisco, CA"
    linkedin?: string;    // e.g. "linkedin.com/in/username"
    website?: string;     // e.g. "portfolio.dev"
  };
  experience: {
    id: string;
    jobTitle: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
  }[];
  education: {
    id: string;
    school: string;
    degree: string;
    startYear: string;
    endYear: string;
  }[];
  skills: string[];
}

export interface TemplateTheme {
  accent: string;      // e.g. "#1e3a5f"
  accentFg: string;    // foreground on accent bg: "#ffffff" or "#000000"
  text: string;        // body text color e.g. "#1a1a1a"
  muted: string;       // muted text e.g. "#666666"
  border: string;      // border/rule color
  fontFamily: string;  // CSS font stack
}

export interface TemplateConfig {
  id: string;
  name: string;
  category: 'classic' | 'modern' | 'creative' | 'tech' | 'executive';
  layout: 'single' | 'sidebar-left' | 'sidebar-right' | 'banner' | 'compact';
  theme: TemplateTheme;
}

export interface TemplateProps {
  data: ResumeContent;
  theme: TemplateTheme;
}
