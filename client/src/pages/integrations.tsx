import { Card, CardContent } from "@/components/ui/card";
import { Plug } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold font-serif mb-6">Integrations</h1>
      <Card>
        <CardContent className="pt-12 pb-12">
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
              <Plug className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground">
              Connect third-party services like Twilio, Squarespace, and Toast POS
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
