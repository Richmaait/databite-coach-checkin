import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CoachPortal from "./pages/CoachPortal";
import Dashboard from "./pages/Dashboard";
import TeamManagement from "./pages/TeamManagement";
import ClientCheckins from "./pages/ClientCheckins";
import ActivityReport from "./pages/ActivityReport";
import CoachPerformanceReport from "./pages/CoachPerformanceReport";
import ClientProgress from "./pages/ClientProgress";
import WeeklySummary from "./pages/WeeklySummary";
import SweepReport from "./pages/SweepReport";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/coach" component={CoachPortal} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/team" component={TeamManagement} />
      <Route path="/client-checkins" component={ClientCheckins} />
      <Route path="/activity-report" component={ActivityReport} />
      <Route path="/coach-performance" component={CoachPerformanceReport} />
      <Route path="/client-progress" component={ClientProgress} />
      <Route path="/weekly-summary" component={WeeklySummary} />
      <Route path="/sweep-report/:id" component={SweepReport} />
      <Route path="/client-performance"><Redirect to="/client-progress" /></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
