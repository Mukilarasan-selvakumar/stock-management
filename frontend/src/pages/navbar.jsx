import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
  FiHome,
  FiFileText,
  FiPackage,
  FiBarChart2,
  FiUsers,
  FiLogOut,
} from "react-icons/fi";
import "./navbar.css";

const Navbar = ({ children }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <h3>StoreApp</h3>
        </div>

        <nav className="menu">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "menu-item active" : "menu-item"
            }
          >
            <FiHome />
            <span  style={{fontSize:"14px",color:"black"}}>Dashboard</span>
          </NavLink>

          <NavLink
            to="/billing"
            className={({ isActive }) =>
              isActive ? "menu-item active" : "menu-item"
            }
          >
            <FiFileText />
            <span style={{fontSize:"14px"}}>Billing</span>
          </NavLink>

          {(user?.role === "admin" || user?.role === "superadmin") && (
            <>
              <NavLink
                to="/stocks"
                className={({ isActive }) =>
                  isActive ? "menu-item active" : "menu-item"
                }
              >
                <FiPackage />
                <span  style={{fontSize:"14px"}}>Stock</span>
              </NavLink>

              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  isActive ? "menu-item active" : "menu-item"
                }
              >
                <FiBarChart2 />
                <span  style={{fontSize:"14px"}}>Analytics</span>
              </NavLink>
            </>
          )}

          {user?.role === "superadmin" && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                isActive ? "menu-item active" : "menu-item"
              }
            >
              <FiUsers />
              <span  style={{fontSize:"14px"}}>Users</span>
            </NavLink>
          )}
        </nav>
      </aside>

      {/* RIGHT SIDE */}
      <div className="main-content">
        {/* TOP HEADER */}
        <header className="topbar">
          <div className="topbar-title">Inventory Management</div>

          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:"5px" }}>
            <div className="avatar">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>

            <span style={{fontSize:"14px"}}>{user?.name?.toUpperCase()}</span>
<div style={{marginLeft:"8px"}}> <button onClick={handleLogout} className="logout-btn" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"2px"}}>
              <FiLogOut />
              Logout
            </button></div>
           
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="content">{children}</div>
      </div>
    </div>
  );
};

export default Navbar;