import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

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
# MODEL FUNCTIONS
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
        return None


def run_prophet(prepared_data, days):
    """Prophet using prepared data with cleaned dates"""
    try:
        sales_data = prepared_data.get('historical_sales', [])
        dates = prepared_data.get('dates', [])
        
        if len(sales_data) < 30 or len(dates) < 30:
            return None
        
        df = pd.DataFrame({
            'ds': pd.to_datetime(dates),
            'y': sales_data
        })

        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=False
        )
        model.fit(df)

        future = model.make_future_dataframe(periods=days, include_history=False)
        forecast = model.predict(future)

        return float(forecast['yhat'].sum())
    except Exception as e:
        return None


def run_lightgbm(prepared_data, days):
    """LightGBM using prepared features"""
    try:
        sales_data = prepared_data.get('historical_sales', [])
        
        if len(sales_data) < 50:
            return None
        
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
        preds = np.maximum(preds, 0)
        
        return float(sum(preds))
    except Exception as e:
        return None


def fallback_prediction(prepared_data, days):
    """Simple fallback using average"""
    sales_data = prepared_data.get('historical_sales', [])
    if not sales_data:
        return float(days * 10)
    recent = sales_data[-min(7, len(sales_data)):]
    return float(np.mean(recent) * days)


def calculate_backtesting_accuracy(sales_data, model_func, prepared_data, test_days=7):
    """Calculate model accuracy using backtesting"""
    try:
        if len(sales_data) <= test_days + 5:
            return None
        
        
        train_data = sales_data[:-test_days]
        test_data = sales_data[-test_days:]
        
        
        train_prepared = prepared_data.copy()
        train_prepared['historical_sales'] = train_data
        
        
        if model_func == "ARIMA":
            prediction_total = run_arima(train_prepared, test_days)
        elif model_func == "Prophet":
            prediction_total = run_prophet(train_prepared, test_days)
        elif model_func == "LightGBM":
            prediction_total = run_lightgbm(train_prepared, test_days)
        else:
            prediction_total = fallback_prediction(train_prepared, test_days)
        
        if prediction_total is None:
            return None
        
        
        pred_per_day = prediction_total / test_days
        predictions = [pred_per_day] * test_days
        
        
        actuals = np.array(test_data)
        preds = np.array(predictions)
        
        mae = mean_absolute_error(actuals, preds)
        rmse = np.sqrt(mean_squared_error(actuals, preds))
        
        
        non_zero_mask = actuals > 0
        if np.any(non_zero_mask):
            mape = np.mean(np.abs((actuals[non_zero_mask] - preds[non_zero_mask]) / actuals[non_zero_mask])) * 100
        else:
            mape = 100.0
        
        accuracy = max(0, 100 - mape)
        
        
        try:
            r2 = r2_score(actuals, preds)
        except:
            r2 = -999
        
        return {
            'mae': round(mae, 2),
            'rmse': round(rmse, 2),
            'mape': round(mape, 2),
            'accuracy': round(accuracy, 2),
            'r2': round(r2, 2)
        }
    except Exception as e:
        print(f"Backtesting error: {e}")
        return None


