import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
from collections import defaultdict

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
# VALIDATION FUNCTIONS
# ============================================

def can_use_prophet(sales_list, dates_list):
    """Check if data is actually valid for Prophet"""
    if len(sales_list) < 30:
        return False, f"Insufficient data: {len(sales_list)} days (need 30+)"
    
    if len(sales_list) != len(dates_list):
        return False, f"Length mismatch: sales={len(sales_list)}, dates={len(dates_list)}"
    
    clean_dates = []
    for d in dates_list:
        if isinstance(d, str):
            clean = d.split('T')[0][:10]
        elif hasattr(d, 'strftime'):
            clean = d.strftime('%Y-%m-%d')
        else:
            clean = str(d)[:10]
        clean_dates.append(clean)
    
    
    if len(set(clean_dates)) != len(clean_dates):
        return False, "Duplicate dates found"
    
    try:
        date_series = pd.to_datetime(clean_dates)
        date_diff = date_series.diff().dropna()
        if (date_diff.dt.days > 1).any():
            print(f"Warning: Gaps in dates detected")
    except:
        pass
    
    return True, "Valid for Prophet"


def can_use_lightgbm(sales_list):
    """Check if data is valid for LightGBM"""
    if len(sales_list) < 50:
        return False, f"Insufficient data: {len(sales_list)} days (need 50+)"
    return True, "Valid for LightGBM"


def can_use_arima(sales_list):
    """Check if data is valid for ARIMA"""
    if len(sales_list) < 10:
        return False, f"Insufficient data: {len(sales_list)} days (need 10+)"
    return True, "Valid for ARIMA"


def analyze_and_recommend_model(sales_list, dates_list):
    """
    Analyze data and recommend the best model that can ACTUALLY work
    """
    data_points = len(sales_list)
    
    
    if data_points >= 50:
        
        lgb_valid, _ = can_use_lightgbm(sales_list)
        if lgb_valid:
            return "LightGBM"
    
    if data_points >= 30:
        
        prophet_valid, _ = can_use_prophet(sales_list, dates_list)
        if prophet_valid:
            return "Prophet"
    
    if data_points >= 10:
        # Check if ARIMA can work
        arima_valid, _ = can_use_arima(sales_list)
        if arima_valid:
            return "ARIMA"
    
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
        cleaned_data = []
        seen_dates = set()
        
        for i, (sale, date_str) in enumerate(zip(sales_list, dates_list)):
            # Clean date
            if isinstance(date_str, str):
                clean_date = date_str.split('T')[0][:10]
            elif hasattr(date_str, 'strftime'):
                clean_date = date_str.strftime('%Y-%m-%d')
            else:
                clean_date = str(date_str)[:10]

            if clean_date not in seen_dates:
                seen_dates.add(clean_date)
                cleaned_data.append({
                    'date': clean_date,
                    'sales': float(sale) if sale is not None else 0
                })

        cleaned_data.sort(key=lambda x: x['date'])
        
        final_dates = [d['date'] for d in cleaned_data]
        final_sales = [d['sales'] for d in cleaned_data]
        
        return {
            "historical_sales": final_sales,
            "dates": final_dates,
            "total_days": len(final_sales),
            "original_days": len(sales_list),
            "model_ready": True
        }
    
    elif model_name == "LightGBM":

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
    
    else:
        return {
            "historical_sales": sales_list,
            "total_days": len(sales_list),
            "model_ready": True
        }


# ============================================
# MAIN ENDPOINT
# ============================================

@app.route('/process-all', methods=['POST'])
def process_all_data():
    try:
        payload = request.json or {}
        forced_model = payload.get('model', None)
        
        
        inventories = list(db.inventories.find())
        products = list(db.products.find())
        sales = list(db.sales.find())

        if not inventories:
            return jsonify({"message": "No inventory data found"}), 404

        
        db.predictions_input.delete_many({})
        
        processed_batch = []
        model_stats = {"ARIMA": 0, "Prophet": 0, "LightGBM": 0, "Fallback": 0}
        validation_errors = []
        
        print("\n" + "="*60)
        print("DATA PREPARATION WITH VALIDATION")
        print("="*60)
        
        for inv in inventories:
            p_id = inv.get('productId')
            prod_meta = next((p for p in products if p.get('productId') == p_id), {})
            
            
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
            
            
            if forced_model:
                selected_model = forced_model
                
                if forced_model == "Prophet":
                    valid, msg = can_use_prophet(sales_list, sorted_dates)
                    if not valid:
                        print(f"{p_id}: Forced Prophet but {msg} -> Using Fallback")
                        selected_model = "Fallback"
                        validation_errors.append({"productId": p_id, "error": msg})
                elif forced_model == "LightGBM":
                    valid, msg = can_use_lightgbm(sales_list)
                    if not valid:
                        print(f"{p_id}: Forced LightGBM but {msg} -> Using Fallback")
                        selected_model = "Fallback"
                        validation_errors.append({"productId": p_id, "error": msg})
                elif forced_model == "ARIMA":
                    valid, msg = can_use_arima(sales_list)
                    if not valid:
                        print(f"{p_id}: Forced ARIMA but {msg} -> Using Fallback")
                        selected_model = "Fallback"
                        validation_errors.append({"productId": p_id, "error": msg})
            else:
                
                selected_model = analyze_and_recommend_model(sales_list, sorted_dates)
            
            
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
                
                # Print status
                status_icon = "✅" if selected_model != "Fallback" else "⚠️"
                print(f"{status_icon} {p_id}: {len(sales_list)} days -> {selected_model}")
        
        # Store in predictions_input
        if processed_batch:
            db.predictions_input.insert_many(processed_batch)
            
            print("\n" + "="*60)
            print("DATA PREPARATION COMPLETE")
            print("="*60)
            print(f"Total products: {len(processed_batch)}")
            print(f"\nModel Distribution:")
            for model, count in model_stats.items():
                if count > 0:
                    percentage = (count / len(processed_batch)) * 100
                    print(f"  {model}: {count} products ({percentage:.1f}%)")
            
            if validation_errors:
                print(f"\n{len(validation_errors)} products had validation issues")
            
            print("="*60)
        
        
        recommended_model = max(model_stats, key=model_stats.get) if model_stats else "Fallback"
        
        return jsonify({
            "recommended_model": recommended_model,
            "model_distribution": model_stats,
            "total_products": len(processed_batch),
            "validation_errors": len(validation_errors)
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "data_processing"
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7000, debug=True)