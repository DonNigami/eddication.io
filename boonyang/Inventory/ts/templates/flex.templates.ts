/**
 * Flex Message Templates
 * LINE Flex message builders for Boonyang Inventory
 * Reference: flex.js from Google Apps Script
 */

import { LineMessageOut } from '../types';

export function flexRegister(
  pictureUrl: string,
  displayName: string,
  name: string,
  surname: string,
  shopname: string,
  taxid: string
): LineMessageOut {
  return {
    type: 'flex',
    altText: 'New Register',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ลงทะเบียนเสร็จสมบูรณ์',
            wrap: true,
            align: 'center',
            weight: 'bold',
            color: '#ffffff',
            size: 'lg',
          },
        ],
        backgroundColor: '#00BFA5',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่เมนูต่างๆ',
            color: '#222222',
            weight: 'bold',
            size: 'md',
            align: 'center',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'image',
                url: pictureUrl,
                size: 'sm',
                aspectMode: 'cover',
                align: 'center',
              },
            ],
            margin: 'xxl',
            cornerRadius: '50px',
            borderWidth: '1px',
            borderColor: '#22222220',
            height: '60px',
            width: '60px',
            offsetStart: '85px',
            offsetEnd: '85px',
          },
          {
            type: 'text',
            text: displayName,
            weight: 'bold',
            size: 'lg',
            margin: 'md',
            align: 'center',
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: taxid,
                size: 'sm',
                color: '#666666',
                wrap: true,
                align: 'center',
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: 'https://cdn4.iconfinder.com/data/icons/e-commerce-icon-set/48/Username-512.png',
              },
              {
                type: 'text',
                text: 'ชื่อ',
                weight: 'bold',
                margin: 'md',
                flex: 0,
                color: '#aaaaaa',
              },
              {
                type: 'text',
                text: `${name} ${surname}`,
                margin: 'md',
              },
            ],
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: 'https://cdn2.iconfinder.com/data/icons/basic-ui-element-2-2-blackfill/512/Basic_UI_Elements_-_2.2_-_Black_Fill-48-512.png',
              },
              {
                type: 'text',
                text: 'ชื่อร้าน',
                weight: 'bold',
                margin: 'md',
                flex: 0,
                color: '#aaaaaa',
              },
              {
                type: 'text',
                text: shopname,
                margin: 'md',
              },
            ],
            margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'แก้ไขใหม่',
              text: 'ลงทะเบียน',
            },
            color: '#ffb62b',
          },
        ],
        flex: 0,
      },
    },
  };
}

export function ansFlex(icon: string, preAns: string, ans: string): LineMessageOut {
  return {
    type: 'flex',
    altText: 'register',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: icon,
              },
              {
                type: 'text',
                text: preAns,
                margin: 'md',
                wrap: true,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png',
              },
              {
                type: 'text',
                text: ans,
                margin: 'md',
                wrap: true,
                weight: 'bold',
              },
            ],
            margin: 'md',
          },
        ],
      },
    },
  };
}

export function createSearchResultCarousel(items: Array<{
  name: string;
  stock: number;
  status: string;
}>): LineMessageOut {
  const maxButtonsPerBubble = 12;

  const chunks = [];
  for (let i = 0; i < items.length; i += maxButtonsPerBubble) {
    chunks.push(items.slice(i, i + maxButtonsPerBubble));
  }

  const buttons = items.map((item) => {
    const stockColor = item.stock >= 4 ? '#00BFA5' : '#FF1744';
    const stockIcon = item.stock >= 4 ? '✅' : '☎️';

    let label = item.name;
    if (label.length > 30) {
      label = label.substring(0, 30) + '...';
    }

    return {
      type: 'button',
      action: {
        type: 'message',
        label: `${stockIcon} ${label}`,
        text: item.name,
      },
      style: 'primary',
      color: stockColor,
      margin: 'sm',
      height: 'sm',
    };
  });

  const bubbles = chunks.map((chunk, index) => {
    const startIdx = index * maxButtonsPerBubble + 1;
    const endIdx = Math.min(startIdx + chunk.length - 1, items.length);

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🔍 ผลการค้นหา',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
            align: 'center',
          },
          {
            type: 'text',
            text:
              chunks.length > 1
                ? `รายการที่ ${startIdx}-${endIdx} จาก ${items.length}`
                : `พบ ${items.length} รายการ`,
            color: '#ffffff',
            size: 'xs',
            align: 'center',
            margin: 'md',
          },
        ],
        backgroundColor: '#00BFA5',
        paddingAll: 'md',
        cornerRadius: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เลือกรายการที่ต้องการดูสถานะ:',
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: buttons,
            margin: 'lg',
          },
        ],
        paddingAll: 'sm',
      },
    };
  });

  if (bubbles.length === 1) {
    return {
      type: 'flex',
      altText: `พบ ${items.length} รายการ - เลือกรายการที่ต้องการ`,
      contents: bubbles[0],
    };
  }

  return {
    type: 'flex',
    altText: `พบ ${items.length} รายการ - เลือกรายการที่ต้องการ (${bubbles.length} หน้า)`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}
