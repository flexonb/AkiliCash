import { useEffect, useState } from "react";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Plus, CheckCircle2 } from "lucide-react";

export default function Install() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div className="text-center space-y-2">
        <Smartphone className="w-12 h-12 mx-auto text-primary" />
        <h1 className="text-3xl font-bold">Install SenteFlaw</h1>
        <p className="text-muted-foreground">
          Add to your home screen for one-tap access and offline use.
        </p>
      </div>

      {installed ? (
        <Card className="p-6 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
          <h2 className="text-xl font-semibold">Already installed</h2>
          <p className="text-muted-foreground text-sm">
            You're using the installed app. Open it from your home screen anytime.
          </p>
        </Card>
      ) : deferred ? (
        <Card className="p-6 text-center space-y-4">
          <p>Tap the button below to install on your device.</p>
          <Button size="lg" onClick={install}>Install app</Button>
        </Card>
      ) : isIOS ? (
        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">Install on iPhone / iPad</h2>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Share className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Tap the <b>Share</b> button at the bottom of Safari.</span>
            </li>
            <li className="flex items-start gap-2">
              <Plus className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Choose <b>Add to Home Screen</b>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Tap <b>Add</b> in the top-right corner.</span>
            </li>
          </ol>
        </Card>
      ) : (
        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">Install on Android</h2>
          <ol className="space-y-2 text-sm list-decimal list-inside">
            <li>Open the browser menu (⋮ in Chrome).</li>
            <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
            <li>Confirm and the app icon will appear on your home screen.</li>
          </ol>
        </Card>
      )}

      <Card className="p-4 text-sm text-muted-foreground">
        Once installed, the app opens like a native app and works offline for viewing existing
        clients, loans and payments. Recording new data still requires an internet connection
        (offline writes are coming soon).
      </Card>
    </div>
  );
}
