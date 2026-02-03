import { cn } from "@/lib/utils";
import { Wifi } from "lucide-react";

interface NetworkCardProps {
  network: string;
  onClick: () => void;
  isSelected?: boolean;
}

export function NetworkCard({ network, onClick, isSelected }: NetworkCardProps) {
  const getNetworkColor = (net: string) => {
    switch (net.toLowerCase()) {
      case 'mtn':
        return 'from-yellow-400 to-yellow-500 text-black';
      case 'vodafone':
        return 'from-red-500 to-pink-600 text-white';
      case 'telecel':
        return 'from-red-500 to-pink-600 text-white';
      case 'at':
      case 'airteltigo':
        return 'from-blue-500 to-blue-600 text-white'; // AirtelTigo
      default:
        return 'from-gray-500 to-gray-600 text-white';
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 h-32 w-full text-left transition-all duration-300",
        "hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-primary/20",
        isSelected ? "ring-4 ring-primary ring-offset-2 scale-[1.02]" : "shadow-md",
        "bg-gradient-to-br",
        getNetworkColor(network)
      )}
    >
      <div className="relative z-10 flex flex-col justify-between h-full">
        <Wifi className="w-8 h-8 opacity-80" />
        <h3 className="text-2xl font-bold font-display tracking-tight">{network}</h3>
      </div>
      
      {/* Abstract Pattern overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
    </button>
  );
}
