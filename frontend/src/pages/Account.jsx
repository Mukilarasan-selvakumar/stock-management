import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  Card,
  Descriptions,
  Button,
  Modal,
  Form,
  Input,
  message,
  Tag,
  Typography,
  Avatar,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import Navbar from "./navbar";

import PhoneInput, {
  isValidPhoneNumber,
} from "react-phone-number-input";
import "react-phone-number-input/style.css";

const { Title, Text } = Typography;

const Account = () => {
  const { user, updateProfile } = useContext(AuthContext);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const showModal = () => {
    form.setFieldsValue({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });

    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();

      setLoading(true);

      await updateProfile(values);

      message.success("Profile updated successfully!");

      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      message.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Navbar>
      <div
        style={{
          padding: "40px",
          background: "#f0f2f5",
          minHeight: "100vh",
        }}
      >
        <Row justify="center">
          <Col xs={24} sm={22} md={18} lg={12}>
            <Card
              style={{
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              cover={
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #1890ff 0%, #096dd9 100%)",
                    height: 120,
                  }}
                />
              }
            >
              <div
                style={{
                  textAlign: "center",
                  marginTop: -60,
                  marginBottom: 20,
                }}
              >
                <Avatar
                  size={100}
                  icon={<UserOutlined />}
                  style={{
                    border: "4px solid #fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                />

                <Title
                  level={2}
                  style={{
                    marginTop: 10,
                    marginBottom: 0,
                  }}
                >
                  {user?.name}
                </Title>

                <Tag
                  color={
                    user?.role === "superadmin"
                      ? "gold"
                      : "blue"
                  }
                  style={{ marginTop: 8 }}
                >
                  {user?.role?.toUpperCase()}
                </Tag>
              </div>

              <Descriptions
                title="Profile Information"
                bordered
                column={1}
                extra={
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={showModal}
                  >
                    Edit Profile
                  </Button>
                }
              >
                <Descriptions.Item
                  label={
                    <span>
                      <UserOutlined /> Name
                    </span>
                  }
                >
                  {user?.name}
                </Descriptions.Item>

                <Descriptions.Item
                  label={
                    <span>
                      <MailOutlined /> Email
                    </span>
                  }
                >
                  {user?.email}
                </Descriptions.Item>

                <Descriptions.Item
                  label={
                    <span>
                      <PhoneOutlined /> Phone
                    </span>
                  }
                >
                  {user?.phone || "Not Set"}
                </Descriptions.Item>

                <Descriptions.Item
                  label={
                    <span>
                      <SafetyCertificateOutlined /> Role
                    </span>
                  }
                >
                  <Text strong>{user?.role}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* EDIT PROFILE MODAL */}

        <Modal
          title="Update Profile"
          open={isModalOpen}
          onOk={handleUpdate}
          onCancel={() => setIsModalOpen(false)}
          confirmLoading={loading}
          okText="Save Changes"
        >
          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: 20 }}
          >
            <Form.Item
              name="name"
              label="Full Name"
              rules={[
                {
                  required: true,
                  message: "Please enter your name",
                },
              ]}
            >
              <Input prefix={<UserOutlined />} />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                {
                  required: true,
                  type: "email",
                  message: "Please enter a valid email",
                },
              ]}
            >
              <Input prefix={<MailOutlined />} />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone Number"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) {
                      return Promise.resolve();
                    }

                    if (!isValidPhoneNumber(value)) {
                      return Promise.reject(
                        new Error(
                          "Please enter a valid phone number"
                        )
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
          </Form>
        </Modal>
      </div>
    </Navbar>
  );
};

export default Account;