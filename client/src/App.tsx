import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFileSystem } from "@/lib/mock-fs";
import { useEffect, lazy, Suspense } from "react";
import { getStoreValue } from "@/lib/electron";
import { UpdateManager } from "@/components/UpdateManager";

const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Profile = lazy(() => import("@/pages/Profile"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const TodoPage = lazy(() => import("@/pages/Todo"));
const TaskWindow = lazy(() => import("@/pages/TaskWindow"));
const SharedNotePage = lazy(() => import("@/pages/SharedNotePage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/not-found"));

function AppRoutes() {
  const { isAuthenticated } = useFileSystem();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && location === "/login") {
      setLocation("/");
    }
  }, [isAuthenticated, location, setLocation]);

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
        <Route path="/share/:noteId">
          <SharedNotePage />
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
  const { checkAuth, isAuthChecking, theme } = useFileSystem();

  useEffect(() => {
    const root = window.document.body;
    root.classList.remove('theme-midnight-blue', 'theme-graphite', 'theme-light-mode');
    
    if (theme && theme !== 'obsidian-dark') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  useEffect(() => {
    checkAuth();

    // Restore storage path - kept for local preferences if needed, but no backend sync
    const initStorage = async () => {
        try {
            const path = await getStoreValue('storagePath');
            if (path) {
                console.log('Restoring storage path:', path);
                // Backend sync removed as we are using Appwrite
            }
        } catch (e) {
            console.error('Failed to restore storage path', e);
        }
    };
    initStorage();
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
          <AppRoutes />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
