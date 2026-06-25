import { Card } from "@/components/ui/AppCard";
import { Users } from "lucide-react";

export default function ClientSupport() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">General Support</h1>
        <p className="text-muted-foreground">Get help and find answers to your questions.</p>
      </div>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <div className="bg-primary/10 p-4 rounded-full text-primary">
            <Users className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-semibold mb-1">We're here to help</h3>
            <p className="text-muted-foreground text-sm">Do you have general questions about your account or need help finding a loan? Contact our central support team.</p>
          </div>
          <div className="w-full sm:w-auto">
            <a href="mailto:support@akili.rw" className="block w-full sm:w-auto bg-primary text-primary-foreground text-center px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
