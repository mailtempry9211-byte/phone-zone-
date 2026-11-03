
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Phone, Instagram, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { data as dataDriver } from "@/lib/data";
import { ContactInfo } from "@/lib/data/types";

interface ContactFormProps {
  theme?: string;
  formOnly?: boolean;
}

const ContactForm: React.FC<ContactFormProps> = ({ theme = "modern", formOnly = false }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contact, setContact] = useState<ContactInfo | null>(null);

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const info = await dataDriver.getContactInfo();
        setContact(info);
      } catch (e) {
        console.error("Failed to fetch contact info", e);
      }
    };
    fetchContact();
  }, []);

  const rawWa = contact?.whatsapp_number || contact?.phone_primary || "";
  const cleanWa = rawWa.replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";
  const rawInstagram = contact?.instagram || "";
  const instagramHandle = rawInstagram.replace(/^@+/, "").trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Store the contact form submission (Supabase online / SQLite offline)
      await dataDriver.submitContactMessage({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        message: formData.subject
          ? `Subject: ${formData.subject}\n\n${formData.message}`
          : formData.message,
      });


      toast.success("Message sent successfully! We'll get back to you soon.");
      
      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: ""
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (formOnly) {
    const isDarkTheme = !["apple_minimal", "brutalist", "glassmorphism"].includes(theme);
    const isLuxury = theme === "luxury";
    const isNeon = theme === "neon";
    const isSplitSlider = theme === "split_slider";
    const isFluidCarousel = theme === "fluid_carousel";
    const isBrutalist = theme === "brutalist";
    const isGlass = theme === "glassmorphism";

    const cardClasses = isLuxury
      ? "bg-[#13151c] border-amber-500/30 text-amber-100 shadow-xl"
      : isNeon
      ? "bg-[#0d1322] border-cyan-500/30 text-slate-100 shadow-xl shadow-cyan-500/5"
      : isSplitSlider
      ? "bg-[#0f172a] border-teal-500/30 text-slate-100 shadow-xl shadow-teal-500/5"
      : isFluidCarousel
      ? "bg-[#140f28] border-violet-500/30 text-slate-100 shadow-xl shadow-violet-500/5"
      : isBrutalist
      ? "bg-white border-4 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none"
      : isGlass
      ? "bg-white/80 backdrop-blur-md border-indigo-200 text-slate-900 shadow-lg"
      : isDarkTheme
      ? "bg-[#0f172a] border-slate-800 text-slate-100 shadow-xl"
      : "bg-white border-slate-200 text-slate-900 shadow-sm";

    const inputClasses = isDarkTheme
      ? "bg-slate-900/90 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400"
      : isBrutalist
      ? "border-2 border-black rounded-none focus:ring-0 focus:border-black font-mono text-black"
      : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400";

    const labelClasses = isLuxury
      ? "text-xs font-bold text-amber-200"
      : isNeon
      ? "text-xs font-bold text-cyan-200"
      : isDarkTheme
      ? "text-xs font-bold text-slate-200"
      : "text-xs font-bold text-slate-700";

    const buttonClasses = isLuxury
      ? "bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 hover:from-amber-500 hover:to-yellow-400 text-black font-extrabold shadow-md shadow-amber-500/20"
      : isNeon
      ? "bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-extrabold shadow-md shadow-cyan-500/25"
      : isSplitSlider
      ? "bg-teal-600 hover:bg-teal-500 text-white font-extrabold shadow-md shadow-teal-600/25"
      : isFluidCarousel
      ? "bg-violet-600 hover:bg-violet-500 text-white font-extrabold shadow-md shadow-violet-600/25"
      : isBrutalist
      ? "bg-black text-white hover:bg-amber-400 hover:text-black font-black uppercase rounded-none border-2 border-black tracking-wider"
      : isGlass
      ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/25"
      : "bg-slate-900 hover:bg-black text-white font-bold";

    return (
      <Card className={`transition-colors duration-300 ${cardClasses}`}>
        <CardHeader>
          <CardTitle className={isDarkTheme ? "text-white" : "text-slate-900"}>Send us a Message</CardTitle>
          <CardDescription className={isDarkTheme ? "text-slate-400" : "text-slate-600"}>
            Fill out the form below and we'll get back to you as soon as possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className={labelClasses}>Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Your full name"
                  className={inputClasses}
                />
              </div>
              <div>
                <Label htmlFor="email" className={labelClasses}>Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="your.email@example.com"
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone" className={labelClasses}>Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+91 12345 67890"
                  className={inputClasses}
                />
              </div>
              <div>
                <Label htmlFor="subject" className={labelClasses}>Subject *</Label>
                <Input
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  placeholder="What's this about?"
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="message" className={labelClasses}>Message *</Label>
              <Textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                placeholder="Tell us how we can help you..."
                rows={6}
                className={inputClasses}
              />
            </div>

            <Button type="submit" className={`w-full h-11 ${buttonClasses}`} disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <section id="contact" className={`py-20 ${theme === "neon" ? "bg-[#090c14] text-slate-100" : theme === "luxury" ? "bg-[#0a0b0f] text-amber-50" : theme === "brutalist" ? "bg-[#fefce8] text-black" : theme === "glassmorphism" ? "bg-white/40 backdrop-blur-md" : "bg-gray-50"} transition-colors duration-500`}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Get in Touch</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Ready to sell your phone or have questions about our services? We're here to help!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Information */}
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold">Phone</p>
                    <p className="text-gray-600">{contact?.phone_primary || "Not available"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold">Email</p>
                    <p className="text-gray-600">{contact?.email || "Not available"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold">Address</p>
                    <p className="text-gray-600">{contact?.address || "Not available"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Instagram className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold">Instagram</p>
                    <p className="text-gray-600">{instagramHandle ? "@" + instagramHandle : "Not available"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span className="text-gray-600">9:00 AM - 7:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span className="text-gray-600">10:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span className="text-gray-600">Closed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Direct Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Connect with Us</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => targetWa && window.open(`https://wa.me/${targetWa}`, '_blank')}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  disabled={!targetWa}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                
                <Button 
                  onClick={() => instagramHandle && window.open(`https://instagram.com/${instagramHandle}`, '_blank')}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  disabled={!instagramHandle}
                >
                  <Instagram className="h-4 w-4 mr-2" />
                  Follow us on Instagram
                </Button>
                
                <Button 
                  onClick={() => contact?.email && window.open(`mailto:${contact.email}`, '_blank')}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={!contact?.email}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you as soon as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+91 12345 67890"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      placeholder="What's this about?"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    placeholder="Tell us how we can help you..."
                    rows={6}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
