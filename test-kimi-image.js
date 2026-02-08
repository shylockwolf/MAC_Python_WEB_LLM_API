const testKimiWithImage = async () => {
  const invokeUrl = 'http://localhost:3001/api/kimi/v1/chat/completions';

  const headers = {
    'Content-Type': 'application/json'
  };

  // 创建一个简单的测试图片 (1x1像素的透明PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const payload = {
    'model': 'moonshotai/kimi-k2.5',
    'messages': [
      {
        'role': 'user',
        'content': [
          {
            'type': 'text',
            'text': '描述这张图片'
          },
          {
            'type': 'image_url',
            'image_url': {
              'url': `data:image/png;base64,${testImageBase64}`
            }
          }
        ]
      }
    ],
    'max_tokens': 16384,
    'temperature': 1.00,
    'top_p': 1.00,
    'stream': false,
    'chat_template_kwargs': { 'thinking': true }
  };

  try {
    console.log('Sending request to Kimi API with image...');
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(invokeUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      return;
    }

    const data = await response.json();
    console.log('Success! Response:', JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices[0]) {
      console.log('Generated text:', data.choices[0].message.content);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};

testKimiWithImage();
