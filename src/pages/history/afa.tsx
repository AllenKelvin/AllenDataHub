import { Link } from "wouter";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AfaHistoryPage() {
  const { toast } = useToast();

  return (
    <div>
      <PageHeader
        title="AFA Registrations"
        description="History of AFA registration submissions for your account."
        icon={FileText}
        iconClassName="bg-orange-100 text-orange-600"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => toast({ title: "Refreshed", description: "AFA history is up to date." })}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/user/afa">
              <Button className="gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                <Plus className="h-4 w-4" />
                New Registration
              </Button>
            </Link>
          </div>
        }
      />

      <EmptyState
        icon={FileText}
        title="No AFA registrations yet"
        description="Submit an AFA registration to track status and history here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => toast({ title: "Refreshed", description: "Still no registrations." })}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/user/afa">
              <Button className="gap-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600">
                <Plus className="h-4 w-4" />
                Register AFA
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
