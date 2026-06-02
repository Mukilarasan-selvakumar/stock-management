import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from sklearn.metrics import mean_absolute_error, mean_squared_error

load_dotenv()

# ML Models
from prophet import Prophet
import lightgbm as lgb
from statsmodels.tsa.arima.model import ARIMA

app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["test"]

# ============================================
# FIXED MODEL FUNCTIONS WITH PROPER ERROR HANDLING
# ============================================

def run_arima(prepared_data, days):
    """ARIMA using prepared data"""
    try:
        sales_data = prepared_data.get('historical_sales', [])
        if len(sales_data) < 10:
            return None
        
        model = ARIMA(sales_data, order=(5, 1, 0))
        model_fit = model.fit()
        forecast = model_fit.forecast(steps=days)
        return float(sum(forecast))
    except Exception as e:
        print(f"ARIMA error for {len(sales_data)} points: {e}")
        return None


def run_prophet(prepared_data, days):
    """Prophet with better error handling"""
    try:
        sales_data = prepared_data.get('historical_sales', [])
        dates = prepared_data.get('dates', [])
        
        if len(sales_data) < 30:
            print(f"Prophet: Need 30+ days, have {len(sales_data)}")
            return None
        
        # Ensure dates and sales have same length
        if len(sales_data) != len(dates):
            print(f"Prophet: Length mismatch - sales:{len(sales_data)}, dates:{len(dates)}")
            return None
        
        # Remove duplicates and sort
        df = pd.DataFrame({'ds': pd.to_datetime(dates), 'y': sales_data})
        df = df.drop_duplicates(subset=['ds']).sort_values('ds')
        
        if len(df) < 30:
            print(f"Prophet: After dedup, only {len(df)} days")
            return None
        
        # Check for gaps in dates
        df = df.set_index('ds').asfreq('D').reset_index()
        df['y'] = df['y'].fillna(0)
        
        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=False,
            changepoint_prior_scale=0.05
        )
        model.fit(df)
        
        future = model.make_future_dataframe(periods=days, include_history=False)
        forecast = model.predict(future)
        
        # Ensure no negative predictions
        forecast['yhat'] = forecast['yhat'].clip(lower=0)
        
        return float(forecast['yhat'].sum())
    except Exception as e:
        print(f"Prophet error: {e}")
        return None


def run_lightgbm(prepared_data, days):
    """LightGBM with proper error handling"""
    try:
        sales_data = prepared_data.get('historical_sales', [])
        
        if len(sales_data) < 50:
            print(f"LightGBM: Need 50+ days, have {len(sales_data)}")
            return None
        
        # Simple approach: just use time index
        X = np.arange(len(sales_data)).reshape(-1, 1)
        y = np.array(sales_data)
        
        model = lgb.LGBMRegressor(
            n_estimators=50,
            max_depth=3,
            learning_rate=0.1,
            verbosity=-1,
            random_state=42
        )
        
        model.fit(X, y)
        
        future_X = np.arange(len(sales_data), len(sales_data) + days).reshape(-1, 1)
        preds = model.predict(future_X)
        preds = np.maximum(preds, 0)  # No negative
        
        return float(sum(preds))
    except Exception as e:
        print(f"LightGBM error: {e}")
        return None


def fallback_prediction(prepared_data, days):
    """Simple fallback using average of last 7 days"""
    sales_data = prepared_data.get('historical_sales', [])
    if not sales_data:
        return float(days * 10)
    
    # Use recent average (last 7 days or all if less)
    recent = sales_data[-min(7, len(sales_data)):]
    avg = np.mean(recent)
    return float(max(0.5, avg) * days)


# ============================================
# MAIN PREDICTION ROUTE
# ============================================

