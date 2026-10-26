import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Download, Trash2, RefreshCw, HardDrive, Image, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import StorageUsageCard from "./StorageUsageCard";
import PhotoViewer from "./PhotoViewer";
import { isOfflineMode } from "@/lib/data/config";

interface StorageFile {
  /** Display path - the file's relative path inside local storage. */
  name: string;
  fullPath?: string;
  id?: string;
  /** Direct preview/download URL (offline backend files). */
  url?: string;
  /** Who the file belongs to: seller | customer | phone | repair | invoice | admin | bucket. */
  owner?: string;
  original_name?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}

/**
 * Offline (EXE / local) build: files come from the local backend, not a bucket.
 *
 * Checked through isOfflineMode() at call time - reading
 * window.__PHONEZONE_OFFLINE__ once at module load was false in the desktop and
 * dev runs, so this tab silently fell back to the (empty) Supabase bucket.
 */
const offline = () => isOfflineMode();

const StorageTab = () => {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  const { data: files, isLoading, error, refetch } = useQuery({
    queryKey: ['storage-files'],
    queryFn: async () => {
      // OFFline: the backend owns every file (seller/customer/phone/repair/
      // invoice/admin/bucket trees), so list it there. Enumerating one Supabase
      // bucket reported a fraction of the real usage and could not delete real
      // app photos at all.
      if (offline()) {
        const res = await fetch('/api/files?limit=2000', { credentials: 'include' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Could not load stored files (${res.status}).`);
        }
        const rows = (await res.json()) as Array<Record<string, any>>;
        return rows.map((row) => ({
          name: String(row.relative_path),
          fullPath: String(row.relative_path),
          id: row.id,
          url: `/api/files/${row.id}`,
          owner: row.owner_type,
          original_name: row.original_name || undefined,
          created_at: row.created_at,
          metadata: { size: row.size_bytes, mimetype: row.mime_type },
        })) as StorageFile[];
      }

      // Online: first get all folders
      const { data: folders, error: folderError } = await supabase.storage
        .from('phonezone-uploads')
        .list('', {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (folderError) throw folderError;

      // Then get files from each folder
      let allFiles: StorageFile[] = [];
      
      for (const folder of folders || []) {
        if (folder.name) {
          const { data: folderFiles, error: fileError } = await supabase.storage
            .from('phonezone-uploads')
            .list(folder.name, {
              limit: 1000,
              sortBy: { column: 'name', order: 'asc' }
            });

          if (!fileError && folderFiles) {
            // Add folder path to file names for proper identification
            const filesWithPath = folderFiles.map(file => ({
              ...file,
              name: `${folder.name}/${file.name}`,
              fullPath: `${folder.name}/${file.name}`
            }));
            allFiles = [...allFiles, ...filesWithPath];
          }
        }
      }

      return allFiles as StorageFile[];
    }
  });

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const getFileUrl = (file: StorageFile): string => {
    if (file.url) return file.url;
    const { data } = supabase.storage
      .from('phonezone-uploads')
      .getPublicUrl(file.name);
    return data.publicUrl;
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files?.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files?.map(file => file.name) || []);
    }
  };

  const handleFileSelect = (fileName: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles([...selectedFiles, fileName]);
    } else {
      setSelectedFiles(selectedFiles.filter(f => f !== fileName));
    }
  };

  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsDeleting(true);
    try {
      // In offline mode, route through the backend /api/files endpoint which
      // covers ALL owner types. In online mode, use Supabase Storage directly.
      if (offline()) {
        // Delete each file by its ID via the backend. The files list from the
        // bucket compat endpoint includes the file id in the response.
        for (const fileName of selectedFiles) {
          const fileRecord = files?.find(f => f.name === fileName);
          if (fileRecord?.id) {
            const delRes = await fetch(`/api/files/${fileRecord.id}`, {
              method: 'DELETE',
              credentials: 'include',
            });
            if (!delRes.ok) {
              const body = await delRes.json().catch(() => ({}));
              console.error('Delete error for', fileName, body);
            }
          }
        }
      } else {
        const { error } = await supabase.storage
          .from('phonezone-uploads')
          .remove(selectedFiles);
        if (error) throw error;
      }

      toast.success(`Successfully deleted ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`);
      setSelectedFiles([]);
      refetch();
    } catch (error) {
      console.error('Error deleting files:', error);
      toast.error('Failed to delete files');
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAllFiles = async () => {
    if (!files || files.length === 0) return;

    setIsDeleting(true);
    try {
      if (offline()) {
        // Delete every file record via the backend (one request per file;
        // the compat write limiter allows far more than any real library).
        for (const file of files) {
          if (file.id) {
            const delRes = await fetch(`/api/files/${file.id}`, {
              method: 'DELETE',
              credentials: 'include',
            });
            if (!delRes.ok) {
              const body = await delRes.json().catch(() => ({}));
              console.error('Delete error for', file.name, body);
            }
          }
        }
      } else {
        const fileNames = files.map(file => file.name);
        const { error } = await supabase.storage
          .from('phonezone-uploads')
          .remove(fileNames);
        if (error) throw error;
      }

      toast.success(`Successfully deleted all ${files.length} files`);
      setSelectedFiles([]);
      refetch();
    } catch (error) {
      console.error('Error deleting all files:', error);
      toast.error('Failed to delete all files');
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadFile = async (file: StorageFile) => {
    try {
      let blob: Blob;
      if (file.url) {
        // Offline: stream the bytes from the backend (works for private files
        // too, because the request carries the session cookie).
        const res = await fetch(file.url, { credentials: 'include' });
        if (!res.ok) throw new Error(`Download failed (${res.status}).`);
        blob = await res.blob();
      } else {
        const { data, error } = await supabase.storage
          .from('phonezone-uploads')
          .download(file.name);
        if (error) throw error;
        blob = data;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Get just the filename without the folder path for download
      const displayName = file.name.split('/').pop() || file.name;
      a.download = file.original_name || displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const viewPhotos = () => {
    if (!files) return;
    
    const imageFiles = files
      .filter(file => isImageFile(file.name))
      .map(file => getFileUrl(file));
    
    setSelectedPhotos(imageFiles);
    setPhotoViewerOpen(true);
  };

  const imageFiles = files?.filter(file => isImageFile(file.name)) || [];
  const otherFiles = files?.filter(file => !isImageFile(file.name)) || [];
  const totalSize = files?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading storage files...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Storage Usage Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StorageUsageCard />
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Image className="h-4 w-4 mr-2" />
              Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{imageFiles.length}</div>
            <p className="text-xs text-muted-foreground">Photo files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <HardDrive className="h-4 w-4 mr-2" />
              Other Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{otherFiles.length}</div>
            <p className="text-xs text-muted-foreground">Documents & others</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Selected Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedFiles.length}</div>
            <p className="text-xs text-muted-foreground">Ready for action</p>
          </CardContent>
        </Card>
      </div>

      {/* Storage Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Storage Management:</strong> This tab lists every file PhoneZone has saved - product photos, ID proofs, purchase documents, payment proofs and invoices. Deleting a file here removes it from disk permanently; archived phones and their history are not affected.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading files: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        
        {imageFiles.length > 0 && (
          <Button onClick={viewPhotos} variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            View All Photos ({imageFiles.length})
          </Button>
        )}
        
        {selectedFiles.length > 0 && (
          <Button
            onClick={deleteSelectedFiles}
            disabled={isDeleting}
            variant="destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedFiles.length})
          </Button>
        )}
        
        {files && files.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="ml-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Files
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete All Files</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p>Are you sure you want to delete all {files.length} files? This action cannot be undone.</p>
                <div className="flex justify-end space-x-2">
                  <Button
                    onClick={deleteAllFiles}
                    disabled={isDeleting}
                    variant="destructive"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete All'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Files Table */}
      {files && files.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Files in Storage ({files.length} files, {formatFileSize(totalSize)})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedFiles.length === files.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.name}>
                    <TableCell>
                      <Checkbox
                        checked={selectedFiles.includes(file.name)}
                        onCheckedChange={(checked) => 
                          handleFileSelect(file.name, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        {isImageFile(file.name) ? (
                          <Image className="h-4 w-4 mr-2 text-blue-500" />
                        ) : (
                          <HardDrive className="h-4 w-4 mr-2 text-gray-500" />
                        )}
                        <div>
                          <div className="font-medium">{file.name.split('/').pop()}</div>
                          <div className="text-xs text-muted-foreground">
                            {file.owner ? `${file.owner} · ` : ''}{file.name.split('/').slice(0, -1).join('/')}/
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isImageFile(file.name) ? "default" : "secondary"}>
                        {isImageFile(file.name) ? "Image" : "File"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(file.metadata?.size)}</TableCell>
                    <TableCell>
                      {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {isImageFile(file.name) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPhotos([getFileUrl(file)]);
                              setPhotoViewerOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(file)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <HardDrive className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-600">No files found</p>
            <p className="text-sm text-gray-500">Upload some files to see them here</p>
          </CardContent>
        </Card>
      )}

      {/* Photo Viewer */}
      <PhotoViewer
        photos={selectedPhotos}
        open={photoViewerOpen}
        onOpenChange={setPhotoViewerOpen}
        title="Storage Photos"
      />
    </div>
  );
};

export default StorageTab;