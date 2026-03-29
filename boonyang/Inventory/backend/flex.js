function flexRegister(pictureUrl , displayName , name , surname ,shopname ,taxid) {
  const flex = {"type": "flex","altText":"New Register","contents": {
  "type": "bubble",
  "size": "kilo",
  "header": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "ลงทะเบียนเสร็จสมบูรณ์",
        "wrap": true,
        "align": "center",
        "weight": "bold",
        "color": "#ffffff",
        "size": "lg"
      }
    ],
    "backgroundColor": "#00BFA5"
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "ยินดีต้อนรับสู่เมนูต่างๆ",
        "color": "#222222",
        "weight": "bold",
        "size": "md",
        "align": "center"
      },
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "image",
            "url": "" + pictureUrl,
            "size": "sm",
            "aspectMode": "cover",
            "align": "center"
          }
        ],
        "margin": "xxl",
        "cornerRadius": "50px",
        "borderWidth": "1px",
        "borderColor": "#22222220",
        "height": "60px",
        "width": "60px",
        "offsetStart": "85px",
        "offsetEnd": "85px"
      },
      {
        "type": "text",
        "text": "" + displayName,
        "weight": "bold",
        "size": "lg",
        "margin": "md",
        "align": "center"
      },
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          {
            "type": "text",
            "text": "" + taxid,
            "size": "sm",
            "color": "#666666",
            "wrap": true,
            "align": "center"
          }
        ]
      },
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          {
            "type": "icon",
            "url": "https://cdn4.iconfinder.com/data/icons/e-commerce-icon-set/48/Username-512.png"
          },
          {
            "type": "text",
            "text": "ชื่อ",
            "weight": "bold",
            "margin": "md",
            "flex": 0,
            "color": "#aaaaaa"
          },
          {
            "type": "text",
            "text": name +" " + surname,
            "margin": "md"
          }
        ],
        "margin": "md"
      },
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          {
            "type": "icon",
            "url": "https://cdn2.iconfinder.com/data/icons/basic-ui-element-2-2-blackfill/512/Basic_UI_Elements_-_2.2_-_Black_Fill-48-512.png"
          },
          {
            "type": "text",
            "text": "ชื่อร้าน",
            "weight": "bold",
            "margin": "md",
            "flex": 0,
            "color": "#aaaaaa"
          },
          {
            "type": "text",
            "text": "" + shopname,
            "margin": "md"
          }
        ],
        "margin": "md"
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [
      {
        "type": "button",
        "style": "secondary",
        "height": "sm",
        "action": {
          "type": "message",
          "label": "แก้ไขใหม่",
          "text": "ลงทะเบียน"
        },
        "color": "#ffb62b"
      }
    ],
    "flex": 0
  }
}
  }
  return flex
}

function ansFlex(icon , preAns , ans){
  const flex = {"type": "flex","altText":"register","contents": {
  "type": "bubble",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          {
            "type": "icon",
            "url": "" + icon
          },
          {
            "type": "text",
            "text": "" + preAns,
            "margin": "md",
            "wrap": true
          }
        ]
      },
      {
        "type": "box",
        "layout": "baseline",
        "contents": [
          {
            "type": "icon",
            "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png"
          },
          {
            "type": "text",
            "text": "" + ans,
            "margin": "md",
            "wrap": true,
            "weight": "bold"
          }
        ],
        "margin": "md"
      }
    ]
  }
}
  }
  return flex
}

