
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw, Image, Folder } from "lucide-react";
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

  const fetchStorageFiles = async () => {
    try {
      setIsLoading(true);
      const { data: files, error } = await supabase.storage
        .from('phonezone-uploads')
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      setFiles(files || []);
      console.log(`Fetched ${files?.length || 0} files from storage`);
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
      const { error } = await supabase.storage
        .from('phonezone-uploads')
        .remove(selectedFiles);

      if (error) throw error;

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
      const allFileNames = files.map(file => file.name);
      const { error } = await supabase.storage
        .from('phonezone-uploads')
        .remove(allFileNames);

      if (error) throw error;

      toast.success(`Successfully deleted all ${files.length} files from storage`);
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
    const { data } = supabase.storage
      .from('phonezone-uploads')
      .getPublicUrl(fileName);
    return data.publicUrl;
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
          <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-2">
            {files.map((file) => (
              <div key={file.name} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                <Checkbox
                  checked={selectedFiles.includes(file.name)}
                  onCheckedChange={(checked) => handleFileSelect(file.name, !!checked)}
                />
                <Image className="h-4 w-4 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.metadata?.size || 0)} • {new Date(file.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(getFileUrl(file.name), '_blank')}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        )}

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
