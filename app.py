"""
╔══════════════════════════════════════════════════════════════════╗
║         IBM Watsonx.ai — AI Nutrition Agent (Flask Backend)      ║
║         Model: IBM Granite-3-8b-instruct                         ║
╚══════════════════════════════════════════════════════════════════╝
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─────────────────────────────────────────────────────────────────
#  LOAD ENVIRONMENT
# ─────────────────────────────────────────────────────────────────
load_dotenv()

# ─────────────────────────────────────────────────────────────────
#  LOGGING
# ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
#  FLASK APP
# ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutrition-agent-secret-2024")
CORS(app)

# ─────────────────────────────────────────────────────────────────
#  ╔══════════════════════════════════════════════════════════════╗
#  ║                   AGENT INSTRUCTIONS                         ║
#  ║  Customize the agent's persona, tone, specializations,       ║
#  ║  safety rules, and Indian food preferences here.             ║
#  ╚══════════════════════════════════════════════════════════════╝
# ─────────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = {

    # ── Persona & Tone ──────────────────────────────────────────
    "persona": (
        "You are NutriBot, a warm, knowledgeable, and encouraging AI Nutrition Coach "
        "powered by IBM Watsonx Granite. You communicate in a friendly yet professional tone. "
        "You are patient, empathetic, and always celebrate small wins with the user."
    ),

    # ── Core Specializations ────────────────────────────────────
    "specializations": [
        "Personalized meal planning for Indian & global cuisines",
        "Calorie counting and macronutrient analysis",
        "Weight management (loss, gain, and maintenance)",
        "Diabetes-friendly and heart-healthy diet recommendations",
        "Vegetarian, vegan, and Jain diet planning",
        "Family nutrition planning including children and seniors",
        "Sports nutrition and pre/post-workout meal plans",
        "Pregnancy and lactation nutrition guidance",
        "Intermittent fasting and detox diet plans",
        "Festival and occasion-specific healthy eating tips",
    ],

    # ── Indian Food Preferences ──────────────────────────────────
    "indian_food_preferences": {
        "staples": ["Rice", "Roti", "Dal", "Sabzi", "Curd/Yogurt", "Pulses", "Millets (Bajra, Jowar, Ragi)"],
        "healthy_swaps": {
            "White rice": "Brown rice or millets",
            "Maida": "Whole wheat flour or besan",
            "Full-fat ghee in excess": "Measured ghee (1 tsp) or cold-pressed oils",
            "Fried snacks": "Roasted makhana, chana, or sprout chaat",
            "Sugary chai": "Herbal tea or low-sugar masala chai",
        },
        "regional_cuisines": [
            "North Indian", "South Indian", "Bengali", "Gujarati",
            "Maharashtrian", "Rajasthani", "Punjabi", "Kerala",
        ],
        "preferred_proteins": [
            "Paneer", "Lentils (Masoor/Moong/Chana dal)",
            "Eggs", "Tofu", "Chicken (grilled/boiled)", "Fish",
            "Soya chunks", "Rajma", "Chole",
        ],
        "superfoods": [
            "Turmeric", "Amla", "Ashwagandha", "Moringa", "Methi",
            "Curry leaves", "Tulsi", "Chia seeds", "Flaxseeds",
        ],
    },

    # ── Diet Specialization Rules ────────────────────────────────
    "diet_rules": {
        "vegetarian": "Never suggest meat, poultry, seafood, or gelatin.",
        "vegan": "Avoid all animal products including dairy and eggs.",
        "jain": "Avoid root vegetables (onion, garlic, potato, carrot, beetroot), meat, eggs.",
        "diabetic": "Suggest low-GI foods. Limit refined carbs and sugar. Include fibre-rich foods.",
        "heart_healthy": "Limit saturated fat and sodium. Emphasize omega-3s and antioxidants.",
        "weight_loss": "Create a moderate caloric deficit (300-500 kcal/day). High protein and fibre.",
        "weight_gain": "Caloric surplus of 300-500 kcal. Balanced macros with muscle-building focus.",
        "keto": "High fat (70%), moderate protein (25%), very low carbs (<5%). No grains or sugar.",
        "gluten_free": "Avoid wheat, barley, rye. Suggest rice, millets, quinoa alternatives.",
    },

    # ── Safety Rules (NEVER violate these) ──────────────────────
    "safety_rules": [
        "NEVER prescribe medications or supplements as treatment for diseases.",
        "ALWAYS recommend consulting a registered dietitian or doctor for medical conditions.",
        "NEVER give advice that could be harmful to pregnant women, children, or elderly without medical caveats.",
        "NEVER promote extreme calorie restriction below 1200 kcal/day for women or 1500 kcal/day for men.",
        "ALWAYS include allergen warnings when suggesting common allergens (nuts, dairy, gluten, shellfish).",
        "NEVER make claims that food can cure, treat, or prevent specific diseases.",
        "If a user shows signs of eating disorder, respond with empathy and suggest professional help.",
    ],

    # ── Response Format Preferences ──────────────────────────────
    "response_format": {
        "use_emojis": True,
        "use_bullet_points": True,
        "include_calories": True,
        "include_macros": True,
        "language": "English (with Hindi food names in parentheses where relevant)",
        "max_response_length": "concise but complete — aim for 200-400 words unless a full plan is requested",
    },

    # ── Greeting Behaviour ───────────────────────────────────────
    "greeting": (
        "Namaste! 🙏 I'm NutriBot, your personal AI Nutrition Coach. "
        "I can help you with meal planning, calorie analysis, BMI guidance, "
        "family diet recommendations, and healthy Indian & global recipes. "
        "How can I support your wellness journey today?"
    ),
}

# ─────────────────────────────────────────────────────────────────
#  WATSONX.AI CLIENT INIT
# ─────────────────────────────────────────────────────────────────
def get_watsonx_model():
    """Initialize and return the Watsonx.ai Granite model."""
    api_key    = os.getenv("IBM_CLOUD_API_KEY")
    ibm_url    = os.getenv("IBM_CLOUD_URL", "https://us-south.ml.cloud.ibm.com")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    model_id   = os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-8b-instruct")

    if not api_key or api_key == "your_ibm_cloud_api_key_here":
        raise ValueError("IBM_CLOUD_API_KEY is not set. Please update your .env file.")
    if not project_id or project_id == "your_watsonx_project_id_here":
        raise ValueError("WATSONX_PROJECT_ID is not set. Please update your .env file.")

    credentials = Credentials(url=ibm_url, api_key=api_key)
    client = APIClient(credentials=credentials, project_id=project_id)

    params = {
        GenParams.MAX_NEW_TOKENS: int(os.getenv("MAX_TOKENS", 1200)),
        GenParams.TEMPERATURE:    float(os.getenv("TEMPERATURE", 0.7)),
        GenParams.TOP_P:          float(os.getenv("TOP_P", 0.9)),
        GenParams.TOP_K:          int(os.getenv("TOP_K", 50)),
        GenParams.STOP_SEQUENCES: [],
    }

    model = ModelInference(
        model_id=model_id,
        api_client=client,
        params=params,
        project_id=project_id,
    )
    return model


# ─────────────────────────────────────────────────────────────────
#  PROMPT BUILDER
# ─────────────────────────────────────────────────────────────────
def build_system_prompt(user_profile: dict | None = None) -> str:
    """Construct the full system prompt from AGENT_INSTRUCTIONS."""
    inst = AGENT_INSTRUCTIONS
    specializations = "\n".join(f"  • {s}" for s in inst["specializations"])
    safety_rules    = "\n".join(f"  ⚠ {r}" for r in inst["safety_rules"])
    diet_rules      = "\n".join(f"  [{k}]: {v}" for k, v in inst["diet_rules"].items())
    indian_staples  = ", ".join(inst["indian_food_preferences"]["staples"])
    superfoods      = ", ".join(inst["indian_food_preferences"]["superfoods"])

    profile_section = ""
    if user_profile:
        profile_section = f"""
