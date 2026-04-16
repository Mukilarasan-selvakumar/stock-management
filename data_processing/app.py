import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB Connection
MONGO_URI = os.getenv("MONGODB_URI")
if not MONGO_URI:
    print("ERROR: MONGODB_URI not found in environment variables!")
else:
    print(f"MONGO_URI loaded: {MONGO_URI[:20]}...")

client = MongoClient(MONGO_URI if MONGO_URI else "mongodb://localhost:27017")
db = client["test"]

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "data_processing", "db_connected": db.name})

@app.route('/process-all', methods=['POST'])
def process_all_data():
    try:
        # 1. Fetch all inventories and merge with product metadata
        inventories = list(db.inventories.find())
        products = list(db.products.find())
        sales = list(db.sales.find())

        if not inventories:
            return jsonify({"message": "No inventory data found"}), 404

        processed_batch = []

        for inv in inventories:
            p_id = inv.get('productId')
            
            # Find product metadata
            prod_meta = next((p for p in products if p.get('productId') == p_id), {})
            
            # Aggregate sales for this product
            product_sales = []
            sale_dates = []
            
            for s in sales:
                item = next((i for i in s.get('items', []) if i.get('productId') == p_id), None)
                if item:
                    product_sales.append(item.get('quantity', 0))
                    sale_dates.append(s.get('createdAt').isoformat() if hasattr(s.get('createdAt'), 'isoformat') else str(s.get('createdAt')))

            # Prepare record
            record = {
                "productId": p_id,
                "productName": prod_meta.get('name', 'Unknown'),
                "category": prod_meta.get('category', 'General'),
                "price": prod_meta.get('price', 0),
                "current_stock": inv.get('stock', 0),
                "historical_sales": product_sales,
                "dates": sale_dates,
                "lead_time_days": 3, # Static for now
                "last_processed": pd.Timestamp.now().isoformat()
            }
            processed_batch.append(record)

        # 2. Store in predictions_input collection
        if processed_batch:
            db.predictions_input.delete_many({}) # Clear old input
            db.predictions_input.insert_many(processed_batch)

        return jsonify({
            "message": "All data processed and stored in predictions_input",
            "count": len(processed_batch)
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/process', methods=['POST'])
def process_data():
    # Legacy endpoint for single-product processing (kept for backward compatibility)
    try:
        data = request.json
        df = pd.DataFrame(data.get('raw_data', []))
        if not df.empty:
             df = df.ffill().fillna(0)
        return jsonify({"processed_data": df.to_dict(orient='records')})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7000, debug=True)
