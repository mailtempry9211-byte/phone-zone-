
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  Download,
  FileText,
  BarChart3,
  PieChart,
  Calendar,
  Filter
} from "lucide-react";
import { toast } from "sonner";

const AccountingTab = () => {
  const [dateRange, setDateRange] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState("overview");

  // Fetch comprehensive accounting data
  const { data: accountingData, isLoading } = useQuery({
    queryKey: ['accounting-data', dateRange, startDate, endDate],
    queryFn: async () => {
      // Get phones data
      let phonesQuery = supabase
        .from('phones')
        .select(`
          *,
          sellers (name, phone),
          customers (name, phone)
        `);

      // Apply date filters
      if (dateRange === "custom" && startDate && endDate) {
        phonesQuery = phonesQuery
          .gte('created_at', startDate)
          .lte('created_at', endDate);
      } else if (dateRange !== "all") {
        const date = new Date();
        if (dateRange === "today") {
          date.setHours(0, 0, 0, 0);
        } else if (dateRange === "week") {
          date.setDate(date.getDate() - 7);
        } else if (dateRange === "month") {
          date.setMonth(date.getMonth() - 1);
        } else if (dateRange === "quarter") {
          date.setMonth(date.getMonth() - 3);
        } else if (dateRange === "year") {
          date.setFullYear(date.getFullYear() - 1);
        }
        phonesQuery = phonesQuery.gte('created_at', date.toISOString());
      }

      const { data: phones, error: phonesError } = await phonesQuery;
      if (phonesError) throw phonesError;

      // Get sellers and customers count
      const { data: sellers, error: sellersError } = await supabase
        .from('sellers')
        .select('id');
      if (sellersError) throw sellersError;

      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id');
      if (customersError) throw customersError;

      // Local fallback (online build / backend unreachable): sum the rows that
      // were fetched. Only used when /api/dashboard cannot be read.
      const localTotals = {
        totalInventory: phones?.filter(p => !p.is_sold).length || 0,
        totalSold: phones?.filter(p => p.is_sold).length || 0,
        totalRevenue: phones?.filter(p => p.is_sold).reduce((sum, p) => sum + Number(p.selling_price), 0) || 0,
        totalCost: phones?.reduce((sum, p) => sum + Number(p.purchase_price), 0) || 0,
        totalProfit: phones?.filter(p => p.is_sold).reduce((sum, p) =>
          sum + (Number(p.selling_price) - Number(p.purchase_price)), 0) || 0,
        inventoryValue: phones?.filter(p => !p.is_sold).reduce((sum, p) => sum + Number(p.selling_price), 0) || 0,
        totalSellers: sellers?.length || 0,
        totalCustomers: customers?.length || 0,
        financialYear: null as string | null,
      };

      // Authoritative figures come from the backend: it scopes to the active
      // financial year and hides soft-deleted rows exactly like the dashboard,
      // so the two screens can no longer disagree about revenue or profit.
      let totals = localTotals;
      try {
        const params = new URLSearchParams();
        if (dateRange === 'custom' && startDate) params.set('from', startDate);
        if (dateRange === 'custom' && endDate) params.set('to', endDate);
        const qs = params.toString();
        const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ''}`, { credentials: 'include' });
        if (res.ok) {
          const d = await res.json();
          totals = {
            totalInventory: Number(d.inventory?.available ?? localTotals.totalInventory),
            totalSold: Number(d.inventory?.sold ?? localTotals.totalSold),
            totalRevenue: Number(d.finance?.revenue ?? localTotals.totalRevenue),
            totalCost: Number(d.finance?.totalPurchaseSpend ?? localTotals.totalCost),
            totalProfit: Number(d.finance?.profit ?? localTotals.totalProfit),
            inventoryValue: Number(d.inventory?.stockValue ?? localTotals.inventoryValue),
            totalSellers: Number(d.counts?.sellers ?? localTotals.totalSellers),
            totalCustomers: Number(d.counts?.customers ?? localTotals.totalCustomers),
            financialYear: d.financialYear ?? null,
          };
        }
      } catch (dashError) {
        console.warn('Dashboard totals unavailable, using local sums:', dashError);
      }

      return {
        phones: phones || [],
        ...totals,
        profitMargin: totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0,
      };
    }
  });

  const generateProfitLossReport = () => {
    if (!accountingData) return;

    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Profit & Loss Report - PhoneZone</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { padding: 20px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
        .positive { color: #16a34a; }
        .negative { color: #dc2626; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .table th { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PhoneZone - Profit & Loss Report</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <p>Period: ${dateRange === 'all' ? 'All Time' : dateRange}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Revenue</h3>
            <p style="font-size: 24px; color: #16a34a;">₹${accountingData.totalRevenue.toLocaleString()}</p>
        </div>
        <div class="metric">
            <h3>Total Cost</h3>
            <p style="font-size: 24px; color: #dc2626;">₹${accountingData.totalCost.toLocaleString()}</p>
        </div>
        <div class="metric">
            <h3>Net Profit</h3>
            <p style="font-size: 24px;" class="${accountingData.totalProfit >= 0 ? 'positive' : 'negative'}">
                ₹${accountingData.totalProfit.toLocaleString()}
            </p>
        </div>
        <div class="metric">
            <h3>Profit Margin</h3>
            <p style="font-size: 24px;" class="${accountingData.profitMargin >= 0 ? 'positive' : 'negative'}">
                ${accountingData.profitMargin.toFixed(2)}%
            </p>
        </div>
    </div>

    <h3>Detailed Transactions</h3>
    <table class="table">
        <tr>
            <th>Date</th>
            <th>Phone</th>
            <th>Type</th>
            <th>Cost</th>
            <th>Revenue</th>
            <th>Profit</th>
        </tr>
        ${accountingData.phones.map(phone => `
        <tr>
            <td>${new Date(phone.created_at).toLocaleDateString()}</td>
            <td>${phone.phone_name}</td>
            <td>${phone.is_sold ? 'Sale' : 'Purchase'}</td>
            <td>₹${phone.purchase_price}</td>
            <td>${phone.is_sold ? `₹${phone.selling_price}` : '-'}</td>
            <td class="${phone.is_sold ? (phone.selling_price - phone.purchase_price >= 0 ? 'positive' : 'negative') : ''}">
                ${phone.is_sold ? `₹${(phone.selling_price - phone.purchase_price).toLocaleString()}` : '-'}
            </td>
        </tr>
        `).join('')}
    </table>
</body>
</html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profit_loss_report_${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Profit & Loss report generated successfully!");
  };

  const generateInventoryReport = () => {
    if (!accountingData) return;

    const inventoryPhones = accountingData.phones.filter(p => !p.is_sold);
    
    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Inventory Report - PhoneZone</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { padding: 20px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .table th { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PhoneZone - Inventory Report</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Items</h3>
            <p style="font-size: 24px;">${inventoryPhones.length}</p>
        </div>
        <div class="metric">
            <h3>Inventory Value</h3>
            <p style="font-size: 24px; color: #16a34a;">₹${accountingData.inventoryValue.toLocaleString()}</p>
        </div>
        <div class="metric">
            <h3>Cost Investment</h3>
            <p style="font-size: 24px; color: #dc2626;">₹${inventoryPhones.reduce((sum, p) => sum + Number(p.purchase_price), 0).toLocaleString()}</p>
        </div>
    </div>

    <h3>Current Inventory</h3>
    <table class="table">
        <tr>
            <th>Phone</th>
            <th>Model</th>
            <th>IMEI</th>
            <th>Condition</th>
            <th>Purchase Price</th>
            <th>Selling Price</th>
            <th>Expected Profit</th>
            <th>Purchase Date</th>
        </tr>
        ${inventoryPhones.map(phone => `
        <tr>
            <td>${phone.phone_name}</td>
            <td>${phone.model}</td>
            <td>${phone.imei_number}</td>
            <td>${phone.condition}</td>
            <td>₹${phone.purchase_price}</td>
            <td>₹${phone.selling_price}</td>
            <td style="color: ${phone.selling_price - phone.purchase_price >= 0 ? '#16a34a' : '#dc2626'}">
                ₹${(phone.selling_price - phone.purchase_price).toLocaleString()}
            </td>
            <td>${new Date(phone.purchase_date).toLocaleDateString()}</td>
        </tr>
        `).join('')}
    </table>
</body>
</html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_report_${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Inventory report generated successfully!");
  };

  const exportToCSV = () => {
    if (!accountingData) return;

    const csvContent = [
      ['Date', 'Phone', 'Model', 'IMEI', 'Type', 'Purchase Price', 'Selling Price', 'Profit', 'Customer/Seller'],
      ...accountingData.phones.map(phone => [
        new Date(phone.created_at).toLocaleDateString(),
        phone.phone_name,
        phone.model,
        phone.imei_number,
        phone.is_sold ? 'Sale' : 'Purchase',
        phone.purchase_price,
        phone.is_sold ? phone.selling_price : '',
        phone.is_sold ? (phone.selling_price - phone.purchase_price) : '',
        phone.is_sold ? (phone.customers?.name || '') : (phone.sellers?.name || '')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accounting_data_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Data exported to CSV successfully!");
  };

  if (isLoading) return <div>Loading accounting data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Accounting & Analytics</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={generateInventoryReport}>
            <FileText className="h-4 w-4 mr-2" />
            Inventory Report
          </Button>
          <Button onClick={generateProfitLossReport}>
            <BarChart3 className="h-4 w-4 mr-2" />
            P&L Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <Label>Period:</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dateRange === "custom" && (
          <>
            <div className="flex items-center space-x-2">
              <Label>From:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label>To:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{accountingData?.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-gray-500">From {accountingData?.totalSold} sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${accountingData?.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{accountingData?.totalProfit.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">{accountingData?.profitMargin.toFixed(2)}% margin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Package className="h-4 w-4 mr-2" />
              Inventory Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{accountingData?.inventoryValue.toLocaleString()}</div>
            <p className="text-xs text-gray-500">{accountingData?.totalInventory} items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accountingData?.totalCustomers}</div>
            <p className="text-xs text-gray-500">{accountingData?.totalSellers} sellers</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountingData?.phones.slice(0, 10).map((phone) => (
                  <TableRow key={phone.id}>
                    <TableCell>{new Date(phone.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{phone.phone_name}</div>
                        <div className="text-sm text-gray-500">{phone.model}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={phone.is_sold ? "default" : "secondary"}>
                        {phone.is_sold ? "Sale" : "Purchase"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      ₹{phone.is_sold ? phone.selling_price.toLocaleString() : phone.purchase_price.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {phone.is_sold ? (
                        <span className={`font-medium ${
                          phone.selling_price - phone.purchase_price >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ₹{(phone.selling_price - phone.purchase_price).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={phone.is_sold ? "default" : "outline"}>
                        {phone.is_sold ? "Sold" : "In Stock"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountingTab;