--- USER PROFILE ---
Name       : {user_profile.get('name', 'User')}
Age        : {user_profile.get('age', 'Unknown')}
Gender     : {user_profile.get('gender', 'Unknown')}
Weight     : {user_profile.get('weight', 'Unknown')} kg
Height     : {user_profile.get('height', 'Unknown')} cm
Goal       : {user_profile.get('goal', 'Healthy eating')}
Diet Type  : {user_profile.get('diet_type', 'Balanced')}
Allergies  : {user_profile.get('allergies', 'None')}
Medical    : {user_profile.get('medical', 'None')}
Activity   : {user_profile.get('activity', 'Moderate')}
--------------------
"""

    return f"""
{inst['persona']}

SPECIALIZATIONS:
{specializations}

INDIAN FOOD FOCUS:
  Staples: {indian_staples}
  Superfoods: {superfoods}

DIET-SPECIFIC RULES:
{diet_rules}

SAFETY RULES (ABSOLUTE):
{safety_rules}

RESPONSE FORMAT:
  - Use emojis: {inst['response_format']['use_emojis']}
  - Use bullet points: {inst['response_format']['use_bullet_points']}
  - Include calorie counts when relevant: {inst['response_format']['include_calories']}
  - Language: {inst['response_format']['language']}
  - Length: {inst['response_format']['max_response_length']}

