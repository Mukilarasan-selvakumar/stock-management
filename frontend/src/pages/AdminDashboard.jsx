import React, { useState, useEffect, useContext } from "react";
import { Card, Row, Col, Table, Statistic, Spin, Empty, message, Tabs, Tag, Button, Space, Progress, Typography, DatePicker, Select, Badge } from "antd";
import { 
  ShoppingOutlined, 
  DollarOutlined, 
  RiseOutlined, 
  FallOutlined, 
  StockOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  LineChartOutlined,
  ArrowUpOutlined,
  TeamOutlined,
  CalendarOutlined,
  BulbOutlined,
  RocketOutlined,
  HistoryOutlined
} from "@ant-design/icons";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell } from "recharts";
import axiosInstance from "../api/axiosInstance";
import Navbar from "./navbar";
import { AuthContext } from "../context/AuthContext";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [salesHistory, setSalesHistory] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    understock: 0,
    overstock: 0,
    optimal: 0,
    totalValue: 0
  });
  const [stockStatus, setStockStatus] = useState({
    understock: 0,
    overstock: 0,
    optimal: 0,
  });
  const [dailySales, setDailySales] = useState([]);
  const [stockHistory, setStockHistory] = useState([]); // NEW: Stock movement history

  const [salesSummary, setSalesSummary] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalItems: 0,
    averageOrderValue: 0,
    growth: 0
  });
  const [dateRange, setDateRange] = useState(null);
  const [period, setPeriod] = useState("month");

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        salesRes,
        topProductsRes,
        inventoryRes,
        dailySalesRes,
        salesSummaryRes,
        stockStatusRes,
        stockHistoryRes  // NEW: Fetch stock history
      ] = await Promise.all([
        axiosInstance.get("/sales/admin/sales-history", { 
          params: { 
            startDate: dateRange?.[0]?.toISOString(), 
            endDate: dateRange?.[1]?.toISOString() 
          } 
        }),
        axiosInstance.get("/sales/admin/top-products", { params: { limit: 5 } }),
        axiosInstance.get("/inventory/stats"),
        axiosInstance.get("/sales/admin/daily-sales", { params: { days: 30 } }),
        axiosInstance.get("/sales/admin/sales-summary", { params: { period } }),
        axiosInstance.get("/analytics/results"),
        axiosInstance.get("/inventory/stock-history", { params: { days: 30, limit: 100 } }) // NEW API call
      ]);
      
      console.log({salesRes})
      setSalesHistory(salesRes.data);
      setTopProducts(topProductsRes.data);
      setInventoryStats(inventoryRes.data);
      setDailySales(dailySalesRes.data);
      setSalesSummary(salesSummaryRes.data);
      setStockHistory(stockHistoryRes.data); // NEW: Set stock history data
      setStockStatus({
        understock: stockStatusRes.data.filter(r => r.stock_status === "Understock").length,
        overstock: stockStatusRes.data.filter(r => r.stock_status === "Overstock").length,
        optimal: stockStatusRes.data.filter(r => r.stock_status === "Optimal").length,
      });
    } catch (err) {
      message.error("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, period]);

  // Sales History Table Columns
  const salesColumns = [
    { 
      title: "Date", 
      dataIndex: "date", 
      key: "date", 
      width: 120,
      render: (date) => new Date(date).toLocaleDateString() 
    },
    { 
      title: "Order ID", 
      dataIndex: "orderId", 
      key: "orderId",
      width: 200,
      render: (id) => id?.slice(-8) || 'N/A'
    },
    { title: "Customer", dataIndex: "customerName", key: "customerName", width: 150 },
    { title: "Product", dataIndex: "productName", key: "productName", width: 180 },
    { title: "Quantity", dataIndex: "quantity", key: "quantity", width: 80, align: "center" },
    { 
      title: "Total Amount", 
      dataIndex: "totalAmount", 
      key: "totalAmount",
      width: 120,
      render: (amount) => `$${amount?.toFixed(2)}`,
      align: "right"
    },
    { 
      title: "Status", 
      dataIndex: "status", 
      key: "status",
      width: 100,
      render: (status) => (
        <Tag color={status === "completed" ? "green" : "orange"}>
          {status?.toUpperCase() || 'COMPLETED'}
        </Tag>
      )
    }
  ];

  // NEW: Stock Movement History Columns
  const stockHistoryColumns = [
    { 
      title: "Date", 
      dataIndex: "createdAt", 
      key: "createdAt", 
      width: 150,
      render: (date) => new Date(date).toLocaleString()
    },
    { title: "Product ID", dataIndex: "productId", key: "productId", width: 100 },
    { title: "Product Name", dataIndex: "productName", key: "productName", width: 180 },
    { 
      title: "Previous Stock", 
      dataIndex: "previousStock", 
      key: "previousStock", 
      width: 110,
      align: "center",
      
    },
    { 
      title: "Change", 
      dataIndex: "change", 
      key: "change", 
      width: 100,
      align: "center",
      render: (change) => (
        <Tag color={change > 0 ? "green" : change < 0 ? "red" : "default"}>
          {change > 0 ? `+${change}` : change}
        </Tag>
      )
    },
    { 
      title: "New Stock", 
      dataIndex: "newStock", 
      key: "newStock", 
      width: 110,
      align: "center",
      
    },
    { 
      title: "Type", 
      dataIndex: "type", 
      key: "type", 
      width: 120,
      render: (type) => (
        <Tag color={
          type === "SALE" ? "blue" : 
          type === "RESTOCK" ? "green" : 
          type === "IMPORT" ? "purple" : 
          type === "ADJUSTMENT" ? "orange" : 
          "default"
        }>
          {type}
        </Tag>
      )
    },
    { 
      title: "Performed By", 
      dataIndex: "performedBy", 
      key: "performedBy", 
      width: 150,
      render: (user) => user || "system"
    }
  ];

  // Top Products Columns
  const topProductsColumns = [
    { 
      title: "Rank", 
      key: "rank", 
      width: 70,
      render: (_, __, index) => (
        <div style={{ fontSize: 20 }}>
          {index === 0 && <TrophyOutlined style={{ color: "gold" }} />}
          {index === 1 && <TrophyOutlined style={{ color: "silver" }} />}
          {index === 2 && <TrophyOutlined style={{ color: "#cd7f32" }} />}
          {index > 2 && <span style={{ color: "#888" }}>#{index + 1}</span>}
        </div>
      )
    },
    { title: "Product ID", dataIndex: "productId", key: "productId", width: 100 },
    { title: "Product Name", dataIndex: "productName", key: "productName", width: 200 },
    { title: "Category", dataIndex: "category", key: "category", width: 120 },
    { 
      title: "Units Sold", 
      dataIndex: "unitsSold", 
      key: "unitsSold", 
      width: 100,
      align: "center"
    },
    { 
      title: "Revenue", 
      dataIndex: "revenue", 
      key: "revenue",
      width: 120,
      render: (revenue) => `$${revenue?.toFixed(2)}`,
      align: "right"
    }
  ];

  // Colors for charts
  const COLORS = {
    optimal: '#52c41a',
    understock: '#ff4d4f',
    overstock: '#faad14',
    revenue: '#1890ff',
    units: '#52c41a'
  };

  // Prepare pie chart data
  const pieData = [
    { name: 'Optimal Stock', value: inventoryStats.optimal || 0, color: COLORS.optimal },
    { name: 'Understock', value: inventoryStats.understock || 0, color: COLORS.understock },
    { name: 'Overstock', value: inventoryStats.overstock || 0, color: COLORS.overstock }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#fff', padding: '12px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
          {payload.map((p, idx) => (
            <p key={idx} style={{ margin: 0, color: p.color }}>
              {p.name}: {p.name === 'Revenue ($)' ? `$${p.value?.toFixed(2)}` : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Navbar>
        {(user?.role === "admin" || user?.role === "superadmin") && (
          <div style={{ padding: 24, background: "#f0f2f5", minHeight: "calc(100vh - 70px)" }}>
            
            {/* Header */}
            <Card style={{ marginBottom: 24 }}>
              <Row justify="space-between" align="middle" gutter={[16, 16]}>
                <Col>
                  <Title level={2} style={{ margin: 0 }}>
                     Dashboard
                  </Title>
                  <Text type="secondary">Inventory Management & Sales Analytics</Text>
                </Col>
                <Col>
                  <Space wrap>
                    <Select 
                      value={period} 
                      onChange={setPeriod} 
                      style={{ width: 120 }}
                    >
                      <Option value="week">Last 7 Days</Option>
                      <Option value="month">Last 30 Days</Option>
                      <Option value="year">Last Year</Option>
                      <Option value="all">All Time</Option>
                    </Select>
                   
                    <Button 
                      type="primary" 
                      icon={<ReloadOutlined />} 
                      onClick={fetchDashboardData} 
                      loading={loading}
                    >
                      Refresh
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}>
                <Spin size="large" tip="Loading dashboard data..." />
              </div>
            ) : (
              <>
                {/* Sales Summary Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Total Revenue"
                        value={salesSummary.totalRevenue || 0}
                        prefix={<DollarOutlined />}
                        precision={2}
                        valueStyle={{ color: "#1890ff" }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <ArrowUpOutlined style={{ color: salesSummary.growth >= 0 ? "#52c41a" : "#ff4d4f" }} />
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          {salesSummary.growth >= 0 ? '+' : ''}{salesSummary.growth || 0}% from last period
                        </Text>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Total Orders"
                        value={salesSummary.totalOrders || 0}
                        prefix={<ShoppingCartOutlined />}
                        valueStyle={{ color: "#52c41a" }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Items Sold"
                        value={salesSummary.totalItems || 0}
                        prefix={<ShoppingOutlined />}
                        valueStyle={{ color: "#faad14" }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Average Order Value"
                        value={salesSummary.averageOrderValue || 0}
                        prefix={<DollarOutlined />}
                        precision={2}
                        valueStyle={{ color: "#722ed1" }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Inventory Statistics Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="Total Products"
                        value={inventoryStats.totalProducts || 0}
                        prefix={<ShoppingOutlined />}
                        valueStyle={{ color: "#1890ff" }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="Total Stock Units"
                        value={inventoryStats.totalStock || 0}
                        prefix={<StockOutlined />}
                        valueStyle={{ color: "#52c41a" }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="Inventory Value"
                        value={inventoryStats.totalValue || 0}
                        prefix={<DollarOutlined />}
                        precision={2}
                        valueStyle={{ color: "#faad14" }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Inventory Health Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={8}>
                    <Card style={{ borderLeft: `4px solid ${COLORS.optimal}` }}>
                      <Statistic
                        title="Optimal Stock"
                        value={stockStatus.optimal || 0}
                        suffix="products"
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: COLORS.optimal }}
                      />
                      <Progress 
                        percent={inventoryStats.totalProducts ? (stockStatus.optimal / inventoryStats.totalProducts) * 100 : 0} 
                        strokeColor={COLORS.optimal}
                        showInfo={false}
                        style={{ marginTop: 8 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card style={{ borderLeft: `4px solid ${COLORS.understock}` }}>
                      <Statistic
                        title="Understock (Critical)"
                        value={stockStatus.understock || 0}
                        suffix="products"
                        prefix={<WarningOutlined />}
                        valueStyle={{ color: COLORS.understock }}
                      />
                      <Progress 
                        percent={inventoryStats.totalProducts ? (stockStatus.understock / inventoryStats.totalProducts) * 100 : 0} 
                        strokeColor={COLORS.understock}
                        showInfo={false}
                        style={{ marginTop: 8 }}
                      />
                      {(stockStatus.understock || 0) > 0 && (
                        <Button type="link" size="small" danger style={{ paddingLeft: 0 }}>
                          Need immediate restock
                        </Button>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card style={{ borderLeft: `4px solid ${COLORS.overstock}` }}>
                      <Statistic
                        title="Overstock"
                        value={stockStatus.overstock || 0}
                        suffix="products"
                        prefix={<FallOutlined />}
                        valueStyle={{ color: COLORS.overstock }}
                      />
                      <Progress 
                        percent={inventoryStats.totalProducts ? (stockStatus.overstock / inventoryStats.totalProducts) * 100 : 0} 
                        strokeColor={COLORS.overstock}
                        showInfo={false}
                        style={{ marginTop: 8 }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Top Products */}
                <Card 
                  title={
                    <span>
                      <TrophyOutlined style={{ color: "gold", marginRight: 8 }} />
                      Top 5 Selling Products
                    </span>
                  } 
                  style={{ marginBottom: 24 }}
                  extra={<Tag color="gold">Best Sellers</Tag>}
                >
                  <Table 
                    dataSource={topProducts} 
                    columns={topProductsColumns} 
                    rowKey="productId"
                    pagination={false}
                  />
                </Card>

                {/* Tabs: Sales History and Stock Movement History */}
                <Tabs defaultActiveKey="1" style={{ marginBottom: 24 }}>
                  <Tabs.TabPane 
                    tab={<span><ShoppingCartOutlined /> Sales History</span>} 
                    key="1"
                  >
                    <Table 
                      dataSource={salesHistory} 
                      columns={salesColumns} 
                      rowKey={(record, index) => `${record.orderId}-${index}`}
                      scroll={{ x: 1000 }}
                      pagination={{ pageSize: 10 }}
                    />
                  </Tabs.TabPane>
                  
                  {/* NEW: Stock Movement History Tab */}
                  <Tabs.TabPane 
                    tab={<span><HistoryOutlined /> Stock Movement History</span>} 
                    key="2"
                  >
                    <Table 
                      dataSource={stockHistory} 
                      columns={stockHistoryColumns} 
                      rowKey={(record, index) => `${record.productId}-${index}`}
                      scroll={{ x: 1200 }}
                      pagination={{ pageSize: 10 }}
                    />
                  </Tabs.TabPane>
                </Tabs>
              </>
            )}
          </div>
        )}
      </Navbar>
    </>
  );
};

export default AdminDashboard;