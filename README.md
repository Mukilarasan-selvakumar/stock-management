# AI Inventory Optimization System

This is a microservices-based application for inventory management, demand forecasting, and billing.

## 🏗️ Architecture
- **Frontend**: React + Ant Design + Recharts (Port 5173)
- **API Gateway**: Node.js + Express (Port 5000)
- **Billing Service**: Node.js microservice (Port 6000)
- **Data Processing**: Python Flask (Port 7000)
- **Prediction Service**: Python Flask (Port 8000)

---

## 🐍 Python Services Setup

Each Python service (`data_processing` and `prediction`) requires a Python 3.9+ environment.

### 1. Requirements
Both services use the same base dependencies:
```bash
pip install flask flask-cors pandas numpy scikit-learn statsmodels prophet lightgbm python-dotenv pymongo
```

### 2. Environment Variables
Ensure each folder has a `.env` file with your MongoDB URI:
```env
MONGODB_URI=your_mongodb_atlas_uri
```

### 3. How to Run
I have provided two batch files in the root folder for easy startup on Windows:
- Double-click `start_data_processing.bat`
- Double-click `start_prediction.bat`

Alternatively, manually:
```bash
cd prediction
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

---

## ⚙️ Core Logic
1. **Preprocessing**: Aggregates MongoDB collections into a single ML-ready input.
2. **Analysis**: Uses **ARIMA**, **Prophet**, or **LightGBM** based on data volume to predict a **14-day demand**.
3. **Alerts**: Automatically flags products as **Understock** or **Overstock** based on predictions.
4. **Emails**: Every 2 weeks, a summary report is sent to all admins.

---

## 🛠️ Tech Stack
- **Frontend**: React, Vite, Ant Design, Recharts.
- **Backend**: Node.js, Express, Mongoose.
- **ML**: Python, Flask, Statsmodels, Facebook Prophet, LightGBM.
- **Database**: MongoDB Atlas.
