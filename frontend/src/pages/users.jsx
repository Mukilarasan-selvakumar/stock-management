import React, { useContext, useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { Table, Button, Modal, Form, Input, Select } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import Swal from "sweetalert2";
import Navbar from "./navbar";
import { AuthContext } from "../context/AuthContext";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "./Users.css"; // We'll create this CSS file

const Users = () => {
  const { user } = useContext(AuthContext);
  
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form] = Form.useForm();

  // FETCH USERS
  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get("/users");
      setUsers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ADD USER
  const handleAdd = () => {
    setEditUser(null);
    form.resetFields();
    setOpen(true);
  };

  // EDIT USER
  const handleEdit = (record) => {
    setEditUser(record);
    form.setFieldsValue({
      ...record,
      phone: record.phone || "",
    });
    setOpen(true);
  };

  // DELETE USER
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete User?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d33",
    });

    if (!result.isConfirmed) return;

    try {
      await axiosInstance.delete(`/users/${id}`);

      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: "User deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });

      fetchUsers();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error?.response?.data?.message ||
          "Failed to delete user",
      });
    }
  };

  // ADD / UPDATE USER
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editUser) {
        await axiosInstance.put(`/users/${editUser._id}`, values);

        Swal.fire({
          icon: "success",
          title: "Success",
          text: "User updated successfully",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await axiosInstance.post("/users", values);

        Swal.fire({
          icon: "success",
          title: "Success",
          text: "User created successfully",
          timer: 1500,
          showConfirmButton: false,
        });
      }

      setOpen(false);
      fetchUsers();
    } catch (error) {
      let message =
        error?.response?.data?.message ||
        "Something went wrong";

      if (message.includes("minimum allowed length")) {
        message = "Password must be at least 6 characters long";
      }

      if (message.includes("duplicate key")) {
        message = "Email already exists";
      }

      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: message,
      });
    }
  };

  // TABLE COLUMNS
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
      render: (phone) => phone || "-",
    },
    {
      title: "Role",
      dataIndex: "role",
      render: (role) => (
        <span
          style={{
            color:
              role === "superadmin"
                ? "green"
                : role === "admin"
                ? "#1677ff"
                : "gray",
            fontWeight: 600,
          }}
        >
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
    <Navbar>
      {user?.role === "superadmin" && (
        <div
          style={{
            background: "#f8fafc",
            minHeight: "100vh",
          }}
        >
          <div style={{ padding: 40 }}>
            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 25,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                User & Role Management
              </h2>

              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                style={{ borderRadius: 10 }}
              >
                Add New User
              </Button>
            </div>

            {/* TABLE */}
            <Table
              dataSource={users}
              columns={columns}
              rowKey="_id"
              style={{
                background: "#fff",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow:
                  "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            />

            {/* MODAL */}
            <Modal
              title={editUser ? "Edit User" : "Add User"}
              open={open}
              onOk={handleSubmit}
              onCancel={() => setOpen(false)}
              okText={editUser ? "Update" : "Create"}
              width={600}
            >
              <Form form={form} layout="vertical">
                <Form.Item
                  name="name"
                  label="Name"
                  rules={[
                    {
                      required: true,
                      message: "Name is required",
                    },
                  ]}
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    {
                      required: true,
                      message: "Email is required",
                    },
                    {
                      type: "email",
                      message: "Please enter a valid email",
                    },
                  ]}
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="phone"
                  label="Phone"
                  rules={[
                    {
                      required: true,
                      message: "Phone is required",
                    },
                    {
                      validator: (_, value) => {
                        if (!value) {
                          return Promise.reject(
                            new Error("Phone number is required")
                          );
                        }

                        if (!isValidPhoneNumber(value)) {
                          return Promise.reject(
                            new Error("Please enter a valid phone number")
                          );
                        }

                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <PhoneInput
                    international
                    defaultCountry="IN"
                    countryCallingCodeEditable={false}
                    placeholder="Enter phone number"
                  />
                </Form.Item>

                {!editUser && (
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      {
                        required: true,
                        message: "Password is required",
                      },
                      {
                        min: 6,
                        message:
                          "Password must be at least 6 characters",
                      },
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>
                )}

                <Form.Item
                  name="role"
                  label="Role"
                  initialValue="user"
                >
                  <Select>
                    <Select.Option value="user">
                      User
                    </Select.Option>

                    <Select.Option value="admin">
                      Admin
                    </Select.Option>

                    <Select.Option value="superadmin">
                      Super Admin
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Form>
            </Modal>
          </div>
        </div>
      )}
    </Navbar>
  );
};

export default Users;