import React, { useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { Table, Button, Modal, Form, Input } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import Navbar from "./navbar";

const StockPage = () => {
  const [data, setData] = useState([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    const res = await axiosInstance.get("/inventory");
    setData(res.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditItem(null);
    form.resetFields();
    setOpen(true);
  };

  const handleEdit = (record) => {
    setEditItem(record);
    form.setFieldsValue(record);
    setOpen(true);
  };

  const handleDelete = async (id) => {
    await axiosInstance.delete(`/inventory/${id}`);
    fetchData();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (editItem) {
      await axiosInstance.put(`/inventory/${editItem._id}`, values);
    } else {
      await axiosInstance.post("/inventory", values);
    }

    setOpen(false);
    fetchData();
  };
const columns = [
  { title: "Product ID", dataIndex: "productId" },

  { title: "Product Name", dataIndex: "productName" }, // ✅ NEW

  { title: "Category", dataIndex: "category" }, // ✅ NEW

  { title: "Price", dataIndex: "price" }, // ✅ NEW

  { title: "Stock Count", dataIndex: "stock" },

  {
    title: "Last Updated",
    dataIndex: "lastUpdated",
    render: (date) => new Date(date).toLocaleString(),
  },

  {
    title: "Actions",
    render: (_, record) => (
      <>
        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
        <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} />
      </>
    ),
  },
];

  return (
    <>
      <Navbar />
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
          <h2>StockPage Management</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Add StockPage
          </Button>
        </div>

        <Table dataSource={data} columns={columns} rowKey="_id" />

        <Modal
          title={editItem ? "Edit StockPage" : "Add StockPage"}
          open={open}
          onOk={handleSubmit}
          onCancel={() => setOpen(false)}
        >
  <Form
  form={form}
  layout="vertical"
  style={{ marginTop: 10 }}
>
  <Form.Item
    name="productId"
    label="Product ID"
    rules={[{ required: true }]}
  >
    <Input placeholder="Enter product ID" />
  </Form.Item>

  <Form.Item
    name="name"
    label="Product Name"
    rules={[{ required: true }]}
  >
    <Input placeholder="Enter product name" />
  </Form.Item>

  <Form.Item name="category" label="Category">
    <Input placeholder="e.g. Clothing" />
  </Form.Item>

  <Form.Item name="price" label="Price">
    <Input type="number" placeholder="Enter price" />
  </Form.Item>

  <Form.Item
    name="stock"
    label="Stock Count"
    rules={[{ required: true }]}
  >
    <Input type="number" placeholder="Enter stock" />
  </Form.Item>
</Form>
        </Modal>
      </div>
    </>
  );
};

export default StockPage;