// ✅ Bubble with Multiple Buttons Template สำหรับ Search Result
// 1 bubble = หลายปุ่ม (แต่ละปุ่ม = ชื่อสินค้า)
function createSearchResultCarousel(items) {
  const maxButtonsPerBubble = 12;

  // ✅ แบ่ง items เป็นกลุ่มๆ ละ 12 รายการ
  const chunks = [];
  for (let i = 0; i < items.length; i += maxButtonsPerBubble) {
    chunks.push(items.slice(i, i + maxButtonsPerBubble));
  }

  Logger.log(`📦 Creating ${chunks.length} bubble(s) from ${items.length} items`);

  // ✅ Helper: สร้าง buttons จาก items
  function createButtons(itemList) {
    return itemList.map((item) => {
      const stockColor = item.stock >= 4 ? '#00BFA5' : '#FF1744';
      const stockIcon = item.stock >= 4 ? '✅' : '☎️';

      // ✅ ปรับ label ให้สั้นลง (เฉพาะส่วนที่จำเป็น)
      // ถ้ามี " : " → แสดง SKU + ชื่อสินค้า (ย่อ)
      // เช่น "001-01-NH112-P-SIL : CIVIC FD (06-11)" → "001...P-SIL : CIVIC FD..."
      let label = item.name;
      if (label.includes(' : ')) {
        const parts = label.split(' : ');
        const sku = parts[0].trim();
        const desc = parts[1].trim();

        // SKU: เอา 8 ตัวแรก + "..." + 7 ตัวสุดท้าย (ถ้ายาวเกิน 20 ตัว)
        let shortSku = sku;
        if (sku.length > 20) {
          shortSku = sku.substring(0, 8) + '...' + sku.substring(sku.length - 7);
        }

        // Description: เอา 20 ตัวอักษรแรก
        let shortDesc = desc;
        if (desc.length > 20) {
          shortDesc = desc.substring(0, 20) + '...';
        }

        label = `${shortSku} : ${shortDesc}`;
      } else {
        // ไม่มี " : " → เอา 30 ตัวอักษรแรก
        if (label.length > 30) {
          label = label.substring(0, 30) + '...';
        }
      }

      return {
        type: "button",
        action: {
          type: "message",
          label: `${stockIcon} ${label}`, // แสดงชื่อย่อในปุ่ม
          text: item.name // ส่งชื่อสินค้าเต็มกลับมาค้นหา
        },
        style: "primary",
        color: stockColor,
        margin: "sm",
        height: "sm"
      };
    });
  }

  // ✅ Helper: สร้าง bubble จาก items และ index
  function createBubble(itemList, bubbleIndex) {
    const startIdx = bubbleIndex * maxButtonsPerBubble + 1;
    const endIdx = Math.min(startIdx + itemList.length - 1, items.length);

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🔍 ผลการค้นหา",
            weight: "bold",
            color: "#ffffff",
            size: "md",
            align: "center"
          },
          {
            type: "text",
            text: chunks.length > 1
              ? `รายการที่ ${startIdx}-${endIdx} จาก ${items.length}`
              : `พบ ${items.length} รายการ`,
            color: "#ffffff",
            size: "xs",
            align: "center",
            margin: "md"
          }
        ],
        backgroundColor: "#00BFA5",
        paddingAll: "md",
        cornerRadius: "md"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "เลือกรายการที่ต้องการดูสถานะ:",
            size: "sm",
            color: "#666666",
            margin: "md",
            wrap: true
          },
          {
            type: "box",
            layout: "vertical",
            contents: createButtons(itemList),
            margin: "lg"
          }
        ],
        paddingAll: "sm"
      },
      footer: {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: chunks.length > 1
              ? `💡 Bubble ${bubbleIndex + 1}/${chunks.length} - กดปุ่มเพื่อดูสถานะ`
              : "💡 กดปุ่มเพื่อดูสถานะสินค้า",
            size: "xxs",
            color: "#999999",
            align: "center",
            wrap: true
          }
        ],
        paddingAll: "sm",
        backgroundColor: "#F5F5F5"
      }
    };
  }

  // ✅ สร้าง bubbles ทั้งหมด
  const bubbles = chunks.map((chunk, index) => createBubble(chunk, index));

  // ✅ ถ้ามี bubble เดียว → ส่ง single bubble
  if (bubbles.length === 1) {
    return {
      type: "flex",
      altText: `พบ ${items.length} รายการ - เลือกรายการที่ต้องการ`,
      contents: bubbles[0]
    };
  }

  // ✅ ถ้ามีหลาย bubbles → ส่ง carousel
  return {
    type: "flex",
    altText: `พบ ${items.length} รายการ - เลือกรายการที่ต้องการ (${bubbles.length} หน้า)`,
    contents: {
      type: "carousel",
      contents: bubbles
    }
  };
}
