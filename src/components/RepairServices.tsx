
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone } from "lucide-react";
import { data } from "@/lib/data";

interface RepairServicesProps {
  whatsappNumber?: string;
  phonePrimary?: string;
}

const RepairServices: React.FC<RepairServicesProps> = ({ whatsappNumber: propWa, phonePrimary: propPhone }) => {
  const [waNumber, setWaNumber] = useState<string>(propWa || "");
  const [phoneNum, setPhoneNum] = useState<string>(propPhone || "");

  useEffect(() => {
    if (propWa) setWaNumber(propWa);
    if (propPhone) setPhoneNum(propPhone);
    if (!propWa || !propPhone) {
      data.getContactInfo().then((info) => {
        if (info) {
          if (!propWa) setWaNumber(info.whatsapp_number || info.phone_primary || "");
          if (!propPhone) setPhoneNum(info.phone_primary || "");
        }
      }).catch(() => {});
    }
  }, [propWa, propPhone]);
  const services = [
    {
      icon: "📱",
      title: "Screen Replacement",
      price: "₹1,500",
      duration: "30–60 mins",
      description: "High-quality screen replacement"
    },
    {
      icon: "🔋",
      title: "Battery Replacement", 
      price: "₹800",
      duration: "15–30 mins",
      description: "Original battery with warranty"
    },
    {
      icon: "🔌",
      title: "Charging Port Repair",
      price: "₹600", 
      duration: "20–45 mins",
      description: "Fix charging port issues"
    },
    {
      icon: "💻",
      title: "Software Issues",
      price: "₹300",
      duration: "30–90 mins", 
      description: "OS updates, bugs, performance fixes"
    },
    {
      icon: "💧",
      title: "Water Damage Repair",
      price: "₹1,200",
      duration: "2–24 hours",
      description: "Full restoration from water damage"
    },
    {
      icon: "🔧",
      title: "General Repairs",
      price: "₹500",
      duration: "30–120 mins",
      description: "Camera, speaker, mic, motherboard, etc."
    }
  ];

  return (
    <section id="repairs" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Repair Services</h2>
          <p className="text-gray-600">Professional mobile repair services with warranty</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div key={index} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{service.title}</h3>
              <div className="flex justify-between items-center mb-2">
                <span className="text-2xl font-bold text-green-600">{service.price}</span>
                <span className="text-sm text-gray-500">{service.duration}</span>
              </div>
              <p className="text-gray-600 mb-6">{service.description}</p>
              
              <div className="flex gap-2">
                <Button 
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    const clean = (waNumber || phoneNum || "").replace(/\D/g, "");
                    const target = clean ? (clean.length === 10 ? `91${clean}` : clean) : "";
                    const message = `Hi! I need ${service.title} service. Can you help?`;
                    if (target) {
                      window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, '_blank');
                    }
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Book via WhatsApp
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    const clean = (phoneNum || waNumber || "").replace(/\D/g, "");
                    if (clean) window.open(`tel:${clean}`, '_self');
                  }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call Now
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RepairServices;
