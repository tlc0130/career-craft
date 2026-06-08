import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowRight, Save, X } from "lucide-react";

export default function Builder() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Resume Builder</h1>
            <p className="text-muted-foreground">Build a professional resume from scratch using our guided wizard.</p>
          </div>
          <Button className="gap-2">
            <Save className="w-4 h-4" /> Save Draft
          </Button>
        </div>

        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Professional Title</Label>
                  <Input id="title" placeholder="e.g. Senior Product Manager" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="john@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">Professional Summary</Label>
                  <textarea 
                    id="summary" 
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Briefly describe your professional background and key achievements..."
                  />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button className="gap-2">Next: Experience <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="experience" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
             <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="border-l-2 border-primary/20 pl-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input placeholder="e.g. Software Engineer" />
                    </div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input placeholder="e.g. Tech Corp" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="month" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="month" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <textarea 
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Describe your responsibilities and achievements..."
                    />
                  </div>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="w-4 h-4" /> Remove
                  </Button>
                </div>
                
                <Button variant="outline" className="w-full border-dashed gap-2">
                  <Plus className="w-4 h-4" /> Add Another Position
                </Button>
              </CardContent>
            </Card>
             <div className="flex justify-end">
              <Button className="gap-2">Next: Education <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="education" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="border-l-2 border-primary/20 pl-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>School / University</Label>
                      <Input placeholder="e.g. University of Technology" />
                    </div>
                    <div className="space-y-2">
                      <Label>Degree</Label>
                      <Input placeholder="e.g. Bachelor of Science in Computer Science" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Year</Label>
                      <Input type="number" placeholder="2016" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Year (or Expected)</Label>
                      <Input type="number" placeholder="2020" />
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="w-4 h-4" /> Remove
                  </Button>
                </div>
                
                <Button variant="outline" className="w-full border-dashed gap-2 hover:border-primary/50 hover:bg-primary/5">
                  <Plus className="w-4 h-4" /> Add Another Education
                </Button>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button className="gap-2">Next: Skills <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </TabsContent>
          
          <TabsContent value="skills" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
             <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Add a Skill</Label>
                    <div className="flex gap-2">
                      <Input placeholder="e.g. React, Project Management, SEO" />
                      <Button className="shrink-0 gap-2"><Plus className="w-4 h-4" /> Add</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4">
                    {["JavaScript", "TypeScript", "React", "Node.js", "Tailwind CSS", "UI/UX Design"].map((skill) => (
                      <div key={skill} className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-sm">
                        {skill}
                        <button className="text-secondary-foreground/50 hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button className="gap-2">Finish & Review <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
