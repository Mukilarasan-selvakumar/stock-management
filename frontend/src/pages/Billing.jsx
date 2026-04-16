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

      <div style={{ padding: 40, background: "#f8fafc", minHeight: "calc(100vh - 70px)" }}>
        <div style={{ maxWidth: 1000, margin: "auto" }}>
          
          <div style={{ marginBottom: 25 }}>
            <h2 style={{ fontWeight: 700, color: "#1e293b" }}>Billing & Invoicing</h2>
            <p style={{ color: "#64748b" }}>Create a new sales transaction for a customer.</p>
          </div>

          <div style={{ background: "#fff", padding: 30, borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            
            {/* 👤 CUSTOMER FORM */}
            <Form form={form} layout="vertical">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                <Form.Item
                  name="customerName"
                  label={<b>Customer Name</b>}
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Enter name" style={{ borderRadius: 8 }} />
                </Form.Item>

                <Form.Item name="phone" label={<b>Phone</b>}>
                  <Input placeholder="Enter phone" style={{ borderRadius: 8 }} />
                </Form.Item>

                <Form.Item name="email" label={<b>Email</b>}>
                  <Input placeholder="Enter email" style={{ borderRadius: 8 }} />
                </Form.Item>
              </div>
            </Form>

            <div style={{ margin: "20px 0", borderTop: "1px solid #f1f5f9" }} />

            {/* 📊 TABLE SECTION */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 style={{ margin: 0, color: "#1e293b" }}>Product Items</h3>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addItem}
                style={{ borderRadius: 8, color: "#0ea5e9", borderColor: "#0ea5e9" }}
              >
                Add Product
              </Button>
            </div>

            <Table
              dataSource={items}
              columns={columns}
              pagination={false}
              rowKey={(record, index) => index}
              style={{ marginBottom: 20 }}
            />

            {/* 💰 SUMMARY & SUBMIT */}
            <div style={{ 
              background: "#f0f9ff", 
              padding: 20, 
              borderRadius: 12, 
              display: "flex", 
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <span style={{ color: "#64748b" }}>Grand Total:</span>
                <span style={{ fontSize: "24px", fontWeight: 700, color: "#0ea5e9", marginLeft: 15 }}>₹ {totalAmount}</span>
              </div>
              <Button type="primary" size="large" onClick={handleSubmit} style={{ borderRadius: 10, padding: "0 40px" }}>
                Complete Transaction
              </Button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default Billing;