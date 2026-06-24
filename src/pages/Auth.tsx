import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/AppCard";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
});

const TYPING_WORDS = ["Lend smarter.", "Borrow better.", "Grow together.", "Empower communities."];

function TypewriterEffect() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const currentWord = TYPING_WORDS[wordIndex];
    const typeSpeed = isDeleting ? 30 : 60;
    
    const timeout = setTimeout(() => {
      if (!isDeleting && text === currentWord) {
        setTimeout(() => setIsDeleting(true), 2500);
      } else if (isDeleting && text === "") {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % TYPING_WORDS.length);
      } else {
        setText(currentWord.substring(0, text.length + (isDeleting ? -1 : 1)));
      }
    }, typeSpeed);
    
    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex]);

  return (
    <span className="inline-block relative">
      {text}
      <span className="absolute -right-2 top-0 bottom-0 w-[2px] bg-sidebar-foreground animate-pulse"></span>
    </span>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const signInForm = useForm({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    setLoading(true);
    let error;
    if (isSignUp) {
      const res = await (api as any).auth.signUp({ email: values.email, password: values.password });
      error = res.error;
    } else {
      const res = await (api as any).auth.signInWithPassword({ email: values.email, password: values.password });
      error = res.error;
    }
    
    setLoading(false);
    if (error) {
      if (error.message.includes("auth/operation-not-allowed")) {
        toast.error("Authentication provider not enabled", {
          description: "Please enable Email/Password authentication in your Firebase Console.",
        });
      } else {
        toast.error(error.message);
      }
      return;
    }
    navigate("/");
  }

  async function onGoogleSignIn() {
    setLoading(true);
    const { error } = await (api as any).auth.signInWithGoogle();
    setLoading(false);
    if (error) {
      if (error.message.includes("auth/operation-not-allowed")) {
        toast.error("Google Sign-in not enabled", {
          description: "Please enable Google authentication in your Firebase Console.",
        });
      } else {
        toast.error(error.message);
      }
      return;
    }
    navigate("/");
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div>
          <div className="flex items-center gap-3">
            <img src="/app-icon.png" alt="Logo" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-xl font-bold tracking-tight">AkiliCash</span>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-bold leading-tight min-h-[48px]">
            <TypewriterEffect />
          </h2>
          <p className="text-sidebar-foreground/80 leading-relaxed">
            The premier platform connecting small lending businesses and verified borrowers with transparent credit reference tracking.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50 uppercase tracking-widest font-medium">Join the unified credit network.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-elegant">
          <div className="md:hidden flex items-center mb-8 gap-2">
            <img src="/app-icon.png" alt="Logo" className="w-6 h-6 rounded-full object-cover" />
            <h1 className="text-2xl font-bold tracking-tight">AkiliCash</h1>
          </div>
          <h2 className="text-2xl font-bold mb-1 tracking-tight">{isSignUp ? "Create an account" : "Welcome back"}</h2>
          <p className="text-sm text-muted-foreground mb-8">{isSignUp ? "Sign up to join AkiliCash." : "Sign in to your account."}</p>
          
          <Button type="button" variant="outline" disabled={loading} className="w-full mb-6 font-medium h-11" onClick={onGoogleSignIn}>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase font-medium">
              <span className="bg-card px-3 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={signInForm.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input type="email" {...signInForm.register("email")} className="h-11" placeholder="m@example.com" />
              {signInForm.formState.errors.email && <p className="text-destructive text-xs mt-1">{signInForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password</Label>
              <Input type="password" {...signInForm.register("password")} className="h-11" placeholder="••••••••" />
              {signInForm.formState.errors.password && <p className="text-destructive text-xs mt-1">{signInForm.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 font-medium mt-2">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {isSignUp ? "Sign up" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:text-primary/90 font-medium transition-colors">
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
