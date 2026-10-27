import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InventoryTab from "./InventoryTab";
import SoldTab from "./SoldTab";
import CustomersTab from "./CustomersTab";
import SellersTab from "./SellersTab";
import DealersTab from "./DealersTab";
import MessagesTab from "./MessagesTab";
import AccountingTab from "./AccountingTab";
import DatabaseTab from "./DatabaseTab";
import SettingsTab from "./SettingsTab";
import ReturnsTab from "./ReturnsTab";
import StorageTab from "./StorageTab";
import RepairsTab from "./RepairsTab";
import MarketingTab from "./MarketingTab";
import UsersTab from "./UsersTab";
import NgrokTab from "./NgrokTab";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Globe, ShoppingBag, Wrench, Settings2, LayoutGrid, CheckCircle2 } from "lucide-react";

export type DepartmentMode = "sales" | "repairs" | "management" | "all";

interface AdminDashboardProps {
  initialDepartment?: DepartmentMode;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialDepartment = "sales" }) => {
  const [department, setDepartment] = useState<DepartmentMode>(initialDepartment);
  const [activeTab, setActiveTab] = useState<string>(initialDepartment === "repairs" ? "repairs" : "inventory");

  useEffect(() => {
    if (initialDepartment) {
      setDepartment(initialDepartment);
      if (initialDepartment === "repairs") setActiveTab("repairs");
      else if (initialDepartment === "sales") setActiveTab("inventory");
      else if (initialDepartment === "management") setActiveTab("ngrok");
    }
  }, [initialDepartment]);

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => data.getAdminStats()
  });

  const { data: repairStats } = useQuery({
    queryKey: ['repair-accounting-stats'],
    queryFn: async () => {
      const res = await fetch("/api/repair/accounting");
      if (res.ok) return res.json();
      return null;
    }
  });

  // Switch default tab when department changes
  const handleDepartmentChange = (dept: DepartmentMode) => {
    setDepartment(dept);
    if (dept === "sales") setActiveTab("inventory");
    else if (dept === "repairs") setActiveTab("repairs");
    else if (dept === "management") setActiveTab("ngrok");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Department Selector (Sales vs Repairs vs Store Management) */}
      <div className="bg-white p-2.5 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2">
            Active Department:
          </span>
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleDepartmentChange("sales")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                department === "sales"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Sales Department
            </button>
            <button
              type="button"
              onClick={() => handleDepartmentChange("repairs")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                department === "repairs"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              Repair Department
            </button>
            <button
              type="button"
              onClick={() => handleDepartmentChange("management")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                department === "management"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white"
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Store Admin
            </button>
            <button
              type="button"
              onClick={() => handleDepartmentChange("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                department === "all"
                  ? "bg-gray-200 text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="h-3 w-3" />
              All Tabs
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 hidden md:block">
          {department === "sales" && "Used Phones, Inventory, Counter Sales & Customers"}
          {department === "repairs" && "Mobile Workshop, Rework Warranty, Repair Customers & Margins"}
          {department === "management" && "Online Ngrok Tunnel, WhatsApp API, Staff RBAC & Database"}
          {department === "all" && "All store modules combined view"}
        </div>
      </div>

      {/* Dynamic Department Stats Cards */}
      {department === "repairs" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-indigo-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Repair Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-700">{repairStats?.total_jobs || 0}</div>
              <p className="text-xs text-gray-500">Workshop service tickets</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Repair Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">₹{Number(repairStats?.total_revenue || 0).toLocaleString()}</div>
              <p className="text-xs text-gray-500">Collected from delivered jobs</p>
            </CardContent>
          </Card>

          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Net Repair Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">₹{Number(repairStats?.net_profit || 0).toLocaleString()}</div>
              <p className="text-xs text-gray-500">Labor revenue after parts cost</p>
            </CardContent>
          </Card>

          <Card className="border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending in Workshop</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{repairStats?.pending_jobs || 0}</div>
              <p className="text-xs text-gray-500">Received / in-progress devices</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Phones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPhones || 0}</div>
              <p className="text-xs text-gray-500">Available in inventory</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats?.totalRevenue.toLocaleString() || 0}</div>
              <p className="text-xs text-gray-500">From sold phones</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
              <p className="text-xs text-gray-500">Registered phone buyers</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Sellers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalSellers || 0}</div>
              <p className="text-xs text-gray-500">Phone suppliers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto no-scrollbar pb-1">
          <TabsList className="inline-flex w-max min-w-full sm:w-full gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {/* Sales Department Tabs */}
            {(department === "sales" || department === "all") && (
              <>
                <TabsTrigger value="inventory" className="shrink-0 text-xs px-3 py-1.5">Inventory</TabsTrigger>
                <TabsTrigger value="sold" className="shrink-0 text-xs px-3 py-1.5">Sold</TabsTrigger>
                <TabsTrigger value="returns" className="shrink-0 text-xs px-3 py-1.5">Returns</TabsTrigger>
                <TabsTrigger value="customers" className="shrink-0 text-xs px-3 py-1.5">Customers</TabsTrigger>
                <TabsTrigger value="sellers" className="shrink-0 text-xs px-3 py-1.5">Sellers</TabsTrigger>
                <TabsTrigger value="dealers" className="shrink-0 text-xs px-3 py-1.5 font-semibold text-sky-700 data-[state=active]:bg-sky-600 data-[state=active]:text-white">Dealers (B2B)</TabsTrigger>
                <TabsTrigger value="accounting" className="shrink-0 text-xs px-3 py-1.5">Sales Accounting</TabsTrigger>
              </>
            )}

            {/* Repair Department Tabs */}
            {(department === "repairs" || department === "all") && (
              <TabsTrigger
                value="repairs"
                className="shrink-0 text-xs px-3.5 py-1.5 font-semibold text-indigo-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <Wrench className="h-3.5 w-3.5 mr-1" />
                Repair Department
              </TabsTrigger>
            )}

            {/* Management & Admin Tabs */}
            {(department === "management" || department === "all") && (
              <>
                <TabsTrigger value="ngrok" className="shrink-0 text-xs px-3 py-1.5 gap-1 font-semibold text-blue-700">
                  <Globe className="h-3.5 w-3.5 text-blue-600" /> Online (Ngrok)
                </TabsTrigger>
                <TabsTrigger value="marketing" className="shrink-0 text-xs px-3 py-1.5">WhatsApp / Marketing</TabsTrigger>
                <TabsTrigger value="users" className="shrink-0 text-xs px-3 py-1.5">Staff &amp; Roles</TabsTrigger>
                <TabsTrigger value="messages" className="shrink-0 text-xs px-3 py-1.5">Messages</TabsTrigger>
                <TabsTrigger value="storage" className="shrink-0 text-xs px-3 py-1.5">Storage</TabsTrigger>
                <TabsTrigger value="database" className="shrink-0 text-xs px-3 py-1.5">Database &amp; Backup</TabsTrigger>
                <TabsTrigger value="settings" className="shrink-0 text-xs px-3 py-1.5">Settings</TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        {/* Tab Contents */}
        <TabsContent value="inventory">
          <ErrorBoundary label="Inventory"><InventoryTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="sold">
          <ErrorBoundary label="Sold"><SoldTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="returns">
          <ErrorBoundary label="Returns"><ReturnsTab /></ErrorBoundary>
        </TabsContent>

        <TabsContent value="repairs">
          <ErrorBoundary label="Repairs"><RepairsTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="customers">
          <ErrorBoundary label="Customers"><CustomersTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="sellers">
          <ErrorBoundary label="Sellers"><SellersTab /></ErrorBoundary>
        </TabsContent>

        <TabsContent value="dealers">
          <ErrorBoundary label="Dealers"><DealersTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="accounting">
          <ErrorBoundary label="Sales Accounting"><AccountingTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="ngrok">
          <ErrorBoundary label="Online"><NgrokTab /></ErrorBoundary>
        </TabsContent>

        <TabsContent value="marketing">
          <ErrorBoundary label="Marketing"><MarketingTab /></ErrorBoundary>
        </TabsContent>

        <TabsContent value="users">
          <ErrorBoundary label="Staff & Roles"><UsersTab /></ErrorBoundary>
        </TabsContent>

        <TabsContent value="messages">
          <ErrorBoundary label="Messages"><MessagesTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="storage">
          <ErrorBoundary label="Storage"><StorageTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="database">
          <ErrorBoundary label="Database"><DatabaseTab /></ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="settings">
          <ErrorBoundary label="Settings"><SettingsTab /></ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
