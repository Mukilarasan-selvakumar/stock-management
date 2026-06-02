import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
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


#data Preparation based on the models
def prepare_for_arima(sales_list, dates_list):
    """
    Prepare data for ARIMA model
    ARIMA needs: Sequential numeric values, no gaps, minimum 10 points
    """
    if len(sales_list) < 10:
        return None, "Insufficient data for ARIMA (need 10+ days)"
    

    arima_data = {
        "historical_sales": sales_list,  
        "total_days": len(sales_list),
        "total_units": sum(sales_list),
        "avg_daily": np.mean(sales_list),
        "model_ready": True
    }
    
    return arima_data, None

def prepare_for_prophet(sales_list, dates_list):
    """
    Prepare data for Prophet model
    Prophet needs: YYYY-MM-DD dates, no timestamps, no duplicates, minimum 30 points
    """
    if len(sales_list) < 30:
        return None, "Insufficient data for Prophet (need 30+ days)"
    

    cleaned_dates = []
    for d in dates_list:
        if isinstance(d, str):
            
            clean_date = d.split('T')[0][:10]
            cleaned_dates.append(clean_date)
        else:
            cleaned_dates.append(d.strftime('%Y-%m-%d'))
 
    if len(set(cleaned_dates)) != len(cleaned_dates):
        return None, "Duplicate dates found in Prophet data"
    
    prophet_data = {
        "historical_sales": sales_list,
        "dates": cleaned_dates,  
        "total_days": len(sales_list),
        "total_units": sum(sales_list),
        "avg_daily": np.mean(sales_list),
        "model_ready": True
    }
    
    return prophet_data, None

def prepare_for_lightgbm(sales_list, dates_list, product_price=None):
    """
    Prepare data for LightGBM model
    LightGBM needs: Additional features (day of week, rolling means, lags), minimum 50 points
    """
    if len(sales_list) < 50:
        return None, "Insufficient data for LightGBM (need 50+ days)"
    
    df = pd.DataFrame({
        'sales': sales_list,
        'date': pd.to_datetime(dates_list)
    })
    

    df['day_of_week'] = df['date'].dt.dayofweek
    df['day_of_month'] = df['date'].dt.day
    df['month'] = df['date'].dt.month
    df['quarter'] = df['date'].dt.quarter
    df['weekend'] = (df['day_of_week'] >= 5).astype(int)
    df['days_from_start'] = range(len(df))
    

    for lag in [1, 2, 3, 7, 14]:
        df[f'lag_{lag}'] = df['sales'].shift(lag)
    

    for window in [3, 7, 14]:
        df[f'rolling_mean_{window}'] = df['sales'].rolling(window=window).mean()
        df[f'rolling_std_{window}'] = df['sales'].rolling(window=window).std()
    
 
    if product_price:
        df['price'] = product_price
        df['price_change'] = df['price'].pct_change()
    
 
    df = df.fillna(0)
    
    feature_columns = ['day_of_week', 'day_of_month', 'month', 'quarter', 'weekend', 
                       'days_from_start', 'lag_1', 'lag_2', 'lag_3', 'lag_7', 'lag_14',
                       'rolling_mean_3', 'rolling_mean_7', 'rolling_mean_14',
                       'rolling_std_3', 'rolling_std_7', 'rolling_std_14']
    
    if product_price:
        feature_columns.extend(['price', 'price_change'])
    
    lightgbm_data = {
        "historical_sales": sales_list,
        "dates": [d.strftime('%Y-%m-%d') for d in df['date']],
        "features": df[feature_columns].to_dict('records'),
        "feature_columns": feature_columns,
        "total_days": len(sales_list),
        "total_units": sum(sales_list),
        "avg_daily": np.mean(sales_list),
        "model_ready": True
    }
    
    return lightgbm_data, None

def prepare_for_fallback(sales_list, dates_list):
    """
    Prepare data for Fallback model (simple average)
    Works with any amount of data, minimum 2 points
    """
    if len(sales_list) < 2:
        return None, "Insufficient data for prediction (need 2+ days)"
    
    fallback_data = {
        "historical_sales": sales_list,
        "dates": dates_list,
        "total_days": len(sales_list),
        "total_units": sum(sales_list),
        "avg_daily": np.mean(sales_list),
        "model_ready": True
    }
    
    return fallback_data, None



