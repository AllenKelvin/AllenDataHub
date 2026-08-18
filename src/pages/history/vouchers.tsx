import { Link } from "wouter";
import { Plus, RefreshCw, Ticket } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function VoucherHistoryPage() {
  const { toast } = useToast();

  return (
    <div>
      <PageHeader
        title="Voucher Purchases"
        description="History of voucher shop purchases linked to your wallet."
        icon={Ticket}
        iconClassName="bg-violet-100 text-violet-600"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => toast({ title: "Refreshed", description: "Voucher history is up to date." })}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/user/vouchers">
              <Button className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white">
                <Plus className="h-4 w-4" />
                Browse Vouchers
              </Button>
            </Link>
          </div>
        }
      />

      <EmptyState
        icon={Ticket}
        title="No voucher purchases yet"
        description="Buy airtime or data vouchers from the shop to see them listed here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => toast({ title: "Refreshed", description: "Still no purchases." })}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/user/vouchers">
              <Button className="gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Plus className="h-4 w-4" />
                Shop Vouchers
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
