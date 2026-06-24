import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/AppCard";
import { toast } from "sonner";
import { Loader2, Banknote } from "lucide-react";

const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
});

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const signInForm = useForm({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    setLoading(true);
    let error;
    if (isSignUp) {
      const res = await (supabase as any).auth.signUp({ email: values.email, password: values.password });
      error = res.error;
    } else {
      const res = await (supabase as any).auth.signInWithPassword({ email: values.email, password: values.password });
      error = res.error;
    }
    
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate("/");
  }

  async function onGoogleSignIn() {
    setLoading(true);
    const { error } = await (supabase as any).auth.signInWithGoogle();
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate("/");
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground" style={{ background: "var(--gradient-primary)" }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">
              <Banknote className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold">AkiliCash</span>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Lend smarter. Borrow better.</h2>
          <p className="text-sidebar-foreground/80">The premier platform connecting small lending businesses and verified borrowers with transparent credit reference tracking.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Join the unified credit network.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 shadow-elegant">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <Banknote className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">AkiliCash</h1>
          </div>
          <h2 className="text-2xl font-bold mb-1">{isSignUp ? "Create an account" : "Welcome back"}</h2>
          <p className="text-sm text-muted-foreground mb-6">{isSignUp ? "Sign up to join AkiliCash." : "Sign in to your account."}</p>
          
          <Button type="button" variant="outline" disabled={loading} className="w-full mb-4" onClick={onGoogleSignIn}>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={signInForm.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" {...signInForm.register("email")} />
              {signInForm.formState.errors.email && <p className="text-destructive text-xs mt-1">{signInForm.formState.errors.email.message}</p>}
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" {...signInForm.register("password")} />
              {signInForm.formState.errors.password && <p className="text-destructive text-xs mt-1">{signInForm.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {isSignUp ? "Sign up" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
