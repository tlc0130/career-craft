import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface ResumePreviewProps {
  data?: any; // In a real app, this would be a structured Resume type
  isLoading?: boolean;
}

export function ResumePreview({ data, isLoading }: ResumePreviewProps) {
  if (isLoading) {
    return (
      <Card className="w-full h-[600px] bg-white animate-pulse p-8 space-y-4 shadow-sm border-border/50">
        <div className="h-8 bg-muted rounded w-1/3 mx-auto mb-8" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-4/6" />
        </div>
        <div className="h-32 bg-muted rounded w-full mt-8" />
        <div className="h-32 bg-muted rounded w-full mt-4" />
      </Card>
    );
  }

  return (
    <Card className="w-full h-[800px] bg-white text-slate-900 shadow-sm border-border/50 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
      
      <ScrollArea className="h-full p-8 md:p-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display mb-2">ALEXANDER JAMES</h1>
          <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">Senior Software Engineer</p>
          <div className="flex justify-center gap-4 mt-4 text-xs text-slate-400">
            <span>sanfrancisco, ca</span>
            <span>•</span>
            <span>alex.james@example.com</span>
            <span>•</span>
            <span>linkedin.com/in/alexjames</span>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Summary */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Professional Summary</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Results-driven Senior Software Engineer with 8+ years of experience in full-stack development, specializing in React, Node.js, and cloud architectures. Proven track record of leading cross-functional teams to deliver scalable solutions that drive business growth. Passionate about code quality, performance optimization, and mentoring junior developers.
          </p>
        </div>

        {/* Experience */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Experience</h3>
          
          <div className="mb-6">
            <div className="flex justify-between items-baseline mb-1">
              <h4 className="font-bold text-slate-800">Senior Frontend Engineer</h4>
              <span className="text-xs text-slate-400">2021 - Present</span>
            </div>
            <p className="text-sm text-slate-500 mb-2 font-medium">TechFlow Solutions • San Francisco, CA</p>
            <ul className="list-disc list-outside ml-4 space-y-1 text-sm text-slate-600">
              <li>Architected and led the migration of a legacy monolith to a micro-frontend architecture, reducing build times by 40%.</li>
              <li>Implemented a comprehensive design system using React and Tailwind CSS, improving UI consistency across 5 product lines.</li>
              <li>Mentored a team of 6 junior engineers, conducting code reviews and weekly technical workshops.</li>
            </ul>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-baseline mb-1">
              <h4 className="font-bold text-slate-800">Software Developer</h4>
              <span className="text-xs text-slate-400">2018 - 2021</span>
            </div>
            <p className="text-sm text-slate-500 mb-2 font-medium">Innovate Corp • Austin, TX</p>
            <ul className="list-disc list-outside ml-4 space-y-1 text-sm text-slate-600">
              <li>Developed and maintained critical RESTful APIs serving 1M+ daily active users.</li>
              <li>Optimized database queries, resulting in a 25% reduction in server response time.</li>
              <li>Collaborated with product managers to define requirements and deliver features ahead of schedule.</li>
            </ul>
          </div>
        </div>

        {/* Skills */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Core Competencies</h3>
          <div className="flex flex-wrap gap-2">
            {["React", "TypeScript", "Node.js", "AWS", "Docker", "GraphQL", "System Design", "Agile Leadership"].map((skill) => (
              <Badge key={skill} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-normal">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
