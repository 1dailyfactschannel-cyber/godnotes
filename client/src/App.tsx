import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense, useState } from "react";
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { getStoreValue } from "@/lib/electron";
import { UpdateManager } from "@/components/UpdateManager";
import ErrorBoundary from "@/components/ErrorBoundary";

const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Profile = lazy(() => import("@/pages/Profile"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const TodoPage = lazy(() => import("@/pages/Todo"));
const TaskWindow = lazy(() => import("@/pages/TaskWindow"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/not-found"));

function AppRoutes() {
  const { isAuthenticated } = useAuthContext();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && location === "/login") {
      setLocation("/");
    }
  }, [isAuthenticated, location, setLocation]);

  // Redirect to login when user logs out (isAuthenticated becomes false)
  useEffect(() => {
    console.log('Auth effect triggered:', { isAuthenticated, location });
    if (!isAuthenticated && location !== "/login" && location !== "/reset-password") {
      console.log('Redirecting to login because user is not authenticated');
      setLocation("/login");
    }
  }, [isAuthenticated, location, setLocation]);

  // Additional effect to ensure redirect happens immediately after logout
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('User is not authenticated, checking current location:', location);
      if (location !== "/login" && location !== "/reset-password") {
        console.log('Force redirecting to login');
        setLocation("/login");
      }
    }
  }, [isAuthenticated]);

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background text-foreground">Loading...</div>}>
      <Switch>
        <Route path="/login">
          {isAuthenticated ? <Redirect to="/" /> : <Login />}
        </Route>
        <Route path="/profile">
          {isAuthenticated ? <Profile /> : <Redirect to="/login" />}
        </Route>
        <Route path="/calendar">
          {isAuthenticated ? <CalendarPage /> : <Redirect to="/login" />}
        </Route>
        <Route path="/todo">
          {isAuthenticated ? <TodoPage /> : <Redirect to="/login" />}
        </Route>
        <Route path="/todo-window">
           {isAuthenticated ? (
             <div className="h-screen bg-background text-foreground overflow-auto p-4">
                <TodoPage />
             </div>
           ) : <Redirect to="/login" />}
        </Route>
        <Route path="/task/:taskId">
          {isAuthenticated ? <TaskWindow /> : <Redirect to="/login" />}
        </Route>
        <Route path="/reset-password">
          <ResetPasswordPage />
        </Route>
        <Route path="/">
          {isAuthenticated ? <Home /> : <Redirect to="/login" />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const { checkAuth, isAuthChecking } = useAuthContext();
  const [theme] = useState('obsidian-dark'); // Temporary theme setting

  useEffect(() => {
    const root = window.document.body;
    const themes = [
      'theme-midnight-blue', 
      'theme-graphite', 
      'theme-light-mode', 
      'theme-forest', 
      'theme-sunset', 
      'theme-ocean', 
      'theme-cyberpunk'
    ];
    root.classList.remove(...themes);
    
    if (theme && theme !== 'obsidian-dark') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  useEffect(() => {
    checkAuth();
  }, []);

  if (isAuthChecking) {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Loading...</div>;
  }

  return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <UpdateManager />
          <Toaster />
          <WouterRouter hook={useHashLocation}>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
  );
}

export default App;
