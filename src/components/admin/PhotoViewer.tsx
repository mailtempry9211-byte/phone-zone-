
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

interface PhotoViewerProps {
  photos: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}

const PhotoViewer = ({ photos, open, onOpenChange, title }: PhotoViewerProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev < photos.length - 1 ? prev + 1 : 0
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev > 0 ? prev - 1 : photos.length - 1
    );
  };

  if (!photos || photos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex justify-between items-center">
            <span>{title}</span>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex">
          {/* Image Display */}
          <div className="flex-1 relative flex items-center justify-center bg-gray-50">
            <img
              src={photos[currentImageIndex]}
              alt={`${title} ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: 'calc(90vh - 120px)' }}
            />
            
            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                  onClick={prevImage}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                  onClick={nextImage}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
                
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
                  {currentImageIndex + 1} / {photos.length}
                </div>
              </>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
              onClick={() => downloadImage(
                photos[currentImageIndex], 
                `${title}_${currentImageIndex + 1}.jpg`
              )}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Thumbnail Sidebar */}
          {photos.length > 1 && (
            <div className="w-48 border-l bg-white p-4 overflow-y-auto">
              <h4 className="font-semibold mb-2">{title}</h4>
              <div className="space-y-2">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className={`cursor-pointer border-2 rounded p-1 ${
                      index === currentImageIndex ? 'border-blue-500' : 'border-gray-200'
                    }`}
                    onClick={() => setCurrentImageIndex(index)}
                  >
                    <img
                      src={photo}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoViewer;
