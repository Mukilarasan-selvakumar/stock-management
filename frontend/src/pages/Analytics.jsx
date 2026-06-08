import React, { useState, useEffect, useContext } from "react";
import { Card, Select, Button, Row, Col, Table, Tag, Spin, Empty, message, Tabs, Space, Typography, Badge, Statistic } from "antd";
import { RocketOutlined, ExperimentOutlined, TableOutlined, AreaChartOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, FallOutlined } from "@ant-design/icons";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell } from "recharts";
import axiosInstance from "../api/axiosInstance";
import Navbar from "./navbar";
import { AuthContext } from "../context/AuthContext";

const { Option } = Select;
const { TabPane } = Tabs;
const { Title, Text } = Typography;

const Analytics = () => {
    const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);

  // DEFAULT = Prophet
  const [selectedModel, setSelectedModel] = useState("analyze");

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [predRes, custRes] = await Promise.all([
        axiosInstance.get("/analytics/results"),
        axiosInstance.get("/analytics/top-customers")
      ]);
      setResults(predRes.data);
      setTopCustomers(custRes.data);
    } catch (err) {
      message.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Run Pipeline
  const runFullPipeline = async () => {
    setLoading(true);
    try {
      message.loading({ content: "Cleaning data...", key: "pipeline" });
      const res = await axiosInstance.post("/process/process-all",{
        analyze:selectedModel==="analyze"?true :false,
        model: selectedModel==="analyze"?null :selectedModel
      });
      message.loading({
        content: `Running ${selectedModel} predictions...`,
        key: "pipeline"
      });

      await axiosInstance.post("/predict/predict-all", {
        model: res?.data?.recommended_model
      });

      message.success({
        content: `Completed using ${selectedModel}`,
        key: "pipeline"
      });

      fetchData();
    } catch (err) {
      message.error({
        content: "Pipeline failed",
        key: "pipeline"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter data by stock status
  const optimalProducts = results.filter(r => r.stock_status === "Optimal");
  const understockProducts = results.filter(r => r.stock_status === "Understock");
  const overstockProducts = results.filter(r => r.stock_status === "Overstock");

  // Common columns for all tables
  const baseColumns = [
    { title: "Product ID", dataIndex: "productId", width: 100 },
    { title: "Product Name", dataIndex: "productName", width: 200 },
    { 
      title: "Current Stock", 
      dataIndex: "current_stock", 
      width: 120,
      render: (value) => Math.round(value),
      align: "center"
    },
    {
      title: "Predicted Demand",
      dataIndex: "predicted_demand",
      width: 140,
      render: (value) => Math.round(value),
      align: "center"
    },
    {
      title: "Recommended Qty",
      dataIndex: "recommended_qty",
      width: 140,
      render: (value) => Math.round(value),
      align: "center"
    },
    {
      title: "Model Used",
      dataIndex: "model_used",
      width: 100,
      render: (model) => (
        <Tag color={model === "Prophet" ? "green" : model === "ARIMA" ? "blue" : "purple"}>
          {model}
        </Tag>
      )
    }
  ];

  // Understock specific columns (with urgent action)
  const understockColumns = [
    ...baseColumns,
    {
      title: "Urgency",
      dataIndex: "current_stock",
      width: 100,
      render: (stock) => {
        if (stock <= 5) return <Tag color="red">CRITICAL</Tag>;
        if (stock <= 10) return <Tag color="orange">HIGH</Tag>;
        return <Tag color="gold">MEDIUM</Tag>;
      }
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" danger>
          Order Now
        </Button>
      )
    }
  ];

  // Overstock specific columns (with clearance suggestion)
  const overstockColumns = [
    ...baseColumns,
    {
      title: "Excess Units",
      dataIndex: "current_stock",
      width: 100,
      render: (stock, record) => {
        const excess = stock - record.predicted_demand;
        return <Tag color="orange">{Math.round(excess)} units</Tag>;
      }
    },
    {
      title: "Suggestion",
      key: "suggestion",
      width: 120,
      render: (_, record) => (
        <Button type="link" size="small">
          Run Promotion
        </Button>
      )
    }
  ];

  // Optimal columns (no extra actions)
  const optimalColumns = baseColumns;

  // Colors for pie chart
  const PIE_COLORS = {
    Optimal: "#52c41a",
    Understock: "#ff4d4f",
    Overstock: "#faad14"
  };

  // Pie chart data
  const pieData = [
    { name: "Optimal", value: optimalProducts.length, color: PIE_COLORS.Optimal },
    { name: "Understock", value: understockProducts.length, color: PIE_COLORS.Understock },
    { name: "Overstock", value: overstockProducts.length, color: PIE_COLORS.Overstock }
  ];

  return (
    <>
      <Navbar>
        {(user?.role === "admin" || user?.role === "superadmin") && (
          <div style={{ padding: 30 }}>
            {/* HEADER */}
            <Card style={{ marginBottom: 20 }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={3}>
                    Analytics
                  </Title>
                  <Text>Demand Prediction Dashboard</Text>
                </Col>

                <Col>
                  <Space>
                    <Select
                      value={selectedModel}
                      style={{ width: 200 }}
                      onChange={setSelectedModel}
                    >
                      <Option value="ARIMA">ARIMA</Option>
                      <Option value="Prophet">Prophet</Option>
                      <Option value="LightGBM">LightGBM</Option>
                      <Option value="analyze">Analyze and Recommend</Option>
                    </Select>

                    <Button
                      type="primary"
                      onClick={runFullPipeline}
                      loading={loading}
                      icon={<RocketOutlined />}
                    >
                      Run Batch
                    </Button>

                    <Button icon={<ReloadOutlined />} onClick={fetchData} />
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* Statistics Cards */}
            {results.length > 0 && (
              <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Total Products"
                      value={results.length}
                      prefix={<TableOutlined />}
                      valueStyle={{ color: "#1890ff" }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Understock (Need Action)"
                      value={understockProducts.length}
                      prefix={<WarningOutlined />}
                      valueStyle={{ color: "#ff4d4f" }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Overstock (Excess)"
                      value={overstockProducts.length}
                      prefix={<FallOutlined />}
                      valueStyle={{ color: "#faad14" }}
                    />
                  </Card>
                </Col>
              </Row>
            )}

            {/* LOADING */}
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "50px" }}>  
                <Spin size="large" />
              </div>
            ) : results.length === 0 ? (
              <Empty description="No Data">
                <Button type="primary" onClick={runFullPipeline}>
                  Run Prediction
                </Button>
              </Empty>
            ) : (
              <Tabs defaultActiveKey="1">
                {/* UNDERSTOCK TABLE - Most Important */}
                <TabPane 
                  tab={
                    <span>
                      <WarningOutlined style={{ color: "#ff4d4f" }} /> 
                      Understock ({understockProducts.length})
                    </span>
                  } 
                  key="1"
                >
                  {understockProducts.length === 0 ? (
                    <Empty description="No understock products" />
                  ) : (
                    <Table 
                      dataSource={understockProducts} 
                      columns={understockColumns} 
                      rowKey="productId"
                      pagination={{ pageSize: 10 }}
                      style={{ marginTop: 10 }}
                    />
                  )}
                </TabPane>

                {/* OVERSTOCK TABLE */}
                <TabPane 
                  tab={
                    <span>
                      <FallOutlined style={{ color: "#faad14" }} /> 
                      Overstock ({overstockProducts.length})
                    </span>
                  } 
                  key="2"
                >
                  {overstockProducts.length === 0 ? (
                    <Empty description="No overstock products" />
                  ) : (
                    <Table 
                      dataSource={overstockProducts} 
                      columns={overstockColumns} 
                      rowKey="productId"
                      pagination={{ pageSize: 10 }}
                      style={{ marginTop: 10 }}
                    />
                  )}
                </TabPane>

                {/* OPTIMAL TABLE */}
                <TabPane 
                  tab={
                    <span>
                      <CheckCircleOutlined style={{ color: "#52c41a" }} /> 
                      Optimal ({optimalProducts.length})
                    </span>
                  } 
                  key="3"
                >
                  {optimalProducts.length === 0 ? (
                    <Empty description="No optimal products" />
                  ) : (
                    <Table 
                      dataSource={optimalProducts} 
                      columns={optimalColumns} 
                      rowKey="productId"
                      pagination={{ pageSize: 10 }}
                      style={{ marginTop: 10 }}
                    />
                  )}
                </TabPane>

                {/* CHARTS TAB - Keep existing charts */}
                <TabPane 
                  tab={<span><AreaChartOutlined /> Charts</span>} 
                  key="4"
                >
                  <Row gutter={20}>
                    <Col span={12}>
                      <Card title="Demand Forecast by Product">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={results.slice(0, 20)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="productName" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="predicted_demand" fill="#1890ff" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card title="Stock Status Distribution">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>
                  </Row>
                </TabPane>
              </Tabs>
            )}
          </div>
        )}
      </Navbar>
    </>
  );
};

export default Analytics;