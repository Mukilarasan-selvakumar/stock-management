import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Link } from "react-router-dom";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Row,
  Col,
} from "antd";
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
} from "@ant-design/icons";

import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "./signup.css";

const { Title, Text } = Typography;

const Signup = () => {
  const { signup } = useContext(AuthContext);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    setError(null);

    try {
      await signup(values);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to create account. Email might already exist."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <Row
        gutter={40}
        align="middle"
        style={{ maxWidth: 1000, width: "100%" }}
      >
        {/* Decorative Side */}
        <Col xs={0} md={12}>
          <div style={{ color: "#1e293b" }}>
            <Title
              level={1}
              style={{
                fontSize: 48,
                fontWeight: 800,
                margin: 0,
                color: "#1e293b",
              }}
            >
              Store <span style={{ color: "#0ea5e9" }}>App</span>
            </Title>
          </div>
        </Col>

        {/* Signup Form */}
        <Col xs={24} md={12}>
          <Card
            style={{
              borderRadius: 24,
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              padding: "20px",
            }}
          >
            <div style={{ marginBottom: 30 }}>
              <Title level={2} style={{ margin: 0 }}>
                Create Account
              </Title>
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                style={{ marginBottom: 20, borderRadius: 12 }}
              />
            )}

            <Form
              layout="vertical"
              onFinish={onFinish}
              size="large"
            >
              {/* Name */}
              <Form.Item
                name="name"
                rules={[
                  {
                    required: true,
                    message: "Please enter your full name",
                  },
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                  placeholder="Full Name"
                  style={{ borderRadius: 12 }}
                />
              </Form.Item>

              {/* Email */}
              <Form.Item
                name="email"
                rules={[
                  {
                    required: true,
                    type: "email",
                    message: "Please enter a valid email",
                  },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
                  placeholder="Email Address"
                  style={{ borderRadius: 12 }}
                />
              </Form.Item>

              {/* Phone Number with Country Code */}
             <Form.Item
  name="phone"
  rules={[
    {
      required: true,
      message: "Please enter your phone number",
    },
    {
      validator: (_, value) => {
        if (!value || !isValidPhoneNumber(value)) {
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
    placeholder="Phone Number"
  />
</Form.Item>

              {/* Password */}
              <Form.Item
                name="password"
                rules={[
                  {
                    required: true,
                    message: "Please enter password",
                  },
                  {
                    min: 6,
                    message:
                      "Password must be at least 6 characters",
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
                  placeholder="Password"
                  style={{ borderRadius: 12 }}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{
                    height: 50,
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  Get Started
                </Button>
              </Form.Item>
            </Form>

            <div
              style={{
                textAlign: "center",
                marginTop: 20,
              }}
            >
              <Text type="secondary">
                Already have an account?{" "}
              </Text>
              <Link
                to="/login"
                style={{
                  fontWeight: 600,
                  color: "#0ea5e9",
                }}
              >
                Sign In
              </Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Signup;