@app.route('/process-all', methods=['POST'])
def process_all_data():
    try:
        payload = request.json or {}
        forced_model = payload.get('model') 
        

        inventories = list(db.inventories.find())
        products = list(db.products.find())
        sales = list(db.sales.find())

        if not inventories:
            return jsonify({"message": "No inventory data found"}), 404


        db.predictions_input.delete_many({})
        
        processed_batch = []
        model_stats = {
            "ARIMA": 0,
            "Prophet": 0,
            "LightGBM": 0,
            "Fallback": 0
        }
        
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
                

            sorted_dates = sorted(daily_sales.keys())
            sales_list = [daily_sales[d] for d in sorted_dates]
            
          
            product_price = prod_meta.get('price', None)
            

            

            if not forced_model:
                if len(sales_list) >= 50:
                    selected_model = "LightGBM"
                elif len(sales_list) >= 30:
                    selected_model = "Prophet"
                elif len(sales_list) >= 10:
                    selected_model = "ARIMA"
                else:
                    selected_model = "Fallback"
            else:
                selected_model = forced_model
            

            prepared_data = None
            error_message = None
            
            if selected_model == "ARIMA":
                prepared_data, error_message = prepare_for_arima(sales_list, sorted_dates)
            elif selected_model == "Prophet":
                prepared_data, error_message = prepare_for_prophet(sales_list, sorted_dates)
            elif selected_model == "LightGBM":
                prepared_data, error_message = prepare_for_lightgbm(sales_list, sorted_dates, product_price)
            else:  
                prepared_data, error_message = prepare_for_fallback(sales_list, sorted_dates)
            

            if prepared_data is None:
                print(f"Warning for {p_id}: {error_message}. Using Fallback.")
                prepared_data, _ = prepare_for_fallback(sales_list, sorted_dates)
                selected_model = "Fallback"
            
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
                        "avg_daily_sales": round(np.mean(sales_list), 2),
                        "is_daily_aggregated": True
                    },
                    "prepared_at": datetime.now().isoformat(),
                    "last_processed": datetime.now()
                }
                
                processed_batch.append(record)
                model_stats[selected_model] += 1
                
                print(f"{p_id}: {len(sales_list)} days -> {selected_model}")
        

        if processed_batch:
            db.predictions_input.insert_many(processed_batch)
            
 
            print("\n" + "="*60)
            print("DATA PREPARATION SUMMARY (BY MODEL)")
            print("="*60)
            print(f"Total products prepared: {len(processed_batch)}")
            print(f"\nModel Distribution:")
            for model, count in model_stats.items():
                if count > 0:
                    print(f"  {model}: {count} products")
            print("="*60)
            

            db.model_config.delete_many({})
            db.model_config.insert_one({
                "forced_model": forced_model,
                "distribution": model_stats,
                "total_products": len(processed_batch),
                "created_at": datetime.now()
            })
        
        return jsonify({
            "message": f"Data prepared for {len(processed_batch)} products using {forced_model if forced_model else 'auto-selected'} models",
            "count": len(processed_batch),
            "model_distribution": model_stats,
            "warning": "Some products may have insufficient data for accurate predictions" if model_stats.get("Fallback", 0) > 0 else None
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@app.route('/prepared-data/<model_name>', methods=['GET'])
def get_prepared_data_by_model(model_name):

    try:
        products = list(db.predictions_input.find({"selected_model": model_name}))

        for p in products:
            p['_id'] = str(p['_id'])
        
        return jsonify({
            "model": model_name,
            "count": len(products),
            "products": products
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/model-config', methods=['GET'])
def get_model_config():

    try:
        config = db.model_config.find_one(sort=[("created_at", -1)])
        if config:
            config['_id'] = str(config['_id'])
        return jsonify(config or {"message": "No configuration found"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy", 
        "service": "data_processing", 
        "db_connected": db.name,
        "collections": {
            "products": db.products.count_documents({}),
            "inventories": db.inventories.count_documents({}),
            "sales": db.sales.count_documents({}),
            "predictions_input": db.predictions_input.count_documents({})
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7000, debug=True)