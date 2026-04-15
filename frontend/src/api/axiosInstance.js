import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // Important for cookies
});

// Request interceptor to add the access token to headers
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 (Unauthorized) and not retried yet
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Call refresh token endpoint (cookie will be sent automatically)
        const response = await axios.post('http://localhost:5000/api/auth/refresh', {}, {
          withCredentials: true
        });

        const newAccessToken = response.data.accessToken;

        // Store new access token
        sessionStorage.setItem('accessToken', newAccessToken);

        // Update authorization header
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

        // Retry original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('Refresh token failed:', refreshError);
        // Clear session storage just in case
        sessionStorage.removeItem('accessToken');
        // Dispatch an event so AuthContext can logout
        window.dispatchEvent(new Event('auth-error'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
