import React, { useState, useEffect } from "react";
import { Card, Select, Button, Row, Col, Table, Tag, Spin, Empty, message, Tabs, Space, Typography } from "antd";
import { RocketOutlined, ExperimentOutlined, TableOutlined, AreaChartOutlined, ReloadOutlined } from "@ant-design/icons";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import axiosInstance from "../api/axiosInstance";
import Navbar from "./navbar";

const { Option } = Select;
const { TabPane } = Tabs;
const { Title, Text } = Typography;

const Analytics = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);

  //  DEFAULT = Prophet
  const [selectedModel, setSelectedModel] = useState("Prophet");

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
      await axiosInstance.post("/process/process-all");

      message.loading({
        content: `Running ${selectedModel} predictions...`,
        key: "pipeline"
      });

      await axiosInstance.post("/predict/predict-all", {
        model: selectedModel
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

  // Table Columns
  const columns = [
    { title: "Product", dataIndex: "productName" },
    { title: "ID", dataIndex: "productId" },{
      title: "Current Stock",
      dataIndex: "current_stock",
       render: (value) => Math.round(value),
    }
    ,
    {
      title: "Demand",
      dataIndex: "predicted_demand",
       render: (value) => Math.round(value),
    },
    { title: "Reorder", dataIndex: "recommended_qty" , render: (value) => Math.round(value)},
    
    {
      title: "Stock",
      dataIndex: "stock_status",
      render: (s) => (
        <Tag color={s === "Understock" ? "red" : s === "Overstock" ? "orange" : "green"}>
          {s}
        </Tag>
      )
    },

    //  MODEL TAG
    {
      title: "Model",
      dataIndex: "model_used",
      render: (model) => (
        <Tag color={model === "Prophet" ? "green" : model === "ARIMA" ? "blue" : "purple"}>
          {model}
        </Tag>
      )
    }
  ];

  return (
    <>
      <Navbar>

      <div style={{ padding: 30 }}>
        {/* HEADER */}
        <Card style={{ marginBottom: 20 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={3}>
                 AI Analytics
              </Title>
              <Text>Demand Prediction Dashboard</Text>
            </Col>

            <Col>
              <Space>
                {/*  DROPDOWN WITH TAG */}
                <Select
                  value={selectedModel}
                  style={{ width: 200 }}
                  onChange={setSelectedModel}
                >
                  <Option value="ARIMA">ARIMA</Option>

                  <Option value="Prophet">
                    Prophet{" "}
                    <Tag color="green" style={{ marginLeft: 6 }}>
                      Recommended
                    </Tag>
                  </Option>

                  <Option value="LightGBM">LightGBM</Option>
                </Select>

                <Button
                  type="primary"
                  onClick={runFullPipeline}
                  loading={loading}
                >
                  Run Batch
                </Button>

                <Button icon={<ReloadOutlined />} onClick={fetchData} />
              </Space>
            </Col>
          </Row>
        </Card>

        {/* LOADING */}
        {loading ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center" , margin:"50px"}}>  
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
            {/* TABLE */}
            <TabPane tab={<span><TableOutlined /> Table</span>} key="1">
              <Table dataSource={results} columns={columns} rowKey="productId" />
            </TabPane>

            {/* CHART */}
            <TabPane tab={<span><AreaChartOutlined /> Charts</span>} key="2">
              <Row gutter={20}>
                <Col span={12}>
                  <Card title="Demand">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="productName" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="predicted_demand" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>

                <Col span={12}>
                  <Card title="Stock Status">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Optimal", value: results.filter(r => r.stock_status === "Optimal").length },
                            { name: "Understock", value: results.filter(r => r.stock_status === "Understock").length },
                            { name: "Overstock", value: results.filter(r => r.stock_status === "Overstock").length }
                          ]}
                          dataKey="value"
                          label
                        />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>
            </TabPane>
          </Tabs>
        )}
      </div>
            </Navbar>

    </>
  );
};

export default Analytics;