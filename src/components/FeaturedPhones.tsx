
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { data as dataDriver } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Phone, ChevronLeft, ChevronRight, X, Heart } from "lucide-react";

const FeaturedPhones = () => {
  const [selectedPhone, setSelectedPhone] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: phones, isLoading } = useQuery({
    queryKey: ['featured-phones'],
    queryFn: () => dataDriver.listPublicPhones(12)
  });

  const openImageModal = (phone: any, imageIndex: number = 0) => {
    setSelectedPhone(phone);
    setCurrentImageIndex(imageIndex);
  };

  const closeModal = () => {
    setSelectedPhone(null);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    if (selectedPhone?.product_photos) {
      setCurrentImageIndex((prev) => 
        prev < selectedPhone.product_photos.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevImage = () => {
    if (selectedPhone?.product_photos) {
      setCurrentImageIndex((prev) => 
        prev > 0 ? prev - 1 : selectedPhone.product_photos.length - 1
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "TODAY";
    if (diffDays <= 7) return `${diffDays} DAYS AGO`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} WEEKS AGO`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <section id="phones" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Featured Phones</h2>
            <p className="text-gray-600">Discover our handpicked selection of premium second-hand phones</p>
          </div>

          {isLoading ? (
            <div className="text-center">Loading phones...</div>
          ) : !phones || phones.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-gray-600">No phones available at the moment. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {phones.map((phone) => (
                <div key={phone.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 cursor-pointer group">
                  {/* Image Section */}
                  <div className="relative aspect-square p-3">
                    {phone.product_photos && phone.product_photos.length > 0 ? (
                      <>
                        <img 
                          src={phone.product_photos[0]} 
                          alt={phone.phone_name}
                          className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                          onClick={() => openImageModal(phone, 0)}
                        />
                        {/* Heart Icon */}
                        <button className="absolute top-5 right-5 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm">
                          <Heart className="h-4 w-4 text-gray-600 hover:text-red-500" />
                        </button>
                        {/* Photo Count Badge */}
                        {phone.product_photos.length > 1 && (
                          <div className="absolute bottom-5 right-5 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                            1/{phone.product_photos.length}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                        <Phone className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Content Section */}
                  <div className="p-3 pt-0">
                    {/* Price */}
                    <div className="text-lg font-bold text-black mb-1">
                      ₹ {phone.selling_price?.toLocaleString()}
                    </div>
                    
                    {/* Title */}
                    <h3 className="text-sm text-gray-800 mb-1 line-clamp-2 leading-tight">
                      {phone.phone_name} - {phone.model}
                    </h3>

                    {(phone.variant || phone.colour) ? (
                      <div className="text-xs text-gray-500 mb-1">
                        {[phone.variant, phone.colour].filter(Boolean).join(' • ')}
                      </div>
                    ) : null}
                    
                    {/* Condition Badge */}
                    <div className="mb-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        phone.condition === 'excellent' ? 'bg-green-100 text-green-800' :
                        phone.condition === 'good' ? 'bg-blue-100 text-blue-800' :
                        phone.condition === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {phone.condition?.toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Date only - removed location/seller info */}
                    <div className="text-xs text-gray-500 mb-2">
                      <div>{formatDate(phone.created_at)}</div>
                    </div>
                    
                    {/* Features (if any) */}
                    {phone.features && phone.features.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {phone.features.slice(0, 2).map((feature, index) => (
                            <span key={index} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                              {feature}
                            </span>
                          ))}
                          {phone.features.length > 2 && (
                            <span className="text-xs text-gray-500">+{phone.features.length - 2}</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1">
                      <Button 
                        size="sm"
                        className="flex-1 h-8 text-xs bg-green-500 hover:bg-green-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          const message = `Hi! I'm interested in ${phone.phone_name} - ${phone.model} priced at ₹${phone.selling_price}. Can you provide more details?`;
                          window.open(`https://wa.me/918418944572?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Chat
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open('tel:8418944572', '_self');
                        }}
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Full Resolution Image Modal */}
      <Dialog open={!!selectedPhone} onOpenChange={closeModal}>
        <DialogContent className="max-w-5xl w-full h-[85vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex justify-between items-center">
              <span>{selectedPhone?.phone_name} - {selectedPhone?.model}</span>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPhone?.product_photos && selectedPhone.product_photos.length > 0 && (
            <div className="relative flex-1 flex items-center justify-center p-4 bg-black">
              <img
                src={selectedPhone.product_photos[currentImageIndex]}
                alt={`${selectedPhone.phone_name} - Image ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: 'calc(85vh - 120px)' }}
              />
              
              {selectedPhone.product_photos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white hover:bg-opacity-70 hover:text-white"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white hover:bg-opacity-70 hover:text-white"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
                    {currentImageIndex + 1} / {selectedPhone.product_photos.length}
                  </div>

                  {/* Thumbnail navigation */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-center">
                    <div className="flex gap-2 bg-black bg-opacity-50 p-2 rounded max-w-full overflow-x-auto">
                      {selectedPhone.product_photos.map((photo: string, index: number) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`Thumbnail ${index + 1}`}
                          className={`w-12 h-12 object-cover rounded cursor-pointer border-2 transition-all ${
                            index === currentImageIndex 
                              ? 'border-blue-500 opacity-100' 
                              : 'border-transparent opacity-60 hover:opacity-80'
                          }`}
                          onClick={() => setCurrentImageIndex(index)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeaturedPhones;