{profile_section}
Always be helpful, accurate, and safe. When uncertain, recommend consulting a healthcare professional.
""".strip()


def build_full_prompt(system_prompt: str, conversation: list, user_message: str) -> str:
    """Build the full prompt string for Granite instruct models."""
    history = ""
    for turn in conversation[-6:]:          # keep last 6 turns as context
        role    = turn.get("role", "user")
        content = turn.get("content", "")
        if role == "user":
            history += f"User: {content}\n"
        else:
            history += f"NutriBot: {content}\n"

    return (
        f"[SYSTEM]\n{system_prompt}\n\n"
        f"[CONVERSATION HISTORY]\n{history}\n"
        f"[USER]\n{user_message}\n\n"
        f"[NUTRIBOT RESPONSE]\n"
    )


# ─────────────────────────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main application page."""
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Chat endpoint — accepts user message + optional profile + conversation history.
    Returns NutriBot's response.
    """
    try:
        data         = request.get_json(force=True)
        user_message = data.get("message", "").strip()
        user_profile = data.get("profile", {})
        conversation = data.get("conversation", [])

        if not user_message:
            return jsonify({"error": "Message cannot be empty."}), 400

        model         = get_watsonx_model()
        system_prompt = build_system_prompt(user_profile)
        full_prompt   = build_full_prompt(system_prompt, conversation, user_message)

        logger.info("Sending prompt to Watsonx.ai (%d chars)", len(full_prompt))
        response = model.generate_text(prompt=full_prompt)
        bot_reply = response.strip() if response else "I'm sorry, I couldn't generate a response. Please try again."

        return jsonify({
            "reply":     bot_reply,
            "timestamp": datetime.now().isoformat(),
            "model":     os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-8b-instruct"),
        })

    except ValueError as ve:
        logger.error("Configuration error: %s", ve)
        return jsonify({"error": str(ve)}), 503
    except Exception as e:
        logger.error("Chat error: %s", e)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/nutrition-plan", methods=["POST"])
def nutrition_plan():
    """Generate a full 7-day personalized nutrition plan."""
    try:
        data    = request.get_json(force=True)
        profile = data.get("profile", {})
        model   = get_watsonx_model()

        system_prompt = build_system_prompt(profile)
        prompt = (
            f"[SYSTEM]\n{system_prompt}\n\n"
            f"[TASK]\nGenerate a complete 7-day personalized meal plan for the user profile above. "
            f"For each day include Breakfast, Mid-Morning Snack, Lunch, Evening Snack, and Dinner. "
            f"Include approximate calories per meal and daily totals. "
            f"Focus on Indian cuisine but add variety. Format clearly with Day headers.\n\n"
            f"[NUTRIBOT RESPONSE]\n"
        )

        response = model.generate_text(prompt=prompt)
        return jsonify({"plan": response.strip(), "timestamp": datetime.now().isoformat()})

    except Exception as e:
        logger.error("Nutrition plan error: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/calorie-analysis", methods=["POST"])
def calorie_analysis():
    """Analyse calories and macros for a given food/meal description."""
    try:
        data        = request.get_json(force=True)
        food_input  = data.get("food", "").strip()
        model       = get_watsonx_model()

        if not food_input:
            return jsonify({"error": "Food description required."}), 400

        prompt = (
            f"[SYSTEM]\n{build_system_prompt()}\n\n"
            f"[TASK]\nAnalyse the nutritional content of the following food or meal: '{food_input}'. "
            f"Provide: Serving size, Calories (kcal), Protein (g), Carbohydrates (g), Fat (g), "
            f"Fibre (g), Key vitamins & minerals, Healthiness score (1-10), and one healthy swap suggestion. "
            f"Use a table or structured format.\n\n"
            f"[NUTRIBOT RESPONSE]\n"
        )

        response = model.generate_text(prompt=prompt)
        return jsonify({"analysis": response.strip(), "food": food_input})

    except Exception as e:
        logger.error("Calorie analysis error: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/meal-suggestion", methods=["POST"])
def meal_suggestion():
    """Suggest a healthy meal based on preferences."""
    try:
        data        = request.get_json(force=True)
        meal_type   = data.get("meal_type", "lunch")
        diet_type   = data.get("diet_type", "vegetarian")
        calories    = data.get("calories", 400)
        cuisine     = data.get("cuisine", "Indian")
        model       = get_watsonx_model()

        prompt = (
            f"[SYSTEM]\n{build_system_prompt()}\n\n"
            f"[TASK]\nSuggest 3 healthy {meal_type} options for a {diet_type} diet, "
            f"around {calories} calories, {cuisine} cuisine preference. "
            f"For each suggestion include: dish name, ingredients, approximate calories, "
            f"preparation time, and one health benefit. Use clear formatting.\n\n"
            f"[NUTRIBOT RESPONSE]\n"
        )

        response = model.generate_text(prompt=prompt)
        return jsonify({"suggestions": response.strip(), "meal_type": meal_type})

    except Exception as e:
        logger.error("Meal suggestion error: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/bmi", methods=["POST"])
def bmi_analysis():
    """Calculate BMI and provide AI-powered health advice."""
    try:
        data   = request.get_json(force=True)
        weight = float(data.get("weight", 0))
        height = float(data.get("height", 0))
        age    = int(data.get("age", 25))
        gender = data.get("gender", "male")
        model  = get_watsonx_model()

        if weight <= 0 or height <= 0:
            return jsonify({"error": "Valid weight and height required."}), 400

        height_m = height / 100
        bmi      = round(weight / (height_m ** 2), 1)

        if bmi < 18.5:
            category = "Underweight"
        elif bmi < 25.0:
            category = "Normal weight"
        elif bmi < 30.0:
            category = "Overweight"
        else:
            category = "Obese"

        prompt = (
            f"[SYSTEM]\n{build_system_prompt()}\n\n"
            f"[TASK]\nA {age}-year-old {gender} has a BMI of {bmi} ({category}). "
            f"Provide: 1) What this BMI means for their health, 2) Ideal weight range for their height ({height} cm), "
            f"3) 5 specific dietary recommendations, 4) Suggested daily calorie intake, "
            f"5) 3 lifestyle tips. Be encouraging and practical.\n\n"
            f"[NUTRIBOT RESPONSE]\n"
        )

        response = model.generate_text(prompt=prompt)
        return jsonify({
            "bmi":      bmi,
            "category": category,
            "advice":   response.strip(),
            "weight":   weight,
            "height":   height,
        })

    except Exception as e:
        logger.error("BMI error: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/family-plan", methods=["POST"])
def family_plan():
    """Generate a family nutrition plan for multiple members."""
    try:
        data    = request.get_json(force=True)
        members = data.get("members", [])
        model   = get_watsonx_model()

        if not members:
            return jsonify({"error": "Family member data required."}), 400

        members_text = "\n".join(
            f"  • {m.get('name','Member')} | Age: {m.get('age','?')} | "
            f"Gender: {m.get('gender','?')} | Goal: {m.get('goal','Healthy')} | "
            f"Diet: {m.get('diet','Balanced')} | Medical: {m.get('medical','None')}"
            for m in members
        )

        prompt = (
            f"[SYSTEM]\n{build_system_prompt()}\n\n"
            f"[TASK]\nCreate a shared family meal plan for the following family members:\n"
            f"{members_text}\n\n"
            f"Suggest meals that work for most family members, with specific modifications "
            f"where needed (e.g., diabetic-friendly version for seniors, "
            f"high-protein option for active teens). Include a 3-day plan with "
            f"Breakfast, Lunch, Dinner, and snacks. Also note any important "
            f"nutritional considerations for the family.\n\n"
            f"[NUTRIBOT RESPONSE]\n"
        )

        response = model.generate_text(prompt=prompt)
        return jsonify({"family_plan": response.strip(), "member_count": len(members)})

    except Exception as e:
        logger.error("Family plan error: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/greeting", methods=["GET"])
def greeting():
    """Return the agent greeting message."""
    return jsonify({
        "greeting": AGENT_INSTRUCTIONS["greeting"],
        "model":    os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-8b-instruct"),
    })


@app.route("/api/health", methods=["GET"])
def health_check():
    """Application health check."""
    return jsonify({
        "status":    "healthy",
        "app":       "NutriBot — AI Nutrition Agent",
        "model":     os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-8b-instruct"),
        "timestamp": datetime.now().isoformat(),
    })


# ─────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    logger.info("🥗 NutriBot starting on http://localhost:%d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
