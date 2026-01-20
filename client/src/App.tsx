import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFileSystem } from "@/lib/mock-fs";
import { useEffect, lazy, Suspense } from "react";
import { getStoreValue } from "@/lib/electron";

const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Profile = lazy(() => import("@/pages/Profile"));
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
        <Route path="/">
          {isAuthenticated ? <Home /> : <Redirect to="/login" />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const { checkAuth, isAuthChecking } = useFileSystem();

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
        <Toaster />
        <WouterRouter hook={useHashLocation}>
          <AppRoutes />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
