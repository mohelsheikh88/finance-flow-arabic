import { useOfflineQueue } from "@/lib/offline-queue";
import { Wifi, WifiOff, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function OfflineIndicator() {
  const { online, queue, flush, clear, syncing, remove } = useOfflineQueue();
  const pending = queue.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 relative">
          {online ? (
            <Wifi className="h-4 w-4 text-emerald-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <span className="text-xs hidden sm:inline">
            {online ? "متصل" : "غير متصل"}
          </span>
          {pending > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {pending}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">طابور التغييرات</h4>
            <Badge variant={online ? "default" : "destructive"}>
              {online ? "متصل" : "غير متصل"}
            </Badge>
          </div>

          {pending === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              لا توجد تغييرات معلقة
            </p>
          ) : (
            <>
              <ScrollArea className="h-56">
                <ul className="space-y-2 pr-2">
                  {queue.map((item) => (
                    <li
                      key={item.id}
                      className="text-xs border rounded-md p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {item.op.toUpperCase()} · {item.table}
                        </span>
                        <button
                          onClick={() => remove(item.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("ar-SA")}
                      </div>
                      {item.lastError && (
                        <div className="text-destructive text-[10px]">
                          {item.lastError}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => flush()}
                  disabled={!online || syncing}
                >
                  <RefreshCw
                    className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "جاري المزامنة..." : "مزامنة الآن"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => clear()}>
                  مسح
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
