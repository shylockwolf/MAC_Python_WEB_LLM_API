const testKimiViaLocalProxy = async () => {
  const invokeUrl = 'http://localhost:3001/api/kimi/v1/chat/completions';

  const headers = {
    'Content-Type': 'application/json'
  };

  const payload = {
    'model': 'moonshotai/kimi-k2.5',
    'messages': [{ 'role': 'user', 'content': '你好，请简单介绍一下你自己' }],
    'max_tokens': 16384,
    'temperature': 1.00,
    'top_p': 1.00,
    'stream': false,
    'chat_template_kwargs': { 'thinking': true }
  };

  try {
    console.log('Sending request to Kimi API via local proxy...');
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

testKimiViaLocalProxy();