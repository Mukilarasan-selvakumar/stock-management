@echo off
echo Starting Prediction Service...
cd prediction

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing requirements...
pip install -r requirements.txt

echo Running Prediction Service on port 8000...
python app.py