@app.route('/predict-all', methods=['POST'])
def predict_all():
    try:
        payload = request.json or {}
        forced_model = payload.get('model')

        input_data = list(db.predictions_input.find())

        if not input_data:
            return jsonify({"message": "No input data found. Run /process-all first!"}), 404

        results = []
        model_usage_stats = {"ARIMA": 0, "Prophet": 0, "LightGBM": 0, "Fallback": 0}
        model_failures = {"ARIMA": 0, "Prophet": 0, "LightGBM": 0}

        for record in input_data:
            product_id = record.get('productId')
            product_name = record.get('productName')
            prepared_data = record.get('prepared_data', {})
            current_stock = record.get('current_stock', 0)
            lead_time = record.get('lead_time_days', 3)
            selected_model = record.get('selected_model', 'Fallback')
            
            # Use forced model if provided, else use selected model
            if forced_model:
                model_used = forced_model
            else:
                model_used = selected_model

            forecast_days = 14
            prediction = None
            actual_model_used = model_used
            
            # Try to run the selected model
            if model_used == "ARIMA":
                prediction = run_arima(prepared_data, forecast_days)
                if prediction is None:
                    model_failures["ARIMA"] += 1
                    
            elif model_used == "Prophet":
                prediction = run_prophet(prepared_data, forecast_days)
                if prediction is None:
                    model_failures["Prophet"] += 1
                    
            elif model_used == "LightGBM":
                prediction = run_lightgbm(prepared_data, forecast_days)
                if prediction is None:
                    model_failures["LightGBM"] += 1
            
            # If model failed, use fallback
            if prediction is None:
                prediction = fallback_prediction(prepared_data, forecast_days)
                actual_model_used = "Fallback"
            
            # Update stats
            model_usage_stats[actual_model_used] += 1
            
            # Get sales data for calculations
            sales_data = prepared_data.get('historical_sales', [])
            
            if sales_data:
                avg_demand = np.mean(sales_data[-min(7, len(sales_data)):])  # Recent avg
                std_dev = np.std(sales_data) if len(sales_data) > 1 else 0
            else:
                avg_demand = 0
                std_dev = 0

            safety_stock = std_dev * np.sqrt(lead_time)
            
            if prediction > 0:
                difference_percent = abs(current_stock - prediction) / prediction
            else:
                difference_percent = float('inf')
            
            if difference_percent <= 0.10:
                status = "Optimal"
                recommended_qty = 0
            elif current_stock > prediction:
                status = "Overstock"
                recommended_qty = 0
            else:
                status = "Understock"
                recommended_qty = max(0, prediction + safety_stock - current_stock)

            reorder_point = avg_demand * lead_time

            result = {
                "productId": product_id,
                "productName": product_name,
                "current_stock": current_stock,
                "predicted_demand": round(prediction, 2),
                "stock_status": status,
                "reorder_point": round(reorder_point, 2),
                "recommended_qty": round(recommended_qty, 2),
                "model_used": actual_model_used,
                "planned_model": selected_model,
                "total_historical_sales": float(sum(sales_data)) if sales_data else 0,
                "data_points": len(sales_data),
                "last_run": datetime.datetime.now().isoformat()
            }
            
            results.append(result)

        # Save results
        if results:
            db.predictions_output.delete_many({})
            db.predictions_output.insert_many(results)

        # Print summary
        print("\n" + "="*60)
        print("OVERALL ACCURACY METRICS")
        print("="*60)
        
        models_used = ', '.join([m for m, c in model_usage_stats.items() if c > 0])
        print(f"{'Models Used':<25} : {models_used}")
        
        # Show fallback usage
        if model_usage_stats["Fallback"] > 0:
            print(f"\n⚠️ {model_usage_stats['Fallback']} products used Fallback due to model failures")
            if model_failures["Prophet"] > 0:
                print(f"   - Prophet failed for {model_failures['Prophet']} products")
            if model_failures["LightGBM"] > 0:
                print(f"   - LightGBM failed for {model_failures['LightGBM']} products")
            if model_failures["ARIMA"] > 0:
                print(f"   - ARIMA failed for {model_failures['ARIMA']} products")
        
        print("="*60)

        return jsonify({
            "message": "Prediction completed successfully",
            "count": len(results),
            "model_usage": model_usage_stats,
            "model_failures": model_failures,
            "fallback_used": model_usage_stats["Fallback"] > 0
        })

    except Exception as e:
        print("Error:", str(e))
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "service": "prediction",
        "collections": {
            "predictions_input": db.predictions_input.count_documents({}),
            "predictions_output": db.predictions_output.count_documents({})
        }
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)