import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Row, Col } from 'antd';
import { MailOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Login = () => {
  const { login } = useContext(AuthContext);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", 
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <Row gutter={40} align="middle" style={{ maxWidth: 1000, width: "100%" }}>
        
        {/* Decorative Side */}
        <Col xs={0} md={12}>
          <div style={{ color: "#1e293b" }}>
          
            <Title level={1} style={{ fontSize: 48, fontWeight: 800, margin: 0, color: "#1e293b" }}>
              Store <span style={{ color: "#0ea5e9" }}>App</span>
            </Title>
          </div>
        </Col>

        {/* Login Form */}
        <Col xs={24} md={12}>
          <Card 
            style={{ 
              borderRadius: 24, 
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              padding: "20px" 
            }}
          >
            <div style={{ marginBottom: 30 }}>
              <Title level={2} style={{ margin: 0 }}>Welcome Back</Title>
              
            </div>

            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 12 }} />}

            <Form layout="vertical" onFinish={onFinish} size="large">
              <Form.Item 
                name="email" 
                rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input prefix={<MailOutlined style={{ color: "#94a3b8" }} />} placeholder="Email Address" style={{ borderRadius: 12 }} />
              </Form.Item>

              <Form.Item 
                name="password" 
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password prefix={<LockOutlined style={{ color: "#94a3b8" }} />} placeholder="Password" style={{ borderRadius: 12 }} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 50, borderRadius: 12, fontWeight: 600, fontSize: 16 }}>
                  Sign In
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Text type="secondary">Don't have an account? </Text>
              <Link to="/signup" style={{ fontWeight: 600, color: "#0ea5e9" }}>Create Account</Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Login;