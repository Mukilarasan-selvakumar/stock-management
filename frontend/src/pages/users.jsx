import React, { useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { Table, Button, Modal, Form, Input, Select } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import Navbar from "./navbar";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form] = Form.useForm();

  //  FETCH USERS
  const fetchUsers = async () => {
    const res = await axiosInstance.get("/users");
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  //  OPEN MODAL
  const handleAdd = () => {
    setEditUser(null);
    form.resetFields();
    setOpen(true);
  };

  const handleEdit = (record) => {
    setEditUser(record);
    form.setFieldsValue(record);
    setOpen(true);
  };

  //  DELETE
  const handleDelete = async (id) => {
    await axiosInstance.delete(`/users/${id}`);
    fetchUsers();
  };

  //  SUBMIT
  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (editUser) {
      await axiosInstance.put(`/users/${editUser._id}`, values);
    } else {
      await axiosInstance.post("/users", values);
    }

    setOpen(false);
    fetchUsers();
  };

  //  TABLE COLUMNS
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
    },
    {
      title: "Email",
      dataIndex: "email",
    },
    {
      title: "Phone",
      dataIndex: "phone",
    },
    {
      title: "Role",
      dataIndex: "role",
      render: (role) => (
        <span style={{ color: role === "superadmin" ? "green" : "gray" }}>
          {role}
        </span>
      ),
    },
    {
      title: "Actions",
      render: (_, record) => (
        <>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ marginRight: 8 }}
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          />
        </>
      ),
    },
  ];

  return (
    <>
          <Navbar>

    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ padding: 40 }}>
        {/*  HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
          <h2 style={{ margin: 0, fontWeight: 700, color: "#1e293b" }}>User & Role Management</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="medium" style={{ borderRadius: 10 }}>
            Add New User
          </Button>
        </div>

        {/* ✅ TABLE */}
        <Table
          dataSource={users}
          columns={columns}
          rowKey="_id"
          style={{ 
            background: "#fff", 
            borderRadius: 12, 
            overflow: "hidden", 
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" 
          }}
        />

      {/* ✅ MODAL */}
      <Modal
        title={editUser ? "Edit User" : "Add User"}
        open={open}
        onOk={handleSubmit}
        onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
         {!editUser && (
  <Form.Item
    name="password"
    label="Password"
    rules={[{ required: true, message: "Password is required" }]}
  >
    <Input.Password />
  </Form.Item>
)}
          

          <Form.Item name="role" label="Role" initialValue="user">
            <Select>
              <Select.Option value="user">User</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="superadmin">Super Admin</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
</div>
    </div>
          </Navbar>

    </>
  );
};

export default Users;