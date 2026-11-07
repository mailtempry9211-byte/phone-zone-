import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  RotateCcw,
  Trash2,
  Smartphone,
  Wrench,
  Users,
  UserCheck,
  Building2,
  Clock,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface RecycleItem {
  id: string;
  type: 'phone' | 'repair' | 'customer' | 'seller' | 'dealer';
  typeLabel: string;
  title: string;
  subtitle: string;
  deleted_at: string;
  days_left: number;
  retention_days: number;
  media_count: number;
  media_urls: string[];
}

interface RecycleBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete?: () => void;
}

export const RecycleBinDialog: React.FC<RecycleBinDialogProps> = ({
  open,
  onOpenChange,
  onActionComplete,
}) => {
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [retentionDays, setRetentionDays] = useState(15);
  const [environment, setEnvironment] = useState('render_cloud');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchRecycleBin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recycle-bin', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setRetentionDays(data.retentionDays || 15);
        setEnvironment(data.environment || 'render_cloud');
      }
    } catch {
      toast.error('Failed to load Recycle Bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecycleBin();
    }
  }, [open]);

  const handleRestore = async (item: RecycleItem) => {
    setActionInProgress(item.id);
    try {
      const res = await fetch('/api/recycle-bin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      if (!res.ok) throw new Error('Failed to restore item');
      toast.success(`Restored "${item.title}" successfully!`);
      await fetchRecycleBin();
      onActionComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Error restoring item');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePermanentDelete = async (item: RecycleItem) => {
    if (
      !confirm(
        `⚠️ PERMANENT DELETE WARNING:\n\nAre you sure you want to permanently destroy "${item.title}"?\n\nThis will permanently erase the database row AND all ${item.media_count} linked photo/media files from storage and Supabase Cloud. This cannot be undone.`
      )
    ) {
      return;
    }

    setActionInProgress(item.id);
    try {
      const res = await fetch('/api/recycle-bin/permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      if (!res.ok) throw new Error('Failed to permanently delete item');
      toast.success(`Permanently deleted "${item.title}" and wiped linked photos.`);
      await fetchRecycleBin();
      onActionComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting item');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleEmptyBin = async () => {
    if (items.length === 0) return;
    if (
      !confirm(
        `⚠️ EMPTY RECYCLE BIN:\n\nAre you sure you want to permanently delete ALL ${items.length} items from the Recycle Bin?\n\nAll records AND their photos in storage and Supabase Cloud will be permanently erased. This action CANNOT be undone.`
      )
    ) {
      return;
    }

    setActionInProgress('empty_all');
    try {
      const res = await fetch('/api/recycle-bin/empty', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to empty recycle bin');
      const data = await res.json();
      toast.success(`Recycle bin emptied! Permanently deleted ${data.deletedCount} records & ${data.mediaCount} files.`);
      await fetchRecycleBin();
      onActionComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Error emptying recycle bin');
    } finally {
      setActionInProgress(null);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'phone':
        return <Smartphone className="h-4 w-4 text-blue-400" />;
      case 'repair':
        return <Wrench className="h-4 w-4 text-orange-400" />;
      case 'customer':
        return <UserCheck className="h-4 w-4 text-emerald-400" />;
      case 'seller':
        return <Users className="h-4 w-4 text-violet-400" />;
      case 'dealer':
        return <Building2 className="h-4 w-4 text-cyan-400" />;
      default:
        return <Trash2 className="h-4 w-4 text-slate-400" />;
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.typeLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader className="space-y-2 pb-3 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  PhoneZone Recycle Bin (रीसायकल बिन)
                  <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Deleted records are kept safe here before permanent deletion. Restore anytime or delete permanently.
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] py-1 px-2.5 flex items-center gap-1.5 self-start sm:self-center">
              <Clock className="h-3.5 w-3.5" />
              {retentionDays}-Day Auto-Purge Policy ({environment === 'render_cloud' ? 'Render Cloud' : 'Desktop'})
            </Badge>
          </div>
        </DialogHeader>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 pb-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search deleted items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
            {[
              { id: 'all', label: 'All' },
              { id: 'phone', label: 'Phones' },
              { id: 'repair', label: 'Repairs' },
              { id: 'customer', label: 'Customers' },
              { id: 'seller', label: 'Sellers' },
              { id: 'dealer', label: 'Dealers' },
            ].map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filterType === f.id ? 'default' : 'outline'}
                onClick={() => setFilterType(f.id)}
                className={`h-7 px-2.5 text-xs ${
                  filterType === f.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {f.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchRecycleBin}
              disabled={loading}
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[260px] max-h-[380px]">
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              <p className="text-xs">Loading Recycle Bin items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-lg bg-slate-950/40">
              <div className="p-3 rounded-full bg-slate-800/60">
                <RotateCcw className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-300">Recycle Bin is Empty (रीसायकल बिन खाली है)</p>
              <p className="text-xs text-slate-500 max-w-sm text-center">
                {searchQuery || filterType !== 'all'
                  ? 'No items match your filter. Try clearing filters.'
                  : 'No deleted records found. When phones, repairs, or customers are deleted, they will appear here.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                    {getItemIcon(item.type)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white truncate">{item.title}</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-slate-900 text-slate-300 border-slate-700">
                        {item.typeLabel}
                      </Badge>
                      {item.media_count > 0 && (
                        <span className="text-[10px] text-cyan-400 font-medium inline-flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {item.media_count} {item.media_count === 1 ? 'file' : 'files'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Deleted: {new Date(item.deleted_at).toLocaleDateString()}</span>
                      <span
                        className={`font-medium ${
                          item.days_left <= 3 ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        ⏳ {item.days_left} {item.days_left === 1 ? 'day' : 'days'} left before permanent auto-purge
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(item)}
                    disabled={actionInProgress === item.id}
                    className="h-8 text-xs bg-emerald-950/30 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50 hover:text-emerald-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Restore (वापस लाएं)
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handlePermanentDelete(item)}
                    disabled={actionInProgress === item.id}
                    className="h-8 text-xs bg-red-950/40 border border-red-800/60 text-red-300 hover:bg-red-900/60 hover:text-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete Permanently
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Items older than {retentionDays} days are automatically and permanently purged along with photos.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </Button>
            {items.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmptyBin}
                disabled={actionInProgress !== null}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Empty Recycle Bin ({items.length})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
