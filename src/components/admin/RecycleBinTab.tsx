import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  CheckCircle2,
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

export const RecycleBinTab: React.FC = () => {
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    fetchRecycleBin();
  }, []);

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
      toast.success(`Restored "${item.title}" successfully! Record is back live in stock.`);
      await fetchRecycleBin();
    } catch (err: any) {
      toast.error(err.message || 'Error restoring item');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePermanentDelete = async (item: RecycleItem) => {
    if (
      !confirm(
        `⚠️ PERMANENT DELETE WARNING:\n\nAre you sure you want to permanently destroy "${item.title}"?\n\nThis will permanently erase the database record AND all ${item.media_count} linked photo/media files from storage and Supabase Cloud. This cannot be undone.`
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
    } catch (err: any) {
      toast.error(err.message || 'Error emptying recycle bin');
    } finally {
      setActionInProgress(null);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'phone':
        return <Smartphone className="h-5 w-5 text-blue-400" />;
      case 'repair':
        return <Wrench className="h-5 w-5 text-orange-400" />;
      case 'customer':
        return <UserCheck className="h-5 w-5 text-emerald-400" />;
      case 'seller':
        return <Users className="h-5 w-5 text-violet-400" />;
      case 'dealer':
        return <Building2 className="h-5 w-5 text-cyan-400" />;
      default:
        return <Trash2 className="h-5 w-5 text-slate-400" />;
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
    <div className="space-y-6">
      {/* Top Banner Card */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
                <RotateCcw className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2.5">
                  PhoneZone Recycle Bin (रीसायकल बिन)
                  <Badge className="bg-emerald-600 text-white text-xs px-2.5 py-0.5">
                    {items.length} {items.length === 1 ? 'Record' : 'Records'} Safe
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 mt-1">
                  Jab bhi aap koi phone, repair ticket, customer ya seller delete karte hain, wo yahan safe rehta hai. Aap use 1-click me wapas live stock me restore kar sakte hain.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs py-1 px-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Auto-Purge Policy: {retentionDays} Days ({environment === 'render_cloud' ? 'Render Cloud' : 'Desktop'})
              </Badge>
              {items.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEmptyBin}
                  disabled={actionInProgress !== null}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-8"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Empty Recycle Bin ({items.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filter and Search Bar */}
      <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-md">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by model, IMEI, customer, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
              {[
                { id: 'all', label: `All (${items.length})` },
                { id: 'phone', label: `Phones (${items.filter(i => i.type === 'phone').length})` },
                { id: 'repair', label: `Repairs (${items.filter(i => i.type === 'repair').length})` },
                { id: 'customer', label: `Customers (${items.filter(i => i.type === 'customer').length})` },
                { id: 'seller', label: `Sellers (${items.filter(i => i.type === 'seller').length})` },
                { id: 'dealer', label: `Dealers (${items.filter(i => i.type === 'dealer').length})` },
              ].map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filterType === f.id ? 'default' : 'outline'}
                  onClick={() => setFilterType(f.id)}
                  className={`h-8 px-3 text-xs ${
                    filterType === f.id
                      ? 'bg-blue-600 text-white font-semibold shadow'
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
                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">Loading Recycle Bin items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="border-dashed border-slate-800 bg-slate-900/40 text-center py-16">
            <CardContent className="space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white">Recycle Bin is Empty (रीसायकल बिन खाली है)</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchQuery || filterType !== 'all'
                  ? 'No items match your filter criteria. Try clearing search or selecting All.'
                  : 'Koi deleted records nahi hain. Jab bhi aap koi phone ya repair ticket delete karenge, wo yahan safe dikhega.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card
              key={`${item.type}-${item.id}`}
              className="border-slate-800 bg-slate-900/80 text-slate-100 hover:border-slate-700 transition-all shadow-md"
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getItemIcon(item.type)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{item.title}</span>
                      <Badge variant="outline" className="text-[11px] py-0 px-2 bg-slate-950 text-slate-300 border-slate-700">
                        {item.typeLabel}
                      </Badge>
                      {item.media_count > 0 && (
                        <span className="text-xs text-cyan-400 font-medium inline-flex items-center gap-1 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-800/40">
                          <ImageIcon className="h-3 w-3" />
                          {item.media_count} {item.media_count === 1 ? 'file' : 'files'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">{item.subtitle}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 pt-0.5">
                      <span>Deleted on: {new Date(item.deleted_at).toLocaleString()}</span>
                      <span className="text-slate-600">•</span>
                      <span
                        className={`font-semibold flex items-center gap-1 ${
                          item.days_left <= 3 ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        ⏳ {item.days_left} {item.days_left === 1 ? 'day' : 'days'} left before permanent auto-purge
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    onClick={() => handleRestore(item)}
                    disabled={actionInProgress === item.id}
                    className="h-9 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Restore (वापस लाएं)
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handlePermanentDelete(item)}
                    disabled={actionInProgress === item.id}
                    className="h-9 px-3 text-xs bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-700/60 font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete Permanently
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Footer Card */}
      <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center gap-2 text-xs text-slate-400">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span>
          <strong>Retention Policy Note:</strong> Render cloud hosting par 15 din aur Windows Desktop EXE par 30 din ka safe window rehta hai. Expired items unki sabhi photos ke saath automatically wipe ho jate hain taaki storage quota free rahe.
        </span>
      </div>
    </div>
  );
};

export default RecycleBinTab;
