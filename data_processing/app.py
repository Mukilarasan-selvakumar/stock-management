import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
from collections import defaultdict
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("ERROR: MONGODB_URI not found in environment variables!")
else:
    print(f"MONGO_URI loaded: {MONGO_URI[:20]}...")

client = MongoClient(MONGO_URI if MONGO_URI else "mongodb://localhost:27017")
db = client["test"]

# ============================================
# MODEL RECOMMENDATION ENGINE
# ============================================

def analyze_and_recommend_model(sales_list, dates_list):
    """
    Analyze data and recommend the best model
    Returns: model_name (string)
    """
    data_points = len(sales_list)
    
    # Simple rule-based recommendation
    if data_points >= 50:
        # Check for seasonality pattern
        if len(sales_list) >= 14:
            try:
                # Quick seasonality check (weekly pattern)
                weekly_avg = []
                for i in range(7):
                    week_values = [sales_list[j] for j in range(i, min(i+7*4, len(sales_list)), 7)]
                    if week_values:
                        weekly_avg.append(np.mean(week_values))
                
                if len(weekly_avg) == 7 and np.std(weekly_avg) / max(np.mean(weekly_avg), 1) > 0.15:
                    return "Prophet"
            except:
                pass
        
        # Check for trend
        if data_points >= 10:
            x = np.arange(data_points)
            slope = np.polyfit(x, sales_list, 1)[0]
            if abs(slope) / max(np.mean(sales_list), 1) > 0.05:
                return "Prophet"
        
        return "LightGBM"
    
    elif data_points >= 30:
        return "Prophet"
    
    elif data_points >= 10:
        return "ARIMA"
    
    else:
        return "Fallback"


def prepare_data_for_model(sales_list, dates_list, model_name):
    """
    Prepare data for the recommended model
    """
    if model_name == "ARIMA":
        return {
            "historical_sales": sales_list,
            "total_days": len(sales_list),
            "model_ready": True
        }
    
    elif model_name == "Prophet":
        # Clean dates for Prophet
        cleaned_dates = []
        for d in dates_list:
            if isinstance(d, str):
                clean_date = d.split('T')[0][:10]
            elif hasattr(d, 'strftime'):
                clean_date = d.strftime('%Y-%m-%d')
            else:
                clean_date = str(d)[:10]
            cleaned_dates.append(clean_date)
        
        return {
            "historical_sales": sales_list,
            "dates": cleaned_dates,
            "total_days": len(sales_list),
            "model_ready": True
        }
    
    elif model_name == "LightGBM":
        # Create basic features
        df = pd.DataFrame({'sales': sales_list, 'date': pd.to_datetime(dates_list)})
        df = df.sort_values('date').reset_index(drop=True)
        
        df['day_of_week'] = df['date'].dt.dayofweek
        df['day_of_month'] = df['date'].dt.day
        df['month'] = df['date'].dt.month
        df['days_from_start'] = range(len(df))
        
        for lag in [1, 2, 3, 7]:
            df[f'lag_{lag}'] = df['sales'].shift(lag)
        
        df = df.fillna(0)
        
        feature_columns = ['day_of_week', 'day_of_month', 'month', 'days_from_start',
                          'lag_1', 'lag_2', 'lag_3', 'lag_7']
        
        return {
            "historical_sales": sales_list,
            "dates": [d.strftime('%Y-%m-%d') for d in df['date']],
            "features": df[feature_columns].values.tolist(),
            "feature_columns": feature_columns,
            "total_days": len(sales_list),
            "model_ready": True
        }
    
    else:  # Fallback
        return {
            "historical_sales": sales_list,
            "total_days": len(sales_list),
            "model_ready": True
        }


# ============================================
# MAIN ENDPOINT - ANALYZE & RECOMMEND
# ============================================

