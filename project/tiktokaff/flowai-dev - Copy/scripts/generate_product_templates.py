import os
from pathlib import Path

ROOT = Path(r"d:\VS_Code_GitHub_DATA\eddication.io\eddication.io\project\tiktokaff\flowai-dev - Copy")
OUT_DIR = ROOT / "examples" / "extend-prompts"

CATEGORIES = [
    ("skincare_facial", "Skincare: Facial"),
    ("skincare_sunscreen", "Skincare: Sunscreen"),
    ("skincare_serum", "Skincare: Serum"),
    ("skincare_moisturizer", "Skincare: Moisturizer"),
    ("makeup_foundation", "Makeup: Foundation"),
    ("makeup_lipstick", "Makeup: Lipstick"),
    ("makeup_eyeliner", "Makeup: Eyeliner"),
    ("hair_shampoo", "Hair: Shampoo"),
    ("hair_treatment", "Hair: Treatment"),
    ("fragrance_perfume", "Fragrance: Perfume"),
    ("men_grooming", "Men: Grooming"),
    ("fitness_wear", "Fitness: Wear"),
    ("supplements_vitamins", "Supplements: Vitamins"),
    ("kitchen_blender", "Kitchen: Blender"),
    ("kitchen_airfryer", "Kitchen: Air Fryer"),
    ("cookware_pan", "Cookware: Nonstick Pan"),
    ("storage_organizer", "Home: Storage Organizer"),
    ("cleaning_spray", "Cleaning: Spray"),
    ("home_decor", "Home: Decor"),
    ("bedding_set", "Home: Bedding Set"),
    ("furniture_desk", "Furniture: Desk"),
    ("lighting_led", "Lighting: LED Lamp"),
    ("air_purifier", "Home: Air Purifier"),
    ("pet_supplies", "Pet: Supplies"),
    ("baby_diapers", "Baby: Diapers"),
    ("toys_educational", "Toys: Educational"),
    ("stationery_notebook", "Stationery: Notebook"),
    ("smartphone", "Electronics: Smartphone"),
    ("laptop", "Electronics: Laptop"),
    ("tablet", "Electronics: Tablet"),
    ("smartwatch", "Electronics: Smartwatch"),
    ("earbuds", "Electronics: Earbuds"),
    ("speaker", "Electronics: Speaker"),
    ("gaming_mouse", "Gaming: Mouse"),
    ("camera_action", "Camera: Action Cam"),
    ("accessories_powerbank", "Accessories: Powerbank"),
    ("accessories_charger", "Accessories: Charger"),
    ("accessories_cable", "Accessories: Cable"),
    ("accessories_case", "Accessories: Case"),
    ("accessories_screen", "Accessories: Screen Protector"),
    ("womens_dress", "Fashion: Women Dress"),
    ("womens_top", "Fashion: Women Top"),
    ("mens_shirt", "Fashion: Men Shirt"),
    ("shoes_sneakers", "Fashion: Sneakers"),
    ("bags_backpack", "Fashion: Backpack"),
    ("jewelry_necklace", "Jewelry: Necklace"),
    ("watch_fashion", "Watch: Fashion"),
    ("outdoor_camping", "Outdoor: Camping"),
    ("auto_accessories", "Automotive: Accessories"),
    ("tools_hand", "Tools: Hand Tools"),
]

