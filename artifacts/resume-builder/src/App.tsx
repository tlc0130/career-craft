import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Tailor from "@/pages/Tailor";
import Builder from "@/pages/Builder";
import CoverLetter from "@/pages/CoverLetter";
import Login from "@/pages/Login";
import MyResumes from "@/pages/MyResumes";
import JobTracker from "@/pages/JobTracker";
import ATSScore from "@/pages/ATSScore";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tailor" component={Tailor} />
      <Route path="/builder" component={Builder} />
      <Route path="/cover-letter" component={CoverLetter} />
      <Route path="/login" component={Login} />
      <Route path="/my-resumes" component={MyResumes} />
      <Route path="/ats-score" component={ATSScore} />
      <Route path="/job-tracker" component={JobTracker} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Toaster />
            <Router />
          </WouterRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
