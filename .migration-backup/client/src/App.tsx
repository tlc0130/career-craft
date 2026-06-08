import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Tailor from "@/pages/Tailor";
import Builder from "@/pages/Builder";
import CoverLetter from "@/pages/CoverLetter";
import Login from "@/pages/Login";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tailor" component={Tailor} />
      <Route path="/builder" component={Builder} />
      <Route path="/cover-letter" component={CoverLetter} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
