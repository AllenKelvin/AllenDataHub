import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function VouchersPage() {
  return (
    <div>
      <PageHeader
        title="Vouchers Shop"
        description="New voucher offers will be added here soon."
        icon={Ticket}
        iconClassName="bg-violet-100 text-violet-600"
      />

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
          <Ticket className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">No vouchers available right now</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The voucher shop is temporarily empty while new offers are being prepared.
        </p>
        <Link href="/user/dashboard">
          <Button className="mt-5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white">
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
