import React, { useState, useMemo } from "react";
import { Form, Input, Button, Table, Space, message } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import axiosInstance from "../api/axiosInstance";
import Navbar from "./navbar";
import debounce from "lodash/debounce";

const Billing = () => {
  const [items, setItems] = useState([]);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false); // ✅ Loader state

  // ➕ Add item
  const addItem = () => {
    setItems([
      ...items,
      { productId: "", name: "", price: 0, quantity: 1 },
    ]);
  };

  // ❌ Remove item
  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // 🔄 Update item safely
  const updateItem = (index, key, value) => {
    const updated = [...items];
    updated[index][key] = value ?? "";
    setItems(updated);
  };

  // 🔍 Fetch product safely
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
        name: res?.data?.name || "",
        price: res?.data?.price || 0,
      };

      setItems(updated);
    } catch (err) {
      message.error(
        err?.response?.data?.message || "Product not found"
      );
    }
  };

  // ⏳ Debounce API call
  const debouncedFetchProduct = useMemo(() => {
    return debounce((index, value) => {
      fetchProduct(index, value);
    }, 800);
  }, [items]);

  // 💰 Total calculation
  const totalAmount = items.reduce(
    (sum, item) =>
      sum +
      (item?.price || 0) * (item?.quantity || 0),
    0
  );

  // 📤 Submit billing
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (items.length === 0) {
        return message.error("Add at least one product");
      }

      setLoading(true); // ✅ Start loader

      await axiosInstance.post("/billing/sales", {
        ...values,
        items,
      });

      message.success("Bill created successfully!");

      form.resetFields();
      setItems([]);
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          "Error creating bill"
      );
    } finally {
      setLoading(false); // ✅ Stop loader (success or error)
    }
  };

  // 📊 Table columns
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
        <Input value={record?.name || ""} disabled />
      ),
    },
    {
      title: "Price",
      render: (_, record) => (
        <Input value={record?.price || 0} disabled />
      ),
    },
    {
      title: "Qty",
      render: (_, record, index) => (
        <Input
          type="number"
          min={1}
          value={record?.quantity || 1}
          onChange={(e) => {
            const qty = Number(e.target.value) || 1;
            updateItem(index, "quantity", qty);
          }}
        />
      ),
    },
    {
      title: "Total",
      render: (_, record) =>
        (record?.price || 0) *
        (record?.quantity || 0),
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
      <Navbar>
        <div
          style={{
            padding: 40,
            background: "#f8fafc",
            minHeight: "calc(100vh - 70px)",
          }}
        >
          <div style={{ maxWidth: 1000, margin: "auto" }}>
            <div style={{ marginBottom: 25 }}>
              <h2>Billing & Invoicing</h2>
              <p>Create a new sales transaction</p>
            </div>

            <div
              style={{
                background: "#fff",
                padding: 30,
                borderRadius: 16,
              }}
            >
              {/* CUSTOMER FORM */}
              <Form form={form} layout="vertical">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr 1fr 1fr",
                    gap: "20px",
                  }}
                >
                  <Form.Item
                    name="customerName"
                    label="Customer Name"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Enter name" />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label="Phone"
                  >
                    <Input placeholder="Enter phone" />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="Email"
                  >
                    <Input placeholder="Enter email" />
                  </Form.Item>
                </div>
              </Form>

              <div
                style={{
                  margin: "20px 0",
                  borderTop: "1px solid #eee",
                }}
              />

              {/* ITEMS */}
              <Space style={{ marginBottom: 10 }}>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={addItem}
                  disabled={loading} // ✅ Disable while loading
                >
                  Add Product
                </Button>
              </Space>

              <Table
                dataSource={items}
                columns={columns}
                pagination={false}
                rowKey={(r, i) => i}
              />

              {/* TOTAL */}
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <h3>Total: ₹ {totalAmount}</h3>

                <Button
                  type="primary"
                  onClick={handleSubmit}
                  loading={loading} // ✅ Show loader on button
                  disabled={loading} // ✅ Disable while loading
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Navbar>
    </>
  );
};

export default Billing;