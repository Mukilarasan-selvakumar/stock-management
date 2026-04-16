import React, { useState, useEffect } from "react";
import { Card, Select, Button, Row, Col, Table, Tag, Spin, Empty, message, Tabs, Alert, Space, Typography } from "antd";
import { RocketOutlined, ExperimentOutlined, TableOutlined, AreaChartOutlined, ReloadOutlined, DatabaseOutlined } from "@ant-design/icons";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import axiosInstance from "../api/axiosInstance";
import Navbar from "./navbar";

const { Option } = Select;
const { TabPane } = Tabs;
const { Title, Text } = Typography;

const Analytics = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [selectedModel, setSelectedModel] = useState("ARIMA");

  // 1. Fetch existing results on load
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

  // 2. Full Pipeline: Preprocess -> Predict -> Fetch
  const runFullPipeline = async () => {
    setLoading(true);
    try {
      // Step A: Preprocess
      message.loading({ content: "Cleaning historical data...", key: "pipeline" });
      await axiosInstance.post("/process/process-all");

      // Step B: Predict
      message.loading({ content: `Running ${selectedModel} predictions for all products...`, key: "pipeline" });
      await axiosInstance.post("/predict/predict-all", { model: selectedModel });

      message.success({ content: "Batch analysis complete!", key: "pipeline" });
      
      // Step C: Refresh results
      fetchData();
    } catch (err) {
      console.error(err);
      message.error({ content: "Pipeline failed. Check service logs.", key: "pipeline" });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Product", dataIndex: "productName", key: "productName" },
    { title: "ID", dataIndex: "productId", key: "productId" },
    { 
      title: "Stock Status", 
      dataIndex: "stock_status", 
      key: "stock_status",
      render: (status) => (
        <Tag color={status === "Understock" ? "red" : status === "Overstock" ? "orange" : "green"}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    { 
      title: "Pred. Demand", 
      dataIndex: "predicted_demand", 
      key: "predicted_demand",
      sorter: (a, b) => a.predicted_demand - b.predicted_demand
    },
    { title: "Rec. Reorder", dataIndex: "recommended_qty", key: "recommended_qty" },
    { title: "Model Used", dataIndex: "model_used", key: "model_used" },
    { 
      title: "Last Run", 
      dataIndex: "last_run", 
      key: "last_run",
      render: (date) => new Date(date).toLocaleString()
    },
  ];

  return (
    <>
      <Navbar />
      <div style={{ padding: 30, background: "#f8fafc", minHeight: "calc(100vh - 70px)" }}>
        
        {/* 🔥 HEADER & CONTROLS */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col span={24}>
            <Card style={{ borderRadius: 12 }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={3} style={{ margin: 0 }}>
                    <ExperimentOutlined /> AI Inventory Analytics Dashboard
                  </Title>
                  <Text type="secondary">Predict 14-day demand across all products using advanced ML models</Text>
                </Col>
                <Col>
                  <Space size="middle">
                    <Select 
                      defaultValue="ARIMA" 
                      style={{ width: 140 }} 
                      onChange={setSelectedModel}
                    >
                      <Option value="ARIMA">ARIMA</Option>
                      <Option value="Prophet">Prophet</Option>
                      <Option value="LightGBM">LightGBM</Option>
                    </Select>
                    <Button 
                      type="primary" 
                      icon={<RocketOutlined />} 
                      onClick={runFullPipeline}
                      loading={loading}
                    >
                      Run Batch Prediction
                    </Button>
                    <Button 
                      icon={<ReloadOutlined />} 
                      onClick={fetchData}
                    />
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {loading && !results.length ? (
          <div style={{ textAlign: "center", marginTop: 100 }}>
            <Spin size="large" tip="Processing massive datasets..." />
          </div>
        ) : (
          <Tabs defaultActiveKey="1" style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
            
            {/* 📊 TABLE VIEW */}
            <TabPane tab={<span><TableOutlined /> Insights Table</span>} key="1">
              <Table 
                columns={columns} 
                dataSource={results} 
                rowKey="productId"
                pagination={{ pageSize: 8 }}
              />
            </TabPane>

            {/* 📈 CHART VIEW */}
            <TabPane tab={<span><AreaChartOutlined /> Demand Visualization</span>} key="2">
              <Row gutter={[24, 24]}>
                
                {/* 1. Demand Bar Chart */}
                <Col span={12}>
                  <Card title="Predicted 14-Day Demand" bordered={false} style={{ borderRadius: 12 }}>
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <BarChart data={results}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="productName" tick={{fontSize: 10}} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="predicted_demand" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Units" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>

                {/* 2. Stock Status Pie Chart */}
                <Col span={12}>
                  <Card title="Inventory Status Distribution" bordered={false} style={{ borderRadius: 12 }}>
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Optimal', value: results.filter(r => r.stock_status === 'Optimal').length, fill: '#10b981' },
                              { name: 'Understock', value: results.filter(r => r.stock_status === 'Understock').length, fill: '#ef4444' },
                              { name: 'Overstock', value: results.filter(r => r.stock_status === 'Overstock').length, fill: '#f59e0b' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label
                          >
                            {/* Colors are defined in data objects for better clarity */}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>

                {/* 3. Highly Sold Products (Historical) */}
                <Col span={12}>
                  <Card title="Most Sold Products (Historical)" bordered={false} style={{ borderRadius: 12 }}>
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <BarChart data={[...results].sort((a,b) => b.total_historical_sales - a.total_historical_sales).slice(0, 5)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" />
                          <YAxis dataKey="productName" type="category" width={100} tick={{fontSize: 10}} />
                          <Tooltip />
                          <Bar dataKey="total_historical_sales" fill="#6366f1" radius={[0, 4, 4, 0]} name="Total Sold" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>

                {/* 4. Top Customers Chart */}
                <Col span={12}>
                  <Card title="Top Customers (By Orders)" bordered={false} style={{ borderRadius: 12 }}>
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <BarChart data={topCustomers}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{fontSize: 10}} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="totalOrders" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Orders" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>

              </Row>
            </TabPane>
          </Tabs>
        )}

        {!loading && results.length === 0 && (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No prediction data found. Run a batch prediction to generate insights."
          >
            <Button type="primary" onClick={runFullPipeline}>Start Data Pipeline</Button>
          </Empty>
        )}
      </div>

      <style>{`
        .ant-tabs-nav { margin-bottom: 20px !important; }
        .ant-card { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>
    </>
  );
};

export default Analytics;
