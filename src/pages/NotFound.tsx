import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md animate-in fade-in slide-in-from-bottom-4">
        <div className="flex justify-center mb-8">
          <img src="/app-icon.png" alt="AkiliCash" className="w-16 h-16 rounded-full" />
        </div>
        <h1 className="text-6xl font-bold tracking-tighter">404</h1>
        <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
        <p className="text-muted-foreground text-balance">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="pt-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/" to="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
