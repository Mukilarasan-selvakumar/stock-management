import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { NavLink, useNavigate } from "react-router-dom";
import "./navbar.css";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="logo">StoreApp</div>

      <div className="right-section">
        {/*  NAV LINKS */}
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>
            Dashboard
          </NavLink>

          <NavLink to="/analytics" className={({ isActive }) => isActive ? "active" : ""}>
            Analytics
          </NavLink>

          <NavLink to="/billing" className={({ isActive }) => isActive ? "active" : ""}>
            Billing
          </NavLink>

          {user?.role === "superadmin" && (
            <>
              <NavLink to="/users" className={({ isActive }) => isActive ? "active" : ""}>
                Users
              </NavLink>

              <NavLink to="/stocks" className={({ isActive }) => isActive ? "active" : ""}>
                Stock
              </NavLink>
            </>
          )}
        </nav>

        {/*  USER */}
        <div className="user-section">
          <div className="userAvatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span>{user?.name}</span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="logout-btn"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;