# ============================================
# MAIN PREDICTION ROUTE WITH ACCURACY
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
        all_accuracy_scores = []
        model_accuracy_scores = {"ARIMA": [], "Prophet": [], "LightGBM": [], "Fallback": []}

        for record in input_data:
            product_id = record.get('productId')
            product_name = record.get('productName')
            prepared_data = record.get('prepared_data', {})
            current_stock = record.get('current_stock', 0)
            lead_time = record.get('lead_time_days', 3)
            selected_model = record.get('selected_model', 'Fallback')
            
            if forced_model:
                model_used = forced_model
            else:
                model_used = selected_model

            forecast_days = 14
            prediction = None
            
            sales_data = prepared_data.get('historical_sales', [])
            
            
            product_accuracy = None
            if len(sales_data) > 14:
                product_accuracy = calculate_backtesting_accuracy(sales_data, model_used, prepared_data)
                if product_accuracy:
                    product_accuracy['model'] = model_used
                    all_accuracy_scores.append(product_accuracy)
                    model_accuracy_scores[model_used].append(product_accuracy['accuracy'])

            
            if model_used == "ARIMA":
                prediction = run_arima(prepared_data, forecast_days)
            elif model_used == "Prophet":
                prediction = run_prophet(prepared_data, forecast_days)
            elif model_used == "LightGBM":
                prediction = run_lightgbm(prepared_data, forecast_days)
            
            if prediction is None:
                prediction = fallback_prediction(prepared_data, forecast_days)
                actual_model_used = "Fallback"
            else:
                actual_model_used = model_used
            
            model_usage_stats[actual_model_used] += 1
            
            if sales_data:
                avg_demand = np.mean(sales_data[-min(7, len(sales_data)):])
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
                "model_accuracy": product_accuracy,
                "total_historical_sales": float(sum(sales_data)) if sales_data else 0,
                "data_points": len(sales_data),
                "last_run": datetime.datetime.now().isoformat()
            }
            
            results.append(result)

        
        if results:
            db.predictions_output.delete_many({})
            db.predictions_output.insert_many(results)

        # ============================================
        # CALCULATE OVERALL ACCURACY METRICS
        # ============================================
        
        overall_metrics = {}
        if all_accuracy_scores:
            overall_metrics = {
                'avg_accuracy': round(np.mean([a['accuracy'] for a in all_accuracy_scores]), 2),
                'avg_mae': round(np.mean([a['mae'] for a in all_accuracy_scores]), 2),
                'avg_rmse': round(np.mean([a['rmse'] for a in all_accuracy_scores]), 2),
                'avg_mape': round(np.mean([a['mape'] for a in all_accuracy_scores]), 2),
                'avg_r2': round(np.mean([a['r2'] for a in all_accuracy_scores]), 2),
                'total_tested': len(all_accuracy_scores)
            }
        
        
        per_model_accuracy = {}
        for model, scores in model_accuracy_scores.items():
            if scores:
                per_model_accuracy[model] = {
                    'accuracy': round(np.mean(scores), 2),
                    'samples': len(scores)
                }
        
        
        accuracy_rating = "Excellent" if overall_metrics.get('avg_accuracy', 0) >= 80 else "Good" if overall_metrics.get('avg_accuracy', 0) >= 60 else "Poor" if overall_metrics.get('avg_accuracy', 0) >= 40 else "Very Poor"
        
        # ============================================
        # PRINT COMPLETE TABLE
        # ============================================
        
        print("\n" + "="*70)
        print("📊 OVERALL ACCURACY METRICS")
        print("="*70)
        
        models_used_str = ', '.join([m for m, c in model_usage_stats.items() if c > 0])
        print(f"{'Models Used':<30} : {models_used_str}")
        
        if overall_metrics:
            print(f"{'Accuracy (Average)':<30} : {overall_metrics['avg_accuracy']:.2f}% ({accuracy_rating})")
            print(f"{'MAE (Mean Absolute Error)':<30} : {overall_metrics['avg_mae']} (Lower is better)")
            print(f"{'RMSE':<30} : {overall_metrics['avg_rmse']} (Lower is better)")
            print(f"{'MAPE':<30} : {overall_metrics['avg_mape']:.2f}% (Lower is better)")
            print(f"{'R² Score':<30} : {overall_metrics['avg_r2']} (Closer to 1 is better)")
            print(f"{'Tested Products':<30} : {overall_metrics['total_tested']}")
        else:
            print(f"{'Accuracy':<30} : ⚠️ No accuracy metrics available (insufficient data for backtesting)")
        
        print("\n" + "-"*70)
        print("📊 MODEL-WISE ACCURACY BREAKDOWN")
        print("-"*70)
        print(f"{'Model':<15} {'Accuracy':<12} {'Samples':<10} {'Rating':<10}")
        print("-"*50)
        
        for model in ['ARIMA', 'Prophet', 'LightGBM', 'Fallback']:
            if model in per_model_accuracy:
                acc = per_model_accuracy[model]['accuracy']
                samples = per_model_accuracy[model]['samples']
                rating = "⭐" if acc >= 80 else "✓" if acc >= 60 else "⚠️" if acc >= 40 else "❌"
                print(f"{model:<15} {acc:.2f}%{' ':<6} {samples:<10} {rating}")
            elif model_usage_stats.get(model, 0) > 0:
                print(f"{model:<15} {'N/A':<12} {0:<10} ⚠️")
        
        print("\n" + "-"*70)
        print("📦 MODEL USAGE DISTRIBUTION")
        print("-"*70)
        for model, count in model_usage_stats.items():
            if count > 0:
                percentage = (count / len(results)) * 100
                bar = "█" * int(percentage / 2)
                print(f"{model:<15} : {count:>3} products ({percentage:>5.1f}%) {bar}")
        
        # Warning if models are failing
        prophet_planned = sum(1 for r in input_data if r.get('selected_model') == 'Prophet')
        prophet_actual = model_usage_stats['Prophet']
        if prophet_planned > prophet_actual:
            print(f"\n⚠️ WARNING: Prophet was planned for {prophet_planned} products but only succeeded for {prophet_actual}")
        
        print("="*70)
        print("✅ PREDICTION COMPLETED")
        print("="*70)

        return jsonify({
            "message": "Prediction completed successfully",
            "count": len(results),
            "model_usage": model_usage_stats,
            "overall_accuracy": overall_metrics,
            "per_model_accuracy": per_model_accuracy,
            "total_predictions": len(results)
        })

    except Exception as e:
        print("Error:", str(e))
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ============================================
# ENDPOINTS
# ============================================

@app.route('/predictions/<model_name>', methods=['GET'])
def get_predictions_by_model(model_name):
    try:
        predictions = list(db.predictions_output.find({"model_used": model_name}))
        for p in predictions:
            p['_id'] = str(p['_id'])
        
        return jsonify({
            "model": model_name,
            "count": len(predictions),
            "predictions": predictions
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/urgent-reorder', methods=['GET'])
def get_urgent_reorder():
    try:
        urgent = list(db.predictions_output.find({
            "stock_status": "Understock",
            "recommended_qty": {"$gt": 0}
        }).sort("recommended_qty", -1))
        
        for p in urgent:
            p['_id'] = str(p['_id'])
        
        return jsonify({
            "count": len(urgent),
            "products": urgent
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/accuracy-report', methods=['GET'])
def get_accuracy_report():
    """Get latest accuracy report"""
    try:
        
        predictions = list(db.predictions_output.find({"model_accuracy": {"$exists": True}}))
        
        if not predictions:
            return jsonify({"message": "No accuracy data available"})
        
        accuracies = [p['model_accuracy']['accuracy'] for p in predictions if p.get('model_accuracy')]
        
        return jsonify({
            "total_tested": len(accuracies),
            "average_accuracy": round(np.mean(accuracies), 2) if accuracies else 0,
            "min_accuracy": round(np.min(accuracies), 2) if accuracies else 0,
            "max_accuracy": round(np.max(accuracies), 2) if accuracies else 0
        })
    except Exception as e:
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