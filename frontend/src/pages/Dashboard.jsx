// Dashboard.js
import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import AdminDashboard from "./AdminDashboard";

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  console.log({user})
 console.log({isAdmin})
  if (isAdmin) {
    return <Navigate to="/dashboard" replace />
    
  }else{
    return <Navigate to="/billing" replace />;
  }
  
  
};

export default Dashboard;