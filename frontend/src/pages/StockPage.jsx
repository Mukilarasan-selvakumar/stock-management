import React, { useContext, useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { Table, Button, Modal, Form, Input, Upload, message, Space, Popconfirm, Radio, Alert } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined, UploadOutlined, DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import Navbar from "./navbar";
import { AuthContext } from "../context/AuthContext";
import * as XLSX from 'xlsx';

const StockPage = () => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [open, setOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await axiosInstance.get("/inventory");
      setData(res.data);
    } catch (error) {
      message.error("Failed to fetch data");
    }
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
    form.setFieldsValue({
      productId: record.productId,
      productName: record.productName,
      category: record.category,
      price: record.price,
      stock: 0,
      stockUpdateStrategy: 'add',
    });
    setOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/inventory/${id}`);
      message.success("Deleted successfully");
      fetchData();
    } catch (error) {
      message.error("Failed to delete");
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);
      
      if (editItem) {
        // Ensure stock is treated as number
        const stockValue = parseInt(values.stock) || 0;
        const currentStock = parseInt(editItem.stock) || 0;
        
        // Calculate final stock based on strategy
        let finalStock;
        if (values.stockUpdateStrategy === 'add') {
          finalStock = currentStock + stockValue;
        } else {
          finalStock = stockValue;
        }
        
        // Single API call to update both product and inventory
        await axiosInstance.put(`/inventory/${editItem._id}`, {
          name: values.productName,
          category: values.category,
          price: parseFloat(values.price),
          stock: stockValue,
          stockUpdateStrategy: values.stockUpdateStrategy,
        });
        
        message.success(`Stock updated successfully! New stock: ${finalStock}`);
      } else {
        // Validate required fields for new product
        if (!values.productId) {
          message.error("Product ID is required");
          return;
        }
        if (!values.productName) {
          message.error("Product Name is required");
          return;
        }
        if (!values.price) {
          message.error("Price is required");
          return;
        }
        if (!values.stock && values.stock !== 0) {
          message.error("Stock count is required");
          return;
        }
        
        await axiosInstance.post("/inventory", {
          productId: values.productId,
          name: values.productName,
          category: values.category || "Uncategorized",
          price: parseFloat(values.price),
          stock: parseInt(values.stock),
        });
        
        message.success("Product added successfully");
      }
      
      setOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      console.error("Submit error:", error);
      message.error(error.response?.data?.message || error.message || "Operation failed");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Watch stock update strategy for preview
  const watchStockStrategy = Form.useWatch('stockUpdateStrategy', form);
  const watchStockValue = Form.useWatch('stock', form);

  // Read and preview Excel file - Only productId and stock are required, others left empty
  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          const previewData = jsonData.map(row => {
            // Extract productId (required)
            const productId = row.productId || row.ProductID;
            
            // Skip rows without productId
            if (!productId) {
              return null;
            }
            
            // Extract stock (required)
            let stock = row.stock !== undefined ? row.stock : row.Stock;
            if (stock === undefined || stock === null || stock === '') {
              return null; // Skip if stock is missing
            }
            
            // Convert stock to number
            stock = parseInt(stock);
            if (isNaN(stock)) {
              return null; // Skip if stock is not a valid number
            }
            
            // Optional fields - keep as is (undefined if not provided)
            return {
              productId: String(productId),
              productName: row.productName || row.ProductName || row.name,
              category: row.category || row.Category,
              price: row.price || row.Price,
              stock: stock,
            };
          }).filter(item => item !== null); // Remove invalid entries
          
          if (previewData.length === 0) {
            reject(new Error("No valid data found. Each row must have productId and stock"));
          }
          
          resolve(previewData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Handle file selection for import
  const handleFileSelect = async (file) => {
    setImportLoading(true);
    try {
      const previewData = await readExcelFile(file);
      setUploadFile(file);
      setImportPreview(previewData);
      message.success(`Loaded ${previewData.length} items for preview`);
    } catch (error) {
      message.error(error.message || "Failed to read file");
      setImportPreview(null);
      setUploadFile(null);
    } finally {
      setImportLoading(false);
    }
    return false;
  };

  // Handle file removal
  const handleFileRemove = () => {
    setImportPreview(null);
    setUploadFile(null);
    message.info("File removed");
  };

  // Handle import with selected strategy
  const handleImport = async () => {
    try {
      const values = await importForm.validateFields();
      const { updateStrategy } = values;
      
      if (!uploadFile || !importPreview) {
        message.error("Please select a file first");
        return;
      }
      
      // Validate that all items have required fields
      const invalidItems = importPreview.filter(item => 
        !item.productId || item.stock === undefined || item.stock === null || isNaN(item.stock)
      );
      
      if (invalidItems.length > 0) {
        message.error(`Found ${invalidItems.length} items missing productId or stock. Please check your file.`);
        return;
      }
      
      setImportLoading(true);
      
      const items = importPreview.map(item => ({
        productId: String(item.productId),
        name: item.productName || "",
        category: item.category || "",
        price: item.price !== undefined && item.price !== null && item.price !== "" ? parseFloat(item.price) : undefined,
        stock: parseInt(item.stock),
      }));
      
      const response = await axiosInstance.post("/inventory/bulk-import", {
        items,
        updateStrategy
      });
      
      if (response.data.summary) {
        message.success(
          `Import completed! Created: ${response.data.summary.created}, ` +
          `Updated: ${response.data.summary.updated}, ` +
          `Errors: ${response.data.summary.errors}`
        );
      } else {
        message.success("Import completed successfully");
      }
      
      handleCloseImportModal();
      fetchData();
      
    } catch (error) {
      console.error("Import error:", error);
      message.error(error.response?.data?.message || error.message || "Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  // Close add/edit modal and clear state
  const handleCloseModal = () => {
    setOpen(false);
    setEditItem(null);
    form.resetFields();
  };

  // Close import modal and clear all states
  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setImportPreview(null);
    setUploadFile(null);
    setImportLoading(false);
    importForm.resetFields();
  };

  // Download template
  const downloadTemplate = () => {
    const template = [
      {
        productId: "P001",
        productName: "Sample Product",
        category: "Electronics",
        price: 99.99,
        stock: 100
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory_Template");
    XLSX.writeFile(wb, "inventory_template.xlsx");
    message.success("Template downloaded");
  };

  const columns = [
    { title: "Product ID", dataIndex: "productId", width: 100 },
    { title: "Product Name", dataIndex: "productName", width: 150 },
    { title: "Category", dataIndex: "category", width: 120 },
    { 
      title: "Price", 
      dataIndex: "price", 
      width: 100,
      render: (price) => price ? `$${price?.toFixed(2)}` : "-"
    },
    { title: "Stock Count", dataIndex: "stock", width: 100 },
    {
      title: "Last Updated",
      dataIndex: "lastUpdated",
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : "N/A",
    },
    {
      title: "Actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: '6px' }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Delete this item?"
            description="Are you sure you want to delete this product?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <Navbar>
        {(user?.role === "admin" || user?.role === "superadmin") && (
          <div style={{ padding: 40, background: "#f8fafc", minHeight: "calc(100vh - 70px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ margin: 0, fontWeight: 700, color: "#1e293b" }}>Inventory Management</h2>
              <Space>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={downloadTemplate}
                >
                  Download Template
                </Button>
                <Button 
                  icon={<UploadOutlined />} 
                  onClick={() => setImportModalOpen(true)}
                  type="default"
                >
                  Import Excel
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="medium" style={{ borderRadius: 10 }}>
                  Add New Product
                </Button>
                <Button type="primary" icon={<ReloadOutlined />} onClick={fetchData} size="medium" style={{ borderRadius: 10 }}>
                  Refresh
                </Button>
              </Space>
            </div>

            <Table 
              dataSource={data} 
              columns={columns} 
              rowKey="_id" 
              style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
              scroll={{ x: 1000 }}
            />

            {/* Add/Edit Modal */}
            <Modal
              title={editItem ? "Edit Product & Inventory" : "Add New Product"}
              open={open}
              onOk={handleSubmit}
              onCancel={handleCloseModal}
              width={600}
              afterClose={handleCloseModal}
              confirmLoading={submitLoading}
            >
              <Form form={form} layout="vertical" style={{ marginTop: 10 }}>
                <Form.Item
                  name="productId"
                  label="Product ID"
                  rules={[{ required: true, message: "Please enter product ID" }]}
                  tooltip="Unique identifier for the product"
                >
                  <Input placeholder="Enter product ID (e.g., P001)" disabled={!!editItem} />
                </Form.Item>

                <Form.Item
                  name="productName"
                  label="Product Name"
                  rules={[{ required: true, message: "Please enter product name" }]}
                >
                  <Input placeholder="Enter product name" />
                </Form.Item>

                <Form.Item 
                  name="category" 
                  label="Category"
                  tooltip="Optional: Categorize your product"
                >
                  <Input placeholder="e.g., Clothing, Electronics, Food" />
                </Form.Item>

                <Form.Item
                  name="price"
                  label="Price"
                  rules={[
                    { required: true, message: "Please enter price" },
                    { type: 'number', min: 0, message: "Price must be greater than 0" }
                  ]}
                >
                  <Input type="number" placeholder="Enter price" prefix="$" />
                </Form.Item>

                {editItem ? (
                  <>
                    <Form.Item label="Current Stock">
                      <Input 
                        type="number" 
                        disabled 
                        value={editItem?.stock} 
                      />
                    </Form.Item>
                    
                    <Form.Item
                      name="stockUpdateStrategy"
                      label="Stock Update Strategy"
                      rules={[{ required: true, message: "Please select update strategy" }]}
                      initialValue="add"
                    >
                      <Radio.Group>
                        <Space direction="vertical">
                          <Radio value="add">
                            <Space>
                              <span><strong>Add to Existing Stock</strong></span>
                              <span style={{ color: '#666', fontSize: '12px' }}>
                                (New stock = Current stock + New stock)
                              </span>
                            </Space>
                          </Radio>
                          <Radio value="overwrite">
                            <Space>
                              <span><strong>Overwrite Stock</strong></span>
                              <span style={{ color: '#666', fontSize: '12px' }}>
                                (Replace current stock with new stock)
                              </span>
                            </Space>
                          </Radio>
                        </Space>
                      </Radio.Group>
                    </Form.Item>

                    <Form.Item
                      name="stock"
                      label="Stock Quantity"
                      rules={[{ required: true, message: "Please enter stock quantity" }]}
                    >
                      <Input type="number" placeholder="Enter stock quantity" />
                    </Form.Item>

                    {watchStockStrategy === 'add' && watchStockValue > 0 && (
                      <Alert
                        message="Stock Preview"
                        description={`Current stock: ${parseInt(editItem?.stock) || 0} + New stock: ${parseInt(watchStockValue) || 0} = Total: ${(parseInt(editItem?.stock) || 0) + (parseInt(watchStockValue) || 0)}`}
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    )}

                    {watchStockStrategy === 'overwrite' && watchStockValue > 0 && (
                      <Alert
                        message="Stock Preview"
                        description={`Current stock (${parseInt(editItem?.stock) || 0}) will be replaced with: ${parseInt(watchStockValue) || 0}`}
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    )}
                  </>
                ) : (
                  <Form.Item
                    name="stock"
                    label="Stock Count"
                    rules={[{ required: true, message: "Please enter stock count" }]}
                  >
                    <Input type="number" placeholder="Enter stock quantity" />
                  </Form.Item>
                )}
              </Form>
            </Modal>

            {/* Import Modal */}
            <Modal
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UploadOutlined />
                  <span>Import Inventory</span>
                </div>
              }
              open={importModalOpen}
              onCancel={handleCloseImportModal}
              width={800}
              afterClose={handleCloseImportModal}
              footer={[
                <Button key="cancel" onClick={handleCloseImportModal}>
                  Cancel
                </Button>,
                <Button
                  key="import"
                  type="primary"
                  onClick={handleImport}
                  loading={importLoading}
                  disabled={!importPreview || importPreview.length === 0}
                >
                  Import Now
                </Button>
              ]}
            >
              <Form form={importForm} layout="vertical">
                <Alert
                  message="Import Instructions"
                  description="Upload an Excel file with columns: productId (required), stock (required). Other columns (productName, category, price) are optional and can be left empty."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <Form.Item
                  name="updateStrategy"
                  label="Stock Update Strategy"
                  rules={[{ required: true, message: "Please select update strategy" }]}
                  initialValue="add"
                >
                  <Radio.Group>
                    <Space direction="vertical">
                      <Radio value="add">
                        <Space>
                          <span><strong>Add to Existing Stock</strong></span>
                          <span style={{ color: '#666', fontSize: '12px' }}>
                            (New stock = Current stock + Imported stock) - Recommended
                          </span>
                        </Space>
                      </Radio>
                      <Radio value="overwrite">
                        <Space>
                          <span><strong>Overwrite Stock</strong></span>
                          <span style={{ color: '#666', fontSize: '12px' }}>
                            (Replace current stock with imported stock)
                          </span>
                        </Space>
                      </Radio>
                    </Space>
                  </Radio.Group>
                </Form.Item>

                <Form.Item label="Upload File">
                  <Upload
                    accept=".xlsx,.xls,.csv"
                    showUploadList={true}
                    beforeUpload={handleFileSelect}
                    disabled={importLoading}
                    maxCount={1}
                    onRemove={handleFileRemove}
                  >
                    <Button icon={<UploadOutlined />} loading={importLoading}>
                      Select File
                    </Button>
                  </Upload>
                </Form.Item>

                {importPreview && importPreview.length > 0 && (
                  <>
                    <Alert
                      message={`Loaded ${importPreview.length} items`}
                      type="success"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <div style={{ marginTop: 16, marginBottom: 8 }}>
                      <strong>Preview (First 5 items):</strong>
                    </div>
                    <Table
                      dataSource={importPreview.slice(0, 5)}
                      columns={[
                        { 
                          title: "Product ID", 
                          dataIndex: "productId", 
                          width: 100,
                          render: (text) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{text}</span>
                        },
                        { 
                          title: "Product Name", 
                          dataIndex: "productName", 
                          width: 150,
                          render: (text) => text || <span style={{ color: '#999', fontStyle: 'italic' }}>Empty</span>
                        },
                        { 
                          title: "Category", 
                          dataIndex: "category", 
                          width: 100,
                          render: (text) => text || <span style={{ color: '#999', fontStyle: 'italic' }}>Empty</span>
                        },
                        { 
                          title: "Price", 
                          dataIndex: "price", 
                          width: 80, 
                          render: (v) => v ? `$${v}` : <span style={{ color: '#999', fontStyle: 'italic' }}>Empty</span>
                        },
                        { 
                          title: "Stock", 
                          dataIndex: "stock", 
                          width: 80,
                          render: (text) => <span style={{ fontWeight: 'bold', color: '#52c41a' }}>{text}</span>
                        },
                      ]}
                      rowKey="productId"
                      size="small"
                      pagination={false}
                      scroll={{ x: 600 }}
                    />
                    {importPreview.length > 5 && (
                      <div style={{ marginTop: 8, color: "#666" }}>
                        ... and {importPreview.length - 5} more items
                      </div>
                    )}
                  </>
                )}
              </Form>
            </Modal>
          </div>
        )}
      </Navbar>
    </>
  );
};

export default StockPage;