TEMPLATES = {
    "Skincare": [
        ("ทาแล้วซึมไว ไม่เหนอะหนะ", "Close-up texture; smooth spread; glow finish."),
        ("ล้างสะอาด แต่ไม่แห้งตึง", "Gentle foam cleanse; fresh face."),
        ("กันแดด SPF50 PA+++ ใช้ทุกวัน", "SPF application; even coverage."),
        ("เซรั่มเข้มข้น จุดด่างดูจางลง", "Serum drop; pat-in; absorb fast."),
        ("ผิวเด้ง อิ่มน้ำทั้งวัน", "Moisturizer; bouncy hydration."),
        ("มาร์คเร็ว ผิวฟูขึ้น", "Sheet mask; dewy result."),
        ("โทนเนอร์สมดุล ลดมันทีโซน", "Toner clarify; soothed look."),
        ("ใต้ตาสว่าง เนียนขึ้น", "Eye cream dab; bright under-eye."),
        ("ก่อนนอนทาบาง ตื่นมาหน้านุ่ม", "Night cream; calm tone."),
        ("แต้มสิวเล็ก ยุบไว", "Spot care; targeted calm."),
        ("ผิวดูใสขึ้นสม่ำเสมอ", "Brightening glide; even tone."),
        ("ผิวแพ้ง่ายใช้ได้ ไม่ระคายเคือง", "Minimal fragrance; comfort."),
        ("คุมมันดี แต่งหน้าติดทน", "Oil-control gel; matte."),
        ("มือชุ่มชื้น ไม่เหนียว", "Hand cream; soft touch."),
        ("ปากนุ่ม ไม่แห้งเป็นขุย", "Lip balm; smooth layer."),
    ],
    "IT": [
        ("ภาพคมชัด โฟกัสไว", "Camera test; quick focus; crisp detail."),
        ("แบตอึด ใช้ทั้งวัน", "Battery life; lasting."),
        ("ชาร์จไว ไม่ต้องรอ", "Fast charge; quick climb."),
        ("ลื่นไหล ทำงานไม่สะดุด", "Laptop multitask; quiet fan."),
        ("พิมพ์นุ่ม มือไม่ล้า", "Keyboard feel; backlight."),
        ("เสียงใส ใส่สบาย", "Earbuds; clear call."),
        ("ดูแจ้งเตือนสะดวก", "Smartwatch glance; metrics."),
        ("กันสั่นดี ภาพนิ่ง", "Action cam; stabilization."),
        ("เขียนลื่น ลายเส้นสวย", "Tablet stylus; palm rejection."),
        ("สัญญาณแรง ครอบคลุมบ้าน", "Router; steady speed."),
        ("โอนไว พกสะดวก", "SSD; fast copy."),
        ("ต่อครบ ใช้ง่าย", "USB-C hub; tidy desk."),
        ("สีตรง มุมมองกว้าง", "Monitor sRGB; wide angles."),
        ("ควบคุมแม่น ตอบไว", "Gaming mouse; DPI switch."),
        ("กันตกดี จับถนัด", "Phone case; tactile buttons."),
    ],
    "Home": [
        ("ดูดแรง ทำความสะอาดเร็ว", "Vacuum; strong suction."),
        ("อากาศสะอาด หายใจโล่ง", "Air purifier; quiet mode."),
        ("ข้าวนุ่ม หอม", "Rice cooker; fluffy grains."),
        ("ไม่ติดกระทะ ล้างง่าย", "Nonstick pan; even heat."),
        ("เก็บเป็นระเบียบ หยิบง่าย", "Storage box; tidy shelf."),
        ("แสงสบายตา", "LED lamp; minimal glare."),
        ("ลมเย็น เงียบ", "Fan; quiet spin."),
        ("น้ำสะอาด รสชาติดี", "Water filter; safe drink."),
        ("ขนย้ายสะดวก", "Laundry basket; easy carry."),
        ("เช็ดแห้งไว ไม่เป็นคราบ", "Microfiber cloth; streak-free."),
        ("นอนสบาย หลับลึก", "Bedding set; cozy sleep."),
        ("น้ำไหลดี แห้งเร็ว", "Dish rack; airy drain."),
        ("ไม่มีกลิ่นรบกวน", "Trash bin; sealed."),
        ("กันฝุ่นเข้า บ้านสะอาด", "Door mat; mud trap."),
        ("ซ่อมง่าย มีครบ", "Tool kit; compact."),
    ],
}

def build_prompts(category_key: str):
    # Choose base template group by category family
    if category_key.startswith("skincare") or category_key.startswith("makeup"):
        base = TEMPLATES["Skincare"]
    elif category_key.startswith("hair") or category_key.startswith("fragrance") or category_key.startswith("men_"):
        base = TEMPLATES["Skincare"]
    elif category_key.startswith("smart") or category_key in {"smartphone","laptop","tablet","smartwatch","earbuds","speaker","gaming_mouse","camera_action"} or category_key.startswith("accessories") or category_key.startswith("router"):
        base = TEMPLATES["IT"]
    elif category_key.startswith("kitchen") or category_key.startswith("cookware") or category_key.startswith("storage") or category_key.startswith("cleaning") or category_key.startswith("home") or category_key.startswith("bedding") or category_key.startswith("lighting") or category_key.startswith("air_") or category_key.startswith("pet") or category_key.startswith("baby") or category_key.startswith("toys") or category_key.startswith("stationery") or category_key.startswith("furniture") or category_key.startswith("tools"):
        base = TEMPLATES["Home"]
    else:
        base = TEMPLATES["IT"]

    prompts = []
    for speech, eng in base:
        prompts.append(f"{eng} Speech: \"{speech}\". No text on screen. No Captions.")
    return prompts

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for key, label in CATEGORIES:
        filename = OUT_DIR / f"product_{key}_speech_15.csv"
        prompts = build_prompts(key)
        with open(filename, "w", encoding="utf-8") as f:
            f.write("\n".join(prompts))
    print(f"Generated {len(CATEGORIES)} CSV files in {OUT_DIR}")

if __name__ == "__main__":
    main()
