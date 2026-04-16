import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# ML Models
from prophet import Prophet
import lightgbm as lgb
from statsmodels.tsa.arima.model import ARIMA

app = Flask(__name__)
CORS(app)

# MongoDB Connection
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["test"]

# -----------------------------
# 🔥 MODEL FUNCTIONS
# -----------------------------

def run_arima(sales_data, days):
    try:
        model = ARIMA(sales_data, order=(5,1,0))
        model_fit = model.fit()
        forecast = model_fit.forecast(steps=days)
        return float(sum(forecast))
    except Exception as e:
        print("ARIMA error:", e)
        return None


def run_prophet(sales_data, dates, days):
    try:
        df = pd.DataFrame({
            'ds': pd.to_datetime(dates),
            'y': sales_data
        })

        model = Prophet(daily_seasonality=True)
        model.fit(df)

        future = model.make_future_dataframe(periods=days)
        forecast = model.predict(future)

        return float(forecast['yhat'].tail(days).sum())
    except Exception as e:
        print("Prophet error:", e)
        return None


def run_lightgbm(sales_data, days):
    try:
        X = np.arange(len(sales_data)).reshape(-1, 1)
        y = np.array(sales_data)

        train_data = lgb.Dataset(X, label=y)

        params = {
            "objective": "regression",
            "verbosity": -1
        }

        model = lgb.train(params, train_data, num_boost_round=50)

        future_X = np.arange(len(sales_data), len(sales_data)+days).reshape(-1, 1)
        preds = model.predict(future_X)

        return float(sum(preds))
    except Exception as e:
        print("LightGBM error:", e)
        return None


def fallback_prediction(sales_data, days):
    return float(np.mean(sales_data) * days)


# -----------------------------
# 🔥 MAIN PREDICTION ROUTE
# -----------------------------

@app.route('/predict-all', methods=['POST'])
def predict_all():
    try:
        payload = request.json or {}
        forced_model = payload.get('model')  # ARIMA / Prophet / LightGBM

        input_data = list(db.predictions_input.find())

        if not input_data:
            return jsonify({"message": "No input data found"}), 404

        results = []

        for record in input_data:
            product_id = record.get('productId')
            product_name = record.get('productName')

            sales_data = record.get('historical_sales', [])
            dates = record.get('dates', [])

            current_stock = record.get('current_stock', 0)
            lead_time = record.get('lead_time_days', 3)

            if len(sales_data) == 0:
                continue

            # -----------------------------
            # 🔥 MODEL SELECTION
            # -----------------------------
            if forced_model:
                model_used = forced_model
            else:
                if len(sales_data) > 30:
                    model_used = "LightGBM"
                elif len(sales_data) > 10:
                    model_used = "Prophet"
                else:
                    model_used = "ARIMA"

            forecast_days = 14

            # -----------------------------
            # 🔥 RUN MODEL
            # -----------------------------
            prediction = None

            if model_used == "ARIMA":
                prediction = run_arima(sales_data, forecast_days)

            elif model_used == "Prophet":
                if len(dates) == len(sales_data):
                    prediction = run_prophet(sales_data, dates, forecast_days)

            elif model_used == "LightGBM":
                prediction = run_lightgbm(sales_data, forecast_days)

            # -----------------------------
            # 🔥 FALLBACK
            # -----------------------------
            if prediction is None:
                prediction = fallback_prediction(sales_data, forecast_days)

            # -----------------------------
            # 🔥 BUSINESS LOGIC
            # -----------------------------
            avg_demand = np.mean(sales_data)
            std_dev = np.std(sales_data) if len(sales_data) > 1 else 0

            if current_stock > 1.5 * prediction:
                status = "Overstock"
            elif current_stock < 0.5 * prediction:
                status = "Understock"
            else:
                status = "Optimal"

            reorder_point = avg_demand * lead_time
            safety_stock = std_dev * np.sqrt(lead_time)
            recommended_qty = max(0, prediction + safety_stock - current_stock)

            # -----------------------------
            # 🔥 RESULT OBJECT
            # -----------------------------
            results.append({
                "productId": product_id,
                "productName": product_name,
                "model_used": model_used,
                "predicted_demand": round(prediction, 2),
                "stock_status": status,
                "reorder_point": round(reorder_point, 2),
                "recommended_qty": round(recommended_qty, 2),
                "total_historical_sales": float(sum(sales_data)),
                "last_run": datetime.datetime.now().isoformat()
            })

        # -----------------------------
        # 🔥 SAVE OUTPUT
        # -----------------------------
        if results:
            db.predictions_output.delete_many({})
            db.predictions_output.insert_many(results)

        return jsonify({
            "message": "Prediction completed successfully",
            "count": len(results)
        })

    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": str(e)}), 500


# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "service": "prediction"
    })


# -----------------------------
# RUN SERVER
# -----------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)