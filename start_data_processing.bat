@echo off
echo Starting Data Processing Service...
cd data_processing

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing requirements...
pip install -r requirements.txt

echo Running Data Processing Service on port 7000...
python app.py
