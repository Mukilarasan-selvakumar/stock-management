import React, { useState ,useMemo} from "react";
import { Form, Input, Button, Table, Space, message } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import axiosInstance from "../api/axiosInstance";
import Navbar from "./navbar";
import debounce from "lodash/debounce";

const Billing = () => {
  const [items, setItems] = useState([]);
  const [form] = Form.useForm();

  // ➕ Add new row
  const addItem = () => {
    setItems([
      ...items,
      { productId: "", name: "", price: 0, quantity: 1 },
    ]);
  };

  // ❌ Remove row
  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // 🔄 Update item
  const updateItem = (index, key, value) => {
    const updated = [...items];
    updated[index][key] = value;
    setItems(updated);
  };

  // 🔥 FETCH PRODUCT FROM BACKEND
  const fetchProduct = async (index, productId) => {
    if (!productId) return;

    try {
      const res = await axiosInstance.get(
        `/billing/sales/product/${productId}`
      );

      const updated = [...items];

      updated[index] = {
        ...updated[index],
        productId,
        name: res.data.name,
        price: res.data.price,
      };

      setItems(updated);
    } catch (err) {
      message.error("Product not found");
    }
  };

  // 🔥 Total calculation
  const totalAmount = items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );

  // 🚀 Submit billing
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (items.length === 0) {
        return message.error("Add at least one product");
      }

      await axiosInstance.post("/billing/sales", {
        ...values,
        items,
      });

      message.success("Bill created successfully!");

      form.resetFields();
      setItems([]);
    } catch (err) {
      message.error(err.response?.data?.message || "Error creating bill");
    }
  };
const debouncedFetchProduct = useMemo(() => {
  return debounce((index, value) => {
    fetchProduct(index, value);
  }, 1000);
}, []);
  // 🧾 Table columns
  const columns = [
    {
      title: "Product ID",
      render: (_, record, index) => (
        <Input
          placeholder="Enter Product ID"
         onChange={(e) =>
    debouncedFetchProduct(index, e.target.value)
  }
        />
      ),
    },
    {
      title: "Product Name",
      render: (_, record) => (
        <Input value={record.name} disabled />
      ),
    },
    {
      title: "Price",
      render: (_, record) => (
        <Input value={record.price} disabled />
      ),
    },
    {
      title: "Qty",
      render: (_, record, index) => (
        <Input
          type="number"
          min={1}
          value={record.quantity}
          onChange={(e) =>
            updateItem(index, "quantity", Number(e.target.value))
          }
        />
      ),
    },
    {
      title: "Total",
      render: (_, record) =>
        (record.price || 0) * (record.quantity || 0),
    },
    {
      title: "Action",
      render: (_, record, index) => (
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(index)}
        />
      ),
    },
  ];

  return (
    <>
      <Navbar />

      <div style={{ padding: 20, maxWidth: 900, margin: "auto" }}>
        <h2>Billing Page</h2>

        {/* 👤 CUSTOMER FORM */}
        <Form form={form} layout="vertical">
          <Form.Item
            name="customerName"
            label="Customer Name"
            rules={[{ required: true }]}
          >
            <Input placeholder="Enter name" />
          </Form.Item>

          <Form.Item name="phone" label="Phone">
            <Input placeholder="Enter phone" />
          </Form.Item>

          <Form.Item name="email" label="Email">
            <Input placeholder="Enter email" />
          </Form.Item>
        </Form>

        {/* ➕ ADD ITEM */}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addItem}
          style={{ marginBottom: 10 }}
        >
          Add Product
        </Button>

        {/* 📊 TABLE */}
        <Table
          dataSource={items}
          columns={columns}
          pagination={false}
          rowKey={(record, index) => index}
        />

        {/* 💰 TOTAL */}
        <div style={{ marginTop: 20, textAlign: "right" }}>
          <h3>Total: ₹ {totalAmount}</h3>
        </div>

        {/* 🚀 SUBMIT */}
        <Space style={{ marginTop: 20 }}>
          <Button type="primary" onClick={handleSubmit}>
            Generate Bill
          </Button>
        </Space>
      </div>
    </>
  );
};

export default Billing;