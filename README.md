# 🥗 NutriBot — AI Nutrition Agent
### Powered by IBM Watsonx.ai · Granite-3-8b-instruct · Flask

[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0.3-green)](https://flask.palletsprojects.com)
[![IBM Watsonx](https://img.shields.io/badge/IBM%20Watsonx-Granite-purple)](https://www.ibm.com/watsonx)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-blueviolet)](https://getbootstrap.com)

---

## 📖 Overview

NutriBot is a full-stack AI-powered Nutrition Agent web application that provides:

| Feature | Description |
|---|---|
| 🤖 **AI Chat** | Real-time nutrition Q&A powered by IBM Granite |
| 📅 **7-Day Meal Plans** | Personalized meal plans based on your profile |
| 🔥 **Calorie Analysis** | Detailed macro and micro-nutrient breakdown |
| 🍽️ **Meal Suggestions** | Smart meal ideas by type, diet, and calories |
| ⚖️ **BMI Calculator** | AI health advice based on your BMI |
| 👨‍👩‍👧 **Family Plans** | Shared meal plans for the whole household |
| 👤 **User Profiles** | Persistent profile for personalized responses |
| 🌙 **Dark Mode** | Full dark/light theme toggle |
| 📱 **Mobile Ready** | Fully responsive Bootstrap 5 UI |

---

## 🏗️ Project Structure

```
Nutrition Agent/
├── app.py                  ← Flask backend + Watsonx.ai integration
├── requirements.txt        ← Python dependencies
├── .env                    ← Your credentials (DO NOT commit)
├── .env.example            ← Template for .env
├── templates/
│   └── index.html          ← Full single-page application
└── static/
    ├── css/
    │   └── style.css       ← All styles (dark mode, animations)
    └── js/
        └── app.js          ← Full frontend logic
```

---

## 🚀 Quick Start

### Step 1 — Clone / set up the project

```bash
cd "Nutrition Agent"
```

### Step 2 — Create a Python virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Configure your IBM Watsonx credentials

Open the `.env` file and fill in your credentials:

```env
IBM_CLOUD_API_KEY=your_actual_api_key_here
IBM_CLOUD_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_actual_project_id_here
FLASK_SECRET_KEY=any_long_random_string
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
```

> **How to get IBM credentials:**
> 1. Log in to [IBM Cloud](https://cloud.ibm.com)
> 2. Go to **Manage → Access → API Keys** → Create an API key
> 3. Go to [IBM Watsonx.ai](https://dataplatform.cloud.ibm.com) → Create a project
> 4. Copy the **Project ID** from the project settings

### Step 5 — Run the application

```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## ⚙️ Customizing the Agent

The `AGENT_INSTRUCTIONS` dictionary in [`app.py`](app.py) is your central configuration hub. Edit it to customize NutriBot completely:

### 🎭 Change the Persona & Tone
```python
"persona": (
    "You are DietBot, a strict and clinical AI nutrition expert. "
    "Respond concisely in bullet points only. No emojis."
),
```

### 🥗 Change Diet Specialization
```python
"specializations": [
    "Ketogenic diet planning",
    "Intermittent fasting protocols",
    "Bodybuilding nutrition",
],
```

### 🍛 Indian Food Preferences
```python
"indian_food_preferences": {
    "staples": ["Idli", "Dosa", "Sambar", "Rasam"],    # South Indian focus
    "superfoods": ["Moringa", "Kokum", "Curry leaves"],
}
```

### 🛡️ Safety Rules
```python
"safety_rules": [
    "Always recommend consulting a doctor for any medical queries.",
    "Never suggest supplements without professional advice.",
]
```

### 📐 Response Format
```python
"response_format": {
    "use_emojis": False,          # turn off emojis
    "include_calories": True,
    "language": "Hindi",          # change response language
}
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Serve the web app |
| `POST` | `/api/chat` | Send a message to NutriBot |
| `POST` | `/api/nutrition-plan` | Generate a 7-day meal plan |
| `POST` | `/api/calorie-analysis` | Analyse food nutrition |
| `POST` | `/api/meal-suggestion` | Get meal suggestions |
| `POST` | `/api/bmi` | Calculate BMI + get advice |
| `POST` | `/api/family-plan` | Generate family nutrition plan |
| `GET`  | `/api/greeting` | Get NutriBot's greeting |
| `GET`  | `/api/health` | App health check |

### Example: Chat API

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What should I eat for breakfast?",
    "profile": {"age": 30, "gender": "female", "diet_type": "Vegetarian", "goal": "weight loss"},
    "conversation": []
  }'
```

---

## 🌐 Deployment

### Deploy to IBM Cloud (Code Engine)

```bash
# Build container
docker build -t nutribot .

# Push to IBM Container Registry
ibmcloud login
ibmcloud cr login
docker tag nutribot us.icr.io/<your-namespace>/nutribot
docker push us.icr.io/<your-namespace>/nutribot

# Deploy to Code Engine
ibmcloud ce application create \
  --name nutribot \
  --image us.icr.io/<your-namespace>/nutribot \
  --env-from-secret nutribot-secrets
```

### Deploy to Heroku

```bash
heroku create nutribot-app
heroku config:set IBM_CLOUD_API_KEY=xxx WATSONX_PROJECT_ID=xxx FLASK_SECRET_KEY=xxx
git push heroku main
```

### Deploy with Docker

```bash
docker build -t nutribot .
docker run -p 5000:5000 --env-file .env nutribot
```

---

## 🐳 Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `IBM_CLOUD_API_KEY is not set` | Open `.env` and add your real API key |
| `WATSONX_PROJECT_ID is not set` | Get your project ID from IBM Watsonx.ai dashboard |
| `401 Unauthorized` | API key is incorrect or expired — regenerate it |
| `404 Model not found` | Check `WATSONX_MODEL_ID` — use `ibm/granite-3-8b-instruct` |
| `Connection refused` | Ensure IBM Cloud URL matches your region |
| Chat returns blank | Increase `MAX_TOKENS` in `.env` |

---

## 📦 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `IBM_CLOUD_API_KEY` | — | **Required.** IBM Cloud API key |
| `IBM_CLOUD_URL` | `https://us-south.ml.cloud.ibm.com` | IBM Cloud region URL |
| `WATSONX_PROJECT_ID` | — | **Required.** Watsonx.ai project ID |
| `WATSONX_MODEL_ID` | `ibm/granite-3-8b-instruct` | Granite model to use |
| `MAX_TOKENS` | `1200` | Max tokens per response |
| `TEMPERATURE` | `0.7` | Creativity (0.0–1.0) |
| `FLASK_SECRET_KEY` | — | Flask session secret |
| `FLASK_DEBUG` | `True` | Debug mode (set False in production) |
| `PORT` | `5000` | Server port |

---

## 🙏 Tech Stack

- **Backend**: Python 3.11 · Flask 3.0 · Flask-CORS
- **AI**: IBM Watsonx.ai · Granite-3-8b-instruct
- **Frontend**: Bootstrap 5.3 · Bootstrap Icons · Vanilla JS (ES6+)
- **Fonts**: Google Inter
- **Deployment**: Gunicorn · Docker compatible

---

*NutriBot — Your AI Nutrition Coach · Built with ❤️ using IBM Watsonx.ai*
