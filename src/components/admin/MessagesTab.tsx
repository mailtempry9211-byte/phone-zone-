
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, 
  MailOpen, 
  Search, 
  Phone, 
  MessageSquare, 
  Trash2, 
  Reply,
  Archive,
  Filter,
  Download,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

const MessagesTab = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const queryClient = useQueryClient();

  // Business contact details used by the "Reply" mail body. Loaded separately
  // from the message list so a missing settings row can never break the inbox.
  const { data: adminSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_settings').select('*').single();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', searchTerm, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,message.ilike.%${searchTerm}%`);
      }

      if (filterStatus !== "all") {
        query = query.eq('is_read', filterStatus === "read");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const markAsRead = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;
      
      toast.success("Message marked as read");
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      console.error('Mark as read error:', error);
      toast.error("Failed to mark as read");
    }
  };

  const markAsUnread = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: false })
        .eq('id', messageId);

      if (error) throw error;
      
      toast.success("Message marked as unread");
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      console.error('Mark as unread error:', error);
      toast.error("Failed to mark as unread");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      
      toast.success("Message deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Failed to delete message");
    }
  };

  const bulkMarkAsRead = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
      
      toast.success("All messages marked as read");
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      console.error('Bulk mark as read error:', error);
      toast.error("Failed to mark all as read");
    }
  };

  const deleteAllMessages = async () => {
    if (!confirm("Are you sure you want to delete ALL messages? This action cannot be undone!")) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      
      toast.success("All messages deleted");
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      console.error('Delete all error:', error);
      toast.error("Failed to delete all messages");
    }
  };

  const replyToMessage = (message) => {
    const subject = `Re: Your inquiry to PhoneZone`;
    const body = `Hello ${message.name},\n\nThank you for contacting PhoneZone. We have received your message:\n\n"${message.message}"\n\nBest regards,\nPhoneZone Team\n\nPhone: ${adminSettings?.phone_primary || '8418944572'} | ${adminSettings?.phone_secondary || '9125790119'}\nEmail: ${adminSettings?.email || 'phonezone7753@gmail.com'}`;
    
    window.open(`mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const callCustomer = (phone) => {
    if (phone) {
      window.open(`tel:${phone}`, '_blank');
    } else {
      toast.error("No phone number available");
    }
  };

  const whatsappCustomer = (phone, name) => {
    if (phone) {
      const message = `Hello ${name}, this is PhoneZone. Thank you for your inquiry!`;
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      toast.error("No phone number available");
    }
  };

  const exportMessages = () => {
    if (!messages || messages.length === 0) {
      toast.error("No messages to export");
      return;
    }

    const csvContent = [
      ['Name', 'Email', 'Phone', 'Message', 'Status', 'Date'].join(','),
      ...messages.map(msg => [
        `"${msg.name}"`,
        `"${msg.email}"`,
        `"${msg.phone || 'N/A'}"`,
        `"${msg.message.replace(/"/g, '""')}"`,
        msg.is_read ? 'Read' : 'Unread',
        `"${new Date(msg.created_at).toLocaleString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phonezone_messages_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Messages exported successfully!");
  };

  const viewMessage = (message) => {
    setSelectedMessage(message);
    setShowMessageDialog(true);
    if (!message.is_read) {
      markAsRead(message.id);
    }
  };

  const unreadCount = messages?.filter(m => !m.is_read).length || 0;
  const todayCount = messages?.filter(m => {
    const today = new Date();
    const msgDate = new Date(m.created_at);
    return msgDate.toDateString() === today.toDateString();
  }).length || 0;

  if (isLoading) return <div>Loading messages...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messages</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportMessages}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={bulkMarkAsRead}>
            <MailOpen className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          <Button variant="destructive" onClick={deleteAllMessages}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
        </div>
      </div>

      {/* Message Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{messages?.length || 0}</div>
            <div className="text-sm text-gray-600">Total Messages</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
            <div className="text-sm text-gray-600">Unread Messages</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{todayCount}</div>
            <div className="text-sm text-gray-600">Today's Messages</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {messages?.filter(m => m.is_read).length || 0}
            </div>
            <div className="text-sm text-gray-600">Read Messages</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Messages</SelectItem>
            <SelectItem value="unread">Unread Only</SelectItem>
            <SelectItem value="read">Read Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Messages List */}
      {!messages || messages.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No messages found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card 
              key={message.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                !message.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
              }`}
              onClick={() => viewMessage(message)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-2">
                        {message.is_read ? (
                          <MailOpen className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Mail className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-semibold">{message.name}</span>
                      </div>
                      <Badge variant={message.is_read ? "secondary" : "default"}>
                        {message.is_read ? "Read" : "New"}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <span>{message.email}</span>
                      {message.phone && (
                        <>
                          <span className="mx-2">•</span>
                          <span>{message.phone}</span>
                        </>
                      )}
                    </div>
                    
                    <p className="text-gray-800 mb-2 line-clamp-2">
                      {message.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                      
                      <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                        {message.phone && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => callCustomer(message.phone)}
                              title="Call Customer"
                            >
                              <Phone className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => whatsappCustomer(message.phone, message.name)}
                              title="WhatsApp Customer"
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => replyToMessage(message)}
                          title="Reply via Email"
                        >
                          <Reply className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => message.is_read ? markAsUnread(message.id) : markAsRead(message.id)}
                          title={message.is_read ? "Mark as Unread" : "Mark as Read"}
                        >
                          {message.is_read ? <Mail className="h-3 w-3" /> : <MailOpen className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMessage(message.id)}
                          title="Delete Message"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Message Detail Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold">From:</span>
                  <p>{selectedMessage.name}</p>
                </div>
                <div>
                  <span className="font-semibold">Email:</span>
                  <p>{selectedMessage.email}</p>
                </div>
                <div>
                  <span className="font-semibold">Phone:</span>
                  <p>{selectedMessage.phone || 'Not provided'}</p>
                </div>
                <div>
                  <span className="font-semibold">Date:</span>
                  <p>{new Date(selectedMessage.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <span className="font-semibold">Message:</span>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                {selectedMessage.phone && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => callCustomer(selectedMessage.phone)}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => whatsappCustomer(selectedMessage.phone, selectedMessage.name)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => replyToMessage(selectedMessage)}
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply via Email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesTab;
