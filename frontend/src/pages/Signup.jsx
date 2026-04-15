import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './auth.css';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });

  const { signup } = useContext(AuthContext);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup(formData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to signup');
    }
  };

  return (
    <div className="auth-wrapper">

      {/* LEFT */}
      <div className="left-panel">
        <h1>Store Management Application</h1>
        <p>Create account and start managing your store</p>
      </div>

      {/* RIGHT */}
      <div className="right-panel">
        <h2>Signup</h2>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <input name="name" placeholder="Full Name" onChange={handleChange} required />
          <input name="email" placeholder="Email" onChange={handleChange} required />
          <input name="phone" placeholder="Phone" onChange={handleChange} required />
          <input name="password" type="password" placeholder="Password" onChange={handleChange} required />

          <button type="submit" style={{
    display: "block",
    margin: "10px auto"
  }}>Signup</button>
        </form>
<p style={{ textAlign: "center", marginTop: "10px" }}>
  Already have an account? <Link to="/login">Login</Link>
</p>
       
      </div>
    </div>
  );
};

export default Signup;