@app.route('/process-all', methods=['POST'])
def process_all_data():
    try:
        payload = request.json or {}
        
        # Check if user wants analysis (default to True)
        analyze = payload.get('analyze', True)
        forced_model = payload.get('model', None)
        
        # Fetch data
        inventories = list(db.inventories.find())
        products = list(db.products.find())
        sales = list(db.sales.find())

        if not inventories:
            return jsonify({"message": "No inventory data found"}), 404

        # Clear previous prepared data
        db.predictions_input.delete_many({})
        
        processed_batch = []
        model_stats = {"ARIMA": 0, "Prophet": 0, "LightGBM": 0, "Fallback": 0}
        
        # Track which model was most recommended
        model_count = {"ARIMA": 0, "Prophet": 0, "LightGBM": 0, "Fallback": 0}
        
        for inv in inventories:
            p_id = inv.get('productId')
            prod_meta = next((p for p in products if p.get('productId') == p_id), {})
            
            # Aggregate daily sales
            daily_sales = defaultdict(float)
            
            for s in sales:
                for item in s.get('items', []):
                    if item.get('productId') == p_id:
                        quantity = item.get('quantity', 0)
                        sale_date = s.get('createdAt')
                        
                        if sale_date:
                            if hasattr(sale_date, 'strftime'):
                                date_str = sale_date.strftime('%Y-%m-%d')
                            elif isinstance(sale_date, str):
                                date_str = sale_date.split('T')[0][:10]
                            else:
                                date_str = str(sale_date)[:10]
                        else:
                            date_str = datetime.now().strftime('%Y-%m-%d')
                        
                        daily_sales[date_str] += quantity
            
            if not daily_sales:
                continue
                
            # Sort by date
            sorted_dates = sorted(daily_sales.keys())
            sales_list = [daily_sales[d] for d in sorted_dates]
            
            # Determine model to use
            if forced_model:
                selected_model = forced_model
                model_source = "forced"
            elif analyze:
                selected_model = analyze_and_recommend_model(sales_list, sorted_dates)
                model_source = "recommended"
                model_count[selected_model] += 1
            else:
                # Auto based on data quantity only
                if len(sales_list) >= 50:
                    selected_model = "LightGBM"
                elif len(sales_list) >= 30:
                    selected_model = "Prophet"
                elif len(sales_list) >= 10:
                    selected_model = "ARIMA"
                else:
                    selected_model = "Fallback"
                model_source = "auto"
                model_count[selected_model] += 1
            
            # Prepare data for the selected model
            prepared_data = prepare_data_for_model(sales_list, sorted_dates, selected_model)
            
            if prepared_data:
                record = {
                    "productId": p_id,
                    "productName": prod_meta.get('name', 'Unknown'),
                    "category": prod_meta.get('category', 'General'),
                    "price": prod_meta.get('price', 0),
                    "current_stock": inv.get('stock', 0),
                    "lead_time_days": inv.get('lead_time_days', 3),
                    "selected_model": selected_model,
                    "model_source": model_source,
                    "prepared_data": prepared_data,
                    "data_quality": {
                        "total_days": len(sales_list),
                        "total_units_sold": sum(sales_list),
                        "avg_daily_sales": round(np.mean(sales_list), 2)
                    },
                    "prepared_at": datetime.now().isoformat()
                }
                
                processed_batch.append(record)
                model_stats[selected_model] += 1
        
        # Store in predictions_input
        if processed_batch:
            db.predictions_input.insert_many(processed_batch)
            
            print("\n" + "="*50)
            print("DATA PREPARATION COMPLETE")
            print("="*50)
            print(f"Total products: {len(processed_batch)}")
            print(f"Model distribution: {model_stats}")
            print("="*50)
        
        # Determine the most recommended model (if not forced)
        if forced_model:
            recommended_model = forced_model
        else:
            # Find the model with highest count
            recommended_model = max(model_count, key=model_count.get) if model_count else "Fallback"
        
        # RETURN THE ACTUAL RECOMMENDED MODEL NAME
        return jsonify({
            "recommended_model": recommended_model,  # This will be "ARIMA", "Prophet", "LightGBM", or "Fallback"
            "model_distribution": model_stats,
            "total_products": len(processed_batch)
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ============================================
# SIMPLE ANALYZE ENDPOINT - JUST RECOMMENDATION
# ============================================

@app.route('/analyze', methods=['POST'])
def analyze_only():
    """
    Just analyze and return recommended model without preparing data
    """
    try:
        payload = request.json or {}
        product_id = payload.get('productId')
        
        if not product_id:
            return jsonify({"error": "productId required"}), 400
        
        # Fetch data for specific product
        sales = list(db.sales.find())
        
        # Aggregate sales
        daily_sales = defaultdict(float)
        for s in sales:
            for item in s.get('items', []):
                if item.get('productId') == product_id:
                    quantity = item.get('quantity', 0)
                    sale_date = s.get('createdAt')
                    
                    if sale_date:
                        if hasattr(sale_date, 'strftime'):
                            date_str = sale_date.strftime('%Y-%m-%d')
                        elif isinstance(sale_date, str):
                            date_str = sale_date.split('T')[0][:10]
                        else:
                            date_str = str(sale_date)[:10]
                    else:
                        date_str = datetime.now().strftime('%Y-%m-%d')
                    
                    daily_sales[date_str] += quantity
        
        if not daily_sales:
            return jsonify({
                "productId": product_id,
                "recommended_model": "Fallback",
                "reason": "No sales data found"
            })
        
        sorted_dates = sorted(daily_sales.keys())
        sales_list = [daily_sales[d] for d in sorted_dates]
        
        # Get recommendation
        recommended_model = analyze_and_recommend_model(sales_list, sorted_dates)
        
        return jsonify({
            "productId": product_id,
            "recommended_model": recommended_model,  # Returns actual model name
            "data_points": len(sales_list),
            "avg_daily_sales": round(np.mean(sales_list), 2)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "data_processing"
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7000, debug=True)