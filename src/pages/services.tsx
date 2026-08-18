import { Gift, PlayCircle, Sparkles, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const SERVICES = [
  {
    id: "bulk",
    title: "Bulk Ordering Desk",
    description: "Priority queue for dealers placing 50+ orders per day with dedicated support.",
    badge: "Popular",
    icon: Zap,
    tone: "from-blue-50 to-violet-50 border-blue-100",
  },
  {
    id: "float",
    title: "Weekend Float Boost",
    description: "Temporary float extension for high-demand weekends. Apply before Friday 4pm.",
    badge: "Limited",
    icon: Sparkles,
    tone: "from-emerald-50 to-teal-50 border-emerald-100",
  },
  {
    id: "loyalty",
    title: "Loyalty Cashback",
    description: "Earn up to 1.5% cashback on completed MTN volume each month.",
    badge: "Active",
    icon: Gift,
    tone: "from-amber-50 to-orange-50 border-amber-100",
  },
  {
    id: "api",
    title: "API Automation Starter",
    description: "Guided setup for integrating data purchases into your own storefront or bot.",
    badge: "New",
    icon: PlayCircle,
    tone: "from-fuchsia-50 to-pink-50 border-fuchsia-100",
  },
];

export default function ServicesPage() {
  const { toast } = useToast();

  return (
    <div>
      <PageHeader
        title="Services & Offers"
        description="Optional add-ons and campaigns available to approved dealers."
        icon={PlayCircle}
        iconClassName="bg-pink-100 text-pink-600"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          return (
            <div
              key={service.id}
              className={`rounded-2xl border bg-gradient-to-br p-6 shadow-sm ${service.tone} dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-violet-600 shadow-sm dark:bg-slate-800 dark:text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge className="rounded-full bg-white/90 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{service.badge}</Badge>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{service.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{service.description}</p>
              <Button
                className="mt-5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white"
                onClick={() =>
                  toast({
                    title: "Interest recorded",
                    description: `We'll follow up about “${service.title}”.`,
                  })
                }
              >
                Get started
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
