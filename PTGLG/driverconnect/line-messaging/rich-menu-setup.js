/**
 * LINE Rich Menu Management for DriverConnect
 * Creates dynamic rich menus based on driver status
 *
 * Prerequisites:
 * - LINE OA with Messaging API enabled
 * - Server-side execution (Node.js)
 */

import axios from 'axios';

const LINE_API_URL = 'https://api.line.me/v2/bot';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

/**
 * Rich Menu Definitions
 */
const RICH_MENUS = {
  idle: {
    size: { width: 2500, height: 1686 },
    name: 'Driver Menu - Idle',
    chatBarText: 'เมนูคนขับ',
    chatBarTextSize: 'compact',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=today_jobs&source=richmenu',
          label: 'งานวันนี้',
          text: 'งานวันนี้'
        }
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: {
          type: 'uri',
          uri: process.env.LIFF_APP_URL,
          label: 'เปิดแอป'
        }
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=my_performance&source=richmenu',
          label: 'ผลงานของฉัน',
          text: 'ผลงานของฉัน'
        }
      },
      {
        bounds: { x: 0, y: 843, width: 1250, height: 843 },
        action: {
          type: 'postback',
          data: 'action=report_issue&source=richmenu',
          label: 'รายงานปัญหา',
          text: 'รายงานปัญหา'
        }
      },
      {
        bounds: { x: 1250, y: 843, width: 1250, height: 843 },
        action: {
          type: 'postback',
          data: 'action=contact_support&source=richmenu',
          label: 'ติดต่อแอดมิน',
          text: 'ติดต่อแอดมิน'
        }
      }
    ]
  },

  active_trip: {
    size: { width: 2500, height: 1686 },
    name: 'Driver Menu - Active Trip',
    chatBarText: 'กำลังทำงาน',
    chatBarTextSize: 'compact',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: {
          type: 'postback',
          data: 'action=current_trip_status&source=richmenu',
          label: 'สถานะทริป',
          text: 'สถานะทริปปัจจุบัน'
        }
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: {
          type: 'postback',
          data: 'action=view_route&source=richmenu',
          label: 'ดูเส้นทาง',
          text: 'ดูเส้นทาง'
        }
      },
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=next_stop&source=richmenu',
          label: 'จุดถัดไป',
          text: 'จุดถัดไป'
        }
      },
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: {
          type: 'postback',
          data: 'action=report_issue&source=richmenu',
          label: 'รายงานปัญหา',
          text: 'รายงานปัญหา'
        }
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=emergency&source=richmenu',
          label: 'ฉุกเฉิน',
          text: '🆘 ฉุกเฉิน'
        }
      }
    ]
  },

  emergency: {
    size: { width: 2500, height: 1686 },
    name: 'Driver Menu - Emergency',
    chatBarText: '🆘 ฉุกเฉิน',
    chatBarTextSize: 'compact',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 2500, height: 1686 },
        action: {
          type: 'postback',
          data: 'action=ergency_triggered&source=richmenu',
          label: 'กดแจ้งฉุกเฉิน',
          text: '🆘 ฉุกเฉิน! ต้องการความช่วยเหลือด่วน'
        }
      }
    ]
  }
};

/**
 * Create Rich Menu
 */
async function createRichMenu(menuConfig) {
  try {
    const response = await axios.post(
      `${LINE_API_URL}/richmenu`,
      menuConfig,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    return response.data.richMenuId;
  } catch (error) {
    console.error('Error creating rich menu:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Upload Rich Menu Image
 * @param {string} richMenuId - Rich menu ID
 * @param {Buffer} imageBuffer - Image buffer (PNG or JPEG)
 * @param {string} imagePath - Path to image file
 */
async function uploadRichMenuImage(richMenuId, imagePath) {
  const fs = require('fs');
  const formData = new FormData();

  formData.append('file', fs.createReadStream(imagePath));

  try {
    await axios.post(
      `${LINE_API_URL}/richmenu/${richMenuId}/content`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    console.log(`✅ Image uploaded for rich menu: ${richMenuId}`);
  } catch (error) {
    console.error('Error uploading rich menu image:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Set Rich Menu for Specific User
 */
async function setUserRichMenu(userId, richMenuId) {
  try {
    await axios.post(
      `${LINE_API_URL}/user/${userId}/richmenu/${richMenuId}`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    console.log(`✅ Rich menu set for user ${userId}: ${richMenuId}`);
  } catch (error) {
    console.error('Error setting user rich menu:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Set Default Rich Menu (for all users)
 */
async function setDefaultRichMenu(richMenuId) {
  try {
    await axios.post(
      `${LINE_API_URL}/user/all/richmenu/${richMenuId}`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    console.log(`✅ Default rich menu set: ${richMenuId}`);
  } catch (error) {
    console.error('Error setting default rich menu:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get All Rich Menus
 */
async function getAllRichMenus() {
  try {
    const response = await axios.get(
      `${LINE_API_URL}/richmenu/list`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    return response.data.richmenus;
  } catch (error) {
    console.error('Error getting rich menus:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Delete Rich Menu
 */
async function deleteRichMenu(richMenuId) {
  try {
    await axios.delete(
      `${LINE_API_URL}/richmenu/${richMenuId}`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    console.log(`✅ Rich menu deleted: ${richMenuId}`);
  } catch (error) {
    console.error('Error deleting rich menu:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update Driver Rich Menu Based on Status
 * This function should be called whenever driver status changes
 */
async function updateDriverRichMenu(lineUserId, driverStatus) {
  const menuMap = {
    'idle': 'rich-menu-idle-id',
    'active_trip': 'rich-menu-active-id',
    'emergency': 'rich-menu-emergency-id'
  };

  const richMenuId = menuMap[driverStatus] || menuMap.idle;

  try {
    await setUserRichMenu(lineUserId, richMenuId);
    console.log(`✅ Updated rich menu for driver ${lineUserId} to ${driverStatus}`);
  } catch (error) {
    console.error(`❌ Failed to update rich menu:`, error.message);
  }
}

/**
 * Setup All Rich Menus
 * Run this once to create all rich menus
 */
async function setupAllRichMenus() {
  console.log('🎨 Setting up LINE Rich Menus for DriverConnect...\n');

  // Create each rich menu
  for (const [key, config] of Object.entries(RICH_MENUS)) {
    try {
      console.log(`Creating rich menu: ${config.name}...`);

      // Create rich menu
      const richMenuId = await createRichMenu(config);
      console.log(`  ✅ Created with ID: ${richMenuId}`);

      // Upload image (you need to create images first)
      // Uncomment when you have images ready:
      // await uploadRichMenuImage(richMenuId, `./rich-menu-images/${key}.png`);

      // Store ID in environment variables or database
      console.log(`  ⚠️  Update your .env: RICH_MENU_${key.toUpperCase()}_ID=${richMenuId}`);

    } catch (error) {
      console.error(`  ❌ Failed to create ${key}:`, error.message);
    }
  }

  console.log('\n✅ Rich menu setup complete!');
}

/**
 * Main execution
 */
if (require.main === module) {
  setupAllRichMenus()
    .then(() => {
      console.log('\n✅ All rich menus created successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    });
}

export {
  createRichMenu,
  uploadRichMenuImage,
  setUserRichMenu,
  setDefaultRichMenu,
  getAllRichMenus,
  deleteRichMenu,
  updateDriverRichMenu,
  RICH_MENUS
};
