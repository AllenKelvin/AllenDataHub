import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

type ApiKeyRow = {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  status: "Active" | "Revoked";
};

function maskKey(key: string) {
  if (key.length < 12) return "••••••••";
  return `${key.slice(0, 10)}••••••••${key.slice(-4)}`;
}

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadKeys = async () => {
      if (!user) return;
      try {
        const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
        const response = await fetch(`${apiBase}/api/api-keys`, {
          headers: { "x-user-id": user.id },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load keys.");
        setKeys(
          (data.keys || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            key: item.key || item.keyPreview || "",
            created: new Date(item.createdAt || Date.now()).toLocaleDateString(),
            lastUsed: item.lastUsed ? new Date(item.lastUsed).toLocaleDateString() : "—",
            status: item.status === "Revoked" ? "Revoked" : "Active",
          }))
        );
      } catch {
        setKeys([]);
      }
    };

    loadKeys();
  }, [user]);

  const generate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
      const response = await fetch(`${apiBase}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ name: name.trim() || `Key ${keys.length + 1}` }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to generate key.");
      const row: ApiKeyRow = {
        id: data.key?.id || `key_${Date.now()}`,
        name: data.key?.name || "New key",
        key: data.key?.key || "",
        created: new Date(data.key?.createdAt || Date.now()).toLocaleDateString(),
        lastUsed: "—",
        status: "Active",
      };
      setKeys((prev) => [row, ...prev]);
      setRevealed(row.id);
      setName("");
      toast({ title: "API key generated", description: "Copy it now — full value is shown once." });
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Could not generate API key.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast({ title: "Copied", description: "API key copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: key, variant: "destructive" });
    }
  };

  const revoke = async (id: string) => {
    if (!user) return;
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:4000";
      const response = await fetch(`${apiBase}/api/api-keys/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to revoke key.");
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: "Revoked" } : k)));
      toast({ title: "Key revoked", description: "This key can no longer authenticate requests." });
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Could not revoke key.", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Generate, copy, and revoke keys used by your integrations."
        icon={KeyRound}
        iconClassName="bg-slate-100 text-slate-700"
      />

      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-violet-700">Generate new key</h2>
        <p className="mt-1 text-sm text-slate-500">Name the key so you can identify where it is used.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WhatsApp bot"
              className="rounded-xl"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={generate}
              className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white"
            >
              <Plus className="h-4 w-4" />
              Generate key
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-violet-700 dark:text-violet-400">Your keys</h2>
        </div>

        {keys.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={KeyRound}
              title="No API keys"
              description="Generate a key to start calling the dealer API."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-800/50">
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {revealed === row.id || row.status === "Revoked" ? row.key : maskKey(row.key)}
                  </TableCell>
                  <TableCell className="text-slate-500">{row.created}</TableCell>
                  <TableCell className="text-slate-500">{row.lastUsed}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.status === "Active"
                          ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                          : "inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
                      }
                    >
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 rounded-lg"
                        disabled={row.status === "Revoked"}
                        onClick={() => {
                          setRevealed(row.id);
                          copyKey(row.key);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 rounded-lg text-rose-600 hover:text-rose-700"
                        disabled={row.status === "Revoked"}
                        onClick={() => revoke(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
