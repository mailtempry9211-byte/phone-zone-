
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, RefreshCw, Image, Folder, Eye, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}

const StorageManagementCard = () => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const fetchStorageFiles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/files?limit=2000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch storage files');
      const rows = await res.json();
      const mapped = rows.map((r: any) => ({
        id: r.id,
        name: r.original_name || r.relative_path || r.id,
        updated_at: r.created_at,
        created_at: r.created_at,
        last_accessed_at: r.created_at,
        metadata: { size: r.size_bytes, mimetype: r.mime_type },
      }));
      setFiles(mapped || []);
    } catch (error) {
      console.error('Error fetching storage files:', error);
      toast.error('Failed to fetch storage files');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStorageFiles();
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(file => file.name));
    }
  };

  const handleFileSelect = (fileName: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles([...selectedFiles, fileName]);
    } else {
      setSelectedFiles(selectedFiles.filter(name => name !== fileName));
    }
  };

  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected');
      return;
    }

    try {
      setIsDeleting(true);
      for (const target of selectedFiles) {
        const fileRecord = files.find(f => f.name === target || f.id === target);
        const fileId = fileRecord?.id || target;
        await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }

      toast.success(`Successfully deleted ${selectedFiles.length} files`);
      setSelectedFiles([]);
      await fetchStorageFiles();
    } catch (error) {
      console.error('Error deleting selected files:', error);
      toast.error('Failed to delete selected files');
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAllFiles = async () => {
    if (files.length === 0) {
      toast.error('No files to delete');
      return;
    }

    try {
      setIsDeleting(true);
      for (const file of files) {
        if (file.id) {
          await fetch(`/api/files/${encodeURIComponent(file.id)}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        }
      }

      toast.success(`Successfully deleted all ${files.length} files`);
      setFiles([]);
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error deleting all files:', error);
      toast.error('Failed to delete all files');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileUrl = (fileName: string) => {
    if (!fileName) return "";
    if (fileName.startsWith("http://") || fileName.startsWith("https://") || fileName.startsWith("data:")) {
      return fileName;
    }
    const fileRecord = files.find(f => f.name === fileName || f.id === fileName);
    if (fileRecord?.id) return `/api/public/files/${fileRecord.id}`;
    return `/api/public/files/${encodeURIComponent(fileName)}`;
  };

  const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Folder className="h-4 w-4 mr-2" />
          Storage Management
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStorageFiles}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {files.length} files • {formatFileSize(totalSize)}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={files.length === 0}
            >
              {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteSelectedFiles}
              disabled={selectedFiles.length === 0 || isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected ({selectedFiles.length})
            </Button>
            <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
              <Button
                variant="destructive"
                size="sm"
                disabled={files.length === 0 || isDeleting}
                onClick={() => setIsDeleteAllOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete All
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Storage Files</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL {files.length} files from Supabase storage.
                    This action cannot be undone and will remove all uploaded images and documents.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setIsDeleteAllOpen(false)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setIsDeleteAllOpen(false);
                      deleteAllFiles();
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete All Files
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {files.length > 0 && (
          <div className="max-h-80 overflow-y-auto border border-slate-800 rounded-lg p-2 space-y-2 bg-slate-950/40">
            {files.map((file) => {
              const fileUrl = getFileUrl(file.name);
              return (
                <div key={file.name} className="flex items-center space-x-3 p-2 hover:bg-slate-850/80 rounded-lg transition-colors border border-transparent hover:border-slate-800">
                  <Checkbox
                    checked={selectedFiles.includes(file.name)}
                    onCheckedChange={(checked) => handleFileSelect(file.name, !!checked)}
                  />
                  {/* Real Image Thumbnail with Zoom Click */}
                  <div
                    className="h-12 w-12 min-w-12 rounded-md overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all shadow-sm group relative"
                    onClick={() => setPreviewImage({ url: fileUrl, name: file.name })}
                    title="Click to view full photo"
                  >
                    <img
                      src={fileUrl}
                      alt={file.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <div className="hidden h-full w-full items-center justify-center bg-slate-800 text-slate-400">
                      <Image className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-slate-200" title={file.name}>{file.name}</div>
                    <div className="text-xs text-slate-400">
                      {formatFileSize(file.metadata?.size || 0)} • {new Date(file.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 gap-1"
                      onClick={() => setPreviewImage({ url: fileUrl, name: file.name })}
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-400 hover:text-white"
                      onClick={() => window.open(fileUrl, '_blank')}
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Image Preview Modal */}
        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="max-w-3xl bg-slate-900 border border-slate-700 text-white p-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono truncate text-slate-300">
                {previewImage?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden max-h-[75vh] p-2">
              {previewImage && (
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => previewImage && window.open(previewImage.url, "_blank")}
                className="text-xs gap-1 border-slate-700 text-slate-300"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Full Image
              </Button>
              <Button
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {files.length === 0 && !isLoading && (
          <div className="text-center py-4 text-gray-500">
            No files found in storage
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageManagementCard;
