import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Wand2, 
  PenTool, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoUrl from '@assets/hiddentech_logo_1024x576_1777502981816.png';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Wand2, label: "Tailor Resume", href: "/tailor" },
    { icon: FileText, label: "Cover Letter", href: "/cover-letter" },
    { icon: PenTool, label: "Resume Builder", href: "/builder" },
  ];

  return (
    <div className="min-h-screen bg-background flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:h-screen",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-border flex justify-center">
            <div className="flex flex-col items-center text-center">
              <img src={logoUrl} alt="Hidden Tech Daily" className="h-16 w-auto mb-3 rounded object-contain" />
              <h1 className="font-display font-bold text-xl tracking-tight leading-none">Career Craft</h1>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">by Hidden Tech Daily</span>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <a className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <Link href="/login">
              <Button variant="outline" className="w-full justify-start gap-3 px-4 py-3 h-auto font-medium border-primary/20 hover:bg-primary/10 hover:text-primary">
                <LogOut className="w-5 h-5" />
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border flex items-center px-4 bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </Button>
          <img src={logoUrl} alt="Hidden Tech Daily" className="h-8 w-auto rounded object-contain ml-4" />
          <div className="ml-3 flex flex-col justify-center">
            <span className="font-display font-bold text-lg leading-none">Career Craft</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">by Hidden Tech Daily</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/5 to-transparent -z-10" />